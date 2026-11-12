-- Allow a linked parent to pay an HTG fee in USD. The USD receipt remains in
-- USD; application, balances, credits, and refund reversals use the fee currency.
alter table public.finance_payments
  add column applied_currency_code text;

update public.finance_payments p
set applied_currency_code=c.currency_code
from public.finance_charges c
where c.id=p.charge_id;

alter table public.finance_payments
  alter column applied_currency_code set not null,
  add constraint finance_payments_applied_currency_code_check
    check (applied_currency_code in ('HTG','USD')),
  drop constraint finance_payments_applied_amount_check;

create or replace function private.guard_finance_payment_currency_pair()
returns trigger language plpgsql set search_path=''
as $$
declare charge_currency text;
begin
  select c.currency_code into charge_currency
  from public.finance_charges c
  where c.id=new.charge_id and c.school_id=new.school_id;
  if charge_currency is null or new.applied_currency_code is distinct from charge_currency then
    if charge_currency is not null and new.applied_currency_code is null then
      new.applied_currency_code:=charge_currency;
    else
    raise exception 'payment_charge_currency_mismatch';
    end if;
  end if;
  if new.currency_code<>charge_currency
     and not (new.currency_code='USD' and charge_currency='HTG') then
    raise exception 'payment_currency_mismatch';
  end if;
  return new;
end $$;
revoke all on function private.guard_finance_payment_currency_pair() from public,anon,authenticated;
create trigger finance_payment_currency_pair_guard_insert
  before insert on public.finance_payments for each row
  execute function private.guard_finance_payment_currency_pair();
create trigger finance_payment_currency_pair_guard_update
  before update of charge_id,school_id,currency_code,applied_currency_code
  on public.finance_payments for each row
  execute function private.guard_finance_payment_currency_pair();

-- The family workspace only exposes the linked child's own payments. Add the
-- fee currency beside each tender so USD and HTG amounts are never ambiguous.
alter function public.family_finance_workspace(uuid) rename to family_finance_workspace_pre_cross_currency;
revoke all on function public.family_finance_workspace_pre_cross_currency(uuid) from public,anon,authenticated;
create or replace function public.family_finance_workspace(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare base jsonb; sid uuid; methods jsonb; rate jsonb; payment_history jsonb;
begin
  base:=public.family_finance_workspace_pre_cross_currency(p_student_id);
  sid:=(base->>'school_id')::uuid;
  select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) into methods
  from public.finance_settings fs cross join lateral jsonb_each(fs.payment_methods) p(k,v)
  where fs.school_id=sid and coalesce((v->>'enabled')::boolean,false);
  select jsonb_build_object('date',r.effective_date,'rate',r.htg_per_usd,'fetched_at',r.fetched_at,'source_url',r.source_url)
    into rate from public.finance_brh_reference_rates r
    where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date order by r.fetched_at desc limit 1;
  select coalesce(jsonb_agg(item||jsonb_build_object(
    'applied_amount',p.applied_amount,
    'exchange_rate_snapshot',p.exchange_rate_snapshot,
    'exchange_rate_effective_date',p.exchange_rate_effective_date,
    'exchange_rate_source_url',p.exchange_rate_source_url,
    'applied_currency_code',p.applied_currency_code
  ) order by p.recorded_at desc),'[]'::jsonb)
    into payment_history
  from jsonb_array_elements(coalesce(base->'payments','[]'::jsonb)) as payments(item)
  join public.finance_payments p on p.id=(item->>'id')::uuid;
  base:=jsonb_set(base,'{payments}',coalesce(payment_history,'[]'::jsonb),true);
  return jsonb_set(base,'{settings}',coalesce(base->'settings','{}'::jsonb)||jsonb_build_object('payment_methods',coalesce(methods,'{}'::jsonb),'brh_rate',rate),true);
end $$;
revoke all on function public.family_finance_workspace(uuid) from public,anon;
grant execute on function public.family_finance_workspace(uuid) to authenticated;

