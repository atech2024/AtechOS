begin;

-- Synthetic rows exist only inside this transaction, which is always rolled back.
insert into public.schools(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002');
insert into public.users(id,full_name) values
 ('20000000-0000-0000-0000-000000000001','CI Director'),
 ('20000000-0000-0000-0000-000000000002','Linked Parent'),
 ('20000000-0000-0000-0000-000000000003','Unrelated Parent');
insert into public.grade_levels(id,code) values('30000000-0000-0000-0000-000000000001','PS1');
insert into public.classes(id,school_id,grade_level_id,grade_level,name) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PS1','Preschool CI');
insert into public.students(id,school_id,first_name,last_name,atechos_id) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','CI','Student','AOS-CI-0001');
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','active');
insert into public.school_members(school_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','director'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','parent'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','parent');
insert into public.parents(id,school_id,user_id,full_name,email,relationship) values
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Linked Parent','linked@example.invalid','parent'),
 ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Other Parent','other@example.invalid','parent');
insert into public.student_parents(student_id,parent_id,is_primary,relationship) values
 ('50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',true,'parent');
insert into public.attendance(id,school_id,student_id,class_id,attendance_date,check_in_at,status,recorded_by) values
 ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,now(),'present','20000000-0000-0000-0000-000000000001');

do $test$
declare v_case_id uuid; family jsonb; kiosk jsonb; failed boolean:=false;
begin
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 v_case_id:=public.start_kindergarten_relocation('50000000-0000-0000-0000-000000000001','needs_support','PRIVATE-CI-NOTE');
 perform public.record_kindergarten_parent_contact(v_case_id,'no_answer','PRIVATE-CI-CONTACT');

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 family:=public.kindergarten_parent_relocation_status();
 if jsonb_array_length(family)<>1 or family->0->>'student_id'<>'50000000-0000-0000-0000-000000000001' then raise exception 'linked parent scope failed'; end if;
 if family::text like '%PRIVATE-%' or family::text like '%needs_support%' or family::text like '%opened_at%' then raise exception 'private relocation detail leaked'; end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 if jsonb_array_length(public.kindergarten_parent_relocation_status())<>0 then raise exception 'unrelated parent saw relocation'; end if;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 insert into public.kindergarten_pickups(id,school_id,student_id,pickup_date,recorded_by) values
  ('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',(now() at time zone 'America/Port-au-Prince')::date,'20000000-0000-0000-0000-000000000001');
 update public.attendance set check_out_at=now() where id='80000000-0000-0000-0000-000000000001';
 if not exists(select 1 from public.kindergarten_relocation_cases where id=v_case_id and status='picked_up' and closed_by='20000000-0000-0000-0000-000000000001') then raise exception 'pickup did not close relocation with actor'; end if;
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
end
$test$;

rollback;
