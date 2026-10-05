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
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('fb500000-0000-0000-0000-000000000001','fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000001','fb200000-0000-0000-0000-000000000001','active'),
 ('fb500000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000002','fb200000-0000-0000-0000-000000000001','active'),
 ('fb500000-0000-0000-0000-000000000003','fb000000-0000-0000-0000-000000000002','fb400000-0000-0000-0000-000000000003','fb200000-0000-0000-0000-000000000002','active');

do $$
declare sanction_type uuid; contact_id uuid; contact2_id uuid; release_id uuid; release2_id uuid; sanction_id uuid; workspace jsonb; denied boolean; kiosk jsonb;
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
 sanction_type:=public.save_student_sanction_type(null,'Suspension',true);
 contact_id:=public.save_student_release_contact('fb400000-0000-0000-0000-000000000001',null,'Alternate Adult','Aunt',null,true);
 denied:=false; begin perform public.request_student_release('fb400000-0000-0000-0000-000000000002','medical',contact_id,'Wrong student contact'); exception when others then denied:=sqlerrm='release_contact_not_authorized'; end;
 if not denied then raise exception 'contact registered for another student was accepted'; end if;
 sanction_id:=public.create_student_sanction('fb400000-0000-0000-0000-000000000001',sanction_type,'Incident recorded by secretary',now()-interval '1 hour');
 perform public.resolve_student_sanction(sanction_id,'Resolved after meeting');
 if not exists(select 1 from public.student_sanctions where id=sanction_id and status='resolved' and created_role='secretary') then raise exception 'sanction actor and resolution were not preserved'; end if;
 release_id:=public.request_student_release('fb400000-0000-0000-0000-000000000001','medical',contact_id,'Student needs to leave for medical care');
 if (select count(*) from public.notifications where type='student_release' and event_key like 'student-release-request:%')<>2 then raise exception 'release request did not notify the other authorized staff'; end if;
 denied:=false; begin perform public.review_student_release(release_id,false,' '); exception when others then denied:=sqlerrm='decision_reason_required'; end;
 if not denied then raise exception 'rejection without a reason was accepted'; end if;

 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 perform public.review_student_release(release_id,true,'Approved by director');
 perform public.record_student_release(release_id,now()+interval '2 hours');
 perform public.confirm_student_return(release_id);
 if not exists(select 1 from public.student_release_cases where id=release_id and status='returned' and reviewed_role='director' and released_role='director' and returned_at is not null) then raise exception 'medical release/return actor timeline was not recorded'; end if;
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000003',true);
 contact2_id:=public.save_student_release_contact('fb400000-0000-0000-0000-000000000002',null,'Second Alternate Adult','Parent',null,true);
 release2_id:=public.request_student_release('fb400000-0000-0000-0000-000000000002','exceptional',contact2_id,'Student is authorized to leave with family');
 perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000001',true);
 perform public.review_student_release(release2_id,true,'Departure approved by director');
 insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at)
 values('fb000000-0000-0000-0000-000000000001','fb400000-0000-0000-0000-000000000002','fb200000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,'present',now()-interval '1 hour');
 -- student_release_kiosk_ci_window: isolate the exact 08:01-12:59 denial deterministically.
 create or replace function private.kiosk_window(p_time time) returns text language sql immutable set search_path='' as $$select 'blocked'::text$$;
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'error'<>'kiosk_closed' then raise exception 'unreleased student bypassed the blocked KIOS window'; end if;
 perform public.record_student_release(release2_id,now()+interval '2 hours');
 kiosk:=private.record_student_kiosk('fb400000-0000-0000-0000-000000000002');
 if kiosk->>'action'<>'check_out' then raise exception 'authorized departure scan did not check the student out: %',kiosk; end if;
 if not exists(select 1 from public.attendance a where a.student_id='fb400000-0000-0000-0000-000000000002' and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null)
    or not exists(select 1 from public.attendance_events e where e.student_id='fb400000-0000-0000-0000-000000000002' and e.source='KIOS' and e.action='check_out') then
  raise exception 'authorized KIOS departure did not preserve attendance and student actor audit';
 end if;
 if (select count(*) from public.student_followup_events where entity_id in (sanction_type,sanction_id,contact_id,release_id))<7 then raise exception 'audit trail is incomplete'; end if;
 denied:=false; begin update public.student_followup_events set action='tampered' where entity_id=release_id; exception when others then denied:=sqlerrm='student_followup_event_immutable'; end;
 if not denied then raise exception 'immutable follow-up audit record was changed'; end if;
 workspace:=public.student_followup_workspace();
 if jsonb_array_length(workspace->'students')<>2 or jsonb_array_length(workspace->'releases')<>2 then raise exception 'workspace leaked another school or lost the in-scope record'; end if;
end $$;

rollback;
