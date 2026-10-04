-- Finance build 09A: school-scoped fees, installment obligations, payments,
-- concessions, validation, parent notices and append-only audit history.
-- No existing academic record is edited or removed by this migration.

create table public.finance_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  director_can_validate boolean not null default false,
  proof_required boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create table public.finance_fee_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id),
  class_id uuid not null references public.classes(id),
  fee_type text not null check (fee_type in ('inscription','rentree','class_fee')),
  label text not null check (length(trim(label)) between 2 and 120),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id),
  unique (id, school_id)
);
create index finance_fee_plans_school_year on public.finance_fee_plans(school_id,academic_year_id,class_id,active);

create table public.finance_fee_installments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  fee_plan_id uuid not null,
  installment_number smallint not null check (installment_number > 0),
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  foreign key (fee_plan_id,school_id) references public.finance_fee_plans(id,school_id),
  unique (fee_plan_id,installment_number),
  unique (id,school_id,fee_plan_id)
);

create table public.finance_charges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id),
  academic_year_id uuid not null references public.academic_years(id),
  class_id uuid not null references public.classes(id),
  fee_plan_id uuid not null,
  fee_installment_id uuid not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  due_date date not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id),
  unique (id,school_id),
  foreign key (fee_plan_id,school_id) references public.finance_fee_plans(id,school_id),
  foreign key (fee_installment_id,school_id,fee_plan_id) references public.finance_fee_installments(id,school_id,fee_plan_id),
  unique (student_id,fee_installment_id)
);
create index finance_charges_school_date on public.finance_charges(school_id,due_date desc);
create index finance_charges_student_year on public.finance_charges(school_id,student_id,academic_year_id);

create table public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  charge_id uuid not null references public.finance_charges(id),
  amount numeric(12,2) not null check (amount > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  payment_method text not null check (length(trim(payment_method)) between 2 and 60),
  reference text check (reference is null or length(reference) <= 120),
  proof_storage_path text,
  paid_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','validated','rejected')),
  recorded_by uuid not null references public.users(id),
  recorded_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  review_reason text,
  foreign key (charge_id,school_id) references public.finance_charges(id,school_id)
);
create index finance_payments_charge_status on public.finance_payments(school_id,charge_id,status,recorded_at desc);
create index finance_payments_school_created on public.finance_payments(school_id,recorded_at desc);

create table public.finance_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  charge_id uuid not null references public.finance_charges(id),
  adjustment_type text not null check (adjustment_type in ('scholarship','half_scholarship','discount','exception','manual_exemption','temporary_clearance')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  reason text not null check (length(trim(reason)) between 3 and 500),
  valid_from timestamptz,
  valid_until timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  review_reason text,
  foreign key (charge_id,school_id) references public.finance_charges(id,school_id),
  check (
    (adjustment_type='temporary_clearance' and amount=0 and valid_from is not null and valid_until is not null and valid_until>valid_from)
    or (adjustment_type<>'temporary_clearance' and amount>0 and valid_from is null and valid_until is null)
  )
);
create index finance_adjustments_charge_status on public.finance_adjustments(school_id,charge_id,status);

create table public.finance_audit_events (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_id uuid references public.users(id),
  actor_role text,
  entity text not null,
  entity_id text not null,
  action text not null check (action in ('created','updated','deleted')),
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);
create index finance_audit_school_time on public.finance_audit_events(school_id,occurred_at desc);

create schema if not exists private;

create or replace function private.finance_member(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and (
    exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role in ('school_admin','director','secretary','accountant'))
  )
$$;

create or replace function private.finance_manager(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and (
    exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role in ('school_admin','director'))
  )
$$;

create or replace function private.finance_can_validate(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and (
    exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role in ('school_admin','accountant'))
    or (coalesce((select fs.director_can_validate from public.finance_settings fs where fs.school_id=p_school),false)
      and exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role='director'))
  )
$$;

