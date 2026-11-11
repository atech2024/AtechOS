begin;

-- Synthetic rows exist only inside this transaction, which is always rolled back.
insert into public.schools(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002');
insert into public.academic_years(id,school_id,start_date,end_date,is_current) values
 ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-08-01','2027-07-31',true);
insert into public.users(id,full_name) values
 ('20000000-0000-0000-0000-000000000001','CI Director'),
 ('20000000-0000-0000-0000-000000000002','Linked Parent'),
 ('20000000-0000-0000-0000-000000000003','Unrelated Parent'),
 ('20000000-0000-0000-0000-000000000004','CI Preschool Teacher'),
 ('20000000-0000-0000-0000-000000000005','CI Surveillant'),
 ('20000000-0000-0000-0000-000000000006','CI Censeur'),
 ('20000000-0000-0000-0000-000000000007','CI Secretary'),
 ('20000000-0000-0000-0000-000000000008','CI School Administrator');
insert into public.grade_levels(id,code) values('30000000-0000-0000-0000-000000000001','PS1');
insert into public.grade_levels(id,code,name) values('30000000-0000-0000-0000-000000000002','AF1','Primary CI');
insert into public.classes(id,school_id,grade_level_id,grade_level,name,academic_year_id) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PS1','Preschool CI','11000000-0000-0000-0000-000000000001');
insert into public.students(id,school_id,first_name,last_name,atechos_id) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','CI','Student','AOS-CI-0001');
insert into public.student_badges(id,school_id,student_id,badge_uid) values
 ('51000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','CI-BADGE');
insert into private.badge_token_history(token_hash,badge_id) values
 (encode(extensions.digest(repeat('a',64),'sha256'),'hex'),'51000000-0000-0000-0000-000000000001');
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','active');
insert into public.school_members(school_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','director'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','parent'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','parent'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','teacher'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','surveillant'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','censeur'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','secretary'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','school_admin');
insert into public.parents(id,school_id,user_id,full_name,email,relationship) values
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Linked Parent','linked@example.invalid','parent'),
 ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Other Parent','other@example.invalid','parent');
insert into public.student_parents(student_id,parent_id,is_primary,relationship) values
 ('50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',true,'parent');
insert into public.attendance(id,school_id,student_id,class_id,attendance_date,check_in_at,status,recorded_by) values
 ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,now(),'present','20000000-0000-0000-0000-000000000001');

