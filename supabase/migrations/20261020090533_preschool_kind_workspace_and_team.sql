-- Keep Kindergarten access and staff management scoped to the Preschool module.
create or replace function private.can_manage_preschool(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and (
  private.has_role(p_school,array['school_admin','director','secretary','censeur'])
  or exists(
   select 1 from public.preschool_program_settings ps
   join public.school_members m on m.school_id=ps.school_id and m.user_id=auth.uid() and m.enabled
   where ps.school_id=p_school and ps.coordinator_user_id=auth.uid()
     and m.role in ('teacher','school_admin','director','secretary')
  )
 )
$$;

-- A coordinator may operate Preschool pickup, while authorization-list editing
-- remains restricted by kindergarten_pickup_workspace.can_manage_authorizations.
create or replace function private.can_operate_kindergarten_pickup(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select private.has_role(p_school,array['school_admin','director','secretary','surveillant','censeur'])
   or private.can_manage_preschool(p_school)
$$;

-- The old one-lead/one-assistant unique key prevented a real classroom team.
alter table public.preschool_class_staff
 drop constraint if exists preschool_class_staff_class_id_assignment_role_key;

create or replace function public.preschool_management_access()
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and private.can_manage_preschool(public.get_my_school_id()) $$;

create function public.save_preschool_class_team(p_class uuid,p_assignments jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();assignment_count integer;
begin
 if auth.uid() is null or sid is null or not private.can_manage_preschool(sid) then raise exception 'not_authorized';end if;
 if p_assignments is null or jsonb_typeof(p_assignments)<>'array' or jsonb_array_length(p_assignments)<2 or jsonb_array_length(p_assignments)>4 then raise exception 'invalid_preschool_class_team';end if;
 select count(*) into assignment_count from jsonb_to_recordset(p_assignments) as item(user_id uuid,assignment_role text);
 if assignment_count<>jsonb_array_length(p_assignments)
   or exists(select 1 from jsonb_to_recordset(p_assignments) as item(user_id uuid,assignment_role text)
      where item.user_id is null or item.assignment_role not in ('titulaire','aide_educatrice'))
   or (select count(distinct item.user_id) from jsonb_to_recordset(p_assignments) as item(user_id uuid,assignment_role text))<>assignment_count
   or exists(select 1 from jsonb_to_recordset(p_assignments) as item(user_id uuid,assignment_role text)
      left join public.school_members m on m.school_id=sid and m.user_id=item.user_id and m.enabled
        and m.role in ('teacher','school_admin','director','secretary') where m.user_id is null)
 then raise exception 'invalid_preschool_class_team';end if;
 if not exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id
    where c.id=p_class and c.school_id=sid and c.enabled and public.grade_section(coalesce(c.grade_level,gl.code))='preschool')
 then raise exception 'preschool_class_not_found';end if;
 delete from public.preschool_class_staff where school_id=sid and class_id=p_class;
 insert into public.preschool_class_staff(school_id,class_id,user_id,assignment_role,assigned_by)
 select sid,p_class,item.user_id,item.assignment_role,auth.uid()
 from jsonb_to_recordset(p_assignments) as item(user_id uuid,assignment_role text);
end $$;

-- Return only a localized role label, never the private sex/profile field.
create function public.preschool_class_staff_display(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();result jsonb;
begin
 if auth.uid() is null or sid is null or not private.can_manage_preschool(sid)
   or not exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id
      where c.id=p_class and c.school_id=sid and c.enabled and public.grade_section(coalesce(c.grade_level,gl.code))='preschool')
 then raise exception 'not_authorized';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'label',case
    when profile.sex='female' and cs.assignment_role='titulaire' then 'Enseignante titulaire'
    when profile.sex='male' and cs.assignment_role='titulaire' then 'Enseignant titulaire'
    when profile.sex='female' and cs.assignment_role='aide_educatrice' then 'Aide-éducatrice'
    when profile.sex='male' and cs.assignment_role='aide_educatrice' then 'Aide-éducateur'
    when cs.assignment_role='titulaire' then 'Titulaire'
    else 'Membre de l’équipe' end) order by cs.assignment_role,u.full_name),'[]'::jsonb)
 into result from public.preschool_class_staff cs
 join public.users u on u.id=cs.user_id
 join public.school_members m on m.school_id=cs.school_id and m.user_id=cs.user_id and m.enabled
 left join public.staff_private_profiles profile on profile.school_id=cs.school_id and profile.user_id=cs.user_id
 where cs.school_id=sid and cs.class_id=p_class;
 return result;
end $$;