create or replace function private.log_finance_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_before jsonb; v_after jsonb; v_school uuid; v_id text; v_role text;
begin
  if tg_op<>'INSERT' then v_before:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then v_after:=to_jsonb(new); end if;
  v_school:=coalesce(nullif(v_after->>'school_id','')::uuid,nullif(v_before->>'school_id','')::uuid);
  v_id:=coalesce(v_after->>'id',v_before->>'id',v_after->>'school_id',v_before->>'school_id');
  select m.role::text into v_role from public.school_members m where m.school_id=v_school and m.user_id=auth.uid() and m.enabled order by case m.role when 'school_admin' then 0 when 'director' then 1 when 'accountant' then 2 when 'secretary' then 3 else 4 end limit 1;
  insert into public.finance_audit_events(school_id,actor_id,actor_role,entity,entity_id,action,before_data,after_data)
  values(v_school,auth.uid(),v_role,tg_table_name,v_id,lower(tg_op),v_before,v_after);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

create trigger finance_settings_audit after insert or update or delete on public.finance_settings for each row execute function private.log_finance_event();
create trigger finance_fee_plans_audit after insert or update or delete on public.finance_fee_plans for each row execute function private.log_finance_event();
create trigger finance_installments_audit after insert or update or delete on public.finance_fee_installments for each row execute function private.log_finance_event();
create trigger finance_charges_audit after insert or update or delete on public.finance_charges for each row execute function private.log_finance_event();
create trigger finance_payments_audit after insert or update or delete on public.finance_payments for each row execute function private.log_finance_event();
create trigger finance_adjustments_audit after insert or update or delete on public.finance_adjustments for each row execute function private.log_finance_event();

alter table public.finance_settings enable row level security;
alter table public.finance_fee_plans enable row level security;
alter table public.finance_fee_installments enable row level security;
alter table public.finance_charges enable row level security;
alter table public.finance_payments enable row level security;
alter table public.finance_adjustments enable row level security;
alter table public.finance_audit_events enable row level security;

grant select on public.finance_settings,public.finance_fee_plans,public.finance_fee_installments,public.finance_charges,public.finance_payments,public.finance_adjustments to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.finance_settings,public.finance_fee_plans,public.finance_fee_installments,public.finance_charges,public.finance_payments,public.finance_adjustments,public.finance_audit_events from public,anon,authenticated;
revoke all on public.finance_audit_events from public,anon,authenticated;
create policy finance_settings_read on public.finance_settings for select to authenticated using(private.finance_member(school_id));
create policy finance_fee_plans_read on public.finance_fee_plans for select to authenticated using(private.finance_member(school_id));
create policy finance_installments_read on public.finance_fee_installments for select to authenticated using(private.finance_member(school_id));
create policy finance_charges_read on public.finance_charges for select to authenticated using(private.finance_member(school_id));
create policy finance_payments_read on public.finance_payments for select to authenticated using(private.finance_member(school_id));
create policy finance_adjustments_read on public.finance_adjustments for select to authenticated using(private.finance_member(school_id));
create policy finance_audit_read on public.finance_audit_events for select to authenticated using(
  private.finance_manager(school_id)
  or (actor_id=(select auth.uid()) and private.finance_member(school_id))
);
grant select on public.finance_audit_events to authenticated;
grant usage on schema private to authenticated;
revoke all on function private.finance_member(uuid),private.finance_manager(uuid),private.finance_can_validate(uuid) from public,anon;
grant execute on function private.finance_member(uuid),private.finance_manager(uuid),private.finance_can_validate(uuid) to authenticated;
revoke all on function private.log_finance_event() from public,anon,authenticated;