do $test$
declare v_case_id uuid; family jsonb; kiosk jsonb; failed boolean:=false; adult_id uuid; pickup_workspace jsonb; pickup_update_id uuid; term_year uuid:='11000000-0000-0000-0000-000000000001'; ps_period uuid; ps_competency uuid; ps_version uuid; ps_workspace jsonb; ps_report jsonb; ps_published integer; ps_attendance jsonb; ps_staff_labels jsonb;
begin
 if has_function_privilege('anon','public.family_preschool_bulletins()','EXECUTE') then raise exception 'anonymous users can execute family preschool bulletin RPC'; end if;
 if not has_function_privilege('authenticated','public.family_preschool_bulletins()','EXECUTE') then raise exception 'authenticated parents cannot execute family preschool bulletin RPC'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 if (select term_count from public.academic_years where id=term_year)<>3 then raise exception 'official term default must be three'; end if;
 failed:=false;
 begin
  insert into public.grading_periods(school_id,academic_year_id,code,is_active) values('10000000-0000-0000-0000-000000000001',term_year,'T4',true);
 exception when others then failed:=sqlerrm='fourth_term_not_enabled';
 end;
 if not failed then raise exception 'fourth term was accepted before enabling'; end if;
 perform public.set_academic_year_term_count(term_year,4);
 insert into public.grading_periods(school_id,academic_year_id,code,is_active) values('10000000-0000-0000-0000-000000000001',term_year,'T4',true);
 failed:=false;
 begin
  insert into public.grading_periods(school_id,academic_year_id,code,is_active) values('10000000-0000-0000-0000-000000000001',term_year,'C1',true);
 exception when others then failed:=sqlerrm='assessment_is_not_a_grading_period';
 end;
 if not failed then raise exception 'assessment code was accepted as active grading period'; end if;
 insert into public.kindergarten_pickup_authorizations(school_id,student_id,full_name,relationship,phone,created_by)
 values('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Authorized Adult','guardian','555-0123','20000000-0000-0000-0000-000000000001') returning id into adult_id;
 v_case_id:=public.start_kindergarten_relocation('50000000-0000-0000-0000-000000000001','needs_support','PRIVATE-CI-NOTE');
 perform public.review_kindergarten_relocation(v_case_id,true,'Approved by CI Direction');
 perform public.record_kindergarten_parent_contact(v_case_id,'no_answer','PRIVATE-CI-CONTACT');

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 family:=public.kindergarten_parent_relocation_status();
 if jsonb_array_length(family)<>1 or family->0->>'student_id'<>'50000000-0000-0000-0000-000000000001' then raise exception 'linked parent scope failed'; end if;
 if family::text like '%PRIVATE-%' or family::text like '%needs_support%' or family::text like '%opened_at%' then raise exception 'private relocation detail leaked'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 if jsonb_array_length(public.kindergarten_parent_relocation_status())<>0 then raise exception 'unrelated parent saw relocation'; end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 pickup_workspace:=public.kindergarten_pickup_workspace();
 if not (pickup_workspace->>'can_manage_authorizations')::boolean then raise exception 'director cannot manage pickup authorizations'; end if;
 if not ((pickup_workspace->'students'->0->'authorizations'->0)?'phone') then raise exception 'pickup manager cannot view authorized adult phone';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000007',true);
 if not (public.kindergarten_pickup_workspace()->>'can_manage_authorizations')::boolean then raise exception 'secretary cannot manage pickup authorizations'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 if not (public.kindergarten_pickup_workspace()->>'can_manage_authorizations')::boolean then raise exception 'school administrator cannot manage pickup authorizations'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
 pickup_workspace:=public.kindergarten_pickup_workspace();
 if (pickup_workspace->>'can_manage_authorizations')::boolean then raise exception 'surveillant gained pickup authorization management'; end if;
 if (pickup_workspace->'students'->0->'authorizations'->0)?'phone' then raise exception 'surveillant saw authorized adult phone';end if;
 if public.kindergarten_pickup_preview('AOSQ1.'||repeat('a',64))->>'student_id'<>'50000000-0000-0000-0000-000000000001' then raise exception 'surveillant cannot preview preschool pickup QR'; end if;
 failed:=false;
 begin
  perform public.save_kindergarten_pickup_authorization('50000000-0000-0000-0000-000000000001',null,'Unauthorized Adult','guardian',null,true);
 exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'surveillant changed pickup authorizations'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000006',true);
 pickup_workspace:=public.kindergarten_pickup_workspace();
 if (pickup_workspace->>'can_manage_authorizations')::boolean then raise exception 'censeur gained pickup authorization management'; end if;
 if (pickup_workspace->'students'->0->'authorizations'->0)?'phone' then raise exception 'censeur saw authorized adult phone';end if;
 if public.kindergarten_pickup_preview('AOSQ1.'||repeat('a',64))->>'student_id'<>'50000000-0000-0000-0000-000000000001' then raise exception 'censeur cannot preview preschool pickup QR'; end if;
 failed:=false;
 begin
  perform public.save_kindergarten_pickup_authorization('50000000-0000-0000-0000-000000000001',null,'Unauthorized Adult','guardian',null,true);
 exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'censeur changed pickup authorizations'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 failed:=false;
 begin perform public.kindergarten_pickup_workspace(); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'teacher accessed kindergarten pickup workspace'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 perform public.guardian_note_kindergarten_pickup('50000000-0000-0000-0000-000000000001','on_the_way','Parent pickup update fixture');
 select id into pickup_update_id from public.kindergarten_pickup_updates where student_id='50000000-0000-0000-0000-000000000001' and parent_user_id='20000000-0000-0000-0000-000000000002' and status='on_the_way';
 if pickup_update_id is null then raise exception 'parent pickup update was not stored';end if;
 if (select count(*) from public.notifications where event_key like 'kindergarten-pickup-parent:'||pickup_update_id::text||':%')<>5 then raise exception 'pickup update did not notify each enabled staff role once';end if;
 failed:=false;
 begin perform public.guardian_note_kindergarten_pickup('50000000-0000-0000-0000-000000000001','on_the_way','Duplicate parent pickup update');exception when others then failed:=sqlerrm='pickup_update_already_sent';end;
 if not failed then raise exception 'duplicate parent pickup update was accepted';end if;
 if (select count(*) from public.kindergarten_pickup_updates where student_id='50000000-0000-0000-0000-000000000001' and parent_user_id='20000000-0000-0000-0000-000000000002')<>1 then raise exception 'duplicate pickup update was persisted';end if;
 perform public.guardian_note_kindergarten_pickup('50000000-0000-0000-0000-000000000001','delay','Changed pickup plan fixture');
 if (select count(distinct status) from public.kindergarten_pickup_updates where student_id='50000000-0000-0000-0000-000000000001' and parent_user_id='20000000-0000-0000-0000-000000000002')<>2 then raise exception 'parent could not send a meaningful pickup status change';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 perform public.complete_kindergarten_pickup('AOSQ1.'||repeat('a',64),adult_id,'CI verified pickup');
 if not exists(select 1 from public.kindergarten_relocation_cases where id=v_case_id and status='picked_up' and closed_by='20000000-0000-0000-0000-000000000001') then raise exception 'pickup did not close relocation with actor'; end if;
 if not exists(select 1 from public.attendance_events where attendance_id='80000000-0000-0000-0000-000000000001' and source='STAFF' and actor_role='director' and action='kindergarten_pickup_check_out') then raise exception 'pickup checkout attribution failed'; end if;
 if not exists(select 1 from public.badge_scans where badge_id='51000000-0000-0000-0000-000000000001' and source='PICKUP' and result='pickup_complete') then raise exception 'pickup badge audit failed'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 failed:=false;
 begin perform public.guardian_note_kindergarten_pickup('50000000-0000-0000-0000-000000000001','on_the_way',null);exception when others then failed:=sqlerrm='already_picked_up';end;
 if not failed then raise exception 'parent sent a pickup update after the child left';end if;
 failed:=false;
 begin
  update public.kindergarten_pickups set reason='mutated' where student_id='50000000-0000-0000-0000-000000000001';
 exception when others then failed:=sqlerrm='pickup_history_immutable';
 end;
 if not failed then raise exception 'pickup history was mutable'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 if jsonb_array_length(public.kindergarten_parent_relocation_status())<>0 then raise exception 'family notice remained after pickup'; end if;
 begin
  update public.kindergarten_relocation_events re set private_note='rewrite' where re.case_id=v_case_id;
 exception when others then failed:=sqlerrm='relocation_history_immutable';
 end;
 if not failed then raise exception 'relocation event history was mutable'; end if;

 kiosk:=private.record_student_kiosk('50000000-0000-0000-0000-000000000001');
 if kiosk ? 'atechos_id' or kiosk->>'name'<>'CI Student' then raise exception 'private kiosk result contract failed'; end if;
 kiosk:=public.scan_student_code('AOS-CI-0001','10000000-0000-0000-0000-000000000001');
 if kiosk ? 'atechos_id' or kiosk->>'name'<>'CI Student' then raise exception 'staff scan result contract failed'; end if;
 if has_table_privilege('authenticated','public.kindergarten_relocation_cases','select') then raise exception 'authenticated has direct case-table access'; end if;
 if not has_function_privilege('authenticated','public.start_kindergarten_relocation(uuid,text,text)','execute') then raise exception 'authenticated missing authorized relocation RPC'; end if;

 insert into public.classes(id,school_id,grade_level,name,academic_year_id) values('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','PS2','Second preschool CI','11000000-0000-0000-0000-000000000001');
 insert into public.grading_periods(school_id,academic_year_id,name,code,start_date,end_date,sections,is_active) values('10000000-0000-0000-0000-000000000001',term_year,'1er Trimestre','T1','2026-08-01','2026-11-30',array['preschool'],true) returning id into ps_period;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 perform public.save_preschool_class_staff('40000000-0000-0000-0000-000000000001','titulaire','20000000-0000-0000-0000-000000000004');
 ps_workspace:=public.preschool_report_workspace('40000000-0000-0000-0000-000000000001',ps_period);
 if jsonb_array_length(ps_workspace->'competencies')<12 or jsonb_array_length(ps_workspace->'students')<>1 then raise exception 'preschool defaults/roster were not initialized'; end if;
 ps_competency:=(ps_workspace->'competencies'->0->>'id')::uuid;
 perform public.save_preschool_evaluation('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',ps_period,ps_competency,'good','Observed during group activity');
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 ps_workspace:=public.preschool_report_workspace('40000000-0000-0000-0000-000000000001',ps_period);
 if not (ps_workspace->>'editable')::boolean or (ps_workspace->>'manager')::boolean or jsonb_array_length(ps_workspace->'staff_options')<>0 then raise exception 'preschool class teacher scope mismatch'; end if;
 failed:=false;begin perform public.preschool_report_workspace('40000000-0000-0000-0000-000000000002',ps_period);exception when others then failed:=true;end;
 if not failed then raise exception 'preschool teacher accessed unassigned class';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 perform public.save_preschool_settings('20000000-0000-0000-0000-000000000004',false,false,true);
 failed:=false;begin perform public.save_preschool_class_team('40000000-0000-0000-0000-000000000001','[{"user_id":"20000000-0000-0000-0000-000000000004","assignment_role":"titulaire"}]'::jsonb);exception when others then failed:=sqlerrm='invalid_preschool_class_team';end;
 if not failed then raise exception 'Kindergarten accepted a one-person classroom team';end if;
 perform public.save_preschool_class_team('40000000-0000-0000-0000-000000000001','[{"user_id":"20000000-0000-0000-0000-000000000004","assignment_role":"titulaire"},{"user_id":"20000000-0000-0000-0000-000000000008","assignment_role":"aide_educatrice"}]'::jsonb);
 failed:=false;begin perform public.save_preschool_class_team('40000000-0000-0000-0000-000000000001','[{"user_id":"20000000-0000-0000-0000-000000000004","assignment_role":"titulaire"},{"user_id":"20000000-0000-0000-0000-000000000008","assignment_role":"aide_educatrice"},{"user_id":"20000000-0000-0000-0000-000000000007","assignment_role":"aide_educatrice"},{"user_id":"20000000-0000-0000-0000-000000000001","assignment_role":"titulaire"},{"user_id":"20000000-0000-0000-0000-000000000006","assignment_role":"aide_educatrice"}]'::jsonb);exception when others then failed:=sqlerrm='invalid_preschool_class_team';end;
 if not failed then raise exception 'Kindergarten accepted a five-person classroom team';end if;
 insert into public.staff_private_profiles(school_id,user_id,sex) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','female');
 insert into public.classes(id,school_id,grade_level,name,academic_year_id) values('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','AF1','Primary CI','11000000-0000-0000-0000-000000000001');
 insert into public.students(id,school_id,first_name,last_name,atechos_id) values('50000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Primary','Student','AOS-CI-0006');
 insert into public.enrollments(id,school_id,student_id,class_id,status) values('60000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000006','active');
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 if not public.preschool_management_access() then raise exception 'designated Kind coordinator did not receive module access';end if;
 ps_attendance:=public.preschool_attendance_workspace(term_year,(now() at time zone 'America/Port-au-Prince')::date);
 if jsonb_array_length(ps_attendance)<2
   or not exists(select 1 from jsonb_array_elements(ps_attendance) as class_row(value)
     cross join lateral jsonb_array_elements(coalesce(class_row.value->'students','[]'::jsonb)) as student_row(value)
     where student_row.value->>'first_name'='CI' and student_row.value->>'last_name'='Student')
   or exists(select 1 from jsonb_array_elements(ps_attendance) as class_row(value)
     cross join lateral jsonb_array_elements(coalesce(class_row.value->'students','[]'::jsonb)) as student_row(value)
     where student_row.value->>'first_name'='Primary' and student_row.value->>'last_name'='Student')
 then raise exception 'Kind attendance RPC failed its roster or school-section scope';end if;
 ps_staff_labels:=public.preschool_class_staff_display('40000000-0000-0000-0000-000000000001');
 if not exists(select 1 from jsonb_array_elements(ps_staff_labels) as staff_label(value)
     where staff_label.value->>'id'='20000000-0000-0000-0000-000000000004' and staff_label.value->>'label'='Enseignante titulaire')
   or ps_staff_labels::text like '%sex%' then raise exception 'staff gendered label or profile privacy contract failed';end if;
 perform public.staff_mark_attendance('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','late');
 if not exists(select 1 from public.attendance_events where student_id='50000000-0000-0000-0000-000000000001' and actor_role='teacher' and action='late') then raise exception 'Kind coordinator attendance action was not attributed';end if;
 failed:=false;begin perform public.staff_mark_attendance('50000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000006','present');exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'Kind coordinator marked non-Kind attendance';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 failed:=false;begin perform public.preschool_attendance_workspace('11000000-0000-0000-0000-000000000099',(now() at time zone 'America/Port-au-Prince')::date);exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'Kind attendance workspace accepted a foreign academic year';end if;
 perform public.save_preschool_settings(null,false,false,true);
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 if public.preschool_management_access() then raise exception 'former Kind coordinator retained management access';end if;
 ps_workspace:=public.preschool_report_workspace('40000000-0000-0000-0000-000000000001',ps_period);
 if (ps_workspace->>'manager')::boolean or not (ps_workspace->>'editable')::boolean then raise exception 'coordinator removal changed the teacher classroom access';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 update public.classes set homeroom_teacher_id='20000000-0000-0000-0000-000000000004' where id='40000000-0000-0000-0000-000000000001';
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 ps_workspace:=public.preschool_report_workspace('40000000-0000-0000-0000-000000000001',ps_period);
 if not (ps_workspace->>'editable')::boolean then raise exception 'active homeroom teacher lost Preschool access';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 update public.school_members set enabled=false where school_id='10000000-0000-0000-0000-000000000001' and user_id='20000000-0000-0000-0000-000000000004' and role='teacher';
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 failed:=false;begin perform public.preschool_report_workspace('40000000-0000-0000-0000-000000000001',ps_period);exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'disabled homeroom teacher retained access';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 update public.school_members set enabled=true where school_id='10000000-0000-0000-0000-000000000001' and user_id='20000000-0000-0000-0000-000000000004' and role='teacher';
 ps_published:=public.publish_preschool_bulletins('40000000-0000-0000-0000-000000000001',ps_period,6,'Quarterly preschool observation');
 if ps_published<>1 then raise exception 'expected one preschool bulletin';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 ps_published:=public.publish_preschool_bulletins('40000000-0000-0000-0000-000000000001',ps_period,6,'School administrator publication');
 if ps_published<>1 then raise exception 'school administrator could not publish Preschool bulletin';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000006',true);
 ps_published:=public.publish_preschool_bulletins('40000000-0000-0000-0000-000000000001',ps_period,6,'Censeur publication');
 if ps_published<>1 then raise exception 'Censeur could not publish Preschool bulletin';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000007',true);
 ps_published:=public.publish_preschool_bulletins('40000000-0000-0000-0000-000000000001',ps_period,6,'Secretary publication');
 if ps_published<>1 then raise exception 'secretary could not publish Preschool bulletin';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 failed:=false;begin perform public.publish_preschool_bulletins('40000000-0000-0000-0000-000000000001',ps_period,6,null);exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'teacher published Preschool bulletin';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
 failed:=false;begin perform public.publish_preschool_bulletins('40000000-0000-0000-0000-000000000001',ps_period,6,null);exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'surveillant published Preschool bulletin';end if;
 if (select count(*) from public.preschool_bulletin_versions where student_id='50000000-0000-0000-0000-000000000001')<>4 then raise exception 'Preschool bulletin publisher role versions missing';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 select id,payload into ps_version,ps_report from public.preschool_bulletin_versions where student_id='50000000-0000-0000-0000-000000000001';
 if ps_report->>'exam_month'<>'6' or ps_report->>'period'<>'1er Trimestre' or ps_report->'competencies'->0->>'rating' is null then raise exception 'preschool bulletin snapshot missing period, month, or observations';end if;
 if not exists(select 1 from public.preschool_evaluation_events where evaluation_id=(select id from public.preschool_evaluations where student_id='50000000-0000-0000-0000-000000000001' limit 1) and action='created') then raise exception 'preschool evaluation audit missing';end if;
 failed:=false;begin update public.preschool_bulletin_versions set exam_month=7 where id=ps_version;exception when others then failed:=sqlerrm='preschool_bulletin_immutable';end;
 if not failed then raise exception 'preschool bulletin snapshot was mutable';end if;
 insert into public.academic_years(id,school_id,start_date,end_date,is_current) values('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','2027-08-01','2028-07-31',false);
 insert into public.classes(id,school_id,grade_level,name,academic_year_id) values('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','PS1','Future Preschool CI','11000000-0000-0000-0000-000000000002');
 insert into public.grading_periods(id,school_id,academic_year_id,name,code,start_date,end_date,sections,is_active) values('80000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000002','1er Trimestre','T1','2027-08-01','2027-11-30',array['preschool'],true);
 insert into public.preschool_bulletin_versions(school_id,student_id,class_id,academic_year_id,period_id,version,exam_month,payload,published_by,publisher_name)
 values('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','11000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002',1,9,'{"academic_year":"2027-2028","student":{"name":"CI Student"}}','20000000-0000-0000-0000-000000000001','CI Director');
 update public.students set departure_year_id=term_year where id='50000000-0000-0000-0000-000000000001';
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 family:=public.family_preschool_bulletins();if jsonb_array_length(family)<>4 or family->0->'payload'->'student'->>'name'<>'CI Student' then raise exception 'linked parent missed preschool bulletin history';end if;
 ps_report:=private.student_report_cards('50000000-0000-0000-0000-000000000001');if jsonb_array_length(ps_report->'preschool_cards')<>4 then raise exception 'parent report-card RPC wrapper missed preschool bulletin history or leaked a post-departure Preschool bulletin';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 if jsonb_array_length(public.family_preschool_bulletins())<>0 then raise exception 'unrelated parent saw preschool bulletin';end if;
 if has_table_privilege('authenticated','public.preschool_bulletin_versions','select') or has_table_privilege('authenticated','public.preschool_evaluations','select') then raise exception 'authenticated can bypass preschool RPC security';end if;
