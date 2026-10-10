begin;

insert into public.schools(id,name) values
 ('fb000000-0000-0000-0000-000000000001','Follow-up CI'),
 ('fb000000-0000-0000-0000-000000000002','Other Follow-up CI');
insert into public.academic_years(id,school_id,name,start_date,end_date,is_current) values
 ('fb100000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','Follow-up CI year','2026-08-01','2027-07-31',true),
 ('fb100000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000002','Other CI year','2026-08-01','2027-07-31',true);
insert into public.classes(id,school_id,academic_year_id,name,enabled) values
 ('fb200000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','fb100000-0000-0000-0000-000000000001','CI Class',true),
 ('fb200000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000002','fb100000-0000-0000-0000-000000000002','Other CI Class',true);
insert into public.users(id,full_name) values
 ('fb300000-0000-0000-0000-000000000001','Follow-up Director'),
 ('fb300000-0000-0000-0000-000000000002','Follow-up Admin'),
 ('fb300000-0000-0000-0000-000000000003','Follow-up Secretary'),
 ('fb300000-0000-0000-0000-000000000004','Follow-up Teacher'),
 ('fb300000-0000-0000-0000-000000000005','Follow-up Parent'),
 ('fb300000-0000-0000-0000-000000000006','Follow-up Other-school Admin');
insert into public.parents(id,school_id,user_id,full_name,email) values
 ('fb600000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000005','Follow-up Parent','followup-parent@example.invalid');
insert into public.school_members(school_id,user_id,role,enabled) values
 ('fb000000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000001','director',true),
 ('fb000000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000002','school_admin',true),
 ('fb000000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000003','secretary',true),
 ('fb000000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000004','teacher',true),
 ('fb000000-0000-0000-0000-000000000001','fb300000-0000-0000-0000-000000000005','parent',true),
 ('fb000000-0000-0000-0000-000000000002','fb300000-0000-0000-0000-000000000006','school_admin',true);
insert into public.students(id,school_id,first_name,last_name,atechos_id,active,school_status) values
 ('fb400000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','Followup','Student One','AOS-FOLLOWUP-1',true,'active'),
 ('fb400000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000001','Followup','Student Two','AOS-FOLLOWUP-2',true,'active'),
 ('fb400000-0000-0000-0000-000000000003','fb000000-0000-0000-0000-000000000002','Other','School Student','AOS-FOLLOWUP-3',true,'active');
insert into public.student_parents(student_id,parent_id) values
 ('fb400000-0000-0000-0000-000000000001','fb600000-0000-0000-0000-000000000001');
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('fb500000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000001','fb200000-0000-0000-0000-000000000001','active'),
 ('fb500000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000002','fb200000-0000-0000-0000-000000000001','active'),
 ('fb500000-0000-0000-0000-000000000003','fb000000-0000-0000-0000-000000000002','fb400000-0000-0000-0000-000000000003','fb200000-0000-0000-0000-000000000002','active');
update public.classes set grade_level='PS1' where id='fb200000-0000-0000-0000-000000000001';
update public.classes set grade_level='NS1' where id='fb200000-0000-0000-0000-000000000002';