-- Proofs are private files. The first two path components are school and uploader IDs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('finance-proofs','finance-proofs',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy finance_proofs_read on storage.objects for select to authenticated using(
  bucket_id='finance-proofs' and case when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then private.finance_member(((storage.foldername(name))[1])::uuid) else false end
);
create policy finance_proofs_insert on storage.objects for insert to authenticated with check(
  bucket_id='finance-proofs'
  and (storage.foldername(name))[1]=(select public.get_my_school_id())::text
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and case when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then private.finance_member(((storage.foldername(name))[1])::uuid) else false end
);

create or replace function public.finance_workspace(p_academic_year_id uuid default null,p_class_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); expected numeric; paid numeric; pending integer; validated_count integer;
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_academic_year_id is not null and not exists(select 1 from public.academic_years y where y.id=p_academic_year_id and y.school_id=sid) then raise exception 'invalid_year'; end if;
  if p_class_id is not null and not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)) then raise exception 'invalid_class'; end if;
  select coalesce(sum(c.amount-coalesce(a.adjusted,0)),0),coalesce(sum(p.paid),0),coalesce(sum(p.pending),0)::integer,coalesce(sum(p.validated_count),0)::integer
  into expected,paid,pending,validated_count
  from public.finance_charges c
  left join lateral (select sum(x.amount) adjusted from public.finance_adjustments x where x.charge_id=c.id and x.status='approved' and x.adjustment_type<>'temporary_clearance') a on true
  left join lateral (select sum(x.amount) filter(where x.status='validated') paid,count(*) filter(where x.status='pending') pending,count(*) filter(where x.status='validated') validated_count from public.finance_payments x where x.charge_id=c.id) p on true
  where c.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id);
  return jsonb_build_object(
    'settings',(select to_jsonb(f) from public.finance_settings f where f.school_id=sid),
    'years',(select coalesce(jsonb_agg(to_jsonb(y) order by y.start_date desc),'[]'::jsonb) from public.academic_years y where y.school_id=sid),
    'classes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'academic_year_id',c.academic_year_id,'enabled',c.enabled) order by c.name),'[]'::jsonb) from public.classes c where c.school_id=sid and c.enabled),
    'summary',jsonb_build_object('expected',expected,'paid',paid,'pending_payments',pending,'validated_payment_count',validated_count,'balance',greatest(0,expected-paid)),
    'plans',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) from (select p.*,c.name as class_name,y.name as academic_year_name,(select coalesce(jsonb_agg(to_jsonb(i) order by i.installment_number),'[]'::jsonb) from public.finance_fee_installments i where i.fee_plan_id=p.id) as installments from public.finance_fee_plans p join public.classes c on c.id=p.class_id join public.academic_years y on y.id=p.academic_year_id where p.school_id=sid and (p_academic_year_id is null or p.academic_year_id=p_academic_year_id) and (p_class_id is null or p.class_id=p_class_id) order by p.created_at desc limit 200) q),
    'charges',(select coalesce(jsonb_agg(to_jsonb(q) order by q.due_date desc),'[]'::jsonb) from (select c.id,c.student_id,c.academic_year_id,c.class_id,c.fee_plan_id,c.fee_installment_id,c.description,c.amount,c.currency_code,c.due_date,c.created_at,s.first_name||' '||s.last_name as student_name,cl.name as class_name,y.name as academic_year_name,coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0) as adjusted_amount,coalesce((select sum(p.amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0) as paid_amount,coalesce((select sum(p.amount) from public.finance_payments p where p.charge_id=c.id and p.status='pending'),0) as pending_amount from public.finance_charges c join public.students s on s.id=c.student_id join public.classes cl on cl.id=c.class_id join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id) order by c.due_date desc,c.created_at desc limit 500) q),
    'payments',(select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc),'[]'::jsonb) from (select p.*,s.first_name||' '||s.last_name as student_name,c.description as charge_description,c.due_date as charge_due_date,cl.name as class_name,(select coalesce(sum(x.amount),0) from public.finance_payments x where x.charge_id=p.charge_id and x.status='validated') as charge_paid from public.finance_payments p join public.finance_charges c on c.id=p.charge_id join public.students s on s.id=c.student_id join public.classes cl on cl.id=c.class_id where p.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id) order by p.recorded_at desc limit 500) q),
    'adjustments',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) from (select a.*,s.first_name||' '||s.last_name as student_name,c.description as charge_description from public.finance_adjustments a join public.finance_charges c on c.id=a.charge_id join public.students s on s.id=c.student_id where a.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id) order by a.created_at desc limit 500) q),
    'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.occurred_at desc),'[]'::jsonb) from (select e.id,e.actor_id,e.actor_role,e.entity,e.entity_id,e.action,e.before_data,e.after_data,e.occurred_at,u.full_name as actor_name from public.finance_audit_events e left join public.users u on u.id=e.actor_id where e.school_id=sid and (private.finance_manager(sid) or e.actor_id=auth.uid()) order by e.occurred_at desc limit 100) a),
    'can_manage',private.finance_manager(sid),
    'can_validate',private.finance_can_validate(sid),
    'can_record',private.finance_member(sid)
  );
