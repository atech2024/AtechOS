-- Configurable, tenant-scoped KIOS hours. Existing schedule remains the default.
create table public.school_kiosk_schedules (
 school_id uuid primary key references public.schools(id) on delete cascade,
 entry_opens_at time not null default time '05:00',
 entry_ends_at time not null default time '07:45',
 late_ends_at time not null default time '08:00',
 checkout_starts_at time not null default time '13:00',
 checkout_ends_at time not null default time '23:59',
 preschool_entry_opens_at time not null default time '05:00',
 preschool_entry_ends_at time not null default time '07:45',
 preschool_late_ends_at time not null default time '08:00',
 preschool_checkout_starts_at time not null default time '13:00',
 preschool_checkout_ends_at time not null default time '23:59',
 updated_by uuid references public.users(id),
 updated_at timestamptz not null default now(),
 check(entry_opens_at < entry_ends_at and entry_ends_at < late_ends_at and late_ends_at < checkout_starts_at and checkout_starts_at < checkout_ends_at),
 check(preschool_entry_opens_at < preschool_entry_ends_at and preschool_entry_ends_at < preschool_late_ends_at and preschool_late_ends_at < preschool_checkout_starts_at and preschool_checkout_starts_at < preschool_checkout_ends_at)
);
alter table public.school_kiosk_schedules enable row level security;
revoke all on public.school_kiosk_schedules from public,anon,authenticated;

-- A Direction-authorized one-day release keeps its decision and intended time immutable.
alter table public.school_release_protocols add column release_at time not null default time '00:00';

create function public.school_kiosk_schedule_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); schedule_row public.school_kiosk_schedules; protocol_row public.school_release_protocols; today date:=(now() at time zone 'America/Port-au-Prince')::date;
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 select * into schedule_row from public.school_kiosk_schedules where school_id=sid;
 select * into protocol_row from public.school_release_protocols where school_id=sid and protocol_date=today;
 return jsonb_build_object(
  'date',today,
  'can_manage',private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']),
  'schedule',jsonb_build_object(
   'entry_opens_at',coalesce(schedule_row.entry_opens_at,time '05:00'),'entry_ends_at',coalesce(schedule_row.entry_ends_at,time '07:45'),'late_ends_at',coalesce(schedule_row.late_ends_at,time '08:00'),'checkout_starts_at',coalesce(schedule_row.checkout_starts_at,time '13:00'),'checkout_ends_at',coalesce(schedule_row.checkout_ends_at,time '23:59'),
   'preschool_entry_opens_at',coalesce(schedule_row.preschool_entry_opens_at,time '05:00'),'preschool_entry_ends_at',coalesce(schedule_row.preschool_entry_ends_at,time '07:45'),'preschool_late_ends_at',coalesce(schedule_row.preschool_late_ends_at,time '08:00'),'preschool_checkout_starts_at',coalesce(schedule_row.preschool_checkout_starts_at,time '13:00'),'preschool_checkout_ends_at',coalesce(schedule_row.preschool_checkout_ends_at,time '23:59')),
  'today_release',case when protocol_row.id is null then null else jsonb_build_object('id',protocol_row.id,'release_at',protocol_row.release_at,'reason',protocol_row.reason,'activated_by',protocol_row.activated_name,'activated_role',protocol_row.activated_role,'activated_at',protocol_row.activated_at) end,
  'can_set_today_release',private.has_role(sid,array['school_admin','director','secretary']));
end $$;

