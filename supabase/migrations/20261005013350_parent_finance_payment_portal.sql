-- Let linked parents submit evidence-backed digital payments for their own child.
-- Finance payments remain pending until an authorized school member reviews them.

alter table public.finance_settings
  add column moncash_payment_instructions text not null default '' check (char_length(moncash_payment_instructions)<=1200),
  add column natcash_payment_instructions text not null default '' check (char_length(natcash_payment_instructions)<=1200),
  add column bank_transfer_instructions text not null default '' check (char_length(bank_transfer_instructions)<=1200),
  add column general_payment_instructions text not null default '' check (char_length(general_payment_instructions)<=1200);

create or replace function private.finance_parent_linked(p_school uuid,p_student uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and p_user=auth.uid() and exists (
    select 1 from public.students s
    join public.student_parents sp on sp.student_id=s.id
    join public.parents p on p.id=sp.parent_id and p.school_id=s.school_id and p.user_id=p_user
    join public.school_members m on m.school_id=p.school_id and m.user_id=p_user and m.role='parent' and m.enabled
    where s.id=p_student and s.school_id=p_school
  )
$$;
revoke all on function private.finance_parent_linked(uuid,uuid,uuid) from public,anon;
grant execute on function private.finance_parent_linked(uuid,uuid,uuid) to authenticated;

create policy finance_parent_proofs_insert on storage.objects for insert to authenticated with check (
  bucket_id='finance-proofs'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and case
    when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.finance_parent_linked(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[3])::uuid,(select auth.uid()))
    else false
  end
);

create policy finance_parent_proofs_read on storage.objects for select to authenticated using (
  bucket_id='finance-proofs'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and case
    when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.finance_parent_linked(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[3])::uuid,(select auth.uid()))
    else false
  end
);

create or replace function public.save_finance_payment_instructions(
  p_moncash text,p_natcash text,p_bank_transfer text,p_general text
) returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if greatest(char_length(coalesce(p_moncash,'')),char_length(coalesce(p_natcash,'')),char_length(coalesce(p_bank_transfer,'')),char_length(coalesce(p_general,'')))>1200 then raise exception 'payment_instructions_too_long'; end if;
  update public.finance_settings set
    moncash_payment_instructions=trim(coalesce(p_moncash,'')),
    natcash_payment_instructions=trim(coalesce(p_natcash,'')),
    bank_transfer_instructions=trim(coalesce(p_bank_transfer,'')),
    general_payment_instructions=trim(coalesce(p_general,'')),
    updated_at=now(),updated_by=auth.uid()
  where school_id=sid;
  if not found then raise exception 'finance_settings_missing'; end if;
end $$;
revoke all on function public.save_finance_payment_instructions(text,text,text,text) from public,anon;
grant execute on function public.save_finance_payment_instructions(text,text,text,text) to authenticated;

create or replace function public.finance_payment_options(p_academic_year_id uuid default null,p_class_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); items jsonb;
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_academic_year_id is not null and not exists(select 1 from public.academic_years y where y.id=p_academic_year_id and y.school_id=sid) then raise exception 'invalid_year'; end if;
  if p_class_id is not null and not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)) then raise exception 'invalid_class'; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.due_date,q.student_name,q.description),'[]'::jsonb) into items
  from (
    select c.id,c.student_id,c.academic_year_id,c.class_id,c.fee_plan_id,c.fee_installment_id,fp.fee_type,
      c.description,c.amount,c.currency_code,c.due_date,s.first_name||' '||s.last_name as student_name,
      s.atechos_id as student_code,cl.name as class_name,y.name as academic_year_name,
      coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0) as adjusted_amount,
      coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)
        +coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) as paid_amount,
      coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='pending'),0) as pending_amount
    from public.finance_charges c
    join public.finance_fee_plans fp on fp.id=c.fee_plan_id and fp.school_id=sid
    join public.students s on s.id=c.student_id and s.school_id=sid
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    join public.academic_years y on y.id=c.academic_year_id and y.school_id=sid
    where c.school_id=sid and c.due_date<=(now() at time zone 'America/Port-au-Prince')::date
      and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)
      and (p_class_id is null or c.class_id=p_class_id)
      and greatest(0,c.amount
        -coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)
        -coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status in ('pending','validated')),0)
        -coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0))>0
    order by c.due_date,c.created_at,c.id limit 1000
  ) q;
  return jsonb_build_object('items',items);