end
$test$;

-- A numeric bulletin can have a calculated grade preview before the school
-- publishes its immutable family/student document. Keep this synthetic card
-- in the rollback-only fixture; the production calculator is unchanged.
insert into public.classes(id,school_id,grade_level,name,academic_year_id) values
 ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','AF7','Numeric CI','11000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','AF7','Future Numeric CI','11000000-0000-0000-0000-000000000002');
insert into public.grading_periods(id,school_id,academic_year_id,name,code,start_date,end_date,sections,is_active) values
 ('80000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','Numeric Period','T2','2026-12-01','2027-03-31',array['fundamental'],true),
 ('80000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000002','Future Numeric Period','T2','2027-12-01','2028-03-31',array['fundamental'],true);
insert into public.students(id,school_id,first_name,last_name,atechos_id) values
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Numeric','Student','AOS-CI-0002');
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','active');
insert into public.student_parents(student_id,parent_id,is_primary,relationship) values
 ('50000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001',true,'parent');

create or replace function private.calculated_student_report_cards(p_student uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'student',jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id),
  'school',jsonb_build_object('name',sc.name,'code',sc.code),
  'passing_average',6,
  'attendance','[]'::jsonb,
  'cards',case when s.id='50000000-0000-0000-0000-000000000002'::uuid then
   jsonb_build_array(jsonb_build_object(
    'class_id','40000000-0000-0000-0000-000000000004',
    'class_name','Numeric CI','year','CI Year',
    'period_id','80000000-0000-0000-0000-000000000003',
    'period','Numeric Period','start_date','2026-12-01','end_date','2027-03-31',
    'subjects',jsonb_build_array(jsonb_build_object('name','Mathematique','note',7.5,'earned',15,'possible',20)),
    'earned',15,'possible',20,'complete',true,'average',7.5,'status','passed'))
   else '[]'::jsonb end)
 from public.students s join public.schools sc on sc.id=s.school_id where s.id=p_student
