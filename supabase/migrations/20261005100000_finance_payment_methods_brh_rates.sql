-- Finance follow-up: school-controlled digital payment destinations and a
-- verified daily BRH reference-rate snapshot for USD payment validation.
-- Payment method destinations are not secrets, but only finance staff and
-- linked families may read them. Rate history and payment snapshots are append-only.

alter table public.finance_settings
  add column payment_methods jsonb not null default '{
    "moncash":{"enabled":false},"natcash":{"enabled":false},
    "paypal":{"enabled":false},"zelle":{"enabled":false},
    "bank_transfer_htg":{"enabled":false},"bank_transfer_usd":{"enabled":false}
  }'::jsonb;

alter table public.finance_payments
  add column exchange_rate_snapshot numeric(12,6),
  add column exchange_rate_effective_date date,
  add column exchange_rate_source_url text;

alter table public.finance_payments add constraint finance_payment_fx_snapshot_complete
  check ((exchange_rate_snapshot is null and exchange_rate_effective_date is null and exchange_rate_source_url is null)
      or (currency_code='USD' and exchange_rate_snapshot > 0 and exchange_rate_effective_date is not null and exchange_rate_source_url = 'https://www.brh.ht/politique-monetaire/taux-de-change/'));

create table public.finance_brh_reference_rates (
  id bigint generated always as identity primary key,
  effective_date date not null,
  htg_per_usd numeric(12,6) not null check (htg_per_usd > 0),
  source_url text not null check (source_url = 'https://www.brh.ht/politique-monetaire/taux-de-change/'),
  fetched_at timestamptz not null default now(),
  unique (effective_date, htg_per_usd)
);
alter table public.finance_payments add constraint finance_payment_fx_snapshot_from_brh
  foreign key (exchange_rate_effective_date,exchange_rate_snapshot)
  references public.finance_brh_reference_rates(effective_date,htg_per_usd);
alter table public.finance_brh_reference_rates enable row level security;
revoke all on public.finance_brh_reference_rates from public, anon, authenticated;
grant select, insert on public.finance_brh_reference_rates to service_role;
grant usage, select on sequence public.finance_brh_reference_rates_id_seq to service_role;

create or replace function private.prevent_finance_brh_rate_mutation()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'brh_rate_history_is_append_only'; end $$;
create trigger finance_brh_rates_append_only before update or delete on public.finance_brh_reference_rates
for each row execute function private.prevent_finance_brh_rate_mutation();

create or replace function private.prevent_finance_payment_fx_snapshot_change()
returns trigger language plpgsql set search_path=''
as $$
begin
  if old.exchange_rate_snapshot is not null and (
    new.exchange_rate_snapshot is distinct from old.exchange_rate_snapshot
    or new.exchange_rate_effective_date is distinct from old.exchange_rate_effective_date
    or new.exchange_rate_source_url is distinct from old.exchange_rate_source_url
  ) then raise exception 'finance_payment_fx_snapshot_is_immutable'; end if;
  return new;
end $$;
create trigger finance_payment_fx_snapshot_immutable before update on public.finance_payments
for each row execute function private.prevent_finance_payment_fx_snapshot_change();

