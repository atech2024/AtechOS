-- Keep automatic absences limited to open school days, beginning at 09:00 Haiti time.
-- Add one absent row per active student with exactly one current class; never overwrite an existing attendance decision.
create or replace function private.mark_missing_attendance(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  d date:=(p_now at time zone 'America/Port-au-Prince')::date;
  n integer:=0;
begin
  if (p_now at time zone 'America/Port-au-Prince')::time < time '09:00' then
    return 0;
  end if;

  with roster as (
    select s.id,s.school_id,(array_agg(c.id))[1] as class_id
    from public.students s
    join public.enrollments e on e.student_id=s.id and e.status='active'
    join public.classes c on c.id=e.class_id and c.school_id=s.school_id and c.enabled
    join public.academic_years y on y.id=c.academic_year_id and y.school_id=s.school_id and y.is_current
      and d between y.start_date and y.end_date
    where s.active and s.school_status='active'
      and private.guard_school_day(s.school_id,d)
    group by s.id,s.school_id
    having count(*)=1
  ), inserted as (
    insert into public.attendance(school_id,student_id,class_id,attendance_date,status,recorded_by)
    select school_id,id,class_id,d,'absent',null from roster
    on conflict(student_id,attendance_date) do nothing
    returning id,student_id
  )
  insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action,recorded_at,attendance_date)
  select id,student_id,'SYSTEM',null,'AtechOS','system','automatic_absence',p_now,d from inserted;

  get diagnostics n=row_count;
  return n;
end $$;

revoke all on function private.mark_missing_attendance(timestamptz) from public,anon,authenticated;
