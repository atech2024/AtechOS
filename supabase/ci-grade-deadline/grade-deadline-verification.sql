begin;
insert into public.schools(id) values('10000000-0000-0000-0000-000000000001');
insert into public.users(id,full_name) values
 ('20000000-0000-0000-0000-000000000001','CI Director'),
 ('20000000-0000-0000-0000-000000000004','CI Teacher'),
 ('20000000-0000-0000-0000-000000000007','CI Secretary');
insert into public.school_members(school_id,user_id,role,enabled) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','director',true),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','teacher',true),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','secretary',true);
insert into public.academic_years(id,school_id,is_current) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true);
insert into public.classes(id,school_id,academic_year_id,grade_level,enabled) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','AF1',true);
insert into public.grading_periods(id,school_id,academic_year_id,name,code,start_date,end_date,sections,is_active) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','T1','T1','2026-09-01','2026-11-30',array['primary'],true);
insert into public.students(id,school_id,active) values
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true);
insert into public.enrollments(school_id,student_id,class_id,status) values
 ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','active');
insert into public.category_grade_deadlines(period_id,section,deadline) values
 ('50000000-0000-0000-0000-000000000001','primary',now()-interval '1 minute');

do $test$
declare subject_id uuid; failed boolean:=false; saved uuid;
begin
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 subject_id:=public.create_subject_with_max_score('CI Math','CIM',20);
 insert into public.class_subjects(school_id,class_id,subject_id,teacher_id)
 values('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',subject_id,'20000000-0000-0000-0000-000000000004');

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 failed:=false;
 begin perform public.create_grade('60000000-0000-0000-0000-000000000001',subject_id,'40000000-0000-0000-0000-000000000001','Contrôle 1',15,20,null,'50000000-0000-0000-0000-000000000001',100);
 exception when others then failed:=sqlerrm='grade_deadline_passed';end;
 if not failed then raise exception 'teacher entered a late grade without a grant';end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000007',true);
 failed:=false;
 begin perform public.grant_grade_deadline_exception('20000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001',subject_id,'50000000-0000-0000-0000-000000000001',now()+interval '1 hour','CI test');
 exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'secretary granted late grade access';end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 saved:=public.grant_grade_deadline_exception('20000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001',subject_id,'50000000-0000-0000-0000-000000000001',now()+interval '1 hour','CI Direction authorization');
 if not exists(select 1 from public.grade_deadline_exceptions where id=saved and granted_by='20000000-0000-0000-0000-000000000001' and reason='CI Direction authorization') then raise exception 'authorization audit record missing';end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 failed:=false;
 begin perform public.create_grade('60000000-0000-0000-0000-000000000001',subject_id,'40000000-0000-0000-0000-000000000001','Contrôle 1',8,10,null,'50000000-0000-0000-0000-000000000001',100);
 exception when others then failed:=sqlerrm='subject_max_score_mismatch';end;
 if not failed then raise exception 'subject maximum score was not enforced';end if;
 perform public.create_grade('60000000-0000-0000-0000-000000000001',subject_id,'40000000-0000-0000-0000-000000000001','Contrôle 1',15,20,null,'50000000-0000-0000-0000-000000000001',100);

 update public.grade_deadline_exceptions set expires_at=now()-interval '1 minute' where id=saved;
 failed:=false;
 begin perform public.create_grade('60000000-0000-0000-0000-000000000001',subject_id,'40000000-0000-0000-0000-000000000001','Contrôle 2',14,20,null,'50000000-0000-0000-0000-000000000001',100);
 exception when others then failed:=sqlerrm='grade_deadline_passed';end;
 if not failed then raise exception 'expired grant still permits a grade';end if;
end
$test$;

do $permissions$
begin
 if has_table_privilege('authenticated','public.grade_deadline_exceptions','select') then raise exception 'authenticated can read exception audit rows directly';end if;
 if not has_function_privilege('authenticated','public.grant_grade_deadline_exception(uuid,uuid,uuid,uuid,timestamp with time zone,text)','execute') then raise exception 'authenticated is missing the scoped authorization RPC';end if;
 if has_function_privilege('anon','public.grant_grade_deadline_exception(uuid,uuid,uuid,uuid,timestamp with time zone,text)','execute') then raise exception 'anon can grant late grade access';end if;
end
$permissions$;
rollback;