end $$;
revoke all on function public.finance_payment_options(uuid,uuid) from public,anon;
grant execute on function public.finance_payment_options(uuid,uuid) to authenticated;

create or replace function public.family_finance_workspace(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; child jsonb; instructions jsonb; charges jsonb; payments jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select s.school_id into sid from public.students s where s.id=p_student_id;
  if sid is null or not private.finance_parent_linked(sid,p_student_id,auth.uid()) then raise exception 'not_authorized'; end if;
  select jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'class_name',coalesce(cl.name,''))
    into child
  from public.students s left join lateral (
    select c.name from public.enrollments e join public.classes c on c.id=e.class_id and c.school_id=sid
    where e.student_id=s.id and e.school_id=sid and e.status='active'
    limit 1
  ) cl on true where s.id=p_student_id and s.school_id=sid;
  select jsonb_build_object(
    'currency_code',coalesce(f.currency_code,'HTG'),
    'moncash_payment_instructions',coalesce(f.moncash_payment_instructions,''),
    'natcash_payment_instructions',coalesce(f.natcash_payment_instructions,''),
    'bank_transfer_instructions',coalesce(f.bank_transfer_instructions,''),
    'general_payment_instructions',coalesce(f.general_payment_instructions,''))
    into instructions from (select 1) seed left join public.finance_settings f on f.school_id=sid;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.due_date,q.description),'[]'::jsonb) into charges
  from (
    select c.id,c.academic_year_id,c.class_id,c.description,c.currency_code,c.due_date,cl.name as class_name,
      greatest(0,c.amount-coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)
        -coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status in ('pending','validated')),0)
        -coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)) as remaining_amount,
      coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='pending'),0) as pending_amount,
      coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)
        +coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) as settled_amount
    from public.finance_charges c join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    where c.school_id=sid and c.student_id=p_student_id and c.due_date<=(now() at time zone 'America/Port-au-Prince')::date
      and greatest(0,c.amount-coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)
        -coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status in ('pending','validated')),0)
        -coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0))>0
    order by c.due_date,cl.name,c.description limit 200
  ) q;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc),'[]'::jsonb) into payments
  from (
    select p.id,p.amount,p.currency_code,p.payment_method,p.reference,p.paid_at,p.status,p.review_reason,p.recorded_at,
      c.description as charge_description,cl.name as class_name
    from public.finance_payments p join public.finance_charges c on c.id=p.charge_id and c.school_id=sid and c.student_id=p_student_id
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    where p.school_id=sid and p.recorded_by=auth.uid()
    order by p.recorded_at desc limit 100
  ) q;
  return jsonb_build_object('school_id',sid,'student',child,'settings',coalesce(instructions,'{}'::jsonb),'charges',coalesce(charges,'[]'::jsonb),'payments',coalesce(payments,'[]'::jsonb));
end $$;
revoke all on function public.family_finance_workspace(uuid) from public,anon;
grant execute on function public.family_finance_workspace(uuid) to authenticated;