$$;

do $numeric_bulletin$
declare student_id uuid:='50000000-0000-0000-0000-000000000002';
 report jsonb; preview jsonb; failed boolean;
begin
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 preview:=public.get_report_card(student_id);
 if jsonb_array_length(preview->'cards')<>1 or preview->'cards'->0->>'average'<>'7.5' then
  raise exception 'director lost calculated numeric bulletin preview';end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 report:=public.get_report_card(student_id);
 if jsonb_array_length(report->'cards')<>0 or jsonb_array_length(report->'document_history')<>0 then
  raise exception 'linked parent saw unpublished numeric bulletin';end if;
 report:=public.student_portal_overview(student_id::text)->'report';
 if jsonb_array_length(report->'cards')<>0 then raise exception 'student saw unpublished numeric bulletin';end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 failed:=false;
 begin perform public.get_report_card(student_id);exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'unrelated parent saw numeric bulletin';end if;

 -- This row stands in for publish_class_bulletins, which the small CI baseline
 -- does not define. It exercises the real immutable-history visibility path.
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 insert into public.bulletin_versions(school_id,student_id,class_id,period_id,version,payload) values
 ('10000000-0000-0000-0000-000000000001',student_id,
  '40000000-0000-0000-0000-000000000004','80000000-0000-0000-0000-000000000003',1,
  jsonb_build_object('card',preview->'cards'->0));
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 report:=public.get_report_card(student_id);
 if jsonb_array_length(report->'cards')<>1 or report->'cards'->0->'document'->>'version'<>'1'
  or report->'cards'->0->>'average'<>'7.5' then
  raise exception 'linked parent missed published numeric bulletin';end if;
 report:=public.student_portal_overview(student_id::text)->'report';
 if jsonb_array_length(report->'cards')<>1 or report->'cards'->0->'document'->>'version'<>'1' then
  raise exception 'student missed published numeric bulletin';end if;

 -- A departed student and linked parent retain only the last-school-year
 -- publication, even when a future-year snapshot exists in the database.
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 insert into public.bulletin_versions(school_id,student_id,class_id,period_id,version,payload) values
 ('10000000-0000-0000-0000-000000000001',student_id,
  '40000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000004',1,
  jsonb_build_object('card',jsonb_build_object('class_id','40000000-0000-0000-0000-000000000005',
   'class_name','Future Numeric CI','year','Future CI Year',
   'period_id','80000000-0000-0000-0000-000000000004','period','Future Numeric Period',
   'start_date','2027-12-01','end_date','2028-03-31','average',9)));
 update public.students set school_status='departed',departure_year_id='11000000-0000-0000-0000-000000000001'
 where id=student_id;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 report:=public.get_report_card(student_id);
 if jsonb_array_length(report->'cards')<>1 or report->'cards'->0->>'class_name'<>'Numeric CI'
  or jsonb_array_length(report->'document_history')<>1 then
  raise exception 'departed linked parent lost history or saw a future numeric bulletin';end if;
 report:=public.student_portal_overview(student_id::text)->'report';
 if jsonb_array_length(report->'cards')<>1 or report->'cards'->0->>'class_name'<>'Numeric CI' then
  raise exception 'departed student lost history or saw a future numeric bulletin';end if;
