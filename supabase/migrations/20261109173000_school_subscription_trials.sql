-- One non-renewable trial per school. This does not grant module access.
create table private.school_subscription_trials (
 school_id uuid primary key references public.schools(id) on delete cascade,
 plan text not null check (plan in ('attendance','school','school_finance')),
 started_at timestamptz not null,
 ends_at timestamptz not null,
 check (ends_at = started_at + interval '720 hours')
);
alter table private.school_subscription_trials enable row level security;
revoke all on private.school_subscription_trials from public,anon,authenticated;

create function private.school_trial_owner_id() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null
    or not private.has_role(sid,array['school_admin'])
    or not exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid()) then
   raise exception 'not_authorized';
 end if;
 return sid;
end $$;
revoke all on function private.school_trial_owner_id() from public,anon,authenticated;

create function public.school_subscription_trial() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 sid uuid:=private.school_trial_owner_id();
 trial_status jsonb;
begin
 select jsonb_build_object('plan',t.plan,'started_at',t.started_at,'ends_at',t.ends_at,'active',t.ends_at>statement_timestamp())
 into trial_status
 from private.school_subscription_trials t
 where t.school_id=sid;
 return trial_status;
end $$;

create function public.choose_school_trial_plan(p_plan text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.school_trial_owner_id(); trial private.school_subscription_trials; at_time timestamptz:=statement_timestamp();
begin
 if p_plan is null or p_plan not in ('attendance','school','school_finance') then raise exception 'invalid_trial_plan';end if;
 perform 1 from public.schools where id=sid for update;
 if exists(select 1 from private.school_paid_subscriptions where school_id=sid)
 and not exists(select 1 from private.school_subscription_trials where school_id=sid) then
  raise exception 'school_trial_unavailable';
 end if;
 insert into private.school_subscription_trials(school_id,plan,started_at,ends_at)
 values(sid,p_plan,at_time,at_time+interval '720 hours')
 on conflict(school_id) do update set plan=excluded.plan
 where school_subscription_trials.ends_at>clock_timestamp()
 returning * into trial;
 if not found then raise exception 'school_trial_expired';end if;
 return jsonb_build_object('plan',trial.plan,'started_at',trial.started_at,'ends_at',trial.ends_at);
end $$;
revoke all on function public.school_subscription_trial(),public.choose_school_trial_plan(text) from public,anon,authenticated;
grant execute on function public.school_subscription_trial(),public.choose_school_trial_plan(text) to authenticated;

-- Internal policy for future write guards. Existing schools without a trial
-- retain their current behavior. A paid subscription is handled separately.
create function private.school_trial_allows_write(p_school uuid,p_module text) returns boolean
language sql stable security definer set search_path='' as $$
 select case
   when p_school is null or p_module is null or p_module not in ('attendance','school','finance') then false
   else coalesce((
     select t.ends_at > statement_timestamp() and (
       p_module='attendance' or
       (p_module='school' and t.plan in ('school','school_finance')) or
       (p_module='finance' and t.plan='school_finance')
     )
     from private.school_subscription_trials t where t.school_id=p_school
   ),true)
 end
$$;
revoke all on function private.school_trial_allows_write(uuid,text) from public,anon,authenticated;

-- Apply the trial rule after the existing school and finance role checks.
do $trial_fee_plan$
declare
 src text;
 anchor text := 'select currency_code into currency from public.finance_settings where school_id=sid;';
begin
 select pg_get_functiondef('public.create_finance_fee_plan(uuid,uuid,text,text,jsonb)'::regprocedure) into src;
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then
  raise exception 'trial_fee_plan_guard_anchor_mismatch';
 end if;
 execute replace(src,anchor,
  'if not private.school_trial_allows_write(sid,''finance'') then raise exception ''school_plan_write_restricted''; end if; '||anchor);
end
$trial_fee_plan$;

-- Preserve each operation's existing role check and lock the write behind its trial plan.
do $trial_finance_writes$
declare entry record; src text; anchor text;
begin
 for entry in select * from (values
  ('public.issue_finance_fee_plan(uuid)','manager'),
  ('public.record_finance_payment_base(uuid,numeric,text,text,text,timestamptz)','member'),
  ('public.review_finance_payment(uuid,text,text)','can_validate'),
  ('public.refund_finance_payment(uuid,numeric,text)','can_validate'),
  ('public.request_finance_adjustment(uuid,text,numeric,text,timestamptz,timestamptz)','manager'),
  ('public.review_finance_adjustment(uuid,text,text)','manager'),
  ('public.revoke_finance_adjustment(uuid,text)','manager'),
  ('public.save_finance_settings(text,boolean,boolean,boolean,boolean,boolean)','manager'),
  ('public.save_finance_payment_methods(jsonb)','manager'),
  ('public.save_finance_payment_instructions(text,text,text,text)','manager')
 ) as guards(signature,role_check) loop
  select pg_get_functiondef(entry.signature::regprocedure) into src;
  anchor:=format('if auth.uid() is null or sid is null or not private.finance_%s(sid) then raise exception ''not_authorized''; end if;',entry.role_check);
  if length(src)-length(replace(src,anchor,''))<>length(anchor) then
   raise exception 'trial_finance_guard_anchor_mismatch: %',entry.signature;
  end if;
  execute replace(src,anchor,anchor||' if not private.school_trial_allows_write(sid,''finance'') then raise exception ''school_plan_write_restricted''; end if;');
 end loop;
end
$trial_finance_writes$;

-- Both family payment overloads use this authorized base function.
do $trial_family_payment$
declare src text; anchor text:='if sid is null or not private.finance_parent_linked(sid,(select student_id from public.finance_charges where id=p_charge_id),pay_user) then raise exception ''not_authorized''; end if;';
begin
 select pg_get_functiondef('public.submit_family_finance_payment_base(uuid,numeric,text,text,text)'::regprocedure) into src;
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then
  raise exception 'trial_family_payment_guard_anchor_mismatch';
 end if;
 execute replace(src,anchor,anchor||' if not private.school_trial_allows_write(sid,''finance'') then raise exception ''school_plan_write_restricted''; end if;');
end
$trial_family_payment$;

-- Check writes after row authorization, including direct grade writes and RPCs.
create function private.enforce_trial_school_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op <> 'INSERT' and not private.school_trial_allows_write(old.school_id,'school') then
  raise exception 'school_plan_write_restricted';
 end if;
 if tg_op <> 'DELETE' and not private.school_trial_allows_write(new.school_id,'school') then
  raise exception 'school_plan_write_restricted';
 end if;
 return null;
end $$;
revoke all on function private.enforce_trial_school_write() from public,anon,authenticated;

-- The reduced general CI schema does not include numeric grades.
do $trial_grade_guard$
begin
 if to_regclass('public.grades') is not null then
  create trigger trial_school_write_grades
  after insert or update or delete on public.grades
  for each row execute function private.enforce_trial_school_write();
 end if;
end
$trial_grade_guard$;
create trigger trial_school_write_bulletins
after insert on public.bulletin_versions
for each row execute function private.enforce_trial_school_write();
create trigger trial_school_write_preschool_bulletins
after insert on public.preschool_bulletin_versions
for each row execute function private.enforce_trial_school_write();

-- AtechOS subscription billing is separate from each school's student payments.
create table private.subscription_billing_operators (
 user_id uuid primary key references public.users(id) on delete cascade,
 enabled boolean not null default true
);
create table private.subscription_payment_methods (
 method text primary key check (method in ('moncash','natcash','paypal','wise')),
 currency text not null check (currency in ('HTG','USD')),
 recipient text not null check (char_length(trim(recipient)) between 2 and 160),
 account text not null check (char_length(trim(account)) between 3 and 254),
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 check ((method in ('moncash','natcash') and currency='HTG')
     or (method in ('paypal','wise') and currency='USD'))
);
create table private.school_subscription_invoices (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 plan text not null check (plan in ('attendance','school','school_finance')),
 currency text not null check (currency in ('HTG','USD')),
 billing_period text not null check (billing_period in ('monthly','yearly')),
 amount numeric(14,2) not null check (amount>0),
 active_students integer not null check (active_students between 0 and 150),
 method text not null references private.subscription_payment_methods(method),
 destination jsonb not null,
 status text not null default 'pending' check (status in ('pending','submitted','paid','rejected','cancelled')),
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '7 days',
 reference text,
 reference_key text generated always as (lower(regexp_replace(trim(reference),'[[:space:]]','','g'))) stored,
 submitted_at timestamptz,
 reviewed_by uuid references public.users(id),
 reviewed_at timestamptz,
 review_note text,
 verified_amount numeric(14,2),
 check (status not in ('submitted','paid','rejected') or (char_length(trim(reference)) between 1 and 160 and submitted_at is not null)),
 check (status not in ('paid','rejected') or (reviewed_by is not null and reviewed_at is not null and char_length(trim(review_note)) between 5 and 1200)),
 check (status<>'paid' or verified_amount=amount)
);
create unique index subscription_invoice_pending_school on private.school_subscription_invoices(school_id)
 where status in ('pending','submitted');
create unique index subscription_invoice_reference on private.school_subscription_invoices(method,reference_key)
 where status in ('submitted','paid');
create index subscription_invoice_school_history on private.school_subscription_invoices(school_id,created_at desc);
create table private.school_paid_subscriptions (
 school_id uuid primary key references public.schools(id),
 plan text not null check (plan in ('attendance','school','school_finance')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 invoice_id uuid not null unique references private.school_subscription_invoices(id),
 check (ends_at>starts_at)
);
create table private.subscription_billing_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.users(id),
 invoice_id uuid references private.school_subscription_invoices(id),
 event text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table private.subscription_billing_operators enable row level security;
alter table private.subscription_payment_methods enable row level security;
alter table private.school_subscription_invoices enable row level security;
alter table private.school_paid_subscriptions enable row level security;
alter table private.subscription_billing_audit enable row level security;
revoke all on private.subscription_billing_operators,private.subscription_payment_methods,
 private.school_subscription_invoices,private.school_paid_subscriptions,private.subscription_billing_audit
 from public,anon,authenticated;

create function public.subscription_billing_operator() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from private.subscription_billing_operators where user_id=auth.uid() and enabled
 )
$$;

create function public.school_subscription_billing_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=private.school_trial_owner_id(); result jsonb;
begin
 select jsonb_build_object(
  'methods',coalesce((select jsonb_agg(to_jsonb(m) order by m.method) from private.subscription_payment_methods m where enabled),'[]'::jsonb),
  'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from private.school_subscription_invoices i where school_id=sid),'[]'::jsonb),
  'subscription',(select to_jsonb(s) from private.school_paid_subscriptions s where school_id=sid)
 ) into result;
 return result;
end $$;

create function public.create_school_subscription_invoice(p_plan text,p_currency text,p_billing_period text,p_method text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.school_trial_owner_id(); students integer; price numeric; destination private.subscription_payment_methods; existing private.school_subscription_invoices; invoice_id uuid;
begin
 if p_plan is null or p_plan not in ('attendance','school','school_finance')
 or p_currency is null or p_currency not in ('HTG','USD')
 or p_billing_period is null or p_billing_period not in ('monthly','yearly') then
  raise exception 'invalid_subscription_selection';
 end if;
 perform 1 from public.schools where id=sid for update;
 if exists(select 1 from private.school_paid_subscriptions
  where school_id=sid and ends_at>clock_timestamp() and plan<>p_plan) then
  raise exception 'subscription_active_plan_change_requires_review';
 end if;
 update private.school_subscription_invoices set status='cancelled'
 where school_id=sid and status='pending' and expires_at<=clock_timestamp();
 select * into existing from private.school_subscription_invoices
 where school_id=sid and status in ('pending','submitted');
 if found then
  if existing.status='pending' and existing.plan=p_plan and existing.currency=p_currency
    and existing.billing_period=p_billing_period and existing.method=p_method then return existing.id;end if;
  raise exception 'subscription_invoice_pending';
 end if;
 select count(*) into students from public.students where school_id=sid and active and school_status='active';
 if students>150 then raise exception 'subscription_quote_required';end if;
 select * into destination from private.subscription_payment_methods where method=p_method and enabled and currency=p_currency;
 if not found then raise exception 'subscription_method_unavailable';end if;
 price:=case p_plan when 'attendance' then case p_currency when 'HTG' then 1950 else 15 end
  when 'school' then case p_currency when 'HTG' then 3250 else 25 end
  else case p_currency when 'HTG' then 4550 else 35 end end;
 if p_billing_period='yearly' then price:=price*10;end if;
 insert into private.school_subscription_invoices(school_id,plan,currency,billing_period,amount,active_students,method,destination,created_by)
 values(sid,p_plan,p_currency,p_billing_period,price,students,p_method,
  jsonb_build_object('recipient',destination.recipient,'account',destination.account),auth.uid())
 returning id into invoice_id;
 insert into private.subscription_billing_audit(actor_id,invoice_id,event) values(auth.uid(),invoice_id,'invoice_created');
 return invoice_id;
end $$;

create function public.cancel_school_subscription_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.school_trial_owner_id();
begin
 update private.school_subscription_invoices set status='cancelled'
 where id=p_invoice and school_id=sid and status='pending';
 if not found then raise exception 'subscription_invoice_not_pending';end if;
 insert into private.subscription_billing_audit(actor_id,invoice_id,event) values(auth.uid(),p_invoice,'invoice_cancelled');
end $$;

create function public.submit_school_subscription_payment(p_invoice uuid,p_reference text) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.school_trial_owner_id();
begin
 if p_reference is null or char_length(trim(p_reference)) not between 1 and 160 then raise exception 'invalid_subscription_reference';end if;
 update private.school_subscription_invoices
 set reference=trim(p_reference),status='submitted',submitted_at=clock_timestamp()
 where id=p_invoice and school_id=sid and status='pending' and expires_at>clock_timestamp();
 if not found then raise exception 'subscription_invoice_not_pending';end if;
 insert into private.subscription_billing_audit(actor_id,invoice_id,event) values(auth.uid(),p_invoice,'payment_submitted');
exception when unique_violation then raise exception 'subscription_reference_used';
end $$;

create function public.subscription_billing_admin_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.subscription_billing_operator() then raise exception 'not_authorized';end if;
 return jsonb_build_object(
  'methods',coalesce((select jsonb_agg(to_jsonb(m) order by m.method) from private.subscription_payment_methods m),'[]'::jsonb),
  'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from (
   select i.*,to_jsonb(s)->>'name' as school_name from private.school_subscription_invoices i
   join public.schools s on s.id=i.school_id order by (i.status='submitted') desc,i.created_at desc limit 200
  ) i),'[]'::jsonb)
 );