end $$;

create or replace function public.save_finance_settings(p_currency_code text,p_director_can_validate boolean,p_proof_required boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if p_currency_code !~ '^[A-Z]{3}$' then raise exception 'invalid_currency_code'; end if;
  insert into public.finance_settings(school_id,currency_code,director_can_validate,proof_required,updated_at,updated_by)
  values(sid,p_currency_code,p_director_can_validate,p_proof_required,now(),auth.uid())
  on conflict(school_id) do update set currency_code=excluded.currency_code,director_can_validate=excluded.director_can_validate,proof_required=excluded.proof_required,updated_at=now(),updated_by=auth.uid();
end $$;

create or replace function public.create_finance_fee_plan(p_academic_year_id uuid,p_class_id uuid,p_fee_type text,p_label text,p_installments jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); plan_id uuid; currency text; item jsonb; n integer:=0; year_start date; year_end date; fee_label text:=trim(coalesce(p_label,''));
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  select currency_code into currency from public.finance_settings where school_id=sid;
  if currency is null then raise exception 'finance_settings_required'; end if;
  if p_fee_type not in ('inscription','rentree','class_fee') or length(fee_label) not between 2 and 120 then raise exception 'invalid_fee_plan'; end if;
  select start_date,end_date into year_start,year_end from public.academic_years where id=p_academic_year_id and school_id=sid;
  if year_start is null or not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=sid and c.academic_year_id=p_academic_year_id and c.enabled) then raise exception 'invalid_class_or_year'; end if;
  if jsonb_typeof(p_installments)<>'array' or jsonb_array_length(p_installments)=0 or jsonb_array_length(p_installments)>12 then raise exception 'invalid_installments'; end if;
  insert into public.finance_fee_plans(school_id,academic_year_id,class_id,fee_type,label,currency_code,created_by)
  values(sid,p_academic_year_id,p_class_id,p_fee_type,fee_label,currency,auth.uid()) returning id into plan_id;
  for item in select value from jsonb_array_elements(p_installments) loop
    n:=n+1;
    if coalesce((item->>'amount')::numeric,0)<=0 or nullif(item->>'due_date','') is null then raise exception 'invalid_installment'; end if;
    if (item->>'due_date')::date < year_start or (item->>'due_date')::date > year_end then raise exception 'due_date_outside_academic_year'; end if;
    insert into public.finance_fee_installments(school_id,fee_plan_id,installment_number,amount,due_date)
    values(sid,plan_id,n,(item->>'amount')::numeric,(item->>'due_date')::date);
  end loop;
  return plan_id;
end $$;

create or replace function public.issue_finance_fee_plan(p_fee_plan_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); p public.finance_fee_plans; inserted integer;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  select * into p from public.finance_fee_plans where id=p_fee_plan_id and school_id=sid and active for update;
  if p.id is null then raise exception 'fee_plan_not_found'; end if;
  insert into public.finance_charges(school_id,student_id,academic_year_id,class_id,fee_plan_id,fee_installment_id,description,amount,currency_code,due_date,created_by)
  select sid,s.id,p.academic_year_id,p.class_id,p.id,i.id,p.label||' — '||i.installment_number::text,i.amount,p.currency_code,i.due_date,auth.uid()
  from public.enrollments e join public.students s on s.id=e.student_id and s.school_id=sid and s.active and s.school_status='active'
  join public.classes c on c.id=e.class_id and c.id=p.class_id and c.school_id=sid and c.academic_year_id=p.academic_year_id and c.enabled
  join public.finance_fee_installments i on i.fee_plan_id=p.id and i.school_id=sid
  where e.school_id=sid and e.class_id=p.class_id and e.status='active'
  on conflict(student_id,fee_installment_id) do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end $$;

