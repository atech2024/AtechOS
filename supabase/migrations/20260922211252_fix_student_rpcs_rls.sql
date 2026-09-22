CREATE OR REPLACE FUNCTION public.create_school_onboarding(p_school_name text, p_school_code text, p_school_email text DEFAULT NULL::text, p_school_phone text DEFAULT NULL::text, p_school_address text DEFAULT NULL::text, p_admin_full_name text DEFAULT NULL::text, p_admin_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if nullif(trim(p_school_name), '') is null then
    raise exception 'school_name_required';
  end if;
  if nullif(trim(p_school_code), '') is null then
    raise exception 'school_code_required';
  end if;
  if exists (select 1 from public.schools where lower(code) = lower(trim(p_school_code))) then
    raise exception 'school_code_already_exists';
  end if;
  if exists (select 1 from public.school_members where user_id = v_user_id) then
    raise exception 'user_already_belongs_to_school';
  end if;

  insert into public.schools (name, code, email, phone, address)
  values (trim(p_school_name), upper(trim(p_school_code)), nullif(trim(p_school_email), ''), nullif(trim(p_school_phone), ''), nullif(trim(p_school_address), ''))
  returning id into v_school_id;

  insert into public.users (id, full_name, email, phone)
  select v_user_id, coalesce(nullif(trim(p_admin_full_name), ''), coalesce(au.raw_user_meta_data->>'full_name', ''), au.email), au.email, nullif(trim(p_admin_phone), '')
  from auth.users au
  where au.id = v_user_id
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = coalesce(public.users.email, excluded.email),
        phone = coalesce(public.users.phone, excluded.phone),
        updated_at = now();

  update public.schools set owner_user_id=v_user_id where id=v_school_id;
  insert into public.school_members (school_id, user_id, role)
  values (v_school_id, v_user_id, 'school_admin');

  return v_school_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_academic_year(p_name text, p_start_date date, p_end_date date, p_is_current boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
declare v_school_id uuid; v_id uuid;
begin
  select school_id into v_school_id from public.school_members where user_id=auth.uid() and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1;
  if v_school_id is null then raise exception 'school_membership_required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'academic_year_name_required'; end if;
  if p_end_date < p_start_date then raise exception 'invalid_date_range'; end if;
  if p_is_current then update public.academic_years set is_current=false where school_id=v_school_id; end if;
  insert into public.academic_years(school_id,name,start_date,end_date,is_current)
  values(v_school_id,trim(p_name),p_start_date,p_end_date,p_is_current) returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_class(p_academic_year_id uuid, p_name text, p_grade_level text DEFAULT NULL::text, p_room text DEFAULT NULL::text, p_homeroom_teacher_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_school_id uuid; v_id uuid; v_grade_level_id uuid;
begin
  select school_id into v_school_id from public.school_members where user_id=auth.uid() and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1;
  if v_school_id is null then raise exception 'school_membership_required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'class_name_required'; end if;
  if not exists(select 1 from public.academic_years where id=p_academic_year_id and school_id=v_school_id) then raise exception 'academic_year_access_denied'; end if;
  if p_homeroom_teacher_id is not null and not exists(select 1 from public.school_members where school_id=v_school_id and user_id=p_homeroom_teacher_id and role='teacher') then raise exception 'teacher_access_denied'; end if;
  if nullif(trim(p_grade_level),'') is not null then
    select id into v_grade_level_id from public.grade_levels where code=upper(trim(p_grade_level)) and is_active=true;
    if v_grade_level_id is null then raise exception 'invalid_grade_level'; end if;
  end if;
  insert into public.classes(school_id,academic_year_id,name,grade_level,grade_level_id,room,homeroom_teacher_id)
  values(v_school_id,p_academic_year_id,trim(p_name),nullif(trim(p_grade_level),''),v_grade_level_id,nullif(trim(p_room),''),p_homeroom_teacher_id)
  returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_subject(p_name text, p_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_subject_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select school_id into v_school_id from public.school_members where user_id = v_user_id and enabled and school_id=public.get_my_school_id() limit 1;
  if v_school_id is null then raise exception 'school_not_found'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'subject_name_required'; end if;
  if exists (select 1 from public.subjects where school_id=v_school_id and lower(name)=lower(trim(p_name))) then raise exception 'subject_already_exists'; end if;
  if nullif(trim(p_code), '') is not null and exists (select 1 from public.subjects where school_id=v_school_id and lower(code)=lower(trim(p_code))) then raise exception 'subject_code_already_exists'; end if;
  insert into public.subjects(school_id,name,code) values(v_school_id,trim(p_name),nullif(upper(trim(p_code)),'')) returning id into v_subject_id;
  return v_subject_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.assign_subject_to_class(p_class_id uuid, p_subject_id uuid, p_teacher_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select school_id into v_school_id from public.school_members where user_id=v_user_id and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1;
  if v_school_id is null then raise exception 'school_not_found'; end if;
  if not exists(select 1 from public.classes where id=p_class_id and school_id=v_school_id) then raise exception 'class_not_found'; end if;
  if not exists(select 1 from public.subjects where id=p_subject_id and school_id=v_school_id) then raise exception 'subject_not_found'; end if;
  if p_teacher_id is not null and not exists(select 1 from public.school_members where school_id=v_school_id and user_id=p_teacher_id and role='teacher') then raise exception 'teacher_not_found'; end if;
  if exists(select 1 from public.class_subjects where school_id=v_school_id and class_id=p_class_id and subject_id=p_subject_id) then raise exception 'subject_already_assigned'; end if;
  insert into public.class_subjects(school_id,class_id,subject_id,teacher_id) values(v_school_id,p_class_id,p_subject_id,p_teacher_id) returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_class_subject_teacher(p_class_subject_id uuid, p_teacher_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select school_id into v_school_id from public.school_members where user_id=v_user_id and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1;
  if v_school_id is null then raise exception 'school_not_found'; end if;
  if not exists(select 1 from public.class_subjects where id=p_class_subject_id and school_id=v_school_id) then raise exception 'assignment_not_found'; end if;
  if p_teacher_id is not null and not exists(select 1 from public.school_members where school_id=v_school_id and user_id=p_teacher_id and role='teacher') then raise exception 'teacher_not_found'; end if;
  update public.class_subjects set teacher_id=p_teacher_id where id=p_class_subject_id and school_id=v_school_id;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_student(p_nis text DEFAULT NULL::text, p_student_code text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_sex text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_emergency_contact_name text DEFAULT NULL::text, p_emergency_contact_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_school_id uuid; v_student_id uuid; v_atechos_id text; v_role public.school_role; v_nis text:=nullif(trim(p_nis),''); v_code text:=nullif(trim(p_student_code),''); v_first text:=nullif(trim(p_first_name),''); v_last text:=nullif(trim(p_last_name),'');
begin
 select school_id,role into v_school_id,v_role from public.school_members where user_id=auth.uid() and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1;
 if v_school_id is null then raise exception 'school_membership_required'; end if;
 if v_role not in ('school_admin','director','secretary') then raise exception 'not_authorized'; end if;
 if v_first is null then raise exception 'first_name_required'; end if; if v_last is null then raise exception 'last_name_required'; end if;
 if v_nis is not null and exists(select 1 from public.students where school_id=v_school_id and lower(nis)=lower(v_nis)) then raise exception 'nis_already_exists'; end if;
 v_atechos_id:='AOS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); v_code:=coalesce(v_code,v_atechos_id);
 if exists(select 1 from public.students where school_id=v_school_id and lower(student_code)=lower(v_code)) then raise exception 'student_code_already_exists'; end if;
 insert into public.students(atechos_id,school_id,nis,student_code,first_name,last_name,date_of_birth,sex,phone,email,address,emergency_contact_name,emergency_contact_phone) values(v_atechos_id,v_school_id,v_nis,v_code,v_first,v_last,p_date_of_birth,nullif(trim(p_sex),''),nullif(trim(p_phone),''),nullif(trim(p_email),''),nullif(trim(p_address),''),nullif(trim(p_emergency_contact_name),''),nullif(trim(p_emergency_contact_phone),'')) returning id into v_student_id;
 return v_student_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.update_student(p_student_id uuid, p_nis text DEFAULT NULL::text, p_student_code text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_sex text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_emergency_contact_name text DEFAULT NULL::text, p_emergency_contact_phone text DEFAULT NULL::text, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_school_id uuid; v_student_school uuid; v_code text; v_role public.school_role;
begin
 select school_id,role into v_school_id,v_role from public.school_members where user_id=auth.uid() and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1;
 select school_id,student_code into v_student_school,v_code from public.students where id=p_student_id;
 if v_school_id is null or v_student_school is distinct from v_school_id then raise exception 'student_access_denied'; end if;
 if v_role not in ('school_admin','director','secretary') then raise exception 'not_authorized'; end if;
 if nullif(trim(p_first_name),'') is null then raise exception 'first_name_required'; end if; if nullif(trim(p_last_name),'') is null then raise exception 'last_name_required'; end if;
 if nullif(trim(p_nis),'') is not null and exists(select 1 from public.students where school_id=v_school_id and lower(nis)=lower(trim(p_nis)) and id<>p_student_id) then raise exception 'nis_already_exists'; end if;
 if nullif(trim(p_student_code),'') is not null and exists(select 1 from public.students where school_id=v_school_id and lower(student_code)=lower(trim(p_student_code)) and id<>p_student_id) then raise exception 'student_code_already_exists'; end if;
 update public.students set nis=nullif(trim(p_nis),''),student_code=coalesce(nullif(trim(p_student_code),''),v_code),first_name=trim(p_first_name),last_name=trim(p_last_name),date_of_birth=p_date_of_birth,sex=nullif(trim(p_sex),''),phone=nullif(trim(p_phone),''),email=nullif(trim(p_email),''),address=nullif(trim(p_address),''),emergency_contact_name=nullif(trim(p_emergency_contact_name),''),emergency_contact_phone=nullif(trim(p_emergency_contact_phone),''),active=p_active,updated_at=now() where id=p_student_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.update_attendance_checkout(p_attendance_id uuid, p_check_out_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$ declare v_user_id uuid:=auth.uid(); v_school_id uuid; v_id uuid; begin if v_user_id is null then raise exception 'not_authenticated'; end if; select school_id into v_school_id from public.school_members where user_id=v_user_id and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1; if v_school_id is null then raise exception 'school_not_found'; end if; select id into v_id from public.attendance where id=p_attendance_id and school_id=v_school_id; if v_id is null then raise exception 'attendance_not_found'; end if; update public.attendance set check_out_at=coalesce(p_check_out_at,now()), updated_at=now(), recorded_by=v_user_id where id=v_id; return v_id; end; $function$;

CREATE OR REPLACE FUNCTION public.get_grade_levels()
 RETURNS TABLE(id uuid, code text, name text, short_name text, education_level text, cycle_code text, sort_order integer)
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select gl.id, gl.code, gl.name, gl.short_name, gl.education_level, gl.cycle_code, gl.sort_order
  from public.grade_levels gl
  where gl.is_active = true
  order by gl.sort_order;
$function$;

CREATE OR REPLACE FUNCTION public.get_grading_periods()
 RETURNS TABLE(id uuid, name text, code text, start_date date, end_date date, weight numeric, is_active boolean)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_school_id uuid;
begin
  v_school_id := public.get_my_school_id();
  if v_school_id is null then raise exception 'School membership not found'; end if;
  return query
  select gp.id, gp.name, gp.code, gp.start_date, gp.end_date, gp.weight, gp.is_active
  from public.grading_periods gp
  where gp.school_id = v_school_id
  order by gp.start_date nulls last, gp.name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_assignment(p_class_id uuid, p_subject_id uuid, p_title text, p_description text DEFAULT NULL::text, p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_attachment_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_school_id uuid; v_teacher_id uuid; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select sm.school_id,u.id into v_school_id,v_teacher_id from public.school_members sm join public.users u on u.id=sm.user_id where sm.user_id=auth.uid() and sm.enabled and sm.school_id=public.get_my_school_id() and sm.role in ('teacher','school_admin','director') limit 1;
 if v_school_id is null then raise exception 'Teacher access required'; end if;
 if nullif(trim(p_title),'') is null then raise exception 'Assignment title is required'; end if;
 if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=v_school_id) then raise exception 'Invalid class'; end if;
 if not exists(select 1 from public.subjects s where s.id=p_subject_id and s.school_id=v_school_id) then raise exception 'Invalid subject'; end if;
 if not private.write_academic(v_school_id,p_class_id,p_subject_id) then raise exception 'Subject is not assigned to this teacher for this class'; end if;
 insert into public.assignments(school_id,class_id,subject_id,teacher_id,title,description,due_at,attachment_url) values(v_school_id,p_class_id,p_subject_id,v_teacher_id,trim(p_title),p_description,p_due_at,p_attachment_url) returning id into v_id;
 return v_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.update_grade(p_grade_id uuid, p_score numeric, p_max_score numeric, p_note text, p_assessment_name text, p_grading_period_id uuid, p_assessment_weight numeric DEFAULT 100)
 RETURNS grades
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare sid uuid; v_auth_user uuid; v_teacher_id uuid; result public.grades;
begin
  sid:=public.get_my_school_id();v_auth_user:=auth.uid();select u.id into v_teacher_id from public.users u where u.id=v_auth_user;
  if sid is null or v_teacher_id is null then raise exception 'No school membership found';end if;
  if not private.has_role(sid,array['teacher','school_admin','director']) then raise exception 'Only teachers can edit grades';end if;
  if p_max_score is null or p_max_score<=0 or p_score is null or p_score<0 or p_score>p_max_score then raise exception 'Invalid score or max score';end if;
  if trim(coalesce(p_assessment_name,''))='' then raise exception 'Assessment name is required';end if;
  if p_assessment_weight is null or p_assessment_weight<=0 then raise exception 'Assessment weight must be greater than 0';end if;
  if not exists(select 1 from public.grades g where g.id=p_grade_id and g.school_id=sid and (g.teacher_id=v_teacher_id or private.has_role(sid,array['school_admin','director']))) then raise exception 'Grade not found or not editable by this teacher';end if;
  if p_grading_period_id is not null and not exists(select 1 from public.grading_periods gp where gp.id=p_grading_period_id and gp.school_id=sid) then raise exception 'Invalid grading period';end if;
  update public.grades g set score=p_score,max_score=p_max_score,note=p_note,assessment_name=trim(p_assessment_name),grading_period_id=p_grading_period_id,assessment_weight=p_assessment_weight,graded_at=now() where g.id=p_grade_id;
  select * into result from public.grades g where g.id=p_grade_id;return result;
end; $function$;

CREATE OR REPLACE FUNCTION public.update_grading_settings(p_controls_per_period integer, p_passing_average numeric)
 RETURNS school_grading_settings
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  sid uuid;
  result public.school_grading_settings;
begin
  sid := public.get_my_school_id();
  if sid is null then raise exception 'No school membership found'; end if;
  if not exists (
    select 1 from public.school_members sm
    where sm.school_id = sid and sm.user_id = auth.uid()
      and sm.role in ('school_admin','director')
  ) then
    raise exception 'Only school administrators can change grading settings';
  end if;
  if p_controls_per_period is null or p_controls_per_period < 1 or p_controls_per_period > 20 then
    raise exception 'Controls per period must be between 1 and 20';
  end if;
  if p_passing_average is null or p_passing_average < 0 or p_passing_average > 10 then
    raise exception 'Passing average must be between 0 and 10';
  end if;
  insert into public.school_grading_settings(school_id, controls_per_period, passing_average, updated_at)
  values (sid, p_controls_per_period, p_passing_average, now())
  on conflict (school_id) do update set
    controls_per_period = excluded.controls_per_period,
    passing_average = excluded.passing_average,
    updated_at = now()
  returning * into result;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_grade(p_student_id uuid, p_subject_id uuid, p_class_id uuid, p_assessment_name text, p_score numeric, p_max_score numeric, p_note text, p_grading_period_id uuid, p_assessment_weight numeric DEFAULT 100)
 RETURNS grades
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare sid uuid; v_auth_user uuid; v_teacher_id uuid; result public.grades; controls integer; existing_count integer;
begin
  sid := public.get_my_school_id(); v_auth_user := auth.uid();
  select u.id into v_teacher_id from public.users u where u.id=v_auth_user;
  if sid is null or v_teacher_id is null then raise exception 'No school membership found'; end if;
  if not private.has_role(sid,array['teacher','school_admin','director']) then raise exception 'Only teachers can enter grades'; end if;
  if trim(coalesce(p_assessment_name,''))='' then raise exception 'Assessment name is required'; end if;
  if p_max_score is null or p_max_score<=0 then raise exception 'Max score must be greater than 0'; end if;
  if p_score is null or p_score<0 or p_score>p_max_score then raise exception 'Score must be between 0 and max score'; end if;
  if p_assessment_weight is null or p_assessment_weight<=0 then raise exception 'Assessment weight must be greater than 0'; end if;
  if not exists (select 1 from public.students s where s.id=p_student_id and s.school_id=sid and s.active) then raise exception 'Student does not belong to this school'; end if;
  if not exists (select 1 from public.classes c where c.id=p_class_id and c.school_id=sid) then raise exception 'Class does not belong to this school'; end if;
  if not exists (select 1 from public.enrollments e where e.student_id=p_student_id and e.class_id=p_class_id and e.school_id=sid and e.status='active') then raise exception 'Student is not actively enrolled in this class'; end if;
  if not private.write_academic(sid,p_class_id,p_subject_id) then raise exception 'You are not assigned to this subject for this class'; end if;
  if p_grading_period_id is not null and not exists (select 1 from public.grading_periods gp where gp.id=p_grading_period_id and gp.school_id=sid) then raise exception 'Invalid grading period'; end if;
  if p_grading_period_id is not null then
    select coalesce(sgs.controls_per_period,4) into controls from public.school_grading_settings sgs where sgs.school_id=sid;
    controls:=coalesce(controls,4);
    select count(distinct lower(trim(g.assessment_name))) into existing_count from public.grades g where g.school_id=sid and g.class_id=p_class_id and g.subject_id=p_subject_id and g.grading_period_id=p_grading_period_id and g.teacher_id=v_teacher_id;
    if existing_count>=controls and not exists (select 1 from public.grades g where g.school_id=sid and g.class_id=p_class_id and g.subject_id=p_subject_id and g.grading_period_id=p_grading_period_id and g.teacher_id=v_teacher_id and lower(trim(g.assessment_name))=lower(trim(p_assessment_name))) then raise exception 'Maximum of % controls reached for this subject and grading period',controls; end if;
  end if;
  insert into public.grades(school_id,student_id,subject_id,class_id,teacher_id,assessment_name,score,max_score,note,grading_period_id,assessment_weight) values(sid,p_student_id,p_subject_id,p_class_id,v_teacher_id,trim(p_assessment_name),p_score,p_max_score,p_note,p_grading_period_id,p_assessment_weight) returning * into result;
  return result;
end; $function$;

CREATE OR REPLACE FUNCTION public.update_assignment_attachment(p_assignment_id uuid, p_attachment_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_teacher_id uuid;
begin
 select sm.user_id into v_teacher_id from public.school_members sm where sm.user_id=(select auth.uid()) and sm.enabled and sm.school_id=public.get_my_school_id() and sm.role in ('teacher','school_admin','director') limit 1;
 if v_teacher_id is null then raise exception 'Teacher access required'; end if;
 if not exists(select 1 from public.assignments a where a.id=p_assignment_id and a.teacher_id=v_teacher_id) then raise exception 'Assignment not found or not owned by teacher'; end if;
 update public.assignments set attachment_url=nullif(trim(p_attachment_url),'') where id=p_assignment_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.update_student_photo_url(p_student_id uuid, p_photo_url text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v_school_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select school_id into v_school_id from public.students where id=p_student_id;
  if v_school_id is null then raise exception 'student_not_found'; end if;
  if not exists (select 1 from public.school_members sm where sm.school_id=v_school_id and sm.user_id=auth.uid() and sm.role in ('school_admin','director','secretary')) then raise exception 'not_authorized'; end if;
  update public.students set photo_url=nullif(trim(p_photo_url),''), updated_at=now() where id=p_student_id;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.assign_student_badge(p_student_id uuid, p_badge_uid text, p_badge_type text DEFAULT 'rfid'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v_school_id uuid; v_badge_id uuid; v_role public.school_role;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if; select school_id into v_school_id from public.students where id=p_student_id and active=true; if v_school_id is null then raise exception 'student_not_found'; end if;
 select role into v_role from public.school_members where school_id=v_school_id and user_id=auth.uid() limit 1; if v_role not in ('school_admin','director','secretary') then raise exception 'not_authorized'; end if;
 if nullif(trim(p_badge_uid),'') is null then raise exception 'badge_uid_required'; end if;
 if exists(select 1 from public.student_badges where school_id=v_school_id and badge_uid=trim(p_badge_uid) and active=true and student_id<>p_student_id) then raise exception 'badge_already_assigned'; end if;
 update public.student_badges set active=false,revoked_at=now(),updated_at=now() where student_id=p_student_id and active=true;
 insert into public.student_badges(school_id,student_id,badge_uid,badge_type,active,issued_at,created_at,updated_at) values(v_school_id,p_student_id,trim(p_badge_uid),lower(coalesce(nullif(trim(p_badge_type),''),'rfid')),true,now(),now(),now()) returning id into v_badge_id; return v_badge_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.record_attendance(p_student_id uuid, p_class_id uuid, p_attendance_date date, p_status text, p_check_in_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_check_out_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_late_minutes integer DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
declare v_user_id uuid:=auth.uid(); v_school_id uuid; v_id uuid; v_role public.school_role;
begin
 if v_user_id is null then raise exception 'not_authenticated'; end if; select school_id,role into v_school_id,v_role from public.school_members where user_id=v_user_id and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1;
 if v_school_id is null then raise exception 'school_not_found'; end if; if v_role not in ('school_admin','director','secretary','teacher','surveillant') then raise exception 'not_authorized'; end if;
 if p_status not in ('present','late','absent','early_departure') then raise exception 'invalid_attendance_status'; end if; if p_late_minutes<0 then raise exception 'invalid_late_minutes'; end if;
 if not exists(select 1 from public.students where id=p_student_id and school_id=v_school_id and active=true) then raise exception 'student_not_found'; end if; if not exists(select 1 from public.classes where id=p_class_id and school_id=v_school_id) then raise exception 'class_not_found'; end if; if not exists(select 1 from public.enrollments where student_id=p_student_id and class_id=p_class_id and status='active') then raise exception 'student_not_enrolled_in_class'; end if;
 insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,check_out_at,late_minutes,notes,recorded_by,updated_at) values(v_school_id,p_student_id,p_class_id,p_attendance_date,p_status,p_check_in_at,p_check_out_at,p_late_minutes,nullif(trim(p_notes),''),v_user_id,now()) on conflict(student_id,attendance_date) do update set class_id=excluded.class_id,status=excluded.status,check_in_at=excluded.check_in_at,check_out_at=excluded.check_out_at,late_minutes=excluded.late_minutes,notes=excluded.notes,recorded_by=excluded.recorded_by,updated_at=now() returning id into v_id; return v_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.scan_student_badge(p_badge_uid text, p_class_id uuid, p_scan_at timestamp with time zone DEFAULT now(), p_late_minutes integer DEFAULT 0)
 RETURNS TABLE(action text, attendance_id uuid, student_id uuid, atechos_id text, first_name text, last_name text, status text, check_in_at timestamp with time zone, check_out_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v_school_id uuid; v_role public.school_role; v_badge public.student_badges%rowtype; v_att public.attendance%rowtype; v_date date:=(p_scan_at at time zone 'America/Port-au-Prince')::date;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if; select school_id,role into v_school_id,v_role from public.school_members where user_id=auth.uid() and enabled and school_id=public.get_my_school_id() order by case when role='school_admin' then 0 when role='director' then 1 when role='secretary' then 2 else 3 end limit 1; if v_school_id is null then raise exception 'school_not_found'; end if; if v_role not in ('school_admin','director','secretary','teacher','surveillant') then raise exception 'not_authorized'; end if;
 select * into v_badge from public.student_badges where badge_uid=trim(p_badge_uid) and school_id=v_school_id and active=true limit 1; if v_badge.id is null then raise exception 'badge_not_found'; end if;
 if not exists(select 1 from public.classes where id=p_class_id and school_id=v_school_id) then raise exception 'class_not_found'; end if; if not exists(select 1 from public.enrollments where student_id=v_badge.student_id and class_id=p_class_id and status='active') then raise exception 'student_not_enrolled_in_class'; end if;
 select * into v_att from public.attendance where student_id=v_badge.student_id and attendance_date=v_date limit 1;
 if v_att.id is null then insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,late_minutes,recorded_by,updated_at) values(v_school_id,v_badge.student_id,p_class_id,v_date,case when coalesce(p_late_minutes,0)>0 then 'late' else 'present' end,p_scan_at,coalesce(p_late_minutes,0),auth.uid(),now()) returning * into v_att; action:='check_in'; elsif v_att.check_in_at is null then update public.attendance set check_in_at=p_scan_at,status=case when coalesce(p_late_minutes,0)>0 then 'late' else 'present' end,late_minutes=coalesce(p_late_minutes,0),recorded_by=auth.uid(),updated_at=now() where id=v_att.id returning * into v_att; action:='check_in'; elsif v_att.check_out_at is null then update public.attendance set check_out_at=p_scan_at,recorded_by=auth.uid(),updated_at=now() where id=v_att.id returning * into v_att; action:='check_out'; else action:='already_complete'; end if;
 return query select action,v_att.id,v_badge.student_id,s.atechos_id,s.first_name,s.last_name,v_att.status,v_att.check_in_at,v_att.check_out_at from public.students s where s.id=v_badge.student_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.link_student_parent(p_student_id uuid, p_parent_id uuid, p_relationship text, p_is_primary boolean DEFAULT false)
 RETURNS student_parents
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare v_school_id uuid; v_parent_school_id uuid; v_row public.student_parents; v_user_id uuid; begin v_user_id:=auth.uid(); if v_user_id is null then raise exception 'Authentication required'; end if; select school_id into v_school_id from public.students where id=p_student_id and active=true; if v_school_id is null then raise exception 'Student not found'; end if; select school_id into v_parent_school_id from public.parents where id=p_parent_id; if v_parent_school_id is null or v_parent_school_id<>v_school_id then raise exception 'Parent and student must belong to the same school'; end if; if not exists(select 1 from public.school_members sm where sm.school_id=v_school_id and sm.user_id=v_user_id and sm.role in ('school_admin','director','secretary')) then raise exception 'Only school administration can link a parent'; end if; if nullif(trim(p_relationship),'') is null then raise exception 'Relationship is required'; end if; if p_is_primary then update public.student_parents sp set is_primary=false where sp.student_id=p_student_id and sp.is_primary=true; end if; insert into public.student_parents(student_id,parent_id,is_primary) values(p_student_id,p_parent_id,p_is_primary) on conflict(student_id,parent_id) do update set is_primary=excluded.is_primary returning * into v_row; return v_row; end; $function$;

CREATE OR REPLACE FUNCTION public.get_my_parent_students()
 RETURNS TABLE(student_id uuid, first_name text, last_name text, student_code text, class_id uuid, class_name text)
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select distinct on (s.id) s.id,s.first_name,s.last_name,s.student_code,c.id,c.name
 from public.parents p join public.student_parents sp on sp.parent_id=p.id join public.students s on s.id=sp.student_id and s.active=true left join public.enrollments e on e.student_id=s.id and e.status='active' left join public.classes c on c.id=e.class_id
 where p.user_id=(select auth.uid()) and exists(select 1 from public.school_members sm where sm.user_id=(select auth.uid()) and sm.school_id=p.school_id and sm.role='parent') order by s.id,e.enrolled_at desc nulls last;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_parent_assignments(p_student_id uuid)
 RETURNS TABLE(assignment_id uuid, class_id uuid, class_name text, subject_id uuid, subject_name text, title text, description text, due_at timestamp with time zone, attachment_url text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select a.id,a.class_id,c.name,a.subject_id,su.name,a.title,a.description,a.due_at,a.attachment_url,a.created_at
 from public.assignments a join public.students s on s.id=p_student_id and s.school_id=a.school_id join public.student_parents sp on sp.student_id=s.id join public.parents p on p.id=sp.parent_id and p.user_id=(select auth.uid()) join public.school_members sm on sm.user_id=p.user_id and sm.school_id=p.school_id and sm.role='parent' join public.classes c on c.id=a.class_id join public.subjects su on su.id=a.subject_id
 where a.class_id in (select e.class_id from public.enrollments e where e.student_id=s.id and e.status='active') order by a.due_at desc nulls last,a.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.create_assignment(p_class_id uuid, p_subject_id uuid, p_title text, p_description text DEFAULT NULL::text, p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_attachment_url text DEFAULT NULL::text, p_grading_period_id uuid DEFAULT NULL::uuid, p_max_score numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare v_school_id uuid;v_teacher_id uuid;v_id uuid; begin if auth.uid() is null then raise exception 'Not authenticated'; end if; select sm.school_id,u.id into v_school_id,v_teacher_id from public.school_members sm join public.users u on u.id=sm.user_id where sm.user_id=auth.uid() and sm.enabled and sm.school_id=public.get_my_school_id() and sm.role in ('teacher','school_admin','director') limit 1; if v_school_id is null then raise exception 'Teacher access required'; end if; if nullif(trim(p_title),'') is null then raise exception 'Assignment title is required'; end if; if p_max_score is not null and p_max_score<=0 then raise exception 'Max score must be greater than 0'; end if; if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=v_school_id) then raise exception 'Invalid class'; end if; if not exists(select 1 from public.subjects s where s.id=p_subject_id and s.school_id=v_school_id) then raise exception 'Invalid subject'; end if; if not private.write_academic(v_school_id,p_class_id,p_subject_id) then raise exception 'Subject is not assigned to this teacher for this class'; end if; if p_grading_period_id is not null and not exists(select 1 from public.grading_periods gp where gp.id=p_grading_period_id and gp.school_id=v_school_id) then raise exception 'Invalid grading period'; end if; insert into public.assignments(school_id,class_id,subject_id,teacher_id,title,description,due_at,attachment_url,grading_period_id,max_score) values(v_school_id,p_class_id,p_subject_id,v_teacher_id,trim(p_title),p_description,p_due_at,p_attachment_url,p_grading_period_id,p_max_score) returning id into v_id; return v_id; end; $function$;

CREATE OR REPLACE FUNCTION public.create_grading_period(p_name text, p_code text, p_start_date date, p_end_date date, p_weight numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_school_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select school_id into v_school_id
  from public.school_members
  where user_id = auth.uid() and enabled and school_id=public.get_my_school_id()
    and role in ('school_admin','director')
  limit 1;

  if v_school_id is null then raise exception 'grading_period_admin_required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Period name is required'; end if;
  if nullif(trim(p_code), '') is null then raise exception 'Period code is required'; end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then raise exception 'End date cannot be before start date'; end if;
  if p_weight is null or p_weight <= 0 then raise exception 'Weight must be greater than 0'; end if;

  insert into public.grading_periods(school_id,name,code,start_date,end_date,weight)
  values(v_school_id,trim(p_name),trim(p_code),p_start_date,p_end_date,p_weight)
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.get_grading_settings() returns table(controls_per_period integer,passing_average numeric) language sql security invoker set search_path='' as $$ select coalesce((select controls_per_period from public.school_grading_settings where school_id=public.get_my_school_id()),4),coalesce((select passing_average from public.school_grading_settings where school_id=public.get_my_school_id()),5::numeric); $$;