create or replace function public.submit_family_finance_payment(
  p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,p_proof_storage_path text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare pay_user uuid:=auth.uid(); sid uuid; c public.finance_charges; method text; reference_value text:=nullif(trim(coalesce(p_reference,'')),''); proof text:=nullif(trim(coalesce(p_proof_storage_path,'')),''); booked numeric; adjustment numeric; remaining numeric; applied numeric; fee_kind text; payment_id uuid;
begin
  if pay_user is null then raise exception 'not_authenticated'; end if;
  method:=case lower(trim(coalesce(p_payment_method,'')))
    when 'moncash' then 'MonCash' when 'natcash' then 'NatCash'
    when 'bank transfer' then 'Bank transfer' when 'bank_transfer' then 'Bank transfer'
    when 'virement' then 'Bank transfer' when 'virement bancaire' then 'Bank transfer'
    else null end;
  if method is null then raise exception 'invalid_payment_method'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'invalid_payment'; end if;
  if reference_value is null or char_length(reference_value)>120 then raise exception 'payment_reference_required'; end if;
  select ch.school_id into sid from public.finance_charges ch where ch.id=p_charge_id;
  if sid is null or not private.finance_parent_linked(sid,(select student_id from public.finance_charges where id=p_charge_id),pay_user) then raise exception 'not_authorized'; end if;
  select * into c from public.finance_charges ch where ch.id=p_charge_id and ch.school_id=sid for update;
  if c.id is null then raise exception 'charge_not_found'; end if;
  if c.due_date>(now() at time zone 'America/Port-au-Prince')::date then raise exception 'installment_not_due'; end if;
  if proof is null or split_part(proof,'/',1)<>sid::text or split_part(proof,'/',2)<>pay_user::text or split_part(proof,'/',3)<>c.student_id::text
    or not exists(select 1 from storage.objects o where o.bucket_id='finance-proofs' and o.name=proof) then raise exception 'invalid_proof_path'; end if;
  perform 1 from public.students s where s.id=c.student_id and s.school_id=sid for update;
  select coalesce(sum(p.applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)
    into booked from public.finance_payments p where p.charge_id=c.id and p.status in ('pending','validated');
  select coalesce(sum(a.amount),0) into adjustment from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance';
  remaining:=greatest(0,c.amount-adjustment-booked);
  applied:=least(p_amount,remaining);
  select fp.fee_type into fee_kind from public.finance_fee_plans fp where fp.id=c.fee_plan_id and fp.school_id=sid;
  if p_amount>remaining and coalesce(fee_kind,'') not in ('inscription','rentree') then raise exception 'overpayment_only_allowed_for_entry_fees'; end if;
  insert into public.finance_payments(school_id,charge_id,amount,applied_amount,currency_code,payment_method,reference,proof_storage_path,paid_at,recorded_by)
  values(sid,c.id,p_amount,applied,c.currency_code,method,reference_value,proof,now(),pay_user) returning id into payment_id;
  return payment_id;
end $$;
revoke all on function public.submit_family_finance_payment(uuid,numeric,text,text,text) from public,anon;
grant execute on function public.submit_family_finance_payment(uuid,numeric,text,text,text) to authenticated;

-- Server-side staff entry has the same evidence rule as the staff form.
create or replace function public.record_finance_payment(p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,p_proof_storage_path text,p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); c public.finance_charges; booked numeric; adjustment numeric; remaining numeric; applied numeric; payment_id uuid; method text:=trim(coalesce(p_payment_method,'')); reference_value text:=nullif(trim(coalesce(p_reference,'')),''); proof text:=nullif(trim(coalesce(p_proof_storage_path,'')),''); fee_kind text;
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or length(method) not between 2 and 60 or p_paid_at is null then raise exception 'invalid_payment'; end if;
  if lower(method) in ('moncash','natcash','bank transfer','bank_transfer','virement','virement bancaire') then
    if reference_value is null or char_length(reference_value)>120 then raise exception 'payment_reference_required'; end if;
    if proof is null then raise exception 'payment_proof_required'; end if;
  end if;
  select * into c from public.finance_charges where id=p_charge_id and school_id=sid for update;
  if c.id is null then raise exception 'charge_not_found'; end if;
  select coalesce(sum(applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
  select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
  remaining:=greatest(0,c.amount-adjustment-booked);
  applied:=least(p_amount,remaining);
  select fp.fee_type into fee_kind from public.finance_fee_plans fp where fp.id=c.fee_plan_id and fp.school_id=sid;
  if p_amount>remaining and coalesce(fee_kind,'') not in ('inscription','rentree') then raise exception 'overpayment_only_allowed_for_entry_fees'; end if;
  if proof is not null and (split_part(proof,'/',1)<>sid::text or split_part(proof,'/',2)<>auth.uid()::text
    or not exists(select 1 from storage.objects o where o.bucket_id='finance-proofs' and o.name=proof)) then raise exception 'invalid_proof_path'; end if;
  insert into public.finance_payments(school_id,charge_id,amount,applied_amount,currency_code,payment_method,reference,proof_storage_path,paid_at,recorded_by)
  values(sid,c.id,p_amount,applied,c.currency_code,method,reference_value,proof,p_paid_at,auth.uid()) returning id into payment_id;
  return payment_id;
end $$;
revoke all on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz) from public,anon;
grant execute on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz) to authenticated;

