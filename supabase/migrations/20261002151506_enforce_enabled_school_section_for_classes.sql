-- Class creation must honor the section choices the school made for this year.
-- Use the same advisory lock in activation and creation so a concurrent
-- deactivation cannot race a class insert.
create or replace function public.create_class(
  p_academic_year_id uuid,
  p_name text,
  p_grade_level text default null,
  p_room text default null,
  p_homeroom_teacher_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_id uuid;
  v_grade_level_id uuid;
  v_section text;
begin
  select m.school_id into v_school_id
  from public.school_members m
  where m.user_id = auth.uid()
    and m.enabled
    and m.role = any(array['school_admin', 'director', 'secretary'])
    and m.school_id = public.get_my_school_id()
  order by case when m.role = 'school_admin' then 0 when m.role = 'director' then 1 when m.role = 'secretary' then 2 else 3 end
  limit 1;

  if v_school_id is null then raise exception 'school_membership_required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'class_name_required'; end if;
  if not exists (
    select 1 from public.academic_years y
    where y.id = p_academic_year_id and y.school_id = v_school_id
  ) then raise exception 'academic_year_access_denied'; end if;
  if p_homeroom_teacher_id is not null and not exists (
    select 1 from public.school_members m
    where m.school_id = v_school_id and m.user_id = p_homeroom_teacher_id
      and m.role = 'teacher' and m.enabled
  ) then raise exception 'teacher_access_denied'; end if;

  select g.id, public.grade_section(g.code)
    into v_grade_level_id, v_section
  from public.grade_levels g
  where g.code = upper(trim(coalesce(p_grade_level, '')))
    and g.is_active = true;

  if v_grade_level_id is null or v_section is null
    or v_section not in ('preschool', 'primary', 'fundamental', 'secondary') then
    raise exception 'invalid_grade_level';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_school_id::text || p_academic_year_id::text || v_section, 0));

  if not exists (
    select 1
    from public.classes c
    left join public.grade_levels existing_grade on existing_grade.id = c.grade_level_id
    where c.school_id = v_school_id
      and c.academic_year_id = p_academic_year_id
      and c.enabled
      and public.grade_section(coalesce(existing_grade.code, c.grade_level)) = v_section
  ) then raise exception 'school_section_not_enabled'; end if;

  insert into public.classes(school_id, academic_year_id, name, grade_level, grade_level_id, room, homeroom_teacher_id)
  values (v_school_id, p_academic_year_id, trim(p_name), upper(trim(p_grade_level)), v_grade_level_id, nullif(trim(p_room), ''), p_homeroom_teacher_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Seed the section's catalog classes directly before marking them enabled.
-- Calling create_class here would fail the new activation check on first use.
create or replace function public.activate_school_section(
  p_year uuid,
  p_section text,
  p_enabled boolean default true
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sid uuid := public.get_my_school_id();
begin
  if not private.has_role(sid, array['school_admin', 'director', 'secretary']) then
    raise exception 'not_authorized';
  end if;
  if p_section is null or p_section not in ('preschool', 'primary', 'fundamental', 'secondary') or p_enabled is null then
    raise exception 'invalid_section';
  end if;
  if not exists (select 1 from public.academic_years y where y.id = p_year and y.school_id = sid) then
    raise exception 'invalid_year';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(sid::text || p_year::text || p_section, 0));

  if p_enabled then
    insert into public.classes(school_id, academic_year_id, name, grade_level, grade_level_id)
    select sid, p_year, g.name, g.code, g.id
    from public.grade_levels g
    where g.is_active
      and public.grade_section(g.code) = p_section
      and not exists (
        select 1 from public.classes c
        where c.school_id = sid
          and c.academic_year_id = p_year
          and (c.grade_level_id = g.id or c.grade_level = g.code)
      );
  end if;

  update public.classes c
  set enabled = p_enabled
  where c.school_id = sid
    and c.academic_year_id = p_year
    and public.grade_section(coalesce(
      (select g.code from public.grade_levels g where g.id = c.grade_level_id),
      c.grade_level
    )) = p_section;
end;
$$;
