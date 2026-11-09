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
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('plan',t.plan,'started_at',t.started_at,'ends_at',t.ends_at,'active',t.ends_at>statement_timestamp())
 from private.school_subscription_trials t
 where t.school_id=private.school_trial_owner_id()
$$;

create function public.choose_school_trial_plan(p_plan text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.school_trial_owner_id(); trial private.school_subscription_trials; at_time timestamptz:=statement_timestamp();
begin
 if p_plan is null or p_plan not in ('attendance','school','school_finance') then raise exception 'invalid_trial_plan';end if;
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
