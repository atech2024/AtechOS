-- Lock student portal access after a missed GUARD family meeting while preserving enrollment and parent history.
alter table public.guard_cases
  add column if not exists portal_disabled_by_guard boolean not null default false;

create or replace function private.process_guard_cases(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $$
declare n integer:=0;
begin
  update public.guard_cases set status='overdue'
  where (status='awaiting_reason' and reason_due<p_now)
     or (status='meeting' and meeting_due is not null and meeting_due<=p_now);
  get diagnostics n=row_count;

  with lockable as (
    select distinct s.id
    from public.students s
    join public.guard_cases g on g.student_id=s.id
    where g.status='overdue' and g.meeting_due is not null and s.portal_enabled
  ), disabled as (
    update public.students s set portal_enabled=false
    from lockable l where l.id=s.id
    returning s.id
  )
  update public.guard_cases g set portal_disabled_by_guard=true
  where g.student_id in (select id from disabled)
    and g.status='overdue' and g.meeting_due is not null;

  delete from private.student_sessions se
  where exists(select 1 from public.guard_cases g
    where g.student_id=se.student_id and g.portal_disabled_by_guard
      and g.status in ('meeting','overdue') and g.meeting_due is not null);

  return n;
end $$;
revoke all on function private.process_guard_cases(timestamptz) from public,anon,authenticated;

create or replace function public.review_guard_case(p_case uuid,p_accept boolean,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;st uuid;
begin
  select school_id,student_id into sid,st from public.guard_cases where id=p_case for update;
  if sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized'; end if;
  update public.guard_cases set status=case when p_accept then 'resolved' else 'meeting' end,
    reviewed_by=auth.uid(),reviewed_at=now(),staff_note=nullif(trim(p_note),''),
    meeting_due=case when p_accept then null else private.guard_school_deadline(sid,now(),2) end
  where id=p_case and (status in ('review','overdue') or (status='meeting' and p_accept));
  if not found then raise exception 'case_not_reviewable'; end if;

  if p_accept and not exists(select 1 from public.guard_cases
      where student_id=st and status in ('meeting','overdue') and meeting_due is not null) then
    update public.students set portal_enabled=true
      where id=st and active and school_status='active'
        and exists(select 1 from public.guard_cases where student_id=st and portal_disabled_by_guard);
    delete from private.student_sessions where student_id=st;
    update public.guard_cases set portal_disabled_by_guard=false
      where student_id=st and portal_disabled_by_guard;
  end if;
end $$;
revoke all on function public.review_guard_case(uuid,boolean,text) from public,anon;
grant execute on function public.review_guard_case(uuid,boolean,text) to authenticated;

do $guard$
declare src text;
begin
  select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
  if position('guard_account_suspended' in src)=0 then
    src:=replace(src,
      'if s.id is null then return jsonb_build_object(''error'',''invalid_credentials'');end if;',
      'if s.id is null then return jsonb_build_object(''error'',''invalid_credentials'');end if;'||
      'if exists(select 1 from public.guard_cases g where g.student_id=s.id and g.meeting_due is not null and g.status in (''meeting'',''overdue'') and (g.meeting_due<=ts or g.portal_disabled_by_guard)) then return jsonb_build_object(''error'',''guard_account_suspended'');end if;');
    src:=replace(src,
      'return jsonb_build_object(''action'',result,',
      'return jsonb_build_object(''guard_meeting_required'',exists(select 1 from public.guard_cases g where g.student_id=s.id and g.status=''meeting'' and g.meeting_due>ts),''action'',result,');
    if position('guard_account_suspended' in src)=0 or position('guard_meeting_required' in src)=0 then raise exception 'Unable to patch student kiosk recorder'; end if;
    execute src;
  end if;

  select pg_get_functiondef('public.student_kiosk_scan(text,text)'::regprocedure) into src;
  src:=replace(src,'and active and portal_enabled and school_status','and active and school_status');
  src:=replace(src,
      'return private.record_student_kiosk(s.id);',
      'if exists(select 1 from public.guard_cases g where g.student_id=s.id and g.meeting_due is not null and g.status in (''meeting'',''overdue'') and (g.meeting_due<=ts or g.portal_disabled_by_guard)) then return jsonb_build_object(''error'',''guard_account_suspended''); end if; '||
      'if not s.portal_enabled then return jsonb_build_object(''error'',''invalid_credentials''); end if; '||
      'return private.record_student_kiosk(s.id);');
  if position('guard_account_suspended' in src)=0 or position('if not s.portal_enabled' in src)=0 then raise exception 'Unable to patch typed-ID kiosk'; end if;
  execute src;

  select pg_get_functiondef('public.student_device_login(text,text,text,text)'::regprocedure) into src;
  src:=replace(src,'and active and portal_enabled','and active');
  src:=replace(src,
      'if nullif(p_new_pin,'''') is not null and',
      'if exists(select 1 from public.guard_cases g where g.student_id=s.id and g.meeting_due is not null and g.status in (''meeting'',''overdue'') and (g.meeting_due<=now() or g.portal_disabled_by_guard)) then return jsonb_build_object(''error'',''guard_account_suspended''); end if; '||
      'if not s.portal_enabled then return jsonb_build_object(''error'',''invalid_credentials''); end if; '||
      'if nullif(p_new_pin,'''') is not null and');
  if position('guard_account_suspended' in src)=0 or position('if not s.portal_enabled' in src)=0 then raise exception 'Unable to patch student login'; end if;
  execute src;
end $guard$;

-- Ensure the kiosk and login definitions retain their intended grants and service schedule.
