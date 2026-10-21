-- Enforce the 15-day refund window in the database. An officially recorded
-- school departure is the sole exception; all refunds remain immutable ledger events.
create or replace function public.refund_finance_payment(p_payment_id uuid,p_amount numeric,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  sid uuid:=public.get_my_school_id(); pay public.finance_payments; charge public.finance_charges;
  student public.students; credit public.finance_student_credits; allocation record; refund_id uuid;
  already_refunded numeric; charge_refunded numeric; allocated numeric; unallocated numeric;
  credit_refund numeric; applied_refund numeric; refund_in_charge_currency numeric;
  expected_charge_refund_total numeric; reverse_amount numeric; portion numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_refund'; end if;
  select * into pay from public.finance_payments where id=p_payment_id and school_id=sid for update;
  if pay.id is null or pay.status<>'validated' then raise exception 'payment_not_refundable'; end if;
  select * into charge from public.finance_charges where id=pay.charge_id and school_id=sid for update;
  if charge.id is null or pay.applied_currency_code<>charge.currency_code then raise exception 'payment_charge_currency_mismatch'; end if;
  select * into student from public.students where id=charge.student_id and school_id=sid for update;
  if student.id is null then raise exception 'student_not_found'; end if;
  if pay.paid_at < now()-interval '15 days' and student.school_status<>'departed' then raise exception 'refund_window_expired'; end if;
  select coalesce(sum(r.amount),0),coalesce(sum(r.applied_amount+r.credit_amount),0)
    into already_refunded,charge_refunded from public.finance_payment_refunds r where r.payment_id=pay.id and r.school_id=sid;
  if p_amount>pay.amount-already_refunded then raise exception 'refund_exceeds_remaining'; end if;

  if pay.currency_code='USD' and charge.currency_code='HTG' then
    if pay.exchange_rate_snapshot is null then raise exception 'brh_rate_unavailable'; end if;
    expected_charge_refund_total:=round((already_refunded+p_amount)*pay.exchange_rate_snapshot,2);
    refund_in_charge_currency:=expected_charge_refund_total-charge_refunded;
  else
    refund_in_charge_currency:=p_amount;
  end if;
  if refund_in_charge_currency<=0 then raise exception 'invalid_refund'; end if;
  select * into credit from public.finance_student_credits where source_payment_id=pay.id and school_id=sid for update;
  credit_refund:=case when credit.id is null then 0 else least(refund_in_charge_currency,credit.amount) end;
  applied_refund:=refund_in_charge_currency-credit_refund;
  if applied_refund>pay.applied_amount then raise exception 'refund_accounting_conflict'; end if;

  insert into public.finance_payment_refunds(school_id,payment_id,amount,applied_amount,credit_amount,reason,recorded_by)
  values(sid,pay.id,p_amount,applied_refund,credit_refund,trim(p_reason),auth.uid()) returning id into refund_id;

  if credit_refund>0 then
    select coalesce(sum(a.amount),0) into allocated from public.finance_credit_allocations a where a.credit_id=credit.id and a.school_id=sid;
    unallocated:=greatest(0,credit.amount-allocated);
    reverse_amount:=greatest(0,credit_refund-unallocated);
    for allocation in
      select a.id,a.amount from public.finance_credit_allocations a
      where a.credit_id=credit.id and a.school_id=sid order by a.created_at desc,a.id desc for update
    loop
      exit when reverse_amount<=0;
      portion:=least(reverse_amount,allocation.amount);
      if portion=allocation.amount then delete from public.finance_credit_allocations where id=allocation.id;
      else update public.finance_credit_allocations set amount=amount-portion where id=allocation.id; end if;
      reverse_amount:=reverse_amount-portion;
    end loop;
    if reverse_amount>0 then raise exception 'refund_accounting_conflict'; end if;
    if credit.amount=credit_refund then
      if exists(select 1 from public.finance_credit_allocations a where a.credit_id=credit.id) then raise exception 'refund_accounting_conflict'; end if;
      delete from public.finance_student_credits where id=credit.id;
    else update public.finance_student_credits set amount=amount-credit_refund where id=credit.id; end if;
  end if;

  if applied_refund>0 then update public.finance_payments set applied_amount=applied_amount-applied_refund where id=pay.id; end if;
  return refund_id;
end $$;
revoke all on function public.refund_finance_payment(uuid,numeric,text) from public,anon;
grant execute on function public.refund_finance_payment(uuid,numeric,text) to authenticated;

-- Finance-only lookup for departure cases. It never exposes another school's students.
create or replace function public.finance_departure_refund_workspace(p_query text default null,p_student_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  sid uuid:=public.get_my_school_id();
  term text:=left(trim(coalesce(p_query,'')),120);
  student public.students;
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_student_id is null then
    if length(term)<2 then return jsonb_build_object('students','[]'::jsonb); end if;
    return jsonb_build_object('students',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.last_name,q.first_name)
      from (
        select s.id,s.first_name,s.last_name,s.atechos_id,s.school_status
        from public.students s
        where s.school_id=sid and position(lower(term) in lower(concat_ws(' ',s.first_name,s.last_name,s.atechos_id)))>0
        order by s.last_name,s.first_name,s.id limit 25
      ) q
    ),'[]'::jsonb));
  end if;

  select * into student from public.students s where s.id=p_student_id and s.school_id=sid;
  if student.id is null then raise exception 'student_not_found'; end if;
  return jsonb_build_object(
    'student',jsonb_build_object('id',student.id,'first_name',student.first_name,'last_name',student.last_name,
      'atechos_id',student.atechos_id,'school_status',student.school_status),
    'totals',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.currency_code)
      from (
        select p.currency_code,sum(p.amount) as paid_amount,sum(coalesce(r.refunded_amount,0)) as refunded_amount,
          greatest(0,sum(p.amount)-sum(coalesce(r.refunded_amount,0))) as remaining_amount
        from public.finance_payments p
        join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
        left join lateral (
          select sum(x.amount) as refunded_amount from public.finance_payment_refunds x
          where x.payment_id=p.id and x.school_id=sid
        ) r on true
        where p.school_id=sid and c.student_id=student.id and p.status='validated'
        group by p.currency_code
      ) q
    ),'[]'::jsonb),
    'payments',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.paid_at desc,q.id desc)
      from (
        select p.id,p.amount,p.currency_code,p.paid_at,c.description as charge_description,
          coalesce(r.refunded_amount,0) as refunded_amount,
          greatest(0,p.amount-coalesce(r.refunded_amount,0)) as remaining_amount,
          (p.paid_at>=now()-interval '15 days' or student.school_status='departed') as refund_allowed
        from public.finance_payments p
        join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
        left join lateral (
          select sum(x.amount) as refunded_amount from public.finance_payment_refunds x
          where x.payment_id=p.id and x.school_id=sid
        ) r on true
        where p.school_id=sid and c.student_id=student.id and p.status='validated'
        order by p.paid_at desc,p.id desc limit 100
      ) q
    ),'[]'::jsonb)
  );
end $$;
revoke all on function public.finance_departure_refund_workspace(text,uuid) from public,anon;
grant execute on function public.finance_departure_refund_workspace(text,uuid) to authenticated;
