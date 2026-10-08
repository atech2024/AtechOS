begin;
insert into public.schools(id,name) values('10000000-0000-0000-0000-000000000001','Exam CI');
insert into public.users(id,full_name,email) values
 ('10000000-0000-0000-0000-000000000011','Teacher One','t1@example.test'),
 ('10000000-0000-0000-0000-000000000012','Teacher Two','t2@example.test'),
 ('10000000-0000-0000-0000-000000000013','Director One','d@example.test');
insert into public.school_members(school_id,user_id,role,enabled) values
 ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','teacher',true),
 ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012','teacher',true),
 ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000013','director',true);
insert into public.grade_levels(id,code,name) values('10000000-0000-0000-0000-000000000021','AF1','AF1');
insert into public.academic_years(id,school_id,name,start_date,end_date,is_current) values
 ('10000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000001','2026-2027','2026-09-01','2027-07-01',true);
insert into public.classes(id,school_id,grade_level_id,academic_year_id,grade_level,section,name,enabled) values
 ('10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000031','AF1','primary','AF1-A',true);
insert into public.grading_periods(id,school_id,academic_year_id,name,code,start_date,end_date,sections,is_active) values
 ('10000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000031','Période 1','P1','2026-09-01','2027-01-31',array['primary'],true);
insert into public.subjects(id,school_id,name,active) values
 ('10000000-0000-0000-0000-000000000061','10000000-0000-0000-0000-000000000001','Mathématiques',true),
 ('10000000-0000-0000-0000-000000000062','10000000-0000-0000-0000-000000000001','Français',true);
insert into public.class_subjects(school_id,class_id,subject_id,teacher_id) values
 ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000061','10000000-0000-0000-0000-000000000011'),
 ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000062','10000000-0000-0000-0000-000000000012');

do $$ begin
 if not has_table_privilege('authenticated','public.teacher_exam_submissions','select') then raise exception 'authenticated cannot use the row-scoped exam register'; end if;
 if not (select relrowsecurity from pg_class where oid='public.teacher_exam_submissions'::regclass) then raise exception 'exam submission row security is disabled'; end if;
 if has_function_privilege('anon','public.teacher_exam_submission_workspace()','execute') then raise exception 'anon can execute exam workspace'; end if;
 if not exists(select 1 from storage.buckets where id='teacher-exam-files' and public=false and file_size_limit=26214400 and allowed_mime_types=array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then raise exception 'private exam bucket must accept only PDF, DOC and DOCX'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000011',true);
set local role authenticated;
select set_config('exam.test.one',public.create_teacher_exam_submission(
 '10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000061','10000000-0000-0000-0000-000000000051',null)::text,true);
do $$ declare result jsonb; begin
 result:=public.teacher_exam_submission_workspace();
 if result->>'can_manage'<>'false' or jsonb_array_length(result->'submissions')<>1 then raise exception 'teacher did not receive own scoped submission';end if;
 if result#>>'{submissions,0,teacher_id}'<>'10000000-0000-0000-0000-000000000011' then raise exception 'teacher submission ownership mismatch';end if;
 begin
  perform public.create_teacher_exam_submission('10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000062','10000000-0000-0000-0000-000000000051',null);
  raise exception 'teacher submitted an unassigned subject';
 exception when others then
  if sqlerrm='teacher submitted an unassigned subject' then raise;end if;
 end;
 begin
  perform public.create_teacher_exam_submission('10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000061','10000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000012');
  raise exception 'teacher impersonated another teacher';
 exception when others then
  if sqlerrm='teacher impersonated another teacher' then raise;end if;
 end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000013',true);
set local role authenticated;
select set_config('exam.test.two',public.create_teacher_exam_submission(
 '10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000062','10000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000012')::text,true);
do $$ declare result jsonb; begin
 result:=public.teacher_exam_submission_workspace();
 if result->>'can_manage'<>'true' or jsonb_array_length(result->'submissions')<>2 then raise exception 'Direction cannot see the full receipt register';end if;
 if jsonb_array_length(result->'teachers')<>2 then raise exception 'Direction teacher selector is incomplete';end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.teacher_exam_submissions)<>1 then raise exception 'teacher could read another teacher submission';end if;
end $$;
reset role;
rollback;