do $$
declare sanction_type uuid; portal_sanction_type uuid; portal_sanction_id uuid; contact_id uuid; contact2_id uuid; release_id uuid; release2_id uuid; relocation_id uuid; pickup_authorization uuid; kiosk_badge uuid; sanction_id uuid; workspace jsonb; family_sanctions jsonb; denied boolean; kiosk jsonb; home jsonb; protocol jsonb; family_relocation jsonb; student_token text:='home-arrival-ci-token-00000000000000000000000000000000'; school_day date := (now() at time zone 'America/Port-au-Prince')::date - case extract(isodow from now() at time zone 'America/Port-au-Prince')::integer when 6 then 1 when 7 then 2 else 0 end;
begin
 if not (select relrowsecurity from pg_class where oid='public.student_sanctions'::regclass)
    or has_table_privilege('authenticated','public.student_sanctions','SELECT')
    or has_table_privilege('authenticated','public.student_release_contacts','INSERT')
    or has_table_privilege('authenticated','public.student_followup_events','UPDATE')
 then raise exception 'follow-up RLS/direct table grant boundary is not enforced'; end if;

 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000004',true);
 denied:=false; begin perform public.student_followup_workspace(); exception when others then denied:=sqlerrm='not_authorized'; end;
 if not denied then raise exception 'teacher accessed follow-up workspace'; end if;
 denied:=false; begin perform public.save_student_release_contact('fb400000-0000-0000-0000-000000000001',null,'Alternate Adult','Aunt',null,true); exception when others then denied:=sqlerrm='not_authorized'; end;
 if not denied then raise exception 'teacher registered alternate adult'; end if;

 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 denied:=false; begin perform public.student_followup_workspace(); exception when others then denied:=sqlerrm='not_authorized'; end;
 if not denied then raise exception 'parent accessed staff follow-up workspace'; end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000006',true);
 denied:=false; begin perform public.create_student_sanction('fb400000-0000-0000-0000-000000000001',null,'Cross-school attempt',now()); exception when others then denied:=sqlerrm='not_authorized'; end;
 if not denied then raise exception 'another school manager modified this school student'; end if;

 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 sanction_type:=public.save_student_sanction_type(null,'Suspension',true,'kiosk_suspension',3::smallint);
 contact_id:=public.save_student_release_contact('fb400000-0000-0000-0000-000000000001',null,'Alternate Adult','Aunt',null,true);
 denied:=false; begin perform public.request_student_release('fb400000-0000-0000-0000-000000000002','medical',contact_id,'Wrong student contact'); exception when others then denied:=sqlerrm='release_contact_not_authorized'; end;
 if not denied then raise exception 'contact registered for another student was accepted'; end if;
 sanction_id:=public.create_student_sanction('fb400000-0000-0000-0000-000000000001',sanction_type,'Incident recorded by secretary',now()-interval '1 hour');
 if private.student_sanction_restriction('fb400000-0000-0000-0000-000000000001','kiosk')<>'sanction_kiosk_suspended' then raise exception 'configured KIOS action was not activated'; end if;
 if private.student_sanction_restriction('fb400000-0000-0000-0000-000000000001','portal') is not null then raise exception 'KIOS-only sanction blocked student portal access'; end if;
 denied:=false; begin
  insert into private.student_sessions(student_id,token_hash,expires_at)
  values('fb400000-0000-0000-0000-000000000001',encode(extensions.digest('kiosk-only-session-test','sha256'),'hex'),now()+interval '1 hour');
 exception when others then denied:=true; end;
 if denied then raise exception 'KIOS-only sanction blocked student portal session'; end if;
 delete from private.student_sessions where token_hash=encode(extensions.digest('kiosk-only-session-test','sha256'),'hex');
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000001');
 if kiosk->>'error'<>'sanction_kiosk_suspended' then raise exception 'KIOS did not enforce the active configured sanction'; end if;
 perform public.resolve_student_sanction(sanction_id,'Resolved after meeting');
 if private.student_sanction_restriction('fb400000-0000-0000-0000-000000000001','kiosk') is not null then raise exception 'resolving the sanction did not lift its KIOS restriction'; end if;
 if not exists(select 1 from public.student_sanctions where id=sanction_id and status='resolved' and created_role='secretary') then raise exception 'sanction actor and resolution were not preserved'; end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 family_sanctions:=public.family_student_sanctions('fb400000-0000-0000-0000-000000000001');
 if jsonb_array_length(family_sanctions->'sanctions')<>1 or family_sanctions->'sanctions'->0->>'type'<>'Suspension' or family_sanctions->'sanctions'->0 ? 'created_by' then raise exception 'linked parent did not receive only sanitized sanction history'; end if;
 denied:=false; begin perform public.family_student_sanctions('fb400000-0000-0000-0000-000000000002'); exception when others then denied:=sqlerrm='not_authorized'; end;
 if not denied then raise exception 'parent read a non-linked student sanction'; end if;
 if not has_function_privilege('authenticated','public.family_student_sanctions(uuid)','EXECUTE') or has_function_privilege('anon','public.family_student_sanctions(uuid)','EXECUTE') then raise exception 'family sanction grants are unsafe'; end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 portal_sanction_type:=public.save_student_sanction_type(null,'Student access suspension',true,'student_suspension',2::smallint);
 portal_sanction_id:=public.create_student_sanction('fb400000-0000-0000-0000-000000000001',portal_sanction_type,'Student access suspension CI test',now()-interval '1 hour');
 denied:=false; begin insert into private.student_sessions(student_id,token_hash,expires_at)
  values('fb400000-0000-0000-0000-000000000001',encode(extensions.digest('sanction-session-test','sha256'),'hex'),now()+interval '1 hour');
 exception when others then denied:=sqlerrm='sanction_student_suspended'; end;
 if not denied then raise exception 'active student suspension issued a portal session'; end if;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000001');
 if kiosk->>'error'<>'sanction_student_suspended' then raise exception 'student suspension did not also block KIOS'; end if;
 perform public.resolve_student_sanction(portal_sanction_id,'Access suspension CI test complete');
 release_id:=public.request_student_release('fb400000-0000-0000-0000-000000000001','medical',contact_id,'Student needs to leave for medical care');
 if (select count(*) from public.notifications where type='student_release' and event_key like 'student-release-request:%')<>2 then raise exception 'release request did not notify the other authorized staff'; end if;
 denied:=false; begin perform public.review_student_release(release_id,false,' '); exception when others then denied:=sqlerrm='decision_reason_required'; end;
 if not denied then raise exception 'rejection without a reason was accepted'; end if;

 -- Preschool requests stay pending until Direction approves the physical move.
 insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at)
 values('fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000001','fb200000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,'present',now()-interval '1 hour');
 relocation_id:=public.start_kindergarten_relocation('fb400000-0000-0000-0000-000000000001','safety','Private test note');
 if not exists(select 1 from public.kindergarten_relocation_cases where id=relocation_id and status='pending_direction')
    or exists(select 1 from public.kindergarten_relocation_events where case_id=relocation_id and event_type='relocated_to_office') then raise exception 'staff request moved a preschool student before Direction review';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 family_relocation:=public.kindergarten_parent_relocation_status();
 if family_relocation->0->>'status'<>'pending_direction' or family_relocation->0->>'message' not ilike '%urgently%' or family_relocation::text ilike '%Private test note%' then raise exception 'linked parent did not get the safe urgent pickup prompt';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 denied:=false;begin perform public.review_kindergarten_relocation(relocation_id,true,null);exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'secretary approved a Preschool relocation';end if;

 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 perform public.review_kindergarten_relocation(relocation_id,true,'Approved by Direction');
 if not exists(select 1 from public.kindergarten_relocation_cases where id=relocation_id and status='active' and reviewed_role='director')
    or not exists(select 1 from public.kindergarten_relocation_events where case_id=relocation_id and event_type='relocated_to_office' and actor_role='director') then raise exception 'Director approval did not authorize and audit the Preschool move';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 family_relocation:=public.kindergarten_parent_relocation_status();
 if family_relocation->0->>'status'<>'active' or family_relocation->0->>'message' not ilike '%as soon as possible%' or family_relocation::text ilike '%Private test note%' then raise exception 'parent status leaked relocation notes or lost the pickup prompt';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 perform public.return_kindergarten_student_to_class(relocation_id,'Returned after review');

 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 perform public.review_student_release(release_id,true,'Approved by director');
 perform public.record_student_release(release_id,now()+interval '2 hours');
 perform public.confirm_student_return(release_id);
 if not exists(select 1 from public.student_release_cases where id=release_id and status='returned' and reviewed_role='director' and released_role='director' and returned_at is not null) then raise exception 'medical release/return actor timeline was not recorded'; end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 contact2_id:=public.save_student_release_contact('fb400000-0000-0000-0000-000000000002',null,'Second Alternate Adult','Parent',null,true);
 release2_id:=public.request_student_release('fb400000-0000-0000-0000-000000000002','exceptional',contact2_id,'Student is authorized to leave with family');
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at)
 values('fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000002','fb200000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,'present',now()-interval '1 hour');
 -- A completed Preschool pickup must replace the normal kiosk checkout notice.
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 insert into public.kindergarten_pickup_authorizations(id,school_id,student_id,full_name,relationship,created_by)
 values('fb800000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000001','Pickup Adult','Parent','fb300000-0000-0000-0000-000000000003');
 insert into public.student_badges(id,school_id,student_id,badge_uid,badge_type,active,state)
 values('fb700000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000001','PRESCHOOL-CI-1','qr',true,'active');
 insert into private.badge_token_history(token_hash,badge_id) values(encode(extensions.digest(repeat('a',64),'sha256'),'hex'),'fb700000-0000-0000-0000-000000000001');
 perform public.complete_kindergarten_pickup('AOSQ1.'||repeat('a',64),'fb800000-0000-0000-0000-000000000001',null);
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000001');
 if kiosk->>'action'<>'already_picked_up_by_parent' or kiosk->>'check_out_at' is null then raise exception 'KIOS showed the normal checkout result after Preschool pickup: %',kiosk;end if;

 -- student_release_kiosk_ci_window: isolate the exact 08:01-12:59 denial deterministically.
 create or replace function private.kiosk_window(p_time time) returns text language sql immutable set search_path='' as $window$ select 'blocked'::text; $window$;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'error'<>'kiosk_closed' then raise exception 'unreleased student bypassed the blocked KIOS window'; end if;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'error'<>'kiosk_closed' then raise exception 'unapproved departure bypassed the blocked KIOS window';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 perform public.review_student_release(release2_id,true,'Departure approved by director');
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'action'<>'check_out' then raise exception 'approved departure scan did not check the student out: %',kiosk; end if;
 if not exists(select 1 from public.attendance a where a.student_id='fb400000-0000-0000-0000-000000000002' and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null)
    or not exists(select 1 from public.attendance_events e where e.student_id='fb400000-0000-0000-0000-000000000002' and e.source='KIOS' and e.action='check_out') then
  raise exception 'authorized KIOS departure did not preserve attendance and student actor audit';
 end if;
 if not exists(select 1 from public.student_release_cases where id=release2_id and status='released' and departure_source='KIOS' and released_by is null and expected_return_at is null) then raise exception 'approved KIOS scan did not record the release state';end if;
 perform public.confirm_student_return(release2_id);
 if not exists(select 1 from public.student_release_cases where id=release2_id and status='returned' and departure_source='KIOS') then raise exception 'staff return confirmation did not close the KIOS release';end if;
 -- The school-wide protocol is tenant-scoped, audit-linked, and cannot be
 -- enabled by a teacher. It permits checked-in non-Preschool students only.
 insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at)
 values('fb000000-0000-0000-0000-000000000002','fb400000-0000-0000-0000-000000000003','fb200000-0000-0000-0000-000000000002',(now() at time zone 'America/Port-au-Prince')::date,'present',now()-interval '1 hour');
 insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at)
 values('fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000001','fb200000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,'present',now()-interval '1 hour')
 on conflict(student_id,attendance_date) do update set status='present',check_in_at=excluded.check_in_at,check_out_at=null;
 insert into public.student_badges(id,school_id,student_id,badge_uid,badge_type,active,state)
 values('fb700000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000002','fb400000-0000-0000-0000-000000000003','SCHOOL-RELEASE-CI','qr',true,'active');
 insert into public.student_badges(id,school_id,student_id,badge_uid,badge_type,active,state)
 values('fb700000-0000-0000-0000-000000000003','fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000002','SCHOOL-RELEASE-PRESCHOOL-CI','qr',true,'active');
 insert into private.badge_token_history(token_hash,badge_id) values(encode(extensions.digest(repeat('b',64),'sha256'),'hex'),'fb700000-0000-0000-0000-000000000002');
 insert into private.badge_token_history(token_hash,badge_id) values(encode(extensions.digest(repeat('c',64),'sha256'),'hex'),'fb700000-0000-0000-0000-000000000003');
 -- Fix the regular KIOS schedule so this integration assertion is independent
 -- of the hosted runner's clock. The surrounding fixture rolls back.
 create or replace function private.kiosk_window(p_time time) returns text language sql immutable set search_path='' as $school_release_window$ select 'blocked'::text; $school_release_window$;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000006',true);
 protocol:=public.school_release_protocol_workspace();
 if protocol->>'active'<>'false' or protocol->>'can_activate'<>'true' then raise exception 'other-school release protocol leaked or failed to initialize';end if;
 kiosk:=public.student_kiosk_badge('AOSQ1.'||repeat('b',64));
 if kiosk->>'error'<>'kiosk_closed' then raise exception 'KIOS departure was allowed before the school protocol was activated: %',kiosk;end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000004',true);
 denied:=false;begin perform public.activate_school_release_protocol('Unauthorized teacher dismissal');exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'teacher activated a school-wide dismissal';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000006',true);
 protocol:=public.activate_school_release_protocol('Authorized school-wide dismissal');
 if protocol->>'active'<>'true' or protocol->>'can_activate'<>'true' or protocol->'protocol'->>'activated_role'<>'school_admin' then raise exception 'school release protocol activation and actor audit failed';end if;
 kiosk:=public.student_kiosk_badge('AOSQ1.'||repeat('b',64));
 if kiosk->>'action'<>'check_out' or not exists(select 1 from public.attendance a where a.student_id='fb400000-0000-0000-0000-000000000003' and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null) then raise exception 'school release protocol did not let a checked-in non-Preschool student check out: %',kiosk;end if;
 kiosk:=public.student_kiosk_badge('AOSQ1.'||repeat('c',64));
 if kiosk->>'error'<>'kiosk_closed' then raise exception 'school-wide dismissal incorrectly bypassed the Preschool pickup workflow: %',kiosk;end if;
 if not exists(select 1 from public.attendance_events e where e.student_id='fb400000-0000-0000-0000-000000000003' and e.source='KIOS' and e.action='check_out' and e.school_release_protocol_id=(protocol->'protocol'->>'id')::uuid) then raise exception 'school dismissal KIOS checkout was not linked to its protocol audit';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 denied:=false;begin perform public.school_release_protocol_workspace();exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'family read another school release protocol';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000006',true);
 denied:=false;begin update public.school_release_protocols set reason='tampered' where id=(protocol->'protocol'->>'id')::uuid;exception when others then denied:=sqlerrm='school_release_protocol_immutable';end;
 if not denied then raise exception 'school release protocol audit record was mutable';end if;
 if (select count(*) from public.student_followup_events where entity_id in (sanction_type,sanction_id,contact_id,release_id))<7 then raise exception 'audit trail is incomplete'; end if;
 denied:=false; begin update public.student_followup_events set action='tampered' where entity_id=release_id; exception when others then denied:=sqlerrm='student_followup_event_immutable'; end;
 if not denied then raise exception 'immutable follow-up audit record was changed'; end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 workspace:=public.student_followup_workspace();
 if jsonb_array_length(workspace->'students')<>2 or jsonb_array_length(workspace->'releases')<>2 then raise exception 'workspace leaked another school or lost the in-scope record'; end if;

 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000002',true);
 denied:=false;begin perform public.set_home_arrival_enabled(true);exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'school admin activated home-arrival confirmation without Direction';end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 perform public.set_home_arrival_enabled(true);
 home:=public.home_arrival_staff_workspace();
 if home->>'enabled'<>'true' or home->>'can_manage'<>'true' then raise exception 'Director home-arrival settings are unavailable';end if;
 update public.attendance set check_out_at=now()-interval '1 hour' where student_id='fb400000-0000-0000-0000-000000000001' and attendance_date=(now() at time zone 'America/Port-au-Prince')::date;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 home:=public.family_home_arrival_status('fb400000-0000-0000-0000-000000000001');
 if home->>'student_id'<>'fb400000-0000-0000-0000-000000000001' or home->>'confirmed_at' is not null then raise exception 'linked parent did not receive only the eligible arrival confirmation';end if;
 perform public.confirm_family_home_arrival('fb400000-0000-0000-0000-000000000001');
 home:=public.family_home_arrival_status('fb400000-0000-0000-0000-000000000001');
 if home->>'confirmed_as'<>'parent' or home->>'confirmed_at' is null then raise exception 'parent home-arrival confirmation was not recorded';end if;
 denied:=false;begin perform public.family_home_arrival_status('fb400000-0000-0000-0000-000000000002');exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'unlinked parent read another student home-arrival status';end if;
 -- Model a student who has completed the real sign-in flow; it enables the
 -- portal before creating the server-side session used by this assertion.
 update public.students set portal_enabled=true where id='fb400000-0000-0000-0000-000000000002';
 insert into private.student_sessions(student_id,token_hash,expires_at) values('fb400000-0000-0000-0000-000000000002',encode(extensions.digest(student_token,'sha256'),'hex'),now()+interval '1 hour');
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 home:=public.student_home_arrival_status(student_token);
 if home->>'student_id'<>'fb400000-0000-0000-0000-000000000002' or home->>'check_out_at' is null or home->>'confirmed_at' is not null then raise exception 'student session did not see its own unconfirmed arrival status';end if;
 perform public.confirm_student_home_arrival(student_token);
 if not exists(select 1 from public.student_home_arrival_confirmations h where h.student_id='fb400000-0000-0000-0000-000000000002' and h.confirmed_as='student' and h.confirmed_by is null) or public.student_home_arrival_status(student_token)->>'confirmed_at' is null then raise exception 'student home-arrival confirmation was not recorded';end if;
 denied:=false;begin perform public.confirm_student_home_arrival('forged-home-arrival-token');exception when others then denied:=sqlerrm='not_authorized';end;
 if not denied then raise exception 'forged student portal token confirmed arrival';end if;
 -- Collective class sanctions must exclude pupils present only at Direction.
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 perform public.save_student_sanction_hours('08:00','15:00');
 insert into public.student_parents(student_id,parent_id)
 values('fb400000-0000-0000-0000-000000000002','fb600000-0000-0000-0000-000000000001') on conflict do nothing;
 insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,direction_only)
 values
  ('fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000001','fb200000-0000-0000-0000-000000000001',school_day,'present',now()-interval '1 hour',true),
  ('fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000002','fb200000-0000-0000-0000-000000000001',school_day,'present',now()-interval '1 hour',false)
 on conflict(student_id,attendance_date) do update set status=excluded.status,check_in_at=excluded.check_in_at,check_out_at=null,direction_only=excluded.direction_only;
 portal_sanction_type:=public.save_student_sanction_type(null,'Collective test',true,'none',null);
 kiosk:=public.student_followup_class_attendees('fb200000-0000-0000-0000-000000000001',school_day);
 if jsonb_array_length(kiosk)<>1 or kiosk->0->>'id'<>'fb400000-0000-0000-0000-000000000002' then raise exception 'class preview included Direction-only student: %',kiosk;end if;
 kiosk:=public.create_class_student_sanctions('fb200000-0000-0000-0000-000000000001',portal_sanction_type,'Collective class follow-up',least(now()-interval '1 minute',(school_day+time '12:00') at time zone 'America/Port-au-Prince'),array['fb400000-0000-0000-0000-000000000002'::uuid]);
 denied:=false;begin perform public.create_class_student_sanctions('fb200000-0000-0000-0000-000000000001',portal_sanction_type,'Stale roster test',least(now()-interval '1 minute',(school_day+time '12:00') at time zone 'America/Port-au-Prince'),array['fb400000-0000-0000-0000-000000000001'::uuid,'fb400000-0000-0000-0000-000000000002'::uuid]);exception when others then denied:=sqlerrm='class_attendance_changed';end;
 if not denied then raise exception 'stale class preview was accepted';end if;
 if kiosk->>'created_count'<>'1' or not exists(select 1 from public.student_sanctions where student_id='fb400000-0000-0000-0000-000000000002' and reason='Collective class follow-up')
   or exists(select 1 from public.student_sanctions where student_id='fb400000-0000-0000-0000-000000000001' and reason='Collective class follow-up') then raise exception 'collective class target was incorrect: %',kiosk;end if;
 kiosk:=public.create_student_sanctions_bulk(array['fb400000-0000-0000-0000-000000000001'::uuid,'fb400000-0000-0000-0000-000000000002'::uuid],portal_sanction_type,'Bulk badge selection test',now()-interval '15 minutes');
 if kiosk->>'created_count'<>'2' then raise exception 'selected-student batch did not create two records: %',kiosk;end if;
 denied:=false;begin perform public.create_student_sanctions_bulk(array['fb400000-0000-0000-0000-000000000001'::uuid,'fb400000-0000-0000-0000-000000000001'::uuid],portal_sanction_type,'Duplicate selection test',now()-interval '10 minutes');exception when others then denied:=sqlerrm='invalid_student_selection';end;
 if not denied then raise exception 'duplicate student IDs were accepted';end if;

 -- Parent selects a school-hour appointment and KIOS stores Direction-only arrival.
 portal_sanction_type:=public.save_student_sanction_type(null,'Parent meeting test',true,'parent_meeting',null);
 portal_sanction_id:=public.create_student_sanction('fb400000-0000-0000-0000-000000000002',portal_sanction_type,'Parent meeting workflow test',now()-interval '10 minutes');
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 family_sanctions:=public.family_student_sanctions('fb400000-0000-0000-0000-000000000002');
 if jsonb_array_length(family_sanctions->'meeting_options')=0 then raise exception 'parent received no available school-hour meeting';end if;
 perform public.submit_student_sanction_meeting(portal_sanction_id,(family_sanctions->'meeting_options'->>0)::timestamptz);
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 create or replace function private.kiosk_window(p_time time) returns text language sql immutable set search_path='' as $collective_direction_window$ select 'present'::text; $collective_direction_window$;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'error'<>'sanction_meeting_not_today' then raise exception 'KIOS allowed a family meeting visit before its scheduled day: %',kiosk;end if;
 -- Fast-forward the fixture to its appointment; this exercises the meeting
 -- arrival branch without relying on the hosted runner's wall clock.
 create or replace function private.guard_school_day(p_school uuid,p_day date)
 returns boolean language sql stable security definer set search_path=''
 as $meeting_day$ select p_school='fb000000-0000-0000-0000-000000000001'::uuid; $meeting_day$;
 update public.student_sanction_settings set school_entry_time='00:00',school_departure_time='23:59'
 where school_id='fb000000-0000-0000-0000-000000000001';
 update public.student_sanctions set parent_meeting_at=now() where id=portal_sanction_id;
 update public.attendance set status='absent',check_in_at=null,check_out_at=null,direction_only=false
 where student_id='fb400000-0000-0000-0000-000000000002' and attendance_date=(now() at time zone 'America/Port-au-Prince')::date;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'action'<>'check_in' or kiosk->>'direction_only'<>'true'
   or not exists(select 1 from public.attendance where student_id='fb400000-0000-0000-0000-000000000002' and attendance_date=(now() at time zone 'America/Port-au-Prince')::date and direction_only) then raise exception 'meeting KIOS check-in was not Direction-only: %',kiosk;end if;
 denied:=false;begin update public.attendance set direction_only=false,status='present' where student_id='fb400000-0000-0000-0000-000000000002' and attendance_date=(now() at time zone 'America/Port-au-Prince')::date;exception when others then denied:=sqlerrm='student_at_direction';end;
 if not denied then raise exception 'staff attendance writer moved meeting student into class';end if;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'action'<>'duplicate_scan' or (select check_out_at from public.attendance where student_id='fb400000-0000-0000-0000-000000000002' and attendance_date=(now() at time zone 'America/Port-au-Prince')::date) is not null then raise exception 'second scan toggled a Direction check-in into check-out';end if;
 create or replace function private.kiosk_window(p_time time) returns text language sql immutable set search_path='' as $sanction_checkout_window$ select 'checkout'::text; $sanction_checkout_window$;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'action'<>'check_out' or not exists(select 1 from public.attendance where student_id='fb400000-0000-0000-0000-000000000002' and attendance_date=(now() at time zone 'America/Port-au-Prince')::date and check_out_at is not null) then raise exception 'Direction-only student could not check out: %',kiosk;end if;
 perform public.resolve_student_sanction(portal_sanction_id,'Meeting completed');

 -- A school departure stays pending until Direction records retained/departed.
 portal_sanction_type:=public.save_student_sanction_type(null,'Permanent departure test',true,'school_departure',null);
 portal_sanction_id:=public.create_student_sanction('fb400000-0000-0000-0000-000000000002',portal_sanction_type,'School departure decision test',now()-interval '5 minutes');
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000005',true);
 family_sanctions:=public.family_student_sanctions('fb400000-0000-0000-0000-000000000002');
 if jsonb_array_length(family_sanctions->'meeting_options')=0 then raise exception 'departure did not offer family meeting slots';end if;
 perform public.submit_student_sanction_meeting(portal_sanction_id,(family_sanctions->'meeting_options'->>0)::timestamptz);
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 denied:=false;begin perform public.resolve_student_sanction(portal_sanction_id,'Generic resolution must not bypass decision');exception when others then denied:=sqlerrm='use_departure_decision';end;
 if not denied then raise exception 'generic resolution bypassed departure decision';end if;
 perform public.decide_student_sanction_departure(portal_sanction_id,'retained','Family meeting completed; student remains enrolled.');
 if not exists(select 1 from public.student_sanctions where id=portal_sanction_id and departure_decision='retained' and status='resolved')
   or not exists(select 1 from public.students where id='fb400000-0000-0000-0000-000000000002' and school_status='active') then raise exception 'Director retention decision did not preserve active enrollment';end if;
 end $$;

rollback;

