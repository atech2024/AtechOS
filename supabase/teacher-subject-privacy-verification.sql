-- Rollback-only production verification for teacher subject privacy.
-- All generated auth, school, class and subject fixtures are rolled back.
do $test$
declare
 v_owner uuid:=gen_random_uuid();
 v_teacher uuid:=gen_random_uuid();
 v_school uuid;
 v_year uuid;
 v_class uuid;
 v_assigned uuid;
 v_unassigned uuid;
 v_invitation jsonb;
begin
 begin
  insert into auth.users(id,email,email_confirmed_at,role,aud)
  values
   (v_owner,v_owner::text||'@example.invalid',now(),'authenticated','authenticated'),
   (v_teacher,v_teacher::text||'@example.invalid',now(),'authenticated','authenticated');

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  set local role authenticated;
  v_school:=public.create_school_onboarding('Teacher subject privacy verification',gen_random_uuid()::text);
  v_year:=public.create_academic_year('Verification year','2026-01-01','2027-06-30',true);
  perform public.activate_school_section(v_year,'fundamental');

  select c.id into v_class
  from public.classes c
  where c.school_id=v_school and c.academic_year_id=v_year and c.grade_level='AF7'
  limit 1;
  if v_class is null then raise exception 'TEST verification class not created'; end if;

  v_assigned:=public.create_subject('Assigned verification subject','ASG-'||substr(gen_random_uuid()::text,1,8));
  v_unassigned:=public.create_subject('Unassigned verification subject','UN-'||substr(gen_random_uuid()::text,1,8));
  v_invitation:=public.create_school_invitation(v_teacher::text||'@example.invalid','Verification teacher','teacher');

  perform set_config('request.jwt.claim.sub',v_teacher::text,true);
  perform public.accept_school_invitation(v_invitation->>'token');

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform public.assign_subject_to_class(v_class,v_assigned,v_teacher);
  insert into public.class_subjects(school_id,class_id,subject_id)
  values(v_school,v_class,v_unassigned);

  perform set_config('request.jwt.claim.sub',v_teacher::text,true);
  if not exists(select 1 from public.subjects s where s.id=v_assigned) then
    raise exception 'TEST assigned subject hidden';
  end if;
  if exists(select 1 from public.subjects s where s.id=v_unassigned) then
    raise exception 'TEST teacher sees unassigned subject';
  end if;
  if exists(select 1 from public.class_subjects cs where cs.class_id=v_class and cs.subject_id=v_unassigned) then
    raise exception 'TEST teacher sees unassigned class-subject link';
  end if;

  reset role;
  raise exception using errcode='ZX001',message='Rollback verification fixture';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;