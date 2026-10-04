begin;

-- Synthetic GUARD fixture: no school or student record leaves this rollback.
insert into public.schools(id) values('11000000-0000-0000-0000-000000000001');
insert into public.users(id,full_name) values
 ('21000000-0000-0000-0000-000000000001','CI Director'),
 ('21000000-0000-0000-0000-000000000002','Linked Parent'),
 ('21000000-0000-0000-0000-000000000003','Unrelated Parent');
insert into public.academic_years(id,school_id,start_date,end_date,is_current) values
 ('31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','2026-01-01','2027-12-31',true);
insert into public.classes(id,school_id,academic_year_id,grade_level,name,enabled) values
 ('41000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','AF7','GUARD CI',true);
insert into public.students(id,school_id,first_name,last_name,atechos_id,active,school_status,portal_enabled) values
 ('51000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','GUARD','Student','AOS-GUARD-0001',true,'active',true);
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('61000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','active');
insert into public.school_members(school_id,user_id,role) values
 ('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','director'),
 ('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000002','parent'),
 ('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000003','parent');
insert into public.parents(id,school_id,user_id,full_name,email,relationship) values
 ('71000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000002','Linked Parent','linked@example.invalid','parent'),
 ('71000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000003','Other Parent','other@example.invalid','parent');
insert into public.student_parents(student_id,parent_id,is_primary,relationship) values
 ('51000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',true,'parent');

do $test$
declare
 v_school uuid:='11000000-0000-0000-0000-000000000001';
 v_student uuid:='51000000-0000-0000-0000-000000000001';
 v_class uuid:='41000000-0000-0000-0000-000000000001';
 v_reason_case uuid:='81000000-0000-0000-0000-000000000001';
 v_lock_case uuid:='81000000-0000-0000-0000-000000000002';
 v_deadline timestamptz;v_meeting timestamptz;v_payload jsonb;v_result jsonb;v_failed boolean:=false;