create function public.save_school_kiosk_schedule(
 p_entry_opens_at time,p_entry_ends_at time,p_late_ends_at time,p_checkout_starts_at time,p_checkout_ends_at time,
 p_preschool_entry_opens_at time,p_preschool_entry_ends_at time,p_preschool_late_ends_at time,p_preschool_checkout_starts_at time,p_preschool_checkout_ends_at time
) returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 if p_entry_opens_at is null or p_entry_ends_at is null or p_late_ends_at is null or p_checkout_starts_at is null or p_checkout_ends_at is null
  or p_entry_opens_at>=p_entry_ends_at or p_entry_ends_at>=p_late_ends_at or p_late_ends_at>=p_checkout_starts_at or p_checkout_starts_at>=p_checkout_ends_at
  or p_preschool_entry_opens_at is null or p_preschool_entry_ends_at is null or p_preschool_late_ends_at is null or p_preschool_checkout_starts_at is null or p_preschool_checkout_ends_at is null
  or p_preschool_entry_opens_at>=p_preschool_entry_ends_at or p_preschool_entry_ends_at>=p_preschool_late_ends_at or p_preschool_late_ends_at>=p_preschool_checkout_starts_at or p_preschool_checkout_starts_at>=p_preschool_checkout_ends_at then
  raise exception 'invalid_kiosk_schedule';
 end if;
 insert into public.school_kiosk_schedules(school_id,entry_opens_at,entry_ends_at,late_ends_at,checkout_starts_at,checkout_ends_at,preschool_entry_opens_at,preschool_entry_ends_at,preschool_late_ends_at,preschool_checkout_starts_at,preschool_checkout_ends_at,updated_by,updated_at)
 values(sid,p_entry_opens_at,p_entry_ends_at,p_late_ends_at,p_checkout_starts_at,p_checkout_ends_at,p_preschool_entry_opens_at,p_preschool_entry_ends_at,p_preschool_late_ends_at,p_preschool_checkout_starts_at,p_preschool_checkout_ends_at,auth.uid(),now())
 on conflict(school_id) do update set entry_opens_at=excluded.entry_opens_at,entry_ends_at=excluded.entry_ends_at,late_ends_at=excluded.late_ends_at,checkout_starts_at=excluded.checkout_starts_at,checkout_ends_at=excluded.checkout_ends_at,
 preschool_entry_opens_at=excluded.preschool_entry_opens_at,preschool_entry_ends_at=excluded.preschool_entry_ends_at,preschool_late_ends_at=excluded.preschool_late_ends_at,preschool_checkout_starts_at=excluded.preschool_checkout_starts_at,preschool_checkout_ends_at=excluded.preschool_checkout_ends_at,updated_by=auth.uid(),updated_at=now();
end $$;

create or replace function private.prevent_school_release_protocol_change()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'school_release_protocol_immutable';end $$;

create or replace function public.school_release_protocol_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();today date:=(now() at time zone 'America/Port-au-Prince')::date;entry jsonb;
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 select jsonb_build_object('id',p.id,'date',p.protocol_date,'release_at',p.release_at,'activated_at',p.activated_at,'activated_name',p.activated_name,'activated_role',p.activated_role,'reason',p.reason)
 into entry from public.school_release_protocols p where p.school_id=sid and p.protocol_date=today;
 return jsonb_build_object('date',today,'active',entry is not null,'can_activate',private.has_role(sid,array['school_admin','director','secretary']),'protocol',entry);
end $$;

drop function public.activate_school_release_protocol(text);
create function public.activate_school_release_protocol(p_reason text,p_release_at time)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();actor_role text;actor_name text;today date:=(now() at time zone 'America/Port-au-Prince')::date;
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>500 then raise exception 'reason_required';end if;
 if p_release_at is null or p_release_at>time '23:59' then raise exception 'invalid_release_time';end if;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=auth.uid() and enabled
 order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 else 3 end limit 1;
 if actor_role is null then actor_role:='school_admin'; end if;
 select full_name into actor_name from public.users where id=auth.uid();
 insert into public.school_release_protocols(school_id,protocol_date,release_at,activated_by,activated_name,activated_role,reason)
 values(sid,today,p_release_at,auth.uid(),coalesce(nullif(actor_name,''),'Staff'),actor_role,trim(p_reason)) on conflict(school_id,protocol_date) do nothing;
 return public.school_release_protocol_workspace();
end $$;

