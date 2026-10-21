-- Parent-only summaries for a single verified linked child. These RPCs expose
-- the minimum family data needed by the portal; the underlying finance and
-- student-follow-up tables remain unavailable for direct parent queries.

create or replace function public.family_finance_summary(p_student_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  sid uuid;
  totals jsonb;
  charges jsonb;
  charge_count bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select s.school_id into sid from public.students s where s.id=p_student_id;
  if sid is null or not private.finance_parent_linked(sid,p_student_id,auth.uid()) then
    raise exception 'not_authorized';
  end if;

  with per_charge as (
    select c.id,c.description,c.currency_code,c.due_date,cl.name as class_name,
      greatest(0,c.amount-coalesce(adj.amount,0)) as billed_amount,
      coalesce(paid.amount,0)+coalesce(credits.amount,0) as settled_amount,
      coalesce(pending.amount,0) as pending_amount,
      greatest(0,c.amount-coalesce(adj.amount,0)-coalesce(paid.amount,0)-coalesce(credits.amount,0)) as remaining_amount
    from public.finance_charges c
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    left join lateral (
      select sum(a.amount) as amount from public.finance_adjustments a
      where a.school_id=sid and a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'
    ) adj on true
    left join lateral (
      select sum(p.applied_amount) as amount from public.finance_payments p
      where p.school_id=sid and p.charge_id=c.id and p.status='validated'
    ) paid on true
    left join lateral (
      select sum(p.applied_amount) as amount from public.finance_payments p
      where p.school_id=sid and p.charge_id=c.id and p.status='pending'
    ) pending on true
    left join lateral (
      select sum(a.amount) as amount from public.finance_credit_allocations a
      where a.school_id=sid and a.charge_id=c.id
    ) credits on true
    where c.school_id=sid and c.student_id=p_student_id
  ),
  credit_balance as (
    select cr.currency_code,greatest(0,sum(cr.amount-coalesce(spent.amount,0))) as amount
    from public.finance_student_credits cr
    left join lateral (
      select sum(a.amount) as amount from public.finance_credit_allocations a
      where a.school_id=sid and a.credit_id=cr.id
    ) spent on true
    where cr.school_id=sid and cr.student_id=p_student_id
    group by cr.currency_code
  ),
  currency_totals as (
    select pc.currency_code,sum(pc.billed_amount) as billed_amount,
      sum(pc.settled_amount) as settled_amount,sum(pc.pending_amount) as pending_amount,
      sum(pc.remaining_amount) as remaining_amount,
      count(*) filter(where pc.due_date>(now() at time zone 'America/Port-au-Prince')::date) as upcoming_count
    from per_charge pc group by pc.currency_code
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'currency_code',ct.currency_code,'billed_amount',ct.billed_amount,
    'paid_amount',ct.settled_amount,'settled_amount',ct.settled_amount,
    'pending_amount',ct.pending_amount,'remaining_amount',ct.remaining_amount,
    'upcoming_count',ct.upcoming_count,'available_credit',coalesce(cb.amount,0)
  ) order by ct.currency_code),'[]'::jsonb)
    into totals
  from currency_totals ct left join credit_balance cb using(currency_code);

  with per_charge as (
    select c.id,c.description,c.currency_code,c.due_date,cl.name as class_name,
      greatest(0,c.amount-coalesce(adj.amount,0)) as billed_amount,
      coalesce(paid.amount,0)+coalesce(credits.amount,0) as settled_amount,
      coalesce(pending.amount,0) as pending_amount,
      greatest(0,c.amount-coalesce(adj.amount,0)-coalesce(paid.amount,0)-coalesce(credits.amount,0)) as remaining_amount
    from public.finance_charges c
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    left join lateral (select sum(a.amount) as amount from public.finance_adjustments a where a.school_id=sid and a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance') adj on true
    left join lateral (select sum(p.applied_amount) as amount from public.finance_payments p where p.school_id=sid and p.charge_id=c.id and p.status='validated') paid on true
    left join lateral (select sum(p.applied_amount) as amount from public.finance_payments p where p.school_id=sid and p.charge_id=c.id and p.status='pending') pending on true
    left join lateral (select sum(a.amount) as amount from public.finance_credit_allocations a where a.school_id=sid and a.charge_id=c.id) credits on true
    where c.school_id=sid and c.student_id=p_student_id
  )
  select count(*),coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'description',q.description,'class_name',q.class_name,
    'currency_code',q.currency_code,'due_date',q.due_date,
    'billed_amount',q.billed_amount,'paid_amount',q.settled_amount,
    'settled_amount',q.settled_amount,'pending_amount',q.pending_amount,
    'remaining_amount',q.remaining_amount,
    'status',case when q.remaining_amount=0 then 'settled'
      when q.pending_amount>0 then 'pending'
      when q.due_date<(now() at time zone 'America/Port-au-Prince')::date then 'overdue'
      else 'upcoming' end
  ) order by q.due_date,q.description,q.id) filter(where q.row_num<=500),'[]'::jsonb)
    into charge_count,charges
  from (select pc.*,row_number() over(order by pc.due_date,pc.description,pc.id) as row_num from per_charge pc) q;

  return jsonb_build_object(
    'student_id',p_student_id,'school_id',sid,'totals',coalesce(totals,'[]'::jsonb),
    'charges',coalesce(charges,'[]'::jsonb),'charge_count',charge_count,
    'charges_truncated',charge_count>500
  );