end
$numeric_bulletin$;

do $kiosk_schedule_ci$
declare denied boolean:=false;today date:=(now() at time zone 'America/Port-au-Prince')::date;source_url text:='https://ci.invalid/kiosk-exams';nonpreschool_class uuid;summary jsonb;
begin
 if has_function_privilege('anon','public.school_kiosk_schedule_workspace()','EXECUTE') then raise exception 'anonymous can read KIOS schedule settings';end if;
 if has_function_privilege('authenticated','private.kiosk_window_for_student(uuid,time,date,timestamp with time zone,timestamp with time zone)','EXECUTE') then raise exception 'authenticated can call internal KIOS scheduler';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 begin
  perform public.save_school_kiosk_schedule(time '06:30',time '07:30',time '07:45',time '12:30',time '20:00',time '07:00',time '08:00',time '08:15',time '12:00',time '18:00');
 exception when others then denied:=sqlerrm='not_authorized';
 end;
 if not denied then raise exception 'teacher changed KIOS schedules';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 update public.attendance set status='late',late_minutes=8 where id='80000000-0000-0000-0000-000000000001';
 summary:=public.dashboard_summary();
 if summary->>'present'<>'1' or summary->>'late'<>'1' then raise exception 'school-wide present total must include late arrivals and expose lateness as a subset: %',summary;end if;
 perform public.activate_school_section('11000000-0000-0000-0000-000000000001','primary',true);
 select id into nonpreschool_class from public.classes where school_id='10000000-0000-0000-0000-000000000001' and (grade_level_id='30000000-0000-0000-0000-000000000002' or grade_level='AF1') and academic_year_id='11000000-0000-0000-0000-000000000001' limit 1;
 insert into public.students(id,school_id,first_name,last_name,atechos_id) values('50000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Primary','CI','AOS-CI-KIOS');
 insert into public.enrollments(id,school_id,student_id,class_id,status) values('60000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000007',nonpreschool_class,'active');
 perform public.save_school_kiosk_schedule(time '06:30',time '07:30',time '07:45',time '12:30',time '20:00',time '07:00',time '08:00',time '08:15',time '12:00',time '18:00');
 if private.kiosk_window_for_student('50000000-0000-0000-0000-000000000001',time '08:00',today,null,null)<>'present'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000001',time '08:01',today,null,null)<>'late'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000001',time '08:16',today,null,null)<>'blocked'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000001',time '11:59',today,null,null)<>'blocked'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000001',time '12:00',today,now()-interval '1 hour',null)<>'checkout' then
   raise exception 'Preschool-specific attendance and departure hours were not enforced';
 end if;
 if private.kiosk_window_for_student('50000000-0000-0000-0000-000000000007',time '10:59',today,now()-interval '1 hour',null)<>'present' then raise exception 'school release window opened before its approved time';end if;
 perform public.activate_school_release_protocol('CI approved early dismissal',time '11:00');
 if private.kiosk_window_for_student('50000000-0000-0000-0000-000000000007',time '10:59',today,now()-interval '1 hour',null)<>'present'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000007',time '11:00',today,now()-interval '1 hour',null)<>'checkout'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000007',time '11:00',today,null,null)<>'blocked' then
  raise exception 'Direction-approved timed release did not honor its time or check-in requirement';
 end if;
 insert into public.official_calendar_sources(url,source,label,school_year,suggested_dates)
 values(source_url,'MENFP','KIOS exam-period test','2026/2027','[]'::jsonb) on conflict(url) do nothing;
 insert into public.confirmed_official_exam_dates(school_id,academic_year_id,section,source_url,source_name,source_label,source_wording,source_context,category,starts_on,ends_on,proposal_snapshot,proposal_hash,confirmed_by,confirmed_by_name,confirmed_by_role)
 values('10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','preschool',source_url,'MENFP','KIOS exam-period test','Test period','CI fixture','exam_period',today,today,'{}'::jsonb,'kiosk-schedule-ci','20000000-0000-0000-0000-000000000008','CI School Administrator','school_admin');
 insert into public.confirmed_official_exam_dates(school_id,academic_year_id,section,source_url,source_name,source_label,source_wording,source_context,category,starts_on,ends_on,proposal_snapshot,proposal_hash,confirmed_by,confirmed_by_name,confirmed_by_role)
 values('10000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','primary',source_url,'MENFP','KIOS primary exam test','Test period','CI fixture','exam_period',today,today,'{}'::jsonb,'kiosk-schedule-ci-primary','20000000-0000-0000-0000-000000000008','CI School Administrator','school_admin');
 if private.kiosk_window_for_student('50000000-0000-0000-0000-000000000001',time '06:00',today,null,null)<>'present'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000001',time '06:01',today,now()-interval '1 hour',null)<>'checkout' then
  raise exception 'confirmed exam period did not allow flexible entry and exit';
 end if;
 if private.kiosk_window_for_student('50000000-0000-0000-0000-000000000007',time '06:00',today,null,null)<>'present'
  or private.kiosk_window_for_student('50000000-0000-0000-0000-000000000007',time '06:01',today,now()-interval '1 hour',null)<>'checkout' then
  raise exception 'confirmed primary exam period did not allow flexible entry and exit';
 end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 denied:=false;begin perform public.school_kiosk_schedule_workspace();exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'parent read KIOS schedule settings';end if;