create or replace function public.record_finance_payment(p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,p_proof_storage_path text,p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); c public.finance_charges; settings public.finance_settings; booked numeric; adjustment numeric; payment_id uuid; method text:=trim(coalesce(p_payment_method,'')); proof text:=nullif(trim(coalesce(p_proof_storage_path,'')), '');
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
    if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or length(method) not between 2 and 60 or p_paid_at is null then raise exception 'invalid_payment'; end if;
  select * into c from public.finance_charges where id=p_charge_id and school_id=sid for update;
  if c.id is null then raise exception 'charge_not_found'; end if;
  select * into settings from public.finance_settings where school_id=sid;
  select coalesce(sum(amount),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
  select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
  if booked+p_amount>c.amount-adjustment then raise exception 'payment_exceeds_balance'; end if;
  if proof is not null and (split_part(proof,'/',1)<>sid::text or split_part(proof,'/',2)<>auth.uid()::text
    or not exists(select 1 from storage.objects o where o.bucket_id='finance-proofs' and o.name=proof)) then raise exception 'invalid_proof_path'; end if;
  insert into public.finance_payments(school_id,charge_id,amount,currency_code,payment_method,reference,proof_storage_path,paid_at,recorded_by)
  values(sid,c.id,p_amount,c.currency_code,method,nullif(trim(coalesce(p_reference,'')),''),proof,p_paid_at,auth.uid()) returning id into payment_id;
  return payment_id;
end $$;

create or replace function public.review_finance_payment(p_payment_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); pay public.finance_payments; c public.finance_charges; settings public.finance_settings; booked numeric; adjustment numeric; balance numeric; family record; msg text;
begin
  if auth.uid() is null or sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_decision not in ('validated','rejected') or (p_decision='rejected' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'invalid_review'; end if;
  select * into pay from public.finance_payments where id=p_payment_id and school_id=sid for update;
  if pay.id is null or pay.status<>'pending' then raise exception 'payment_not_pending'; end if;
  select * into c from public.finance_charges where id=pay.charge_id and school_id=sid for update;
  select * into settings from public.finance_settings where school_id=sid;
  if p_decision='validated' then
    if coalesce(settings.proof_required,false) and pay.proof_storage_path is null then raise exception 'payment_proof_required'; end if;
    select coalesce(sum(amount),0) into booked from public.finance_payments where charge_id=c.id and status='validated' and id<>pay.id;
    select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
    if booked+pay.amount>c.amount-adjustment then raise exception 'payment_exceeds_balance'; end if;
  end if;
  update public.finance_payments set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(coalesce(p_reason,'')),'') where id=pay.id;
  if p_decision='validated' then
    select greatest(0,c.amount-coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)-coalesce((select sum(p.amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)) into balance;
    msg:=format('Montant : %s %s · Frais : %s · Date : %s · Statut : Validé · Solde restant : %s %s · Référence : %s',to_char(pay.amount,'FM999999999990D00'),pay.currency_code,c.description,to_char(pay.paid_at at time zone 'America/Port-au-Prince','DD/MM/YYYY'),to_char(balance,'FM999999999990D00'),pay.currency_code,coalesce(pay.reference,'—'));
    for family in select distinct p.user_id from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent' where sp.student_id=c.student_id and p.school_id=sid and p.user_id is not null loop
      insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
      values(sid,family.user_id,'finance','Paiement validé',msg,'normal','/dashboard/parent-portal','finance-payment-validated:'||pay.id::text)
      on conflict(school_id,recipient_id,event_key) do nothing;
    end loop;
  end if;
end $$;

create or replace function public.request_finance_adjustment(p_charge_id uuid,p_adjustment_type text,p_amount numeric,p_reason text,p_valid_from timestamptz default null,p_valid_until timestamptz default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); c public.finance_charges; adjustment_id uuid;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if p_adjustment_type not in ('scholarship','half_scholarship','discount','exception','manual_exemption','temporary_clearance') or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_adjustment'; end if;
  select * into c from public.finance_charges where id=p_charge_id and school_id=sid for update;
  if c.id is null then raise exception 'charge_not_found'; end if;
  if p_adjustment_type='temporary_clearance' then
    if coalesce(p_amount,0)<>0 or p_valid_from is null or p_valid_until is null or p_valid_until<=p_valid_from then raise exception 'invalid_temporary_clearance'; end if;
  elsif p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'invalid_adjustment_amount'; end if;
  insert into public.finance_adjustments(school_id,charge_id,adjustment_type,amount,currency_code,reason,valid_from,valid_until,created_by)
  values(sid,c.id,p_adjustment_type,coalesce(p_amount,0),c.currency_code,trim(p_reason),p_valid_from,p_valid_until,auth.uid()) returning id into adjustment_id;
  return adjustment_id;
end $$;

create or replace function public.review_finance_adjustment(p_adjustment_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); a public.finance_adjustments; c public.finance_charges; booked numeric; prior numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if p_decision not in ('approved','rejected') or (p_decision='rejected' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'invalid_review'; end if;
  select * into a from public.finance_adjustments where id=p_adjustment_id and school_id=sid for update;
  if a.id is null or a.status<>'pending' then raise exception 'adjustment_not_pending'; end if;
  select * into c from public.finance_charges where id=a.charge_id and school_id=sid for update;
  if p_decision='approved' and a.adjustment_type<>'temporary_clearance' then
    select coalesce(sum(amount),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
    select coalesce(sum(amount),0) into prior from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
    if a.amount>c.amount-booked-prior then raise exception 'adjustment_exceeds_balance'; end if;
  end if;
  update public.finance_adjustments set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(coalesce(p_reason,'')),'') where id=a.id;
end $$;

create or replace function public.revoke_finance_adjustment(p_adjustment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); a public.finance_adjustments; c public.finance_charges; booked numeric; prior numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason_required'; end if;
  select * into a from public.finance_adjustments where id=p_adjustment_id and school_id=sid and status='approved' for update;
  if a.id is null then raise exception 'approved_adjustment_not_found'; end if;
  select * into c from public.finance_charges where id=a.charge_id and school_id=sid for update;
  if a.adjustment_type<>'temporary_clearance' then
    select coalesce(sum(amount),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
    select coalesce(sum(amount),0) into prior from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance' and id<>a.id;
    if booked>c.amount-prior then raise exception 'payment_balance_conflict'; end if;
  end if;
  update public.finance_adjustments set status='revoked',reviewed_by=auth.uid(),reviewed_at=now(),review_reason=trim(p_reason) where id=a.id;
end $$;

revoke all on function public.finance_workspace(uuid,uuid),public.save_finance_settings(text,boolean,boolean),public.create_finance_fee_plan(uuid,uuid,text,text,jsonb),public.issue_finance_fee_plan(uuid),public.record_finance_payment(uuid,numeric,text,text,text,timestamptz),public.review_finance_payment(uuid,text,text),public.request_finance_adjustment(uuid,text,numeric,text,timestamptz,timestamptz),public.review_finance_adjustment(uuid,text,text),public.revoke_finance_adjustment(uuid,text) from public,anon;
grant execute on function public.finance_workspace(uuid,uuid),public.save_finance_settings(text,boolean,boolean),public.create_finance_fee_plan(uuid,uuid,text,text,jsonb),public.issue_finance_fee_plan(uuid),public.record_finance_payment(uuid,numeric,text,text,text,timestamptz),public.review_finance_payment(uuid,text,text),public.request_finance_adjustment(uuid,text,numeric,text,timestamptz,timestamptz),public.review_finance_adjustment(uuid,text,text),public.revoke_finance_adjustment(uuid,text) to authenticated;