end $$;
revoke all on function public.family_finance_summary(uuid) from public,anon;
grant execute on function public.family_finance_summary(uuid) to authenticated;

create or replace function public.family_student_sanctions(p_student_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; rows jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select s.school_id into sid from public.students s where s.id=p_student_id;
  if sid is null or not private.finance_parent_linked(sid,p_student_id,auth.uid()) then
    raise exception 'not_authorized';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'type',q.type_name,'incident_at',q.incident_at,
    'reason',q.reason,'status',q.status,'resolved_at',q.resolved_at,
    'resolution',q.resolution
  ) order by q.incident_at desc,q.id desc),'[]'::jsonb)
  into rows
  from (
    select x.id,t.name as type_name,x.incident_at,x.reason,x.status,x.resolved_at,x.resolution
    from public.student_sanctions x
    join public.student_sanction_types t on t.id=x.sanction_type_id and t.school_id=sid
    where x.school_id=sid and x.student_id=p_student_id
    order by x.incident_at desc,x.id desc limit 100
  ) q;
  return jsonb_build_object('student_id',p_student_id,'sanctions',coalesce(rows,'[]'::jsonb));
end $$;
revoke all on function public.family_student_sanctions(uuid) from public,anon;
grant execute on function public.family_student_sanctions(uuid) to authenticated;

-- School-configured sanction outcomes. The type controls the consequence;
-- each recorded sanction snapshots it so later catalog edits do not rewrite history.
alter table public.student_sanction_types
  add column action_code text not null default 'none'
    check (action_code in ('none','parent_meeting','kiosk_suspension','student_suspension','school_departure')),
  add column action_duration_days smallint;
alter table public.student_sanction_types add constraint student_sanction_action_duration_check
  check ((action_code in ('kiosk_suspension','student_suspension') and action_duration_days between 1 and 90)
      or (action_code not in ('kiosk_suspension','student_suspension') and action_duration_days is null));
alter table public.student_sanctions
  add column action_code text not null default 'none'
    check (action_code in ('none','parent_meeting','kiosk_suspension','student_suspension','school_departure')),
  add column action_started_at timestamptz,
  add column action_until timestamptz;

create or replace function private.student_sanction_restriction(p_student uuid,p_scope text)
returns text language sql stable security definer set search_path=''
as $$
  select case
    when exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active' and x.action_code='student_suspension' and x.action_started_at<=now() and x.action_until>now()) then 'sanction_student_suspended'
    when p_scope='kiosk' and exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active' and x.action_code='kiosk_suspension' and x.action_started_at<=now() and x.action_until>now()) then 'sanction_kiosk_suspended'
    else null end
$$;
revoke all on function private.student_sanction_restriction(uuid,text) from public,anon,authenticated;

