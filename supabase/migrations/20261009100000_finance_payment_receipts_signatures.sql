-- Secure printable receipts and staff-approved signature snapshots.
create table public.finance_staff_receipt_signatures (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  signer_name text not null check (length(trim(signer_name)) between 2 and 120),
  style_id smallint not null check (style_id between 1 and 10),
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_id,user_id)
);
alter table public.finance_staff_receipt_signatures enable row level security;
revoke all on public.finance_staff_receipt_signatures from public,anon,authenticated;

alter table public.finance_payments
  add column receipt_signer_name text,
  add column receipt_signer_style smallint check (receipt_signer_style between 1 and 10),
  add column receipt_signer_role text,
  add column receipt_signature_approved_at timestamptz;

create or replace function public.save_finance_receipt_signature(p_style_id smallint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); signer text; role_name text; saved public.finance_staff_receipt_signatures; prior public.finance_staff_receipt_signatures;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_style_id is null or p_style_id not between 1 and 10 then raise exception 'invalid_signature_style'; end if;
  select nullif(trim(u.full_name),'') into signer from public.users u where u.id=auth.uid();
  if signer is null then raise exception 'signature_name_required'; end if;
  select m.role::text into role_name from public.school_members m
    where m.school_id=sid and m.user_id=auth.uid() and m.enabled
    order by case m.role when 'school_admin' then 0 when 'director' then 1 when 'accountant' then 2 when 'secretary' then 3 else 4 end limit 1;
  select * into prior from public.finance_staff_receipt_signatures where school_id=sid and user_id=auth.uid();
  insert into public.finance_staff_receipt_signatures(school_id,user_id,signer_name,style_id,approved_at,updated_at)
  values(sid,auth.uid(),signer,p_style_id,now(),now())
  on conflict(school_id,user_id) do update
    set signer_name=excluded.signer_name,style_id=excluded.style_id,approved_at=now(),updated_at=now()
  returning * into saved;
  insert into public.finance_audit_events(school_id,actor_id,actor_role,entity,entity_id,action,before_data,after_data)
  values(sid,auth.uid(),role_name,'finance_staff_receipt_signatures',auth.uid()::text,'updated',
    case when prior.user_id is null then null else jsonb_build_object('signer_name',prior.signer_name,'style_id',prior.style_id,'approved_at',prior.approved_at) end,
    jsonb_build_object('signer_name',saved.signer_name,'style_id',saved.style_id,'approved_at',saved.approved_at));
  return jsonb_build_object('signer_name',saved.signer_name,'style_id',saved.style_id,'approved_at',saved.approved_at);
end $$;

create or replace function public.finance_staff_receipt_signature_self()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  select jsonb_build_object('signer_name',coalesce(sig.signer_name,u.full_name),'style_id',sig.style_id,'approved_at',sig.approved_at)
    into result
  from public.users u left join public.finance_staff_receipt_signatures sig
    on sig.school_id=sid and sig.user_id=u.id
  where u.id=auth.uid();
  return coalesce(result,'{}'::jsonb);
end $$;

create or replace function private.snapshot_finance_receipt_signature()
returns trigger language plpgsql security definer set search_path=''
as $$
declare sig public.finance_staff_receipt_signatures; role_snapshot text;
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
  end if;
  return new;
end $$;
create trigger finance_payment_receipt_signature_snapshot
  before insert or update of status on public.finance_payments
  for each row execute function private.snapshot_finance_receipt_signature();
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
    'student',jsonb_build_object('first_name',s.first_name,'last_name',s.last_name),
    'charge',jsonb_build_object('description',c.description,'class_name',cl.name,'academic_year',y.name,'currency_code',c.currency_code,'due_date',c.due_date),
    'payment',jsonb_build_object('id',p.id,'amount',p.amount,'currency_code',p.currency_code,'applied_amount',p.applied_amount,'applied_currency_code',p.applied_currency_code,'payment_method',p.payment_method,'reference',p.reference,'paid_at',p.paid_at,'reviewed_at',p.reviewed_at,'refunded_amount',coalesce((select sum(r.amount) from public.finance_payment_refunds r where r.school_id=sid and r.payment_id=p.id),0),'recorded_by',rec.full_name),
    'reviewer',jsonb_build_object('name',coalesce(p.receipt_signer_name,rev.full_name),'role',coalesce(p.receipt_signer_role,rm.role::text),'signature_style',p.receipt_signer_style,'signature_approved_at',p.receipt_signature_approved_at),
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
revoke all on function public.save_finance_receipt_signature(smallint),public.finance_staff_receipt_signature_self(),public.finance_payment_receipt(uuid) from public,anon;
grant execute on function public.save_finance_receipt_signature(smallint),public.finance_staff_receipt_signature_self(),public.finance_payment_receipt(uuid) to authenticated;

-- Parents see every validated receipt for their linked child, plus only their
-- own unvalidated requests. Keep the existing cross-currency settings payload.
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
  select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc),'[]'::jsonb) into payment_history
  from (
    select p.id,p.amount,p.currency_code,p.applied_amount,p.applied_currency_code,p.exchange_rate_snapshot,
      p.exchange_rate_effective_date,p.exchange_rate_source_url,p.payment_method,p.reference,p.paid_at,p.status,
      p.review_reason,p.recorded_at,p.reviewed_at,p.reviewed_by,
      coalesce(p.receipt_signer_name,reviewer.full_name) as reviewer_name,
      p.receipt_signer_role,p.receipt_signer_style,p.receipt_signature_approved_at,c.description as charge_description,cl.name as class_name,
      coalesce((select sum(r.amount) from public.finance_payment_refunds r where r.school_id=sid and r.payment_id=p.id),0) as refunded_amount
    from public.finance_payments p
    join public.finance_charges c on c.id=p.charge_id and c.school_id=sid and c.student_id=p_student_id
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    left join public.users reviewer on reviewer.id=p.reviewed_by
    where p.school_id=sid and (p.status='validated' or p.recorded_by=auth.uid())
    order by p.recorded_at desc,p.id desc limit 100
  ) q;
  base:=jsonb_set(base,'{payments}',coalesce(payment_history,'[]'::jsonb),true);
  return jsonb_set(base,'{settings}',coalesce(base->'settings','{}'::jsonb)||jsonb_build_object('payment_methods',coalesce(methods,'{}'::jsonb),'brh_rate',rate),true);
end $$;
revoke all on function public.family_finance_workspace(uuid) from public,anon;
grant execute on function public.family_finance_workspace(uuid) to authenticated;
