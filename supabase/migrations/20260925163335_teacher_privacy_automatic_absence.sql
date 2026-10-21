-- Identifiers are returned only by role-scoped RPCs, never a shared column grant.
revoke select (atechos_id,student_code) on public.students from authenticated,anon,public;
create or replace function public.get_student_records(p_id uuid default null) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select case when private.has_role(s.school_id,array['school_admin','director','secretary','surveillant']) then to_jsonb(s)
 when private.has_role(s.school_id,array['teacher']) then jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'active',s.active,'school_status',s.school_status)
 else jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id,'active',s.active,'school_status',s.school_status) end
 from public.students s where s.school_id=public.get_my_school_id() and private.read_student(s.id) and (p_id is null or s.id=p_id) order by s.last_name,s.first_name;
$$;
revoke all on function public.get_student_records(uuid) from public,anon;
grant execute on function public.get_student_records(uuid) to authenticated;
do $$ declare src text; begin
 select pg_get_functiondef('public.assignment_roster(uuid)'::regprocedure) into src;
 src:=replace(src,'''code'',s.atechos_id','''code'',case when private.has_role(s.school_id,array[''school_admin'',''director'',''secretary'',''surveillant'']) then s.atechos_id end');
 execute src;
end $$;
-- Old badge values may themselves contain the public student code.
alter policy badges_read on public.student_badges using (
 private.has_role(school_id,array['school_admin','director','secretary','surveillant'])
 or (not private.has_role(school_id,array['teacher']) and private.read_student(student_id))
);

create table if not exists public.school_closures (
 school_id uuid not null references public.schools(id),day date not null,title text not null,
 primary key(school_id,day)
);
alter table public.school_closures enable row level security;
revoke all on public.school_closures from public,anon,authenticated;
grant select on public.school_closures to authenticated;
create policy closures_read on public.school_closures for select to authenticated using (school_id=public.get_my_school_id());
create or replace function public.save_school_closure(p_day date,p_title text) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized';end if;
 if p_day is null or length(p_title)>200 then raise exception 'invalid_closure';end if;
 if nullif(trim(p_title),'') is null then delete from public.school_closures where school_id=sid and day=p_day;
 else insert into public.school_closures(school_id,day,title) values(sid,p_day,trim(p_title)) on conflict(school_id,day) do update set title=excluded.title;end if;
end $$;
revoke all on function public.save_school_closure(date,text) from public,anon;
grant execute on function public.save_school_closure(date,text) to authenticated;
alter table public.attendance_events drop constraint attendance_events_source_check;
alter table public.attendance_events add constraint attendance_events_source_check check(source in ('KIOS','STAFF','SYSTEM'));
-- Clock is injectable only into this private function for boundary tests.
-- API roles cannot invoke it, change its clock or manufacture attendance.
create function private.mark_missing_attendance(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare d date:=(p_now at time zone 'America/Port-au-Prince')::date;n integer;
begin
 if (p_now at time zone 'America/Port-au-Prince')::time<time '09:00' or extract(isodow from d)>5 then return 0;end if;
 with roster as (
  select s.id,s.school_id,(array_agg(c.id))[1] as class_id
  from public.students s join public.enrollments e on e.student_id=s.id and e.status='active'
  join public.classes c on c.id=e.class_id and c.school_id=s.school_id and c.enabled
  join public.academic_years y on y.id=c.academic_year_id and y.school_id=s.school_id and y.is_current and d between y.start_date and y.end_date
  where s.active and s.school_status='active'
   and not exists(select 1 from public.school_closures h where h.school_id=s.school_id and h.day=d)
  group by s.id,s.school_id having count(*)=1
 ), inserted as (
  insert into public.attendance(school_id,student_id,class_id,attendance_date,status,recorded_by)
  select school_id,id,class_id,d,'absent',null from roster
  on conflict(student_id,attendance_date) do nothing
  returning id,student_id
 )
 insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action,recorded_at,attendance_date)
 select id,student_id,'SYSTEM',null,'AtechOS','system','automatic_absence',p_now,d from inserted;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function private.mark_missing_attendance(timestamptz) from public,anon,authenticated;
-- Evaluate Haiti time inside the function: this also handles daylight saving time.
create extension if not exists pg_cron;
select cron.schedule('atechos-automatic-absence','* * * * *','select private.mark_missing_attendance();');
