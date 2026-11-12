-- Preserve Preschool class access only while the assigned account still has
-- an enabled role eligible for that assignment. Role changes must revoke stale
-- homeroom/coordinator access immediately.
create or replace function private.can_access_preschool_class(p_class uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.classes c
  left join public.grade_levels gl on gl.id=c.grade_level_id
  where c.id=p_class
   and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
   and (
    private.can_manage_preschool(c.school_id)
    or (c.homeroom_teacher_id=auth.uid() and exists(
      select 1 from public.school_members m
      where m.school_id=c.school_id and m.user_id=auth.uid()
       and m.enabled and m.role='teacher'
    ))
    or exists(
      select 1 from public.preschool_program_settings ps
      join public.school_members m on m.school_id=ps.school_id
       and m.user_id=ps.coordinator_user_id and m.user_id=auth.uid()
       and m.enabled and m.role in ('teacher','school_admin','director','secretary')
      where ps.school_id=c.school_id
    )
    or exists(
      select 1 from public.preschool_class_staff cs
      join public.school_members m on m.school_id=cs.school_id
       and m.user_id=auth.uid() and m.enabled and m.role='teacher'
      where cs.class_id=c.id and cs.user_id=auth.uid()
    )
   )
 )
$$;

create or replace function private.can_edit_preschool_class(p_class uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select private.can_access_preschool_class(p_class)
$$;