create or replace function public.record_brh_reference_rate(p_effective_date date,p_rate numeric,p_source_url text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'not_authorized'; end if;
  if p_effective_date is null or p_rate is null or p_rate <= 0 or p_rate > 100000
     or p_source_url <> 'https://www.brh.ht/politique-monetaire/taux-de-change/' then
    raise exception 'invalid_brh_reference_rate';
  end if;
  insert into public.finance_brh_reference_rates(effective_date,htg_per_usd,source_url)
  values(p_effective_date,round(p_rate,6),p_source_url) on conflict(effective_date,htg_per_usd) do nothing;
end $$;
revoke all on function public.record_brh_reference_rate(date,numeric,text) from public,anon,authenticated;
grant execute on function public.record_brh_reference_rate(date,numeric,text) to service_role;

create or replace function private.finance_method_key(p_method text)
returns text language sql immutable set search_path=''
as $$
  select case lower(trim(coalesce(p_method,'')))
    when 'moncash' then 'moncash'
    when 'natcash' then 'natcash'
    when 'paypal' then 'paypal'
    when 'zelle' then 'zelle'
    when 'bank transfer' then 'bank_transfer_htg'
    when 'bank transfer htg' then 'bank_transfer_htg'
    when 'bank_transfer_htg' then 'bank_transfer_htg'
    when 'virement' then 'bank_transfer_htg'
    when 'virement bancaire' then 'bank_transfer_htg'
    when 'bank transfer usd' then 'bank_transfer_usd'
    when 'bank_transfer_usd' then 'bank_transfer_usd'
    else null end
$$;
revoke all on function private.finance_method_key(text) from public,anon,authenticated;

create or replace function private.finance_method_enabled(p_school uuid,p_method text)
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce((
    select (fs.payment_methods->private.finance_method_key(p_method)->>'enabled')::boolean
    from public.finance_settings fs where fs.school_id=p_school
  ),false)
$$;
revoke all on function private.finance_method_enabled(uuid,text) from public,anon,authenticated;

create or replace function private.finance_payment_htg_limit(p_school uuid,p_method text)
returns numeric language sql stable security definer set search_path=''
as $$
  select nullif(fs.payment_methods->private.finance_method_key(p_method)->>'max_htg','')::numeric
  from public.finance_settings fs where fs.school_id=p_school
$$;
revoke all on function private.finance_payment_htg_limit(uuid,text) from public,anon,authenticated;

create or replace function public.save_finance_payment_methods(p_methods jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); cleaned jsonb:='{}'::jsonb; k text; item jsonb; active boolean; holder text; phone text; email text; bank text; account text; branch text; limit_htg numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if jsonb_typeof(p_methods)<>'object' then raise exception 'invalid_payment_method_settings'; end if;
  foreach k in array array['moncash','natcash','paypal','zelle','bank_transfer_htg','bank_transfer_usd'] loop
    item:=coalesce(p_methods->k,'{}'::jsonb);
    if jsonb_typeof(item)<>'object' then raise exception 'invalid_payment_method_settings'; end if;
    active:=coalesce((item->>'enabled')::boolean,false);
    holder:=left(trim(coalesce(item->>'account_name','')),120);
    phone:=left(trim(coalesce(item->>'phone','')),40);
    email:=left(trim(coalesce(item->>'email','')),254);
    bank:=left(trim(coalesce(item->>'bank_name','')),120);
    account:=left(trim(coalesce(item->>'account_number','')),80);
    branch:=left(trim(coalesce(item->>'branch','')),120);
    limit_htg:=nullif(item->>'max_htg','')::numeric;
    if limit_htg is not null and (limit_htg<=0 or limit_htg>1000000000) then raise exception 'invalid_payment_method_settings'; end if;
    if active and k in ('moncash','natcash') and (holder='' or phone='' or limit_htg is null) then raise exception 'payment_destination_required'; end if;
    if active and k='paypal' and (email='' or position('@' in email)=0) then raise exception 'payment_destination_required'; end if;
    if active and k='zelle' and (holder='' or (phone='' and (email='' or position('@' in email)=0))) then raise exception 'payment_destination_required'; end if;
    if active and k like 'bank_transfer_%' and (holder='' or bank='' or account='') then raise exception 'payment_destination_required'; end if;
    cleaned:=cleaned||jsonb_build_object(k,jsonb_strip_nulls(jsonb_build_object(
      'enabled',active,'account_name',nullif(holder,''),'phone',nullif(phone,''),'email',nullif(email,''),
      'bank_name',nullif(bank,''),'account_number',nullif(account,''),'branch',nullif(branch,''),'max_htg',limit_htg)));
  end loop;
  update public.finance_settings set payment_methods=cleaned,updated_at=now(),updated_by=auth.uid() where school_id=sid;
  if not found then raise exception 'finance_settings_missing'; end if;
end $$;
revoke all on function public.save_finance_payment_methods(jsonb) from public,anon;
grant execute on function public.save_finance_payment_methods(jsonb) to authenticated;

create or replace function public.finance_payment_setup()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); result jsonb;
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'payment_methods',coalesce(fs.payment_methods,'{}'::jsonb),
    'currency_code',coalesce(fs.currency_code,'HTG'),
    'moncash_payment_instructions',coalesce(fs.moncash_payment_instructions,''),
    'natcash_payment_instructions',coalesce(fs.natcash_payment_instructions,''),
    'bank_transfer_instructions',coalesce(fs.bank_transfer_instructions,''),
    'general_payment_instructions',coalesce(fs.general_payment_instructions,''),
    'can_manage',private.finance_manager(sid),
    'brh_rate',(select jsonb_build_object('date',r.effective_date,'rate',r.htg_per_usd,'fetched_at',r.fetched_at,'source_url',r.source_url)
      from public.finance_brh_reference_rates r where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date order by r.fetched_at desc limit 1),
    'latest_brh_date',(select max(r.effective_date) from public.finance_brh_reference_rates r)
  ) into result from public.finance_settings fs where fs.school_id=sid;
  return coalesce(result,jsonb_build_object('payment_methods','{}'::jsonb,'currency_code','HTG'));