end
$kiosk_schedule_ci$;


-- Test the school trial with synthetic school records in the enclosing rollback.
update public.schools set owner_user_id='20000000-0000-0000-0000-000000000008' where id='10000000-0000-0000-0000-000000000001';
create temporary table trial_grade_probe (school_id uuid, marker integer);
insert into trial_grade_probe values ('10000000-0000-0000-0000-000000000001',1);
create trigger trial_grade_probe_guard
after insert or update or delete on trial_grade_probe
for each row execute function private.enforce_trial_school_write();

insert into public.assignments(id,school_id,class_id,title)
values('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 '40000000-0000-0000-0000-000000000001','CI trial assignment');
insert into public.assignment_receipts(assignment_id,student_id,source)
values('a0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','teacher');

do $trial_test$
declare first_plan jsonb; switched jsonb; denied boolean:=false; rejected boolean:=false; competency uuid;
begin
 if has_function_privilege('anon','public.choose_school_trial_plan(text)','execute') then raise exception 'anonymous trial write';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 set local role authenticated;
 begin
  perform public.school_subscription_trial();
  raise exception 'parent read trial status before trial creation';
 exception when others then
  if sqlerrm is distinct from 'not_authorized' then raise;end if;
 end;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 if public.school_subscription_trial() is not null then
  raise exception 'new school must have no trial status';
 end if;
 first_plan:=public.choose_school_trial_plan('attendance');
 reset role;
 begin
  update public.assignments set title='Disallowed change' where id='a0000000-0000-0000-0000-000000000001';
  raise exception 'attendance plan changed an assignment';
 exception when others then if sqlerrm<>'school_plan_write_restricted' then raise;end if;end;
 begin
  update public.assignment_receipts set response='Disallowed receipt change' where assignment_id='a0000000-0000-0000-0000-000000000001';
  raise exception 'attendance plan changed an assignment receipt';
 exception when others then if sqlerrm<>'school_plan_write_restricted' then raise;end if;end;
 begin
  delete from public.assignments where id='a0000000-0000-0000-0000-000000000001';
  raise exception 'attendance plan deleted an assignment';
 exception when others then if sqlerrm<>'school_plan_write_restricted' then raise;end if;end;
 if not exists(select 1 from public.assignment_receipts where assignment_id='a0000000-0000-0000-0000-000000000001') then
  raise exception 'rejected parent delete lost its receipt';
 end if;
 set local role authenticated;
 begin
  perform public.save_preschool_competency(null,'PS1','language','CI blocked trial competency',true);
  raise exception 'attendance plan created a competency through the RPC';
 exception when others then if sqlerrm<>'school_plan_write_restricted' then raise;end if;end;
 reset role;

 begin
  update trial_grade_probe set marker=2;
  raise exception 'attendance plan allowed a grade update';
 exception when others then
  if sqlerrm is distinct from 'school_plan_write_restricted' then raise;end if;
 end;
 begin
  delete from trial_grade_probe;
  raise exception 'attendance plan allowed a grade deletion';
 exception when others then
  if sqlerrm is distinct from 'school_plan_write_restricted' then raise;end if;
 end;
 begin
  insert into trial_grade_probe values('10000000-0000-0000-0000-000000000001',3);
  raise exception 'attendance plan allowed a grade insertion';
 exception when others then
  if sqlerrm is distinct from 'school_plan_write_restricted' then raise;end if;
 end;
 set local role authenticated;

 reset role;
 begin
  insert into public.bulletin_versions(school_id,student_id,class_id,period_id,version,payload)
  select school_id,student_id,class_id,period_id,version+100,payload
  from public.bulletin_versions
  where school_id='10000000-0000-0000-0000-000000000001' limit 1;
  raise exception 'attendance trial must block bulletin publication';
 exception when others then
  if sqlerrm is distinct from 'school_plan_write_restricted' then raise;end if;
 end;
 set local role authenticated;
 begin
  perform public.create_finance_fee_plan(null,null,'invalid','', '[]'::jsonb);
  raise exception 'fee plan probe must fail';
 exception when others then
  if sqlerrm is distinct from 'school_plan_write_restricted' then raise;end if;
 end;
 reset role;
 if not private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','attendance') or private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','finance') then raise exception 'attendance trial scope incorrect';end if;
 set local role authenticated;
 perform public.choose_school_trial_plan('school');
 competency:=public.save_preschool_competency(null,'PS1','language','CI allowed trial competency',true);
 perform public.save_preschool_competency(competency,'PS1','language','CI updated trial competency',true);
 reset role;
 update public.assignments set title='Allowed school plan change' where id='a0000000-0000-0000-0000-000000000001';
 update public.assignment_receipts set response='Allowed school plan receipt' where assignment_id='a0000000-0000-0000-0000-000000000001';
 delete from public.assignments where id='a0000000-0000-0000-0000-000000000001';
 if exists(select 1 from public.assignment_receipts where assignment_id='a0000000-0000-0000-0000-000000000001') then
  raise exception 'allowed assignment delete did not cascade';
 end if;
 update trial_grade_probe set marker=2;
 if not exists(select 1 from trial_grade_probe where marker=2) then raise exception 'school plan must allow grade changes';end if;
 set local role authenticated;
 reset role;
 if not private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','school') or private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','finance') then raise exception 'school trial scope incorrect';end if;
 set local role authenticated;
 switched:=public.choose_school_trial_plan('school_finance');
 if switched->>'plan' is distinct from 'school_finance'
    or switched->>'started_at' is distinct from first_plan->>'started_at'
    or switched->>'ends_at' is distinct from first_plan->>'ends_at'
    or (switched->>'ends_at')::timestamptz-(switched->>'started_at')::timestamptz<>interval '720 hours' then
   raise exception 'plan switching must preserve the 30-day trial';
 end if;
 reset role;
 if not private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','finance') or has_function_privilege('authenticated','private.school_trial_allows_write(uuid,text)','execute') then raise exception 'finance trial scope or helper ACL incorrect';end if;
 update private.school_subscription_trials set started_at=now()-interval '744 hours',ends_at=now()-interval '24 hours' where school_id='10000000-0000-0000-0000-000000000001';
 set local role authenticated;
 reset role;
 if private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','attendance') then raise exception 'expired trial must be read-only';end if;
 set local role authenticated;
 begin
  perform public.save_preschool_competency(competency,'PS1','language','CI expired trial edit',true);
  raise exception 'expired trial changed a competency through the RPC';
 exception when others then if sqlerrm<>'school_plan_write_restricted' then raise;end if;end;
 reset role;
 if not exists(select 1 from public.preschool_competencies where id=competency and label='CI updated trial competency') then
  raise exception 'rejected competency update changed its saved value';
 end if;
 begin
  delete from public.preschool_competencies where id=competency;
  raise exception 'expired trial deleted a competency';
 exception when others then if sqlerrm<>'school_plan_write_restricted' then raise;end if;end;
 set local role authenticated;

 begin
  perform public.create_finance_fee_plan(null,null,'invalid','', '[]'::jsonb);
  raise exception 'fee plan probe must fail';
 exception when others then
  if sqlerrm is distinct from 'school_plan_write_restricted' then raise;end if;
 end;
 begin perform public.choose_school_trial_plan('school');exception when others then rejected:=sqlerrm='school_trial_expired';end;
 if not rejected then raise exception 'expired trial must not restart';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 begin perform public.choose_school_trial_plan('school');exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'linked parent cannot manage subscription trials';end if;
 reset role;