end $$;

create function public.save_subscription_payment_method(p_method text,p_recipient text,p_account text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare currency_code text;
begin
 if not public.subscription_billing_operator() then raise exception 'not_authorized';end if;
 if p_method is null or p_method not in ('moncash','natcash','paypal','wise')
 or p_recipient is null or char_length(trim(p_recipient)) not between 2 and 160
 or p_account is null or p_enabled is null then raise exception 'invalid_subscription_method';end if;
 if p_method in ('moncash','natcash') then
  currency_code:='HTG';
  if p_account !~ '^\+509[0-9]{8}$' then raise exception 'invalid_subscription_method';end if;
 else
  currency_code:='USD';
  if char_length(p_account)>254 or p_account !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_subscription_method';end if;
 end if;
 insert into private.subscription_payment_methods(method,currency,recipient,account,enabled)
 values(p_method,currency_code,trim(p_recipient),trim(p_account),p_enabled)
 on conflict(method) do update set recipient=excluded.recipient,account=excluded.account,enabled=excluded.enabled,updated_at=clock_timestamp();
 insert into private.subscription_billing_audit(actor_id,event,details)
 values(auth.uid(),'payment_method_saved',jsonb_build_object('method',p_method,'enabled',p_enabled));
end $$;

create function public.review_school_subscription_payment(p_invoice uuid,p_approve boolean,p_verified_amount numeric,p_currency text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare invoice private.school_subscription_invoices; current_subscription private.school_paid_subscriptions; period_start timestamptz; invoice_school uuid;
begin
 if not public.subscription_billing_operator() then raise exception 'not_authorized';end if;
 if p_approve is null or p_note is null or char_length(trim(p_note)) not between 5 and 1200 then raise exception 'subscription_review_note_required';end if;
 select school_id into invoice_school from private.school_subscription_invoices where id=p_invoice;
 if not found then raise exception 'subscription_invoice_not_submitted';end if;
 perform 1 from public.schools where id=invoice_school for update;
 select * into invoice from private.school_subscription_invoices where id=p_invoice for update;
 if not found or invoice.status<>'submitted' then raise exception 'subscription_invoice_not_submitted';end if;
 if p_approve then
  if p_verified_amount is null or p_verified_amount<>invoice.amount or p_currency is distinct from invoice.currency then
   raise exception 'subscription_payment_mismatch';
  end if;
  select * into current_subscription from private.school_paid_subscriptions where school_id=invoice.school_id;
  if found and current_subscription.ends_at>clock_timestamp() and current_subscription.plan<>invoice.plan then
   raise exception 'subscription_active_plan_change_requires_review';
  end if;
  period_start:=greatest(statement_timestamp(),current_subscription.ends_at,
   (select ends_at from private.school_subscription_trials where school_id=invoice.school_id));
  insert into private.school_paid_subscriptions(school_id,plan,starts_at,ends_at,invoice_id)
  values(invoice.school_id,invoice.plan,period_start,
   period_start+case invoice.billing_period when 'yearly' then interval '1 year' else interval '1 month' end,invoice.id)
  on conflict(school_id) do update set
   plan=excluded.plan,
   starts_at=case when school_paid_subscriptions.ends_at>clock_timestamp() then school_paid_subscriptions.starts_at else excluded.starts_at end,
   ends_at=excluded.ends_at,invoice_id=excluded.invoice_id;
 end if;
 update private.school_subscription_invoices
 set status=case when p_approve then 'paid' else 'rejected' end,
  reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note),
  verified_amount=case when p_approve then p_verified_amount else null end
 where id=invoice.id;
 insert into private.subscription_billing_audit(actor_id,invoice_id,event,details)
 values(auth.uid(),invoice.id,case when p_approve then 'payment_approved' else 'payment_rejected' end,
  jsonb_build_object('note',trim(p_note),'amount',p_verified_amount,'currency',p_currency));
end $$;

-- An active paid period takes priority. Future paid periods preserve the trial.
create or replace function private.school_trial_allows_write(p_school uuid,p_module text) returns boolean
language sql stable security definer set search_path='' as $$
 select case
  when p_school is null or p_module is null or p_module not in ('attendance','school','finance') then false
  else coalesce(
   (select p_module='attendance' or (p_module='school' and s.plan in ('school','school_finance')) or (p_module='finance' and s.plan='school_finance')
    from private.school_paid_subscriptions s where school_id=p_school and starts_at<=statement_timestamp() and ends_at>statement_timestamp()),
   (select t.ends_at>statement_timestamp() and (p_module='attendance' or (p_module='school' and t.plan in ('school','school_finance')) or (p_module='finance' and t.plan='school_finance'))
    from private.school_subscription_trials t where school_id=p_school),
   not exists(select 1 from private.school_paid_subscriptions where school_id=p_school)
  )
 end
$$;

revoke all on function public.subscription_billing_operator(),public.school_subscription_billing_workspace(),
 public.create_school_subscription_invoice(text,text,text,text),public.cancel_school_subscription_invoice(uuid),
 public.submit_school_subscription_payment(uuid,text),public.subscription_billing_admin_workspace(),
 public.save_subscription_payment_method(text,text,text,boolean),
 public.review_school_subscription_payment(uuid,boolean,numeric,text,text) from public,anon,authenticated;
grant execute on function public.subscription_billing_operator(),public.school_subscription_billing_workspace(),
 public.create_school_subscription_invoice(text,text,text,text),public.cancel_school_subscription_invoice(uuid),
 public.submit_school_subscription_payment(uuid,text),public.subscription_billing_admin_workspace(),
 public.save_subscription_payment_method(text,text,text,boolean),
 public.review_school_subscription_payment(uuid,boolean,numeric,text,text) to authenticated;

-- Apply the shared plan rule to pedagogical writes, including privileged RPCs.
-- Older/reduced CI schemas may omit a relation or its tenant column.
do $school_plan_tables$
declare target text;
begin
 foreach target in array array[
  'assignments','subjects','class_subjects','school_grading_settings','grading_periods',
  'exam_schedule','teacher_exam_submissions','grade_corrections','grade_deadline_exceptions',
  'preschool_competencies','preschool_evaluations','preschool_student_remarks',
  'preschool_program_settings','confirmed_official_exam_dates'
 ] loop
  if exists(select 1 from information_schema.columns
   where table_schema='public' and table_name=target and column_name='school_id') then
   execute format('create trigger trial_school_write_guard after insert or update or delete on public.%I for each row execute function private.enforce_trial_school_write()',target);
  end if;
 end loop;
end
$school_plan_tables$;

-- Receipt/version rows inherit the plan from their parent rather than accepting
-- a tenant identifier from the caller.
create function private.enforce_trial_related_school_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if tg_op<>'INSERT' then
  execute format('select school_id from public.%I where id=$1',tg_argv[0])
  into sid using (to_jsonb(old)->>tg_argv[1])::uuid;
  -- A parent cascade may have already removed the parent. Its own AFTER
  -- trigger still checks the plan and rolls back the entire delete if denied.
  if (sid is not null or tg_op<>'DELETE') and not private.school_trial_allows_write(sid,'school') then
   raise exception 'school_plan_write_restricted';
  end if;
 end if;
 if tg_op<>'DELETE' then
  execute format('select school_id from public.%I where id=$1',tg_argv[0])
  into sid using (to_jsonb(new)->>tg_argv[1])::uuid;
  if not private.school_trial_allows_write(sid,'school') then raise exception 'school_plan_write_restricted';end if;
 end if;
 return null;
end $$;
revoke all on function private.enforce_trial_related_school_write() from public,anon,authenticated;

do $school_plan_related_tables$
declare target record;
begin
 for target in select * from (values
  ('assignment_receipts','assignments','assignment_id'),
  ('exam_schedule_versions','exam_schedule','exam_id')
 ) as guards(child,parent,foreign_key) loop
  if exists(select 1 from information_schema.columns
   where table_schema='public' and table_name=target.child and column_name=target.foreign_key) then
   execute format('create trigger trial_related_school_write_guard after insert or update or delete on public.%I for each row execute function private.enforce_trial_related_school_write(%L,%L)',target.child,target.parent,target.foreign_key);
  end if;
 end loop;
end
$school_plan_related_tables$;

-- Preserve the audited onboarding logic and make trial enrollment atomic with
-- school creation. The old seven-argument entry point defaults to Attendance.
alter function public.create_school_onboarding(text,text,text,text,text,text,text)
 rename to create_school_onboarding_before_subscription;
revoke all on function public.create_school_onboarding_before_subscription(text,text,text,text,text,text,text)
 from public,anon,authenticated;

create function public.create_school_onboarding(
 p_school_name text,p_school_code text,p_school_email text,p_school_phone text,
 p_school_address text,p_admin_full_name text,p_admin_phone text,p_trial_plan text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if p_trial_plan is null or p_trial_plan not in ('attendance','school','school_finance') then
  raise exception 'invalid_trial_plan';
 end if;
 if auth.uid() is null then raise exception 'not_authenticated';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
 sid:=public.create_school_onboarding_before_subscription(
  p_school_name,p_school_code,p_school_email,p_school_phone,
  p_school_address,p_admin_full_name,p_admin_phone
 );
 insert into private.school_subscription_trials(school_id,plan,started_at,ends_at)
 values(sid,p_trial_plan,statement_timestamp(),statement_timestamp()+interval '720 hours');
 return sid;
end $$;

create function public.create_school_onboarding(
 p_school_name text,p_school_code text,p_school_email text default null,p_school_phone text default null,
 p_school_address text default null,p_admin_full_name text default null,p_admin_phone text default null
) returns uuid
language sql security definer set search_path='' as $$
 select public.create_school_onboarding(p_school_name,p_school_code,p_school_email,p_school_phone,
  p_school_address,p_admin_full_name,p_admin_phone,'attendance')
$$;
revoke all on function
 public.create_school_onboarding(text,text,text,text,text,text,text),
 public.create_school_onboarding(text,text,text,text,text,text,text,text)
 from public,anon,authenticated;
grant execute on function
 public.create_school_onboarding(text,text,text,text,text,text,text),
 public.create_school_onboarding(text,text,text,text,text,text,text,text)
 to authenticated;