end $$;
revoke all on function public.finance_payment_setup() from public,anon;
grant execute on function public.finance_payment_setup() to authenticated;

-- Preserve the existing family finance RPC contract while adding only active,
-- school-configured destinations and the current official BRH snapshot.
alter function public.family_finance_workspace(uuid) rename to family_finance_workspace_base;
revoke all on function public.family_finance_workspace_base(uuid) from public,anon,authenticated;
create or replace function public.family_finance_workspace(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare base jsonb; sid uuid; methods jsonb; rate jsonb; payment_history jsonb;
begin
  base:=public.family_finance_workspace_base(p_student_id);
  sid:=(base->>'school_id')::uuid;
  select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) into methods
  from public.finance_settings fs cross join lateral jsonb_each(fs.payment_methods) p(k,v)
  where fs.school_id=sid and coalesce((v->>'enabled')::boolean,false);
  select jsonb_build_object('date',r.effective_date,'rate',r.htg_per_usd,'fetched_at',r.fetched_at,'source_url',r.source_url)
    into rate from public.finance_brh_reference_rates r
    where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date order by r.fetched_at desc limit 1;
  select coalesce(jsonb_agg(item||jsonb_build_object('exchange_rate_snapshot',p.exchange_rate_snapshot,'exchange_rate_effective_date',p.exchange_rate_effective_date,'exchange_rate_source_url',p.exchange_rate_source_url) order by p.recorded_at desc),'[]'::jsonb)
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
declare pay_user uuid:=auth.uid(); sid uuid; c public.finance_charges; method text; method_key text; reference_value text:=nullif(trim(coalesce(p_reference,'')),''); proof text:=nullif(trim(coalesce(p_proof_storage_path,'')),''); booked numeric; adjustment numeric; remaining numeric; applied numeric; fee_kind text; payment_id uuid;
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
  if method_key in ('moncash','natcash','bank_transfer_htg') and c.currency_code<>'HTG' then raise exception 'payment_currency_mismatch'; end if;
  if method_key in ('paypal','zelle','bank_transfer_usd') and c.currency_code<>'USD' then raise exception 'payment_currency_mismatch'; end if;
  if c.currency_code='USD' and not exists(select 1 from public.finance_brh_reference_rates r where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date) then raise exception 'brh_rate_unavailable'; end if;
  if method_key in ('moncash','natcash') and private.finance_payment_htg_limit(sid,method) is not null and p_amount>private.finance_payment_htg_limit(sid,method) then raise exception 'payment_method_limit_exceeded'; end if;
  if proof is null or split_part(proof,'/',1)<>sid::text or split_part(proof,'/',2)<>pay_user::text or split_part(proof,'/',3)<>c.student_id::text
    or not exists(select 1 from storage.objects o where o.bucket_id='finance-proofs' and o.name=proof) then raise exception 'invalid_proof_path'; end if;
  perform 1 from public.students s where s.id=c.student_id and s.school_id=sid for update;
  select coalesce(sum(p.applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)
    into booked from public.finance_payments p where p.charge_id=c.id and p.status in ('pending','validated');
  select coalesce(sum(a.amount),0) into adjustment from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance';
  remaining:=greatest(0,c.amount-adjustment-booked); applied:=least(p_amount,remaining);
  insert into public.finance_payments(school_id,charge_id,amount,applied_amount,currency_code,payment_method,reference,proof_storage_path,paid_at,recorded_by)
  values(sid,c.id,p_amount,applied,c.currency_code,method,reference_value,proof,now(),pay_user) returning id into payment_id;
  return payment_id;
end $$;
revoke all on function public.submit_family_finance_payment(uuid,numeric,text,text,text) from public,anon;
grant execute on function public.submit_family_finance_payment(uuid,numeric,text,text,text) to authenticated;

create or replace function public.record_finance_payment(p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,p_proof_storage_path text,p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); c public.finance_charges; booked numeric; adjustment numeric; remaining numeric; applied numeric; payment_id uuid; method text:=trim(coalesce(p_payment_method,'')); method_key text:=private.finance_method_key(p_payment_method); reference_value text:=nullif(trim(coalesce(p_reference,'')),''); proof text:=nullif(trim(coalesce(p_proof_storage_path,'')),''); fee_kind text;
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or length(method) not between 2 and 60 or p_paid_at is null then raise exception 'invalid_payment'; end if;
  if method_key is not null then
    if not private.finance_method_enabled(sid,method) then raise exception 'payment_method_disabled'; end if;
    if reference_value is null or char_length(reference_value)>120 then raise exception 'payment_reference_required'; end if;
    if proof is null then raise exception 'payment_proof_required'; end if;
  end if;
  select * into c from public.finance_charges where id=p_charge_id and school_id=sid for update;
  if c.id is null then raise exception 'charge_not_found'; end if;
  if method_key in ('moncash','natcash','bank_transfer_htg') and c.currency_code<>'HTG' then raise exception 'payment_currency_mismatch'; end if;
  if method_key in ('paypal','zelle','bank_transfer_usd') and c.currency_code<>'USD' then raise exception 'payment_currency_mismatch'; end if;
  if c.currency_code='USD' and not exists(select 1 from public.finance_brh_reference_rates r where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date) then raise exception 'brh_rate_unavailable'; end if;
  if method_key in ('moncash','natcash') and private.finance_payment_htg_limit(sid,method) is not null and p_amount>private.finance_payment_htg_limit(sid,method) then raise exception 'payment_method_limit_exceeded'; end if;
  select coalesce(sum(applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
  select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
  remaining:=greatest(0,c.amount-adjustment-booked); applied:=least(p_amount,remaining);
  select fp.fee_type into fee_kind from public.finance_fee_plans fp where fp.id=c.fee_plan_id and fp.school_id=sid;
  if proof is not null and (split_part(proof,'/',1)<>sid::text or split_part(proof,'/',2)<>auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id='finance-proofs' and o.name=proof)) then raise exception 'invalid_proof_path'; end if;
  insert into public.finance_payments(school_id,charge_id,amount,applied_amount,currency_code,payment_method,reference,proof_storage_path,paid_at,recorded_by)
  values(sid,c.id,p_amount,applied,c.currency_code,method,reference_value,proof,p_paid_at,auth.uid()) returning id into payment_id;
  return payment_id;
end $$;
revoke all on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz) from public,anon;
grant execute on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz) to authenticated;