create or replace function public.submit_family_finance_payment(
  p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,p_proof_storage_path text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
  pay_user uuid:=auth.uid(); sid uuid; c public.finance_charges; method text; method_key text;
  tender_currency text; tender_rate numeric; tender_value_in_charge_currency numeric;
  reference_value text:=nullif(trim(coalesce(p_reference,'')),'');
  proof text:=nullif(trim(coalesce(p_proof_storage_path,'')),'');
  booked numeric; adjustment numeric; remaining numeric; applied numeric; payment_id uuid;
begin
  if pay_user is null then raise exception 'not_authenticated'; end if;
  method:=case lower(trim(coalesce(p_payment_method,'')))
    when 'moncash' then 'MonCash' when 'natcash' then 'NatCash' when 'paypal' then 'PayPal' when 'zelle' then 'Zelle'
    when 'bank transfer htg' then 'Bank transfer HTG' when 'bank_transfer_htg' then 'Bank transfer HTG'
    when 'bank transfer usd' then 'Bank transfer USD' when 'bank_transfer_usd' then 'Bank transfer USD'
    when 'bank transfer' then 'Bank transfer HTG' when 'virement' then 'Bank transfer HTG' when 'virement bancaire' then 'Bank transfer HTG'
    else null end;
  method_key:=private.finance_method_key(method);
  if method is null or method_key is null then raise exception 'invalid_payment_method'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'invalid_payment'; end if;
  if reference_value is null or char_length(reference_value)>120 then raise exception 'payment_reference_required'; end if;
  select ch.school_id into sid from public.finance_charges ch where ch.id=p_charge_id;
  if sid is null or not private.finance_parent_linked(sid,(select student_id from public.finance_charges where id=p_charge_id),pay_user) then raise exception 'not_authorized'; end if;
  if not private.finance_method_enabled(sid,method) then raise exception 'payment_method_disabled'; end if;
  select * into c from public.finance_charges ch where ch.id=p_charge_id and ch.school_id=sid for update;
  if c.id is null then raise exception 'charge_not_found'; end if;
  if c.due_date>(now() at time zone 'America/Port-au-Prince')::date then raise exception 'installment_not_due'; end if;

  tender_currency:=case when method_key in ('paypal','zelle','bank_transfer_usd') then 'USD' else 'HTG' end;
  if tender_currency<>c.currency_code and not (tender_currency='USD' and c.currency_code='HTG') then
    raise exception 'payment_currency_mismatch';
  end if;
  if tender_currency='USD' then
    select r.htg_per_usd into tender_rate
    from public.finance_brh_reference_rates r
    where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date
    order by r.fetched_at desc limit 1;
    if tender_rate is null then raise exception 'brh_rate_unavailable'; end if;
  end if;
  if method_key in ('moncash','natcash') and private.finance_payment_htg_limit(sid,method) is not null
     and p_amount>private.finance_payment_htg_limit(sid,method) then raise exception 'payment_method_limit_exceeded'; end if;
  if proof is null or split_part(proof,'/',1)<>sid::text or split_part(proof,'/',2)<>pay_user::text or split_part(proof,'/',3)<>c.student_id::text
    or not exists(select 1 from storage.objects o where o.bucket_id='finance-proofs' and o.name=proof) then raise exception 'invalid_proof_path'; end if;
  perform 1 from public.students s where s.id=c.student_id and s.school_id=sid for update;
  select coalesce(sum(p.applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)
    into booked from public.finance_payments p where p.charge_id=c.id and p.status in ('pending','validated');
  select coalesce(sum(a.amount),0) into adjustment from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance';
  remaining:=greatest(0,c.amount-adjustment-booked);
  tender_value_in_charge_currency:=case when tender_currency='USD' and c.currency_code='HTG' then round(p_amount*tender_rate,2) else p_amount end;
  applied:=least(tender_value_in_charge_currency,remaining);
  insert into public.finance_payments(school_id,charge_id,amount,applied_amount,currency_code,applied_currency_code,payment_method,reference,proof_storage_path,paid_at,recorded_by)
  values(sid,c.id,p_amount,applied,tender_currency,c.currency_code,method,reference_value,proof,now(),pay_user) returning id into payment_id;
  return payment_id;
end $$;
revoke all on function public.submit_family_finance_payment(uuid,numeric,text,text,text) from public,anon;
grant execute on function public.submit_family_finance_payment(uuid,numeric,text,text,text) to authenticated;

create or replace function public.review_finance_payment(p_payment_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare
  sid uuid:=public.get_my_school_id(); pay public.finance_payments; c public.finance_charges;
  settings public.finance_settings; booked numeric; adjustment numeric; balance numeric;
  family record; msg text; credit_id uuid; credit_balance numeric;
  fx_rate public.finance_brh_reference_rates; converted_amount numeric; applied_value numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_decision not in ('validated','rejected') or (p_decision='rejected' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'invalid_review'; end if;
  select * into pay from public.finance_payments where id=p_payment_id and school_id=sid for update;
  if pay.id is null or pay.status<>'pending' then raise exception 'payment_not_pending'; end if;
  select * into c from public.finance_charges where id=pay.charge_id and school_id=sid for update;
  if c.id is null or pay.applied_currency_code<>c.currency_code then raise exception 'payment_charge_currency_mismatch'; end if;
  select * into settings from public.finance_settings where school_id=sid;
  if p_decision='validated' then
    if coalesce(settings.proof_required,false) and pay.proof_storage_path is null then raise exception 'payment_proof_required'; end if;
    converted_amount:=pay.amount;
    if pay.currency_code='USD' then
      select * into fx_rate from public.finance_brh_reference_rates r
      where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date order by r.fetched_at desc limit 1;
      if fx_rate.id is null then raise exception 'brh_rate_unavailable'; end if;
      if c.currency_code='HTG' then converted_amount:=round(pay.amount*fx_rate.htg_per_usd,2); end if;
    end if;
    select coalesce(sum(applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)
      into booked from public.finance_payments where charge_id=c.id and status='validated' and id<>pay.id;
    select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
    balance:=greatest(0,c.amount-adjustment-booked);
    applied_value:=least(converted_amount,balance);
    if booked+applied_value>c.amount-adjustment then raise exception 'payment_exceeds_balance'; end if;
  end if;
  update public.finance_payments set status=p_decision,applied_amount=case when p_decision='validated' then applied_value else applied_amount end,
    reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(coalesce(p_reason,'')),''),
    exchange_rate_snapshot=case when p_decision='validated' and pay.currency_code='USD' then fx_rate.htg_per_usd else null end,
    exchange_rate_effective_date=case when p_decision='validated' and pay.currency_code='USD' then fx_rate.effective_date else null end,
    exchange_rate_source_url=case when p_decision='validated' and pay.currency_code='USD' then fx_rate.source_url else null end
    where id=pay.id;
  if p_decision='validated' then
    if converted_amount>applied_value then
      insert into public.finance_student_credits(school_id,student_id,source_payment_id,amount,currency_code,created_by)
      values(sid,c.student_id,pay.id,converted_amount-applied_value,c.currency_code,auth.uid()) returning id into credit_id;
      perform private.apply_finance_student_credits(sid,c.student_id,c.currency_code);
      select greatest(0,cr.amount-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.credit_id=cr.id),0)) into credit_balance from public.finance_student_credits cr where cr.id=credit_id;
    end if;
    select greatest(0,c.amount-coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)-coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)) into balance;
    msg:=format('Montant reçu : %s %s · Affecté aux frais : %s %s · Frais : %s · Date : %s · Statut : Validé · Solde restant : %s %s · Crédit restant : %s %s · Référence : %s%s',
      to_char(pay.amount,'FM999999999990D00'),pay.currency_code,to_char(applied_value,'FM999999999990D00'),c.currency_code,c.description,
      to_char(pay.paid_at at time zone 'America/Port-au-Prince','DD/MM/YYYY'),to_char(balance,'FM999999999990D00'),c.currency_code,
      to_char(coalesce(credit_balance,0),'FM999999999990D00'),c.currency_code,coalesce(pay.reference,'—'),
      case when pay.currency_code='USD' then format(' · Taux BRH : %s HTG/USD (%s)',fx_rate.htg_per_usd,fx_rate.effective_date) else '' end);
    for family in select distinct p.user_id from public.student_parents sp join public.parents p on p.id=sp.parent_id
      join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent'
      where sp.student_id=c.student_id and p.school_id=sid and p.user_id is not null loop
      insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
      values(sid,family.user_id,'finance','Paiement validé',msg,'normal','/dashboard/parent-portal','finance-payment-validated:'||pay.id::text)
      on conflict(school_id,recipient_id,event_key) do nothing;
    end loop;
  end if;