create function private.kiosk_window_for_student(p_student uuid,p_time time,p_date date,p_check_in_at timestamptz,p_check_out_at timestamptz)
returns text language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; v_class_id uuid; v_section text; preschool boolean; opens_at time;entry_end time;late_end time;checkout_start time;checkout_end time;release_at time;
begin
 select s.school_id,c.id,public.grade_section(coalesce(c.grade_level,gl.code)) into sid,v_class_id,v_section
 from public.students s join public.enrollments e on e.student_id=s.id and e.status='active'
 join public.classes c on c.id=e.class_id and c.school_id=s.school_id and c.enabled
 join public.academic_years y on y.id=c.academic_year_id and y.is_current
 left join public.grade_levels gl on gl.id=c.grade_level_id
 where s.id=p_student and s.active and s.school_status='active' limit 1;
 if sid is null then return 'blocked';end if;
 preschool:=v_section='preschool';
 -- Published class exams and school-confirmed exam periods both allow flexible arrival/departure.
 if exists(select 1 from public.exam_schedule ex where ex.school_id=sid and ex.class_id=v_class_id and ex.published_version_id is not null and not ex.cancelled
    and (ex.starts_at at time zone 'America/Port-au-Prince')::date=p_date)
  or exists(select 1 from public.confirmed_official_exam_dates d join public.academic_years y on y.id=d.academic_year_id and y.school_id=d.school_id
    where d.school_id=sid and d.section=v_section and d.category='exam_period' and p_date between d.starts_on and d.ends_on and y.is_current) then
   if p_check_in_at is null then return 'present'; end if;
   return 'checkout';
 end if;
 select coalesce(k.entry_opens_at,time '05:00'),coalesce(k.entry_ends_at,time '07:45'),coalesce(k.late_ends_at,time '08:00'),coalesce(k.checkout_starts_at,time '13:00'),coalesce(k.checkout_ends_at,time '23:59')
 into opens_at,entry_end,late_end,checkout_start,checkout_end from (select 1) seed left join public.school_kiosk_schedules k on k.school_id=sid;
 if preschool then
  select coalesce(k.preschool_entry_opens_at,opens_at),coalesce(k.preschool_entry_ends_at,entry_end),coalesce(k.preschool_late_ends_at,late_end),coalesce(k.preschool_checkout_starts_at,checkout_start),coalesce(k.preschool_checkout_ends_at,checkout_end)
  into opens_at,entry_end,late_end,checkout_start,checkout_end from (select 1) seed left join public.school_kiosk_schedules k on k.school_id=sid;
 end if;
 if not preschool then
  select p.release_at into release_at from public.school_release_protocols p where p.school_id=sid and p.protocol_date=p_date;
  if release_at is not null and p_time>=release_at and p_check_in_at is not null and p_check_out_at is null then return 'checkout';end if;
 end if;
 if p_time<opens_at or p_time>checkout_end then return 'blocked';end if;
 if p_check_in_at is not null and p_time>=checkout_start then return 'checkout';end if;
 if p_check_in_at is not null then return 'present';end if;
 if p_time<=entry_end then return 'present';end if;
 if p_time<=late_end then return 'late';end if;
 if p_time<checkout_start then return 'blocked';end if;
 return 'checkout';
end $$;

create function private.kiosk_late_minutes(p_student uuid,p_time time)
returns integer language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; section text; cutoff time;
begin
 select s.school_id,public.grade_section(coalesce(c.grade_level,gl.code)) into sid,section
 from public.students s join public.enrollments e on e.student_id=s.id and e.status='active' join public.classes c on c.id=e.class_id and c.school_id=s.school_id and c.enabled join public.academic_years y on y.id=c.academic_year_id and y.is_current left join public.grade_levels gl on gl.id=c.grade_level_id where s.id=p_student and s.active and s.school_status='active' limit 1;
 select case when section='preschool' then coalesce(k.preschool_entry_ends_at,time '07:45') else coalesce(k.entry_ends_at,time '07:45') end into cutoff from (select 1) seed left join public.school_kiosk_schedules k on k.school_id=sid;
 return greatest(1,floor(extract(epoch from (p_time-cutoff))/60)::integer);