drop function public.save_student_sanction_type(uuid,text,boolean);
create function public.save_student_sanction_type(
  p_type uuid,p_name text,p_active boolean default true,
  p_action_code text default 'none',p_action_duration_days smallint default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();rid uuid;old_name text;
begin
  if not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'invalid_sanction_type';end if;
  if p_action_code is null or p_action_code not in ('none','parent_meeting','kiosk_suspension','student_suspension','school_departure')
    or ((p_action_code in ('kiosk_suspension','student_suspension')) and coalesce(p_action_duration_days,0) not between 1 and 90)
    or ((p_action_code not in ('kiosk_suspension','student_suspension')) and p_action_duration_days is not null) then
    raise exception 'invalid_sanction_action';
  end if;
  if p_type is null then
    insert into public.student_sanction_types(school_id,name,active,created_by,updated_by,action_code,action_duration_days)
      values(sid,trim(p_name),coalesce(p_active,true),auth.uid(),auth.uid(),p_action_code,p_action_duration_days) returning id into rid;
    perform private.student_followup_event(sid,null,'sanction_type',rid,'created',jsonb_build_object('name',trim(p_name),'active',coalesce(p_active,true),'action_code',p_action_code,'action_duration_days',p_action_duration_days));
  else
    select name into old_name from public.student_sanction_types where id=p_type and school_id=sid for update;
    if not found then raise exception 'sanction_type_not_found';end if;
    update public.student_sanction_types set name=trim(p_name),active=coalesce(p_active,false),action_code=p_action_code,action_duration_days=p_action_duration_days,updated_by=auth.uid(),updated_at=now() where id=p_type returning id into rid;
    perform private.student_followup_event(sid,null,'sanction_type',rid,'updated',jsonb_build_object('old_name',old_name,'name',trim(p_name),'active',coalesce(p_active,false),'action_code',p_action_code,'action_duration_days',p_action_duration_days));
  end if;
  return rid;
exception when unique_violation then raise exception 'sanction_type_exists';
end $$;

create or replace function public.create_student_sanction(p_student uuid,p_type uuid,p_reason text,p_incident_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid;rid uuid;action text;duration smallint;action_end timestamptz;year_id uuid;
begin
  select school_id into sid from public.students where id=p_student and active and school_status='active';
  if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
  if length(trim(coalesce(p_reason,''))) not between 3 and 2000 or p_incident_at is null or p_incident_at>now() then raise exception 'invalid_sanction';end if;
  select action_code,action_duration_days into action,duration from public.student_sanction_types where id=p_type and school_id=sid and active;
  if action is null then raise exception 'sanction_type_not_found';end if;
  if action in ('kiosk_suspension','student_suspension') then action_end:=now()+make_interval(days=>duration);end if;
  insert into public.student_sanctions(school_id,student_id,sanction_type_id,incident_at,reason,created_by,created_role,action_code,action_started_at,action_until)
    values(sid,p_student,p_type,p_incident_at,trim(p_reason),auth.uid(),private.student_followup_actor_role(sid),action,case when action in ('kiosk_suspension','student_suspension') then now() end,action_end) returning id into rid;
  if action='school_departure' then
    select id into year_id from public.academic_years where school_id=sid and is_current;
    update public.students set school_status='departed',departure_year_id=year_id where id=p_student and school_id=sid;
  elsif action='student_suspension' then
    delete from private.student_sessions where student_id=p_student;
  end if;
  perform private.student_followup_event(sid,p_student,'sanction',rid,'created',jsonb_build_object('type_id',p_type,'incident_at',p_incident_at,'action_code',action,'action_duration_days',duration,'action_until',action_end));
  return rid;
end $$;

revoke all on function public.save_student_sanction_type(uuid,text,boolean, text,smallint) from public,anon;
grant execute on function public.save_student_sanction_type(uuid,text,boolean,text,smallint) to authenticated;

-- Reject student portal sessions at the private session-table boundary. This
-- prevents both a fresh login and any future alternate session issuer from
-- bypassing a configured student-access suspension.
create or replace function private.prevent_sanctioned_student_session()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if private.student_sanction_restriction(new.student_id,'portal') is not null then
    raise exception using errcode='P0001',message='sanction_student_suspended';
  end if;
  return new;
end $$;
revoke all on function private.prevent_sanctioned_student_session() from public,anon,authenticated;
drop trigger if exists prevent_sanctioned_student_session on private.student_sessions;
create trigger prevent_sanctioned_student_session
  before insert or update of student_id on private.student_sessions
  for each row execute function private.prevent_sanctioned_student_session();

-- Enforce time-limited KIOS actions at the shared recorder used by QR badges
-- and typed ID/PIN authentication.
do $sanction_guard$
declare src text;
begin
  select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
  if position('student_sanction_restriction(s.id,''kiosk'')' in src)=0 then
    src:=regexp_replace(src,
      'if\s+s[.]id\s+is\s+null\s+then\s+return\s+jsonb_build_object\s*\(\s*''error''\s*,\s*''invalid_credentials''\s*\)\s*;\s*end\s+if\s*;',
      'if s.id is null then return jsonb_build_object(''error'',''invalid_credentials''); end if; if private.student_sanction_restriction(s.id,''kiosk'') is not null then return jsonb_build_object(''error'',private.student_sanction_restriction(s.id,''kiosk'')); end if;','i');
    if position('student_sanction_restriction(s.id,''kiosk'')' in src)=0 then raise exception 'sanction_kiosk_patch_anchor_missing';end if;
    execute src;
  end if;
end $sanction_guard$;

-- Include the school's configured result in the family-safe sanction summary.
create or replace function public.family_student_sanctions(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; rows jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select s.school_id into sid from public.students s where s.id=p_student_id;
  if sid is null or not private.finance_parent_linked(sid,p_student_id,auth.uid()) then raise exception 'not_authorized';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'type',q.type_name,'incident_at',q.incident_at,'reason',q.reason,'status',q.status,'resolved_at',q.resolved_at,'resolution',q.resolution,'action_code',q.action_code,'action_until',q.action_until) order by q.incident_at desc,q.id desc),'[]'::jsonb)
  into rows from (select x.id,t.name as type_name,x.incident_at,x.reason,x.status,x.resolved_at,x.resolution,x.action_code,x.action_until from public.student_sanctions x join public.student_sanction_types t on t.id=x.sanction_type_id and t.school_id=sid where x.school_id=sid and x.student_id=p_student_id order by x.incident_at desc,x.id desc limit 100) q;
  return jsonb_build_object('student_id',p_student_id,'sanctions',coalesce(rows,'[]'::jsonb));
end $$;
revoke all on function public.family_student_sanctions(uuid) from public,anon;
grant execute on function public.family_student_sanctions(uuid) to authenticated;