end
$trial_test$;


-- All subscription billing fixtures are synthetic and roll back.
insert into private.subscription_billing_operators(user_id)
values('20000000-0000-0000-0000-000000000008');
insert into public.users(id,full_name) values('20000000-0000-0000-0000-000000000009','Other School Owner');
insert into public.school_members(school_id,user_id,role,enabled)
values('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000009','school_admin',true);
update public.schools set owner_user_id='20000000-0000-0000-0000-000000000009'
where id='10000000-0000-0000-0000-000000000002';

do $subscription_billing_test$
declare invoice uuid; renewal uuid; different_plan uuid; workspace jsonb; first_end timestamptz; failed boolean;
begin
 if has_function_privilege('anon','public.create_school_subscription_invoice(text,text,text,text)','execute')
 or has_table_privilege('authenticated','private.school_subscription_invoices','select')
 or has_table_privilege('authenticated','private.subscription_billing_operators','insert') then
  raise exception 'subscription billing ACL is unsafe';
 end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 set local role authenticated;
 begin
  perform public.subscription_billing_admin_workspace();
  raise exception 'parent reached platform billing';
 exception when others then if sqlerrm<>'not_authorized' then raise;end if;end;
 begin
  perform public.create_school_subscription_invoice('attendance','HTG','monthly','moncash');
  raise exception 'parent created subscription invoice';
 exception when others then if sqlerrm<>'not_authorized' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 perform public.save_subscription_payment_method('moncash','CI recipient','+50937000001',true);
 perform public.save_subscription_payment_method('paypal','CI USD recipient','billing-ci@example.invalid',true);
 invoice:=public.create_school_subscription_invoice('attendance','HTG','monthly','moncash');
 if public.create_school_subscription_invoice('attendance','HTG','monthly','moncash')<>invoice then
  raise exception 'retry created duplicate invoice';
 end if;
 begin
  perform public.create_school_subscription_invoice('school','USD','monthly','paypal');
  raise exception 'two invoices opened for the same school';
 exception when others then if sqlerrm<>'subscription_invoice_pending' then raise;end if;end;
 perform public.save_subscription_payment_method('moncash','Changed recipient','+50937000002',true);
 workspace:=public.school_subscription_billing_workspace();
 if workspace->'invoices'->0->>'amount'<>'1950.00'
 or workspace->'invoices'->0->'destination'->>'account'<>'+50937000001' then
  raise exception 'invoice price or destination snapshot changed';
 end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000009',true);
 workspace:=public.school_subscription_billing_workspace();
 if jsonb_array_length(workspace->'invoices')<>0 then raise exception 'other school saw subscription invoice';end if;
 begin
  perform public.submit_school_subscription_payment(invoice,'CI-SUB-OTHER-SCHOOL');
  raise exception 'other school submitted subscription payment';
 exception when others then if sqlerrm<>'subscription_invoice_not_pending' then raise;end if;end;
 begin
  perform public.save_subscription_payment_method('moncash','Hijacked recipient','+50937000003',true);
  raise exception 'school owner changed platform destination';
 exception when others then if sqlerrm<>'not_authorized' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 perform public.submit_school_subscription_payment(invoice,'CI-SUB-001');
 reset role;
 if exists(select 1 from private.school_paid_subscriptions where school_id='10000000-0000-0000-0000-000000000001') then
  raise exception 'payment claim activated subscription';
 end if;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000009',true);
 begin
  perform public.review_school_subscription_payment(invoice,true,1950,'HTG','CI bank transaction verified');
  raise exception 'school owner activated subscription';
 exception when others then if sqlerrm<>'not_authorized' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 begin
  perform public.review_school_subscription_payment(invoice,true,1950,'USD','CI wrong currency');
  raise exception 'wrong currency activated subscription';
 exception when others then if sqlerrm<>'subscription_payment_mismatch' then raise;end if;end;
 begin
  perform public.review_school_subscription_payment(invoice,true,1900,'HTG','CI wrong amount');
  raise exception 'wrong amount activated subscription';
 exception when others then if sqlerrm<>'subscription_payment_mismatch' then raise;end if;end;
 perform public.review_school_subscription_payment(invoice,true,1950,'HTG','CI provider transaction verified');
 begin
  perform public.review_school_subscription_payment(invoice,true,1950,'HTG','CI repeated approval');
  raise exception 'repeat review extended subscription';
 exception when others then if sqlerrm<>'subscription_invoice_not_submitted' then raise;end if;end;
 reset role;
 if not private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','attendance')
 or private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','finance') then
  raise exception 'paid subscription module boundaries incorrect';
 end if;
 select ends_at into first_end from private.school_paid_subscriptions where school_id='10000000-0000-0000-0000-000000000001';
 set local role authenticated;
 renewal:=public.create_school_subscription_invoice('attendance','HTG','yearly','moncash');
 begin
  perform public.submit_school_subscription_payment(renewal,' ci-sub-001 ');
  raise exception 'transaction reference reused';
 exception when others then if sqlerrm<>'subscription_reference_used' then raise;end if;end;
 perform public.submit_school_subscription_payment(renewal,'CI-SUB-002');
 perform public.review_school_subscription_payment(renewal,true,19500,'HTG','CI annual renewal verified');
 reset role;
 if (select ends_at from private.school_paid_subscriptions where school_id='10000000-0000-0000-0000-000000000001')<>first_end+interval '1 year' then
  raise exception 'renewal lost the remaining subscription period';
 end if;
 set local role authenticated;
 begin
  perform public.create_school_subscription_invoice('school','USD','monthly','paypal');
  raise exception 'unsupported plan change requested payment';
 exception when others then if sqlerrm<>'subscription_active_plan_change_requires_review' then raise;end if;end;
 reset role;
 update private.school_paid_subscriptions set starts_at=now()-interval '2 months',ends_at=now()-interval '1 month'
 where school_id='10000000-0000-0000-0000-000000000001';
 set local role authenticated;
 different_plan:=public.create_school_subscription_invoice('school','USD','monthly','paypal');
 reset role;
 update private.school_paid_subscriptions set ends_at=first_end+interval '1 year'
 where school_id='10000000-0000-0000-0000-000000000001';
 set local role authenticated;
 workspace:=public.school_subscription_billing_workspace();
 if (select (value->>'amount')::numeric from jsonb_array_elements(workspace->'invoices')
  where value->>'id'=different_plan::text) is distinct from 25::numeric then
  raise exception 'USD subscription quote incorrect';
 end if;
 perform public.submit_school_subscription_payment(different_plan,'CI-USD-SUB');
 begin
  perform public.review_school_subscription_payment(different_plan,true,25,'USD','CI plan change verified');
  raise exception 'active paid plan replaced without commercial review';
 exception when others then if sqlerrm<>'subscription_active_plan_change_requires_review' then raise;end if;end;
 perform public.review_school_subscription_payment(different_plan,false,null,'USD','CI rejected pending commercial review');
 different_plan:=public.create_school_subscription_invoice('attendance','USD','yearly','paypal');
 perform public.cancel_school_subscription_invoice(different_plan);
 different_plan:=public.create_school_subscription_invoice('attendance','USD','yearly','paypal');
 reset role;
 update private.school_subscription_invoices set expires_at=now()-interval '1 day' where id=different_plan;
 set local role authenticated;
 begin
  perform public.submit_school_subscription_payment(different_plan,'CI-EXPIRED-SUB');
  raise exception 'expired quote accepted payment submission';
 exception when others then if sqlerrm<>'subscription_invoice_not_pending' then raise;end if;end;
 reset role;
 update private.school_paid_subscriptions set starts_at=now()-interval '2 months',ends_at=now()-interval '1 month'
 where school_id='10000000-0000-0000-0000-000000000001';
 if private.school_trial_allows_write('10000000-0000-0000-0000-000000000001','attendance') then
  raise exception 'expired paid subscription regained grandfather access';
 end if;
 delete from private.school_subscription_trials where school_id='10000000-0000-0000-0000-000000000001';
 set local role authenticated;
 begin
  perform public.choose_school_trial_plan('school_finance');
  raise exception 'paid school started a new free trial';
 exception when others then if sqlerrm<>'school_trial_unavailable' then raise;end if;end;
 reset role;

 insert into public.students(id,school_id,first_name,last_name,atechos_id,active,school_status)
 select gen_random_uuid(),'10000000-0000-0000-0000-000000000002','Billing','CI','CI-SUB-STUDENT-'||n,true,'active'
 from generate_series(1,151) n;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000009',true);
 set local role authenticated;
 begin
  perform public.create_school_subscription_invoice('attendance','USD','monthly','paypal');
  raise exception 'school above launch capacity received standard invoice';
 exception when others then if sqlerrm<>'subscription_quote_required' then raise;end if;end;
 reset role;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
 update private.subscription_billing_operators set enabled=false;
 set local role authenticated;
 if public.subscription_billing_operator() then raise exception 'disabled platform operator retained access';end if;
 begin
  perform public.subscription_billing_admin_workspace();
  raise exception 'disabled operator read billing';
 exception when others then if sqlerrm<>'not_authorized' then raise;end if;end;
 reset role;
