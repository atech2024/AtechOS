-- Give linked families a bounded, date-filtered attendance history instead of
-- the 20-row snapshot used by the general child activity response.
create or replace function public.family_child_attendance_history(
  p_student uuid,
  p_from date,
  p_to date,
  p_limit integer default 30,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  s public.students;
  last_date date;
  rows jsonb;
  total_count bigint;
  present_count bigint;
  late_count bigint;
  absent_count bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then
    raise exception 'invalid_attendance_date_range';
  end if;
  if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset not between 0 and 5000 then
    raise exception 'invalid_attendance_pagination';
  end if;

  select st.* into s
  from public.students st
  where st.id=p_student
    and exists(
      select 1
      from public.student_parents sp
      join public.parents p on p.id=sp.parent_id
      join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id
      where sp.student_id=st.id and p.school_id=st.school_id
        and p.user_id=auth.uid() and m.role='parent' and m.enabled
    );
  if s.id is null then raise exception 'not_authorized'; end if;

  select y.end_date into last_date
  from public.academic_years y where y.id=s.departure_year_id;

  select count(*),
         count(*) filter(where a.status='present'),
         count(*) filter(where a.status='late'),
         count(*) filter(where a.status='absent')
    into total_count,present_count,late_count,absent_count
  from public.attendance a
  where a.student_id=s.id and a.school_id=s.school_id
    and a.attendance_date between p_from and p_to
    and (last_date is null or a.attendance_date<=last_date);

  select coalesce(jsonb_agg(jsonb_build_object(
    'attendance_date',r.attendance_date,
    'status',r.status,
    'late_minutes',r.late_minutes,
    'check_in_at',r.check_in_at,
    'check_out_at',r.check_out_at
  ) order by r.attendance_date desc,r.id desc),'[]'::jsonb)
    into rows
  from (
    select a.id,a.attendance_date,a.status,a.late_minutes,a.check_in_at,a.check_out_at
    from public.attendance a
    where a.student_id=s.id and a.school_id=s.school_id
      and a.attendance_date between p_from and p_to
      and (last_date is null or a.attendance_date<=last_date)
    order by a.attendance_date desc,a.id desc
    limit p_limit offset p_offset
  ) r;

  return jsonb_build_object(
    'records',coalesce(rows,'[]'::jsonb),
    'total_count',total_count,
    'summary',jsonb_build_object('present',present_count,'late',late_count,'absent',absent_count)
  );
end $$;
revoke all on function public.family_child_attendance_history(uuid,date,date,integer,integer) from public,anon;
grant execute on function public.family_child_attendance_history(uuid,date,date,integer,integer) to authenticated;