-- Include the immutable FX evidence in the staff ledger as well as the parent history.
create or replace function public.finance_payment_ledger(
  p_academic_year_id uuid default null,
  p_class_id uuid default null,
  p_status text default null,
  p_search text default null,
  p_offset integer default 0,
  p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); total bigint; items jsonb; term text:=left(trim(coalesce(p_search,'')),120); page_size integer:=least(greatest(coalesce(p_limit,50),1),100); page_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_status is not null and p_status not in ('pending','validated','rejected') then raise exception 'invalid_payment_status'; end if;
  select count(*) into total
  from public.finance_payments p
  join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
  join public.students s on s.id=c.student_id and s.school_id=sid
  join public.classes cl on cl.id=c.class_id and cl.school_id=sid
  where p.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)
    and (p_class_id is null or c.class_id=p_class_id)
    and (p_status is null or p.status=p_status)
    and (term='' or position(lower(term) in lower(concat_ws(' ',s.first_name,s.last_name,c.description,cl.name,p.reference,p.payment_method)))>0);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc,q.id desc),'[]'::jsonb) into items
  from (
    select p.*,s.first_name||' '||s.last_name as student_name,c.description as charge_description,cl.name as class_name,
      (select coalesce(sum(x.applied_amount),0) from public.finance_payments x where x.charge_id=p.charge_id and x.status='validated') as charge_paid
    from public.finance_payments p
    join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
    join public.students s on s.id=c.student_id and s.school_id=sid
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    where p.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)
      and (p_class_id is null or c.class_id=p_class_id)
      and (p_status is null or p.status=p_status)
      and (term='' or position(lower(term) in lower(concat_ws(' ',s.first_name,s.last_name,c.description,cl.name,p.reference,p.payment_method)))>0)
    order by p.recorded_at desc,p.id desc limit page_size offset page_offset
  ) q;
  return jsonb_build_object('items',items,'total',total,'offset',page_offset,'limit',page_size);