-- A coordinator needs a Kind-only attendance roster without widening the
-- general student/enrollment/attendance table policies for private data.
create function public.preschool_attendance_workspace(p_year uuid,p_day date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();result jsonb;
begin
 if auth.uid() is null or sid is null or p_year is null or p_day is null
   or not exists(select 1 from public.academic_years y where y.id=p_year and y.school_id=sid)
 then raise exception 'not_authorized';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'name',c.name,'grade_level',coalesce(c.grade_level,gl.code),
   'grade_level_id',c.grade_level_id,'academic_year_id',c.academic_year_id,
   'year_start',y.start_date,'year_end',y.end_date,
   'students',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'first_name',s.first_name,'last_name',s.last_name,'class_id',c.id,'class_name',c.name,
      'attendance',case when a.id is null then null else jsonb_build_object('id',a.id,'student_id',a.student_id,'class_id',a.class_id,'status',a.status,'late_minutes',a.late_minutes,'check_in_at',a.check_in_at,'check_out_at',a.check_out_at,'notes',a.notes) end,
      'events',coalesce((select jsonb_agg(jsonb_build_object('student_id',ae.student_id,'source',ae.source,'actor_name',ae.actor_name,'actor_role',ae.actor_role,'action',ae.action,'recorded_at',ae.recorded_at) order by ae.recorded_at desc) from public.attendance_events ae where ae.attendance_id=a.id),'[]'::jsonb)
   ) order by s.first_name,s.last_name)
    from public.enrollments e join public.students s on s.id=e.student_id and s.school_id=c.school_id
    left join public.attendance a on a.student_id=s.id and a.class_id=c.id and a.attendance_date=p_day
    where e.class_id=c.id and e.status='active' and s.active and s.school_status='active'
   ),'[]'::jsonb)
 ) order by c.name),'[]'::jsonb)
 into result
 from public.classes c join public.academic_years y on y.id=c.academic_year_id and y.school_id=c.school_id
 left join public.grade_levels gl on gl.id=c.grade_level_id
 where c.school_id=sid and c.academic_year_id=p_year and c.enabled
   and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
   and (private.can_manage_preschool(sid) or private.can_access_preschool_class(c.id));
 return result;
end $$;

-- Keep existing callers safe after dropping the one-per-role unique constraint.
create or replace function public.save_preschool_class_staff(p_class uuid,p_role text,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null or not private.can_manage_preschool(sid) then raise exception 'not_authorized';end if;
 if p_role not in ('titulaire','aide_educatrice') then raise exception 'invalid_preschool_class_role';end if;
 if not exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id
   where c.id=p_class and c.school_id=sid and c.enabled and public.grade_section(coalesce(c.grade_level,gl.code))='preschool') then raise exception 'preschool_class_not_found';end if;
 if not exists(select 1 from public.school_members m where m.school_id=sid and m.user_id=p_user and m.enabled and m.role in ('teacher','school_admin','director','secretary')) then raise exception 'staff_member_not_found';end if;
 if exists(select 1 from public.preschool_class_staff where class_id=p_class and user_id=p_user and assignment_role<>p_role) then raise exception 'staff_cannot_hold_both_class_roles';end if;
 if not exists(select 1 from public.preschool_class_staff where class_id=p_class and user_id=p_user)
   and (select count(*) from public.preschool_class_staff where class_id=p_class)>=4 then raise exception 'preschool_class_team_limit';end if;
 insert into public.preschool_class_staff(school_id,class_id,user_id,assignment_role,assigned_by)
 values(sid,p_class,p_user,p_role,auth.uid())
 on conflict(class_id,user_id) do update set assignment_role=excluded.assignment_role,assigned_by=auth.uid(),assigned_at=now();
end $$;

-- Teachers chosen as Kindergarten coordinators can mark Preschool attendance only.
do $$
declare src text;
 old_guard text:='not private.has_role(s.school_id,array[''school_admin'',''director'',''secretary'',''surveillant'',''censeur''])';
 new_guard text:='not (private.has_role(s.school_id,array[''school_admin'',''director'',''secretary'',''surveillant'',''censeur'']) or (private.can_manage_preschool(s.school_id) and private.is_preschool_student(s.id)))';
 old_actor text:='role in (''school_admin'',''director'',''secretary'',''surveillant'',''censeur'')';
begin
 select pg_get_functiondef('public.staff_mark_attendance(uuid,uuid,text)'::regprocedure) into src;
 if position(old_guard in src)=0 or position(old_actor in src)=0 then raise exception 'preschool_attendance_authorization_anchor_missing';end if;
 src:=replace(src,old_guard,new_guard);
 src:=replace(src,old_actor,'role in (''school_admin'',''director'',''secretary'',''surveillant'',''censeur'',''teacher'')');
 execute src;
end $$;

revoke all on function public.preschool_management_access(),public.save_preschool_class_team(uuid,jsonb),public.preschool_class_staff_display(uuid),public.preschool_attendance_workspace(uuid,date) from public,anon,authenticated;
grant execute on function public.preschool_management_access(),public.save_preschool_class_team(uuid,jsonb),public.preschool_class_staff_display(uuid),public.preschool_attendance_workspace(uuid,date) to authenticated;