end
$subscription_billing_test$;


-- Exercise the ordinary onboarding entry points with isolated auth users.
insert into auth.users(id,email) values
 ('20000000-0000-0000-0000-000000000010','trial-onboarding-ci@example.invalid'),
 ('20000000-0000-0000-0000-000000000011','trial-legacy-ci@example.invalid');

do $subscription_onboarding_test$
declare sid uuid; trial jsonb; original_end text;
begin
 if has_function_privilege('authenticated','public.create_school_onboarding_before_subscription(text,text,text,text,text,text,text)','execute')
 or has_function_privilege('anon','public.create_school_onboarding(text,text,text,text,text,text,text,text)','execute') then
  raise exception 'subscription onboarding bypass is exposed';
 end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000010',true);
 set local role authenticated;
 begin
  perform public.create_school_onboarding('Invalid trial school','CI-TRIAL-INVALID',null,null,null,'CI owner',null,'invalid');
  raise exception 'invalid onboarding trial plan accepted';
 exception when others then if sqlerrm<>'invalid_trial_plan' then raise;end if;end;
 sid:=public.create_school_onboarding('Selected trial school','CI-TRIAL-SELECTED',null,null,null,'CI owner',null,'school_finance');
 trial:=public.school_subscription_trial();
 if trial->>'plan'<>'school_finance' or (trial->>'active')::boolean is distinct from true
 or (trial->>'ends_at')::timestamptz-(trial->>'started_at')::timestamptz<>interval '720 hours' then
  raise exception 'new school did not receive its selected 30-day trial';
 end if;
 original_end:=trial->>'ends_at';
 perform public.choose_school_trial_plan('school');
 trial:=public.school_subscription_trial();
 if trial->>'ends_at'<>original_end then raise exception 'onboarding plan switch restarted the trial';end if;
 reset role;
 if exists(select 1 from public.schools where code='CI-TRIAL-INVALID')
 or not exists(select 1 from private.school_subscription_trials where school_id=sid and plan='school') then
  raise exception 'school creation and trial enrollment are not atomic';
 end if;
 set local role authenticated;
 begin
  perform public.create_school_onboarding('Duplicate school','CI-TRIAL-DUPLICATE');
  raise exception 'existing member created another trial school';
 exception when others then if sqlerrm<>'user_already_belongs_to_school' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000011',true);
 sid:=public.create_school_onboarding('Legacy client school','CI-TRIAL-LEGACY');
 trial:=public.school_subscription_trial();
 if trial->>'plan'<>'attendance' then raise exception 'legacy onboarding bypassed the default trial';end if;
 reset role;
 if private.school_trial_allows_write(sid,'finance') or not private.school_trial_allows_write(sid,'attendance') then
  raise exception 'legacy onboarding received incorrect module access';
 end if;
end
$subscription_onboarding_test$;

rollback;