end $$;
revoke all on function public.review_finance_payment(uuid,text,text) from public,anon;
grant execute on function public.review_finance_payment(uuid,text,text) to authenticated;

-- Refund receipts stay in the tender currency; their applied and credit portions
-- are expressed in the fee currency and converted from the immutable approval rate.
alter table public.finance_payment_refunds drop constraint finance_payment_refunds_check;

create or replace function public.refund_finance_payment(p_payment_id uuid,p_amount numeric,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  sid uuid:=public.get_my_school_id(); pay public.finance_payments; charge public.finance_charges;
  credit public.finance_student_credits; allocation record; refund_id uuid;
  already_refunded numeric; charge_refunded numeric; allocated numeric; unallocated numeric;
  credit_refund numeric; applied_refund numeric; refund_in_charge_currency numeric;
  expected_charge_refund_total numeric; reverse_amount numeric; portion numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_refund'; end if;
  select * into pay from public.finance_payments where id=p_payment_id and school_id=sid for update;
  if pay.id is null or pay.status<>'validated' then raise exception 'payment_not_refundable'; end if;
  select coalesce(sum(r.amount),0),coalesce(sum(r.applied_amount+r.credit_amount),0)
    into already_refunded,charge_refunded from public.finance_payment_refunds r where r.payment_id=pay.id and r.school_id=sid;
  if p_amount>pay.amount-already_refunded then raise exception 'refund_exceeds_remaining'; end if;
  select * into charge from public.finance_charges where id=pay.charge_id and school_id=sid for update;
  if charge.id is null or pay.applied_currency_code<>charge.currency_code then raise exception 'payment_charge_currency_mismatch'; end if;
  perform 1 from public.students where id=charge.student_id and school_id=sid for update;

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
