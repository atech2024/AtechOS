-- Rollback-only verification for teacher-owned assignment privacy.
do $test$
declare
 v_owner uuid:=gen_random_uuid();
 v_teacher_a uuid:=gen_random_uuid();
 v_teacher_b uuid:=gen_random_uuid();
 v_school uuid;
 v_year uuid;
 v_class uuid;
 v_subject_a uuid;
 v_subject_b uuid;
 v_invite jsonb;
 v_assignment uuid;
 v_failed boolean;
begin
 begin
  insert into auth.users(id,email,email_confirmed_at,role,aud)
  values
   (v_owner,v_owner::text||'@example.invalid',now(),'authenticated','authenticated'),
   (v_teacher_a,v_teacher_a::text||'@example.invalid',now(),'authenticated','authenticated'),
   (v_teacher_b,v_teacher_b::text||'@example.invalid',now(),'authenticated','authenticated');

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  set local role authenticated;
  v_school:=public.create_school_onboarding('Assignment privacy verification',gen_random_uuid()::text);
  v_year:=public.create_academic_year('Verification year','2026-01-01','2027-06-30',true);
  perform public.activate_school_section(v_year,'fundamental');
  select c.id into v_class from public.classes c
   where c.school_id=v_school and c.academic_year_id=v_year and c.grade_level='AF7' limit 1;
  if v_class is null then raise exception 'TEST class not created'; end if;

  v_subject_a:=public.create_subject('Teacher A subject','A-'||substr(gen_random_uuid()::text,1,8));
  v_subject_b:=public.create_subject('Teacher B subject','B-'||substr(gen_random_uuid()::text,1,8));

  v_invite:=public.create_school_invitation(v_teacher_a::text||'@example.invalid','Teacher A','teacher');
  perform set_config('request.jwt.claim.sub',v_teacher_a::text,true);
  perform public.accept_school_invitation(v_invite->>'token');
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  v_invite:=public.create_school_invitation(v_teacher_b::text||'@example.invalid','Teacher B','teacher');
  perform set_config('request.jwt.claim.sub',v_teacher_b::text,true);
  perform public.accept_school_invitation(v_invite->>'token');

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform public.assign_subject_to_class(v_class,v_subject_a,v_teacher_a);
  perform public.assign_subject_to_class(v_class,v_subject_b,v_teacher_b);

  perform set_config('request.jwt.claim.sub',v_teacher_a::text,true);
  v_assignment:=public.create_assignment(v_class,v_subject_a,'Teacher A assignment',null,now()+interval '1 day',null,null,null);
  if not exists(select 1 from public.assignments a where a.id=v_assignment) then
   raise exception 'TEST author cannot read own assignment';
  end if;
  if jsonb_typeof(public.assignment_roster(v_assignment)) is distinct from 'array' then
   raise exception 'TEST author cannot open own assignment roster';
  end if;

  perform set_config('request.jwt.claim.sub',v_teacher_b::text,true);
  if exists(select 1 from public.assignments a where a.id=v_assignment) then
   raise exception 'TEST another teacher sees assignment row';
  end if;
  v_failed:=false;
  begin perform public.assignment_roster(v_assignment);
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'TEST another teacher can open assignment roster'; end if;

  reset role;
  raise exception using errcode='ZX001',message='Rollback assignment fixture';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;