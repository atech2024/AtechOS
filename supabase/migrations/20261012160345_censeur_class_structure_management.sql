-- Censeurs may manage classes and activate school sections, but may not
-- create or modify academic years. Keep all class data scoped to their school.
drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes for all to authenticated
 using (private.has_role(school_id,array['school_admin','director','secretary','censeur']))
 with check (private.has_role(school_id,array['school_admin','director','secretary','censeur']));

-- The Classes workspace needs school-owned class records; this does not grant
-- Censeurs the broader read_class helper used for assignment attachments,
-- enrollment, or other class-linked workflows.
create policy classes_censeur_structure_read on public.classes for select to authenticated
 using (private.has_role(school_id,array['censeur']));

-- The workspace displays school-year choices; writes remain governed by the
-- existing admin/director-only config_write policy.
create policy academic_years_censeur_read on public.academic_years for select to authenticated
 using (private.has_role(school_id,array['censeur']));

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
    and m.role = any(array['school_admin', 'director', 'secretary', 'censeur'])
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

do $migration$
declare
  source text;
  old_rule text := 'private.has_role(sid, array[''school_admin'', ''director'', ''secretary''])';
  new_rule text := 'private.has_role(sid, array[''school_admin'', ''director'', ''secretary'', ''censeur''])';
begin
  select pg_get_functiondef('public.activate_school_section(uuid,text,boolean)'::regprocedure) into source;
  if position(old_rule in source)=0
    or length(source)-length(replace(source,old_rule,''))<>length(old_rule) then
    raise exception 'unexpected_activate_school_section_role_rule';
  end if;
  execute replace(source,old_rule,new_rule);
end
$migration$;
