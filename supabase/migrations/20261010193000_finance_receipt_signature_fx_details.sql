-- Snapshot the permanent school administrator signature with each newly validated receipt,
-- and expose verified student identity, FX and unspent credit to the scoped receipt RPC.
alter table public.finance_payments
  add column receipt_admin_signer_id uuid references public.users(id),
  add column receipt_admin_signer_name text,
  add column receipt_admin_signer_style smallint check (receipt_admin_signer_style between 1 and 10),
  add column receipt_admin_signature_approved_at timestamptz;

create or replace function private.snapshot_finance_receipt_signature()
returns trigger language plpgsql security definer set search_path=''
as $$
declare sig public.finance_staff_receipt_signatures; admin_sig public.finance_staff_receipt_signatures; role_snapshot text;
begin
  if new.status='validated' and (tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from 'validated')) then
    if new.reviewed_by is null then raise exception 'finance_reviewer_signature_required'; end if;
    select * into sig from public.finance_staff_receipt_signatures s
      where s.school_id=new.school_id and s.user_id=new.reviewed_by;
    if sig.user_id is null then raise exception 'finance_reviewer_signature_required'; end if;
    select m.role::text into role_snapshot from public.school_members m where m.school_id=new.school_id and m.user_id=new.reviewed_by and m.enabled
      order by case m.role when 'school_admin' then 0 when 'director' then 1 when 'accountant' then 2 when 'secretary' then 3 else 4 end limit 1;
    if role_snapshot is null then raise exception 'finance_reviewer_signature_required'; end if;
    new.receipt_signer_name:=sig.signer_name;
    new.receipt_signer_role:=role_snapshot;
    new.receipt_signer_style:=sig.style_id;
    new.receipt_signature_approved_at:=sig.approved_at;
    new.receipt_admin_signer_id:=null;
    new.receipt_admin_signer_name:=null;
    new.receipt_admin_signer_style:=null;
    new.receipt_admin_signature_approved_at:=null;
    select s.* into admin_sig from public.finance_staff_receipt_signatures s
      join public.school_members m on m.school_id=s.school_id and m.user_id=s.user_id
      where s.school_id=new.school_id and m.role='school_admin' and m.enabled
      order by s.approved_at desc,s.user_id limit 1;
    if admin_sig.user_id is not null then
      new.receipt_admin_signer_id:=admin_sig.user_id;
      new.receipt_admin_signer_name:=admin_sig.signer_name;
      new.receipt_admin_signer_style:=admin_sig.style_id;
      new.receipt_admin_signature_approved_at:=admin_sig.approved_at;
    end if;
  end if;
  return new;
end $$;

revoke all on function private.snapshot_finance_receipt_signature() from public,anon,authenticated;

create or replace function public.finance_payment_receipt(p_payment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; stid uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select p.school_id,c.student_id into sid,stid
  from public.finance_payments p join public.finance_charges c on c.id=p.charge_id and c.school_id=p.school_id
  where p.id=p_payment_id and p.status='validated';
  if sid is null then raise exception 'receipt_not_found'; end if;
  if not private.finance_member(sid) and not private.finance_parent_linked(sid,stid,auth.uid()) then
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
    'school',jsonb_build_object('name',coalesce(nullif(to_jsonb(sch)->>'name',''),nullif(to_jsonb(sch)->>'school_name',''),'AtechOS')),
    'student',jsonb_build_object('first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id),
    'charge',jsonb_build_object('description',c.description,'class_name',cl.name,'academic_year',y.name,'currency_code',c.currency_code,'due_date',c.due_date),
    'payment',jsonb_build_object('id',p.id,'amount',p.amount,'currency_code',p.currency_code,'applied_amount',p.applied_amount,'applied_currency_code',p.applied_currency_code,'exchange_rate_snapshot',p.exchange_rate_snapshot,'exchange_rate_effective_date',p.exchange_rate_effective_date,'exchange_rate_source_url',p.exchange_rate_source_url,'htg_equivalent',case when p.currency_code='USD' and p.exchange_rate_snapshot is not null then round(p.amount*p.exchange_rate_snapshot,2) else null end,'payment_method',p.payment_method,'reference',p.reference,'paid_at',p.paid_at,'reviewed_at',p.reviewed_at,'refunded_amount',coalesce((select sum(r.amount) from public.finance_payment_refunds r where r.school_id=sid and r.payment_id=p.id),0),'recorded_by',rec.full_name),
    'reviewer',jsonb_build_object('name',coalesce(p.receipt_signer_name,rev.full_name),'role',coalesce(p.receipt_signer_role,rm.role::text),'signature_style',p.receipt_signer_style,'signature_approved_at',p.receipt_signature_approved_at),
    'school_admin_signature',jsonb_build_object('name',p.receipt_admin_signer_name,'style_id',p.receipt_admin_signer_style,'approved_at',p.receipt_admin_signature_approved_at),
    'student_credit_remaining',coalesce((select sum(greatest(0,cr.amount-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.school_id=sid and a.credit_id=cr.id),0))) from public.finance_student_credits cr where cr.school_id=sid and cr.student_id=s.id and cr.currency_code=c.currency_code),0),
    'current_installment',jsonb_build_object('number',ci.installment_number,'due_date',c.due_date,'remaining',greatest(0,c.amount-coalesce((select sum(a.amount) from public.finance_adjustments a where a.school_id=sid and a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)-coalesce((select sum(x.applied_amount) from public.finance_payments x where x.school_id=sid and x.charge_id=c.id and x.status='validated'),0)-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.school_id=sid and a.charge_id=c.id),0))),
    'next_installment',(select jsonb_build_object('number',ni.installment_number,'due_date',ni.due_date,'remaining',greatest(0,coalesce(nc.amount,ni.amount)-coalesce((select sum(a.amount) from public.finance_adjustments a where a.school_id=sid and a.charge_id=nc.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)-coalesce((select sum(x.applied_amount) from public.finance_payments x where x.school_id=sid and x.charge_id=nc.id and x.status='validated'),0)-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.school_id=sid and a.charge_id=nc.id),0))) from public.finance_fee_installments ni left join public.finance_charges nc on nc.fee_installment_id=ni.id and nc.student_id=s.id and nc.school_id=sid where ni.fee_plan_id=c.fee_plan_id and ni.installment_number>ci.installment_number order by ni.installment_number limit 1)
  ) into result
  from public.finance_payments p
  join public.finance_charges c on c.id=p.charge_id and c.school_id=sid and c.student_id=stid
  join public.students s on s.id=c.student_id and s.school_id=sid
  join public.classes cl on cl.id=c.class_id and cl.school_id=sid
  join public.academic_years y on y.id=c.academic_year_id and y.school_id=sid
  join public.finance_fee_installments ci on ci.id=c.fee_installment_id and ci.school_id=sid and ci.fee_plan_id=c.fee_plan_id
  join public.schools sch on sch.id=sid
  left join public.users rec on rec.id=p.recorded_by
  left join public.users rev on rev.id=p.reviewed_by
  left join lateral (select m.role from public.school_members m where m.school_id=sid and m.user_id=p.reviewed_by and m.enabled order by case m.role when 'school_admin' then 0 when 'director' then 1 when 'accountant' then 2 when 'secretary' then 3 else 4 end limit 1) rm on true
  where p.id=p_payment_id and p.status='validated';
  if result is null then raise exception 'receipt_not_found'; end if;
  return result;
end $$;

