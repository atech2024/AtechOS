-- Refuse KIOS scans after three current-year open-school-day absences without
-- a family reason that is awaiting review or has been accepted.
create or replace function private.guard_has_three_unexcused_absences(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select count(*) >= 3
  from (
    select distinct a.attendance_date
    from public.attendance a
    join public.academic_years y
      on y.school_id=a.school_id
     and y.is_current
     and a.attendance_date between y.start_date and y.end_date
    left join public.guard_cases g
      on g.student_id=a.student_id
     and g.kind='absence'
     and g.event_date=a.attendance_date
    where a.student_id=p_student
      and a.status='absent'
      and private.guard_school_day(a.school_id,a.attendance_date)
      and (g.id is null or g.status in ('awaiting_reason','overdue','meeting'))
  ) unexcused_days
$$;

revoke all on function private.guard_has_three_unexcused_absences(uuid) from public,anon,authenticated;

-- Put the rule inside the shared private recorder so badge QR and typed ID/PIN
-- use the same database enforcement after the student identity is verified.
do $guard$
declare src text; anchor text;
begin
  select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
  if position('guard_three_unexcused_absences' in src)=0 then
    anchor:='if s.id is null then return jsonb_build_object(''error'',''invalid_credentials'');end if;';
    src:=replace(src,anchor,
      anchor||'if private.guard_has_three_unexcused_absences(s.id) then return jsonb_build_object(''error'',''guard_three_unexcused_absences'');end if;');
    if position('guard_three_unexcused_absences' in src)=0 then
      raise exception 'kiosk_guard_absence_patch_anchor_missing';
    end if;
    execute src;
  end if;
end $guard$;
