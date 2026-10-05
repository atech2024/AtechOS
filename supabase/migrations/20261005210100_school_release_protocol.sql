-- A Direction-approved, school-wide same-day dismissal. Preschool students
-- remain on the separately audited adult-pickup workflow.
create table public.school_release_protocols (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 protocol_date date not null,
 activated_by uuid not null references public.users(id),
 activated_name text not null,
 activated_role text not null check (activated_role in ('school_admin','director','secretary')),
 reason text not null check (length(trim(reason)) between 3 and 500),
 activated_at timestamptz not null default now(),
 unique(school_id,protocol_date)
);
create index school_release_protocols_school_date on public.school_release_protocols(school_id,protocol_date desc);
alter table public.school_release_protocols enable row level security;
revoke all on public.school_release_protocols from public,anon,authenticated;

create function private.prevent_school_release_protocol_change()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'school_release_protocol_immutable';end $$;
create trigger school_release_protocol_immutable before update or delete on public.school_release_protocols
 for each row execute function private.prevent_school_release_protocol_change();

-- Link each affected kiosk checkout to the immutable protocol record.
alter table public.attendance_events add column school_release_protocol_id uuid
 references public.school_release_protocols(id);
create index attendance_events_school_release_protocol
 on public.attendance_events(school_release_protocol_id) where school_release_protocol_id is not null;

create function public.school_release_protocol_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();today date:=(now() at time zone 'America/Port-au-Prince')::date;entry jsonb;
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 select jsonb_build_object('id',p.id,'date',p.protocol_date,'activated_at',p.activated_at,'activated_name',p.activated_name,'activated_role',p.activated_role,'reason',p.reason)
 into entry from public.school_release_protocols p where p.school_id=sid and p.protocol_date=today;
 return jsonb_build_object('date',today,'active',entry is not null,'can_activate',private.has_role(sid,array['school_admin','director','secretary']),'protocol',entry);
end $$;

create function public.activate_school_release_protocol(p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();actor_role text;actor_name text;today date:=(now() at time zone 'America/Port-au-Prince')::date;
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>500 then raise exception 'reason_required';end if;
 if exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid()) then actor_role:='school_admin';
 else
  select role::text into actor_role from public.school_members where school_id=sid and user_id=auth.uid() and enabled
  order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 else 3 end limit 1;
 end if;
 select full_name into actor_name from public.users where id=auth.uid();
 insert into public.school_release_protocols(school_id,protocol_date,activated_by,activated_name,activated_role,reason)
 values(sid,today,auth.uid(),coalesce(nullif(actor_name,''),'Staff'),actor_role,trim(p_reason)) on conflict(school_id,protocol_date) do nothing;
 return public.school_release_protocol_workspace();
end $$;

-- Once the protocol is active, non-Preschool students who have checked in may
-- check out regardless of the normal KIOS time window. Students without a
-- check-in stay blocked; Preschool must use the separate staff pickup workflow.
do $school_release_kiosk$
declare src text;window_anchor text;event_anchor text;result_anchor text;
begin
 select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
 if position('school_release_protocol_checkout' in src)>0 then return;end if;
 if position('protocol_id uuid;' in lower(src))=0 then
  src:=regexp_replace(src,'(declare\s+)','\1protocol_id uuid; ', 'i');
 end if;
 if position('protocol_id uuid;' in lower(src))=0 then raise exception 'school_release_protocol_declaration_anchor_missing';end if;
 window_anchor:='/* student_release_kiosk_checkout */ if window_name=''blocked'' and exists(';
 if position(window_anchor in src)=0 then raise exception 'school_release_protocol_window_anchor_missing';end if;
 src:=replace(src,window_anchor,
  '/* school_release_protocol_checkout */ select p.id into protocol_id from public.school_release_protocols p where p.school_id=s.school_id and p.protocol_date=d;'
  ||'if protocol_id is not null and not private.is_preschool_student(s.id) then window_name:=''checkout'';end if;'
  ||window_anchor);
 event_anchor:='insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action,attendance_date) values(a.id,s.id,''KIOS'',s.user_id,s.first_name||'' ''||s.last_name,''student'',result,d);';
 if position(event_anchor in src)>0 then
  src:=replace(src,event_anchor,
   'insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action,attendance_date,school_release_protocol_id) '
   ||'values(a.id,s.id,''KIOS'',s.user_id,s.first_name||'' ''||s.last_name,''student'',result,d,case when result=''check_out'' and protocol_id is not null and not private.is_preschool_student(s.id) then protocol_id end);');
 else
  event_anchor:='insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action) values(a.id,s.id,''KIOS'',s.user_id,s.first_name||'' ''||s.last_name,''student'',result);';
  if position(event_anchor in src)=0 then raise exception 'school_release_protocol_event_anchor_missing';end if;
  src:=replace(src,event_anchor,
   'insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action,school_release_protocol_id) '
   ||'values(a.id,s.id,''KIOS'',s.user_id,s.first_name||'' ''||s.last_name,''student'',result,case when result=''check_out'' and protocol_id is not null and not private.is_preschool_student(s.id) then protocol_id end);');
 end if;
 result_anchor:='return jsonb_build_object(''guard_meeting_required'',exists(';
 if position(result_anchor in src)=0 then raise exception 'school_release_protocol_result_anchor_missing';end if;
 src:=replace(src,result_anchor,'return jsonb_build_object(''school_release_protocol_active'',protocol_id is not null and not private.is_preschool_student(s.id),''guard_meeting_required'',exists(');
 if position('school_release_protocol_checkout' in src)=0 or position('school_release_protocol_id)' in src)=0 or position('school_release_protocol_active' in src)=0 then raise exception 'school_release_protocol_patch_failed';end if;
 execute src;
end $school_release_kiosk$;

revoke all on function private.prevent_school_release_protocol_change(),public.school_release_protocol_workspace(),public.activate_school_release_protocol(text) from public,anon,authenticated;
grant execute on function public.school_release_protocol_workspace(),public.activate_school_release_protocol(text) to authenticated;
