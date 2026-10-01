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
 ('20000000-0000-0000-0000-000000000004','CI Preschool Teacher');
insert into public.grade_levels(id,code) values('30000000-0000-0000-0000-000000000001','PS1');
insert into public.classes(id,school_id,grade_level_id,grade_level,name) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PS1','Preschool CI');
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
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','teacher');
insert into public.parents(id,school_id,user_id,full_name,email,relationship) values
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Linked Parent','linked@example.invalid','parent'),
 ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Other Parent','other@example.invalid','parent');
insert into public.student_parents(student_id,parent_id,is_primary,relationship) values
 ('50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',true,'parent');
insert into public.attendance(id,school_id,student_id,class_id,attendance_date,check_in_at,status,recorded_by) values
 ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,now(),'present','20000000-0000-0000-0000-000000000001');

do $test$
declare v_case_id uuid; family jsonb; kiosk jsonb; failed boolean:=false; adult_id uuid; term_year uuid:='11000000-0000-0000-0000-000000000001'; ps_period uuid; ps_competency uuid; ps_version uuid; ps_workspace jsonb; ps_report jsonb; ps_published integer;
begin
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
 insert into public.kindergarten_pickup_authorizations(school_id,student_id,full_name,relationship,created_by)
 values('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Authorized Adult','guardian','20000000-0000-0000-0000-000000000001') returning id into adult_id;
 v_case_id:=public.start_kindergarten_relocation('50000000-0000-0000-0000-000000000001','needs_support','PRIVATE-CI-NOTE');
 perform public.record_kindergarten_parent_contact(v_case_id,'no_answer','PRIVATE-CI-CONTACT');

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 family:=public.kindergarten_parent_relocation_status();
 if jsonb_array_length(family)<>1 or family->0->>'student_id'<>'50000000-0000-0000-0000-000000000001' then raise exception 'linked parent scope failed'; end if;
 if family::text like '%PRIVATE-%' or family::text like '%needs_support%' or family::text like '%opened_at%' then raise exception 'private relocation detail leaked'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 if jsonb_array_length(public.kindergarten_parent_relocation_status())<>0 then raise exception 'unrelated parent saw relocation'; end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 perform public.complete_kindergarten_pickup('AOSQ1.'||repeat('a',64),adult_id,'CI verified pickup');
 if not exists(select 1 from public.kindergarten_relocation_cases where id=v_case_id and status='picked_up' and closed_by='20000000-0000-0000-0000-000000000001') then raise exception 'pickup did not close relocation with actor'; end if;
 if not exists(select 1 from public.attendance_events where attendance_id='80000000-0000-0000-0000-000000000001' and source='STAFF' and actor_role='director' and action='kindergarten_pickup_check_out') then raise exception 'pickup checkout attribution failed'; end if;
 if not exists(select 1 from public.badge_scans where badge_id='51000000-0000-0000-0000-000000000001' and source='PICKUP' and result='pickup_complete') then raise exception 'pickup badge audit failed'; end if;
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
 ps_published:=public.publish_preschool_bulletins('40000000-0000-0000-0000-000000000001',ps_period,6,'Quarterly preschool observation');
 if ps_published<>1 then raise exception 'expected one preschool bulletin';end if;
 select id,payload into ps_version,ps_report from public.preschool_bulletin_versions where student_id='50000000-0000-0000-0000-000000000001';
 if ps_report->>'exam_month'<>'6' or ps_report->>'period'<>'1er Trimestre' or ps_report->'competencies'->0->>'rating' is null then raise exception 'preschool bulletin snapshot missing period, month, or observations';end if;
 if not exists(select 1 from public.preschool_evaluation_events where evaluation_id=(select id from public.preschool_evaluations where student_id='50000000-0000-0000-0000-000000000001' limit 1) and action='created') then raise exception 'preschool evaluation audit missing';end if;
 failed:=false;begin update public.preschool_bulletin_versions set exam_month=7 where id=ps_version;exception when others then failed:=sqlerrm='preschool_bulletin_immutable';end;
 if not failed then raise exception 'preschool bulletin snapshot was mutable';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 family:=public.family_preschool_bulletins();if jsonb_array_length(family)<>1 or family->0->'payload'->'student'->>'name'<>'CI Student' then raise exception 'linked parent missed preschool bulletin';end if;
 ps_report:=private.student_report_cards('50000000-0000-0000-0000-000000000001');if jsonb_array_length(ps_report->'preschool_cards')<>1 then raise exception 'parent report-card RPC wrapper missed preschool bulletin';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 if jsonb_array_length(public.family_preschool_bulletins())<>0 then raise exception 'unrelated parent saw preschool bulletin';end if;
 if has_table_privilege('authenticated','public.preschool_bulletin_versions','select') or has_table_privilege('authenticated','public.preschool_evaluations','select') then raise exception 'authenticated can bypass preschool RPC security';end if;
end
$test$;

rollback;