begin
 insert into public.school_closures(school_id,day,title) values(v_school,'2026-09-07','Fixture closure');
 v_deadline:=private.guard_school_deadline(v_school,'2026-09-04 07:30 America/Port-au-Prince',1);
 if v_deadline<>'2026-09-08 07:30 America/Port-au-Prince'::timestamptz then raise exception 'GUARD deadline did not skip closure/weekend: %',v_deadline;end if;
 if private.guard_school_day(v_school,'2026-09-05') or private.guard_school_day(v_school,'2026-09-07') then raise exception 'weekend/closure counted as school day';end if;

 insert into public.guard_cases(id,school_id,student_id,kind,event_date,status,reason_due)
 values(v_reason_case,v_school,v_student,'absence','2026-09-03','awaiting_reason',now()+interval '2 days');
 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000003',true);
 begin perform public.submit_guard_reason(v_reason_case,'unlinked parent attempt');exception when others then v_failed:=sqlerrm='not_authorized';end;
 if not v_failed then raise exception 'unrelated parent submitted a reason';end if;
 update public.school_members set enabled=false where school_id=v_school and user_id='21000000-0000-0000-0000-000000000002';
 insert into public.attendance(id,school_id,student_id,class_id,attendance_date,status) values
 ('81000000-0000-0000-0000-000000000014',v_school,v_student,v_class,'2026-09-02','absent');
 insert into public.guard_cases(id,school_id,student_id,kind,event_date,status,reason_due)
 values('81000000-0000-0000-0000-000000000003',v_school,v_student,'absence','2026-09-02','awaiting_reason',now()+interval '2 days');
 if exists(select 1 from public.notifications where recipient_id='21000000-0000-0000-0000-000000000002' and event_key='guard:81000000-0000-0000-0000-000000000003:awaiting_reason') then raise exception 'disabled parent received a GUARD notification';end if;
 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000002',true);
 v_failed:=false;
 begin perform public.submit_guard_reason('81000000-0000-0000-0000-000000000003','disabled parent attempt');exception when others then v_failed:=sqlerrm='not_authorized';end;
 if not v_failed then raise exception 'disabled parent submitted a GUARD reason';end if;
 v_failed:=false;
 begin v_payload:=public.guard_workspace();exception when others then v_failed:=sqlerrm='not_authorized';end;
 if not v_failed then raise exception 'disabled parent read the GUARD workspace';end if;
 update public.school_members set enabled=true where school_id=v_school and user_id='21000000-0000-0000-0000-000000000002';
 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000002',true);
 perform public.submit_guard_reason(v_reason_case,'Family reason fixture');
 if not exists(select 1 from public.guard_cases where id=v_reason_case and status='review' and reason='Family reason fixture' and reason_by='21000000-0000-0000-0000-000000000002') then raise exception 'linked parent reason was not recorded';end if;
 if not exists(select 1 from public.notifications where recipient_id='21000000-0000-0000-0000-000000000002' and type='guard') then raise exception 'family was not notified';end if;
  v_failed:=false;
  begin perform public.submit_guard_reason(v_reason_case,'stale duplicate reason');exception when others then v_failed:=sqlerrm='case_not_waiting_for_reason';end;
  if not v_failed then raise exception 'GUARD accepted a stale duplicate family reason';end if;

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true);
 perform public.review_guard_case(v_reason_case,false,'Meeting requested');
 select meeting_due into v_meeting from public.guard_cases where id=v_reason_case and status='meeting';
 if v_meeting is null or v_meeting<=now() then raise exception 'rejected reason did not schedule a future meeting';end if;
 perform public.review_guard_case(v_reason_case,false,'Meeting rescheduled');
 if not exists(select 1 from public.guard_cases where id=v_reason_case and status='meeting' and meeting_due>v_meeting and staff_note='Meeting rescheduled') then raise exception 'existing family meeting could not be rescheduled';end if;
 select meeting_due into v_meeting from public.guard_cases where id=v_reason_case;
 if not exists(select 1 from public.notifications where recipient_id='21000000-0000-0000-0000-000000000001' and type='guard' and priority='high') then raise exception 'staff did not receive the meeting alert';end if;
 perform public.review_guard_case(v_reason_case,true,'Meeting fixture resolved');
 if (select status from public.guard_cases where id=v_reason_case)<>'resolved' then raise exception 'staff confirmation did not resolve the meeting case';end if;
  v_failed:=false;
  begin perform public.review_guard_case(v_reason_case,true,'Stale duplicate review');exception when others then v_failed:=sqlerrm='case_not_reviewable';end;
  if not v_failed then raise exception 'GUARD accepted a stale review action';end if;

 insert into public.attendance(id,school_id,student_id,class_id,attendance_date,status,check_in_at,recorded_by) values
 ('81000000-0000-0000-0000-000000000010',v_school,v_student,v_class,'2026-09-28','late','2026-09-28 07:55 America/Port-au-Prince','21000000-0000-0000-0000-000000000001'),
 ('81000000-0000-0000-0000-000000000011',v_school,v_student,v_class,'2026-09-29','late','2026-09-29 07:55 America/Port-au-Prince','21000000-0000-0000-0000-000000000001'),
 ('81000000-0000-0000-0000-000000000012',v_school,v_student,v_class,'2026-09-30','late','2026-09-30 07:55 America/Port-au-Prince','21000000-0000-0000-0000-000000000001');
 if private.open_weekly_lateness_cases('2026-09-30 12:00 America/Port-au-Prince')<>1 then raise exception 'three weekly lates did not create one case';end if;
 if not exists(select 1 from public.guard_cases where student_id=v_student and kind='lateness' and event_date='2026-09-28') then raise exception 'weekly lateness case missing';end if;

 if private.mark_missing_attendance('2026-10-01 08:59:59 America/Port-au-Prince')<>0 then raise exception 'absence processing ran before 09:00';end if;
 if private.mark_missing_attendance('2026-10-01 09:00 America/Port-au-Prince')<>1 then raise exception 'open-school-day absence was not created at 09:00';end if;
 if not exists(select 1 from public.attendance_events where student_id=v_student and source='SYSTEM' and action='automatic_absence' and attendance_date='2026-10-01') then raise exception 'automatic absence lacks SYSTEM attribution';end if;
 if private.open_daily_absence_guard_cases('2026-10-01 09:10 America/Port-au-Prince')<>1 then raise exception 'daily GUARD absence case missing';end if;
 if private.mark_missing_attendance('2026-10-03 09:00 America/Port-au-Prince')<>0 then raise exception 'Saturday absence was created';end if;

 insert into public.guard_cases(id,school_id,student_id,kind,event_date,status,reason_due,meeting_due)
 values(v_lock_case,v_school,v_student,'absence','2026-09-30','meeting',now(),now()+interval '1 hour');
 insert into private.student_sessions(student_id,token_hash,expires_at) values(v_student,'synthetic-session-hash',now()+interval '1 day');
 perform private.process_guard_cases((select meeting_due+interval '1 second' from public.guard_cases where id=v_lock_case));
 if (select portal_enabled from public.students where id=v_student) then raise exception 'missed meeting did not suspend student portal';end if;
 if exists(select 1 from private.student_sessions where student_id=v_student) then raise exception 'missed meeting left a student session active';end if;
 v_result:=private.record_student_kiosk(v_student);
 if v_result->>'error'<>'guard_account_suspended' then raise exception 'KIOS did not enforce GUARD suspension: %',v_result;end if;
 v_result:=public.student_kiosk_scan('AOS-GUARD-0001','123456');
 if v_result->>'error'<>'guard_account_suspended' then raise exception 'typed-ID KIOS did not enforce GUARD suspension: %',v_result;end if;
 v_result:=public.student_device_login('AOS-GUARD-0001','GUARD Student','123456',null);
 if v_result->>'error'<>'guard_account_suspended' then raise exception 'student portal login did not enforce GUARD suspension: %',v_result;end if;

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true);
 perform public.review_guard_case(v_lock_case,true,'Meeting held fixture');
 if not (select portal_enabled from public.students where id=v_student) then raise exception 'confirmed meeting did not restore student portal';end if;
 v_result:=private.record_student_kiosk(v_student);
 if v_result->>'error'='guard_account_suspended' then raise exception 'confirmed meeting did not restore kiosk access';end if;
 v_result:=public.student_device_login('AOS-GUARD-0001','GUARD Student','123456',null);
 if v_result->>'error'='guard_account_suspended' then raise exception 'confirmed meeting did not restore portal sign-in';end if;

 insert into public.attendance(id,school_id,student_id,class_id,attendance_date,status) values
 ('81000000-0000-0000-0000-000000000013',v_school,v_student,v_class,'2026-10-02','absent');
 insert into public.guard_cases(id,school_id,student_id,kind,event_date,status,reason_due)
 values('81000000-0000-0000-0000-000000000004',v_school,v_student,'absence','2026-10-02','awaiting_reason',now()+interval '1 day');
 if not private.guard_has_three_unexcused_absences(v_student) then raise exception 'three unexcused absences did not activate the KIOS restriction';end if;
 v_result:=private.record_student_kiosk(v_student);
 if v_result->>'error'<>'guard_three_unexcused_absences' then raise exception 'three unexcused absences blocked KIOS with the wrong reason: %',v_result;end if;
 update public.guard_cases set status='review',reason='Family explanation submitted'
 where student_id=v_student and kind='absence' and event_date='2026-09-02';
 if private.guard_has_three_unexcused_absences(v_student) then raise exception 'submitted family reason still counted as an unexcused absence';end if;
 v_result:=private.record_student_kiosk(v_student);
 if v_result->>'error'='guard_three_unexcused_absences' then raise exception 'KIOS restriction remained after the third absence received a reason';end if;

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000002',true);
 if auth.uid()<>'21000000-0000-0000-0000-000000000002'::uuid then raise exception 'linked parent JWT claim was not set: %',auth.uid();end if;
 if not exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id where sp.student_id=v_student and p.user_id=auth.uid()) then raise exception 'linked parent relationship disappeared before workspace read';end if;
 v_payload:=public.guard_workspace();
 if not exists(select 1 from jsonb_array_elements(v_payload->'cases') c where c->>'id'=v_reason_case::text) then raise exception 'linked family lost access to its own GUARD history';end if;
 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000003',true);
 v_failed:=false;
 begin v_payload:=public.guard_workspace();exception when others then v_failed:=sqlerrm='not_authorized';end;
 if not v_failed then raise exception 'unrelated family accessed GUARD workspace';end if;
end
$test$;

rollback;
