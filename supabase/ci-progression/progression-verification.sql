begin;

insert into public.schools(id) values
 ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
insert into auth.users(id,email,email_confirmed_at,role,aud) values
 ('20000000-0000-0000-0000-000000000001','director@example.invalid',now(),'authenticated','authenticated'),
 ('20000000-0000-0000-0000-000000000002','other-director@example.invalid',now(),'authenticated','authenticated'),
 ('20000000-0000-0000-0000-000000000003','teacher@example.invalid',now(),'authenticated','authenticated');
insert into public.school_members(school_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','director'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','director'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','teacher');
insert into public.academic_years(id,school_id,name,start_date,end_date) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2025-2026','2025-08-01','2026-07-31'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','2026-2027','2026-08-01','2027-07-31'),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Other 2025-2026','2025-08-01','2026-07-31');
insert into public.grade_levels(id,code,name,sort_order) values
 ('40000000-0000-0000-0000-000000000001','AF7','7e AF',7),
 ('40000000-0000-0000-0000-000000000002','AF8','8e AF',8),
 ('40000000-0000-0000-0000-000000000003','AF9','9e AF',9),
 ('40000000-0000-0000-0000-000000000004','NS1','NS1',10);
insert into public.classes(id,school_id,academic_year_id,grade_level_id,grade_level,name) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','AF7','AF7 source'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','AF8','AF8 target'),
 ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','AF9','AF9 source'),
 ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','NS1','NS1 target');
insert into public.students(id,school_id,first_name,last_name,atechos_id) values
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Weighted','Student','AOS-WEIGHTED'),
 ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Incomplete','Student','AOS-INCOMPLETE'),
 ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','AF9','Graduate','AOS-AF9');
insert into public.enrollments(student_id,class_id,status) values
 ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','active'),
 ('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','active'),
 ('60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','active');
insert into public.school_grading_settings(school_id,controls_per_period,passing_average)
 values('10000000-0000-0000-0000-000000000001',4,5);
insert into public.grading_periods(id,school_id,academic_year_id,is_active,sections) values
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',true,array['fundamental']);
insert into public.subjects(id,school_id,name) values
 ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Small points subject'),
 ('80000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Large points subject');
insert into public.class_subjects(class_id,subject_id) values
 ('50000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002'),
 ('50000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000002');
insert into public.grades(school_id,student_id,class_id,subject_id,grading_period_id,assessment_name,score,max_score,published) values
 ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Exam',10,10,true),
 ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001','Exam',0,300,true),
 ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Exam',10,10,true),
 ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Exam',10,10,true),
 ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001','Exam',290,300,true);

do $test$
declare payload jsonb; weighted jsonb; incomplete jsonb; graduate jsonb; failed boolean:=false;
begin
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 if exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id where c.academic_year_id='30000000-0000-0000-0000-000000000002') then raise exception 'fixture unexpectedly starts with a target-year enrollment'; end if;
 payload:=public.preview_student_progression('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
 if exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id where c.academic_year_id='30000000-0000-0000-0000-000000000002') then raise exception 'preview created a target enrollment'; end if;
 select value into weighted from jsonb_array_elements(payload) where value->>'id'='60000000-0000-0000-0000-000000000001';
 select value into incomplete from jsonb_array_elements(payload) where value->>'id'='60000000-0000-0000-0000-000000000002';
 select value into graduate from jsonb_array_elements(payload) where value->>'id'='60000000-0000-0000-0000-000000000003';
 if abs((weighted->>'average')::numeric-(10::numeric/310*10))>0.000001 then
  raise exception 'year average must use earned points / possible points; got %',weighted->>'average';
 end if;
 if not (weighted->>'complete')::boolean then
  raise exception 'one published grade per active subject and period is complete; controls_per_period is a maximum';
 end if;
 if weighted->>'recommended_grade'<>'AF7' then
  raise exception '5/10 threshold must use the points-weighted year average, got %',weighted->>'recommended_grade';
 end if;
 if graduate->>'recommended_grade'<>'NS1' then
  raise exception 'a passing AF9 student must be recommended to NS1 for director review, got %',graduate->>'recommended_grade';
 end if;
 if (incomplete->>'complete')::boolean or incomplete->>'average' is not null or incomplete->>'recommended_grade' is not null then
  raise exception 'incomplete bulletin must not show a promotion average or recommendation: %',incomplete;
 end if;
 reset role;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 set local role authenticated;
 failed:=false;
 begin
  perform public.preview_student_progression('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
 exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'teacher progression preview was not denied'; end if;
 reset role;
 failed:=false;
 begin
  perform public.confirm_student_progression('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','[]'::jsonb);
 exception when undefined_function then failed:=true; when insufficient_privilege then failed:=true; when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'teacher progression confirmation was not denied'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 set local role authenticated;
 set local role authenticated;
 begin
  perform public.preview_student_progression('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
 exception when others then failed:=sqlerrm='invalid_years'; end;
 if not failed then raise exception 'cross-school progression preview was not denied'; end if;
end
$test$;

rollback;
