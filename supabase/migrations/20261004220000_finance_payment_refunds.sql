-- Refunds are immutable ledger entries. Their accounting reverses only the
-- affected applied payment and any overpayment credit (including spent credit).
create unique index finance_payments_id_school_key on public.finance_payments(id,school_id);
create table public.finance_payment_refunds (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null references public.finance_payments(id),
  amount numeric(12,2) not null check(amount>0),
  applied_amount numeric(12,2) not null check(applied_amount>=0),
  credit_amount numeric(12,2) not null check(credit_amount>=0),
  reason text not null check(length(trim(reason)) between 3 and 500),
  recorded_by uuid not null references public.users(id),
  recorded_at timestamptz not null default now(),
  check(amount=applied_amount+credit_amount),
  foreign key(payment_id,school_id) references public.finance_payments(id,school_id)
);
create index finance_payment_refunds_payment on public.finance_payment_refunds(school_id,payment_id,recorded_at desc);
create trigger finance_payment_refunds_audit after insert or update or delete on public.finance_payment_refunds for each row execute function private.log_finance_event();
alter table public.finance_payment_refunds enable row level security;
revoke all on public.finance_payment_refunds from public,anon,authenticated;
create policy finance_payment_refunds_read on public.finance_payment_refunds for select to authenticated using(private.finance_member(school_id));
grant select on public.finance_payment_refunds to authenticated;

create or replace function public.refund_finance_payment(p_payment_id uuid,p_amount numeric,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  sid uuid:=public.get_my_school_id(); pay public.finance_payments; charge public.finance_charges;
  credit public.finance_student_credits; allocation record; refund_id uuid;
  already_refunded numeric; allocated numeric; unallocated numeric;
  credit_refund numeric; applied_refund numeric; reverse_amount numeric; portion numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_refund'; end if;
  select * into pay from public.finance_payments where id=p_payment_id and school_id=sid for update;
  if pay.id is null or pay.status<>'validated' then raise exception 'payment_not_refundable'; end if;
  select coalesce(sum(r.amount),0) into already_refunded from public.finance_payment_refunds r where r.payment_id=pay.id and r.school_id=sid;
  if p_amount>pay.amount-already_refunded then raise exception 'refund_exceeds_remaining'; end if;
  select * into charge from public.finance_charges where id=pay.charge_id and school_id=sid for update;
  if charge.id is null then raise exception 'charge_not_found'; end if;
  perform 1 from public.students where id=charge.student_id and school_id=sid for update;

  select * into credit from public.finance_student_credits where source_payment_id=pay.id and school_id=sid for update;
  credit_refund:=case when credit.id is null then 0 else least(p_amount,credit.amount) end;
  applied_refund:=p_amount-credit_refund;
  if applied_refund>pay.applied_amount then raise exception 'refund_accounting_conflict'; end if;

  insert into public.finance_payment_refunds(school_id,payment_id,amount,applied_amount,credit_amount,reason,recorded_by)
  values(sid,pay.id,p_amount,applied_refund,credit_refund,trim(p_reason),auth.uid()) returning id into refund_id;

  if credit_refund>0 then
    select coalesce(sum(a.amount),0) into allocated from public.finance_credit_allocations a where a.credit_id=credit.id and a.school_id=sid;
    unallocated:=greatest(0,credit.amount-allocated);
    reverse_amount:=greatest(0,credit_refund-unallocated);
    for allocation in
      select a.id,a.amount from public.finance_credit_allocations a
      where a.credit_id=credit.id and a.school_id=sid
      order by a.created_at desc,a.id desc for update
    loop
      exit when reverse_amount<=0;
      portion:=least(reverse_amount,allocation.amount);
      if portion=allocation.amount then
        delete from public.finance_credit_allocations where id=allocation.id;
      else
        update public.finance_credit_allocations set amount=amount-portion where id=allocation.id;
      end if;
      reverse_amount:=reverse_amount-portion;
    end loop;
    if reverse_amount>0 then raise exception 'refund_accounting_conflict'; end if;
    if credit.amount=credit_refund then
      if exists(select 1 from public.finance_credit_allocations a where a.credit_id=credit.id) then raise exception 'refund_accounting_conflict'; end if;
      delete from public.finance_student_credits where id=credit.id;
    else
      update public.finance_student_credits set amount=amount-credit_refund where id=credit.id;
    end if;
  end if;

  if applied_refund>0 then
    update public.finance_payments set applied_amount=applied_amount-applied_refund where id=pay.id;
  end if;
  return refund_id;
end $$;
revoke all on function public.refund_finance_payment(uuid,numeric,text) from public,anon;
grant execute on function public.refund_finance_payment(uuid,numeric,text) to authenticated;

-- Keep the existing page-based ledger API and expose the immutable refunded total.
create or replace function public.finance_payment_ledger(
  p_academic_year_id uuid default null,p_class_id uuid default null,p_status text default null,
  p_search text default null,p_offset integer default 0,p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); total bigint; items jsonb; term text:=left(trim(coalesce(p_search,'')),120); page_size integer:=least(greatest(coalesce(p_limit,50),1),100); page_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_status is not null and p_status not in ('pending','validated','rejected') then raise exception 'invalid_payment_status'; end if;
  select count(*) into total from public.finance_payments p
    join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
    join public.students s on s.id=c.student_id and s.school_id=sid
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    where p.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)
      and (p_class_id is null or c.class_id=p_class_id) and (p_status is null or p.status=p_status)
      and (term='' or position(lower(term) in lower(concat_ws(' ',s.first_name,s.last_name,c.description,cl.name,p.reference,p.payment_method)))>0);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc,q.id desc),'[]'::jsonb) into items from (
    select p.*,s.first_name||' '||s.last_name as student_name,c.description as charge_description,cl.name as class_name,
      (select coalesce(sum(x.applied_amount),0) from public.finance_payments x where x.charge_id=p.charge_id and x.status='validated') as charge_paid,
      coalesce((select sum(r.amount) from public.finance_payment_refunds r where r.payment_id=p.id and r.school_id=sid),0) as refunded_amount
    from public.finance_payments p
    join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
    join public.students s on s.id=c.student_id and s.school_id=sid
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    where p.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)
      and (p_class_id is null or c.class_id=p_class_id) and (p_status is null or p.status=p_status)
      and (term='' or position(lower(term) in lower(concat_ws(' ',s.first_name,s.last_name,c.description,cl.name,p.reference,p.payment_method)))>0)
    order by p.recorded_at desc,p.id desc limit page_size offset page_offset
  ) q;
  return jsonb_build_object('items',items,'total',total,'offset',page_offset,'limit',page_size);
end $$;
revoke all on function public.finance_payment_ledger(uuid,uuid,text,text,integer,integer) from public,anon;
grant execute on function public.finance_payment_ledger(uuid,uuid,text,text,integer,integer) to authenticated;