end $$;
revoke all on function public.finance_payment_ledger(uuid,uuid,text,text,integer,integer) from public,anon;
grant execute on function public.finance_payment_ledger(uuid,uuid,text,text,integer,integer) to authenticated;

create or replace function public.review_finance_payment(p_payment_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); pay public.finance_payments; c public.finance_charges; settings public.finance_settings; booked numeric; adjustment numeric; balance numeric; family record; msg text; credit_id uuid; credit_balance numeric; fx_rate public.finance_brh_reference_rates;
begin
  if auth.uid() is null or sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_decision not in ('validated','rejected') or (p_decision='rejected' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'invalid_review'; end if;
  select * into pay from public.finance_payments where id=p_payment_id and school_id=sid for update;
  if pay.id is null or pay.status<>'pending' then raise exception 'payment_not_pending'; end if;
  select * into c from public.finance_charges where id=pay.charge_id and school_id=sid for update;
  select * into settings from public.finance_settings where school_id=sid;
  if p_decision='validated' then
    if coalesce(settings.proof_required,false) and pay.proof_storage_path is null then raise exception 'payment_proof_required'; end if;
    if pay.currency_code='USD' then
      select * into fx_rate from public.finance_brh_reference_rates r
      where r.effective_date=(now() at time zone 'America/Port-au-Prince')::date order by r.fetched_at desc limit 1;
      if fx_rate.id is null then raise exception 'brh_rate_unavailable'; end if;
    end if;
    select coalesce(sum(applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) into booked from public.finance_payments where charge_id=c.id and status='validated' and id<>pay.id;
    select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
    if booked+pay.applied_amount>c.amount-adjustment then raise exception 'payment_exceeds_balance'; end if;
  end if;
  update public.finance_payments set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(coalesce(p_reason,'')),''),
    exchange_rate_snapshot=case when p_decision='validated' and pay.currency_code='USD' then fx_rate.htg_per_usd else null end,
    exchange_rate_effective_date=case when p_decision='validated' and pay.currency_code='USD' then fx_rate.effective_date else null end,
    exchange_rate_source_url=case when p_decision='validated' and pay.currency_code='USD' then fx_rate.source_url else null end
    where id=pay.id;
  if p_decision='validated' then
    if pay.amount>pay.applied_amount then
      insert into public.finance_student_credits(school_id,student_id,source_payment_id,amount,currency_code,created_by)
      values(sid,c.student_id,pay.id,pay.amount-pay.applied_amount,c.currency_code,auth.uid()) returning id into credit_id;
      perform private.apply_finance_student_credits(sid,c.student_id,c.currency_code);
      select greatest(0,cr.amount-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.credit_id=cr.id),0)) into credit_balance from public.finance_student_credits cr where cr.id=credit_id;
    end if;
    select greatest(0,c.amount-coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)-coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)) into balance;
    msg:=format('Montant : %s %s · Frais : %s · Date : %s · Statut : Validé · Solde restant : %s %s · Kredi ki rete : %s %s · Référence : %s%s',to_char(pay.amount,'FM999999999990D00'),pay.currency_code,c.description,to_char(pay.paid_at at time zone 'America/Port-au-Prince','DD/MM/YYYY'),to_char(balance,'FM999999999990D00'),pay.currency_code,to_char(coalesce(credit_balance,0),'FM999999999990D00'),pay.currency_code,coalesce(pay.reference,'—'),case when pay.currency_code='USD' then format(' · Taux BRH : %s HTG/USD (%s)',fx_rate.htg_per_usd,fx_rate.effective_date) else '' end);
    for family in select distinct p.user_id from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent' where sp.student_id=c.student_id and p.school_id=sid and p.user_id is not null loop
      insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
      values(sid,family.user_id,'finance','Paiement validé',msg,'normal','/dashboard/parent-portal','finance-payment-validated:'||pay.id::text)
      on conflict(school_id,recipient_id,event_key) do nothing;
    end loop;
  end if;
end $$;
revoke all on function public.review_finance_payment(uuid,text,text) from public,anon;
grant execute on function public.review_finance_payment(uuid,text,text) to authenticated;
