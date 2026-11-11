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
language plpgsql stable security definer set search_path='' as $
declare
 sid uuid:=private.school_trial_owner_id();
 trial_status jsonb;
begin
 select jsonb_build_object('plan',t.plan,'started_at',t.started_at,'ends_at',t.ends_at,'active',t.ends_at>statement_timestamp())
 into trial_status
 from private.school_subscription_trials t
 where t.school_id=sid;
 return trial_status;
end $;

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
  ('public.save_finance_payment_methods(jsonb)','manager')
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