end $$;

revoke all on function private.kiosk_window_for_student(uuid,time,date,timestamptz,timestamptz),private.kiosk_late_minutes(uuid,time),public.school_kiosk_schedule_workspace(),public.save_school_kiosk_schedule(time,time,time,time,time,time,time,time,time,time),public.school_release_protocol_workspace(),public.activate_school_release_protocol(text,time) from public,anon,authenticated;
grant execute on function public.school_kiosk_schedule_workspace(),public.save_school_kiosk_schedule(time,time,time,time,time,time,time,time,time,time),public.school_release_protocol_workspace(),public.activate_school_release_protocol(text,time) to authenticated;

-- Patch only the shared private recorder, preserving its credential, sanction, finance,
-- pickup, home-arrival and event-audit logic. Fail closed if upstream changed it.
do $kiosk_schedule_patch$
declare src text;attendance_anchor text;release_anchor text;late_anchor text;event_protocol_anchor text;notice_protocol_anchor text;
begin
 select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
 if position('school_kiosk_schedule_apply' in src)>0 then raise exception 'kiosk_schedule_patch_already_applied';end if;
 attendance_anchor:='select * into a from public.attendance where student_id=s.id and attendance_date=d for update;';
 if position(attendance_anchor in src)=0 then raise exception 'kiosk_schedule_attendance_anchor_missing';end if;
 src:=replace(src,attendance_anchor,attendance_anchor||' /* school_kiosk_schedule_apply */ window_name:=private.kiosk_window_for_student(s.id,(ts at time zone ''America/Port-au-Prince'')::time,d,a.check_in_at,a.check_out_at);');
 release_anchor:='if protocol_id is not null and not private.is_preschool_student(s.id) then window_name:=''checkout'';end if;';
 if position(release_anchor in src)=0 then raise exception 'kiosk_schedule_release_anchor_missing';end if;
 src:=replace(src,release_anchor,'if protocol_id is not null and not private.is_preschool_student(s.id) and (ts at time zone ''America/Port-au-Prince'')::time >= (select p.release_at from public.school_release_protocols p where p.id=protocol_id) and a.check_in_at is not null and a.check_out_at is null then window_name:=''checkout'';end if;');
 late_anchor:='floor(extract(epoch from ((ts at time zone ''America/Port-au-Prince'')::time-time ''07:45''))/60)::integer';
 if position(late_anchor in src)=0 then raise exception 'kiosk_schedule_late_anchor_missing';end if;
 src:=replace(src,late_anchor,'private.kiosk_late_minutes(s.id,(ts at time zone ''America/Port-au-Prince'')::time)');
 event_protocol_anchor:='case when result=''check_out'' and protocol_id is not null and not private.is_preschool_student(s.id) then protocol_id end';
 if position(event_protocol_anchor in src)=0 then raise exception 'kiosk_schedule_protocol_event_anchor_missing';end if;
 src:=replace(src,event_protocol_anchor,'case when result=''check_out'' and protocol_id is not null and not private.is_preschool_student(s.id) and (ts at time zone ''America/Port-au-Prince'')::time >= (select p.release_at from public.school_release_protocols p where p.id=protocol_id) then protocol_id end');
 notice_protocol_anchor:='''school_release_protocol_active'',protocol_id is not null and not private.is_preschool_student(s.id)';
 if position(notice_protocol_anchor in src)=0 then raise exception 'kiosk_schedule_protocol_notice_anchor_missing';end if;
 src:=replace(src,notice_protocol_anchor,'''school_release_protocol_active'',protocol_id is not null and not private.is_preschool_student(s.id) and (ts at time zone ''America/Port-au-Prince'')::time >= (select p.release_at from public.school_release_protocols p where p.id=protocol_id)');
 execute src;
end $kiosk_schedule_patch$;
