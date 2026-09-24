-- Isolated fixtures: the deliberate final exception rolls back this entire
-- subtransaction. Any failed assertion propagates and aborts the migration.
do $test$
declare owner_a uuid:=gen_random_uuid(); owner_b uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid(); guardian uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 activation text; device jsonb; payload jsonb; next_year uuid; next_class uuid; request_id uuid; a uuid; b uuid; yr uuid; cls uuid; other_cls uuid; subject uuid; child1 uuid; child2 uuid; other_child uuid; member uuid; invitation jsonb; invited jsonb; pid uuid; period uuid; n integer; rowcount integer; old_id text; failed boolean;
begin
 begin
  insert into auth.users(id,email,email_confirmed_at,role,aud) select id,id::text||'@example.invalid',now(),'authenticated','authenticated' from unnest(array[owner_a,owner_b,teacher,guardian,learner,outsider])id;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  set local role authenticated;
  a:=public.create_school_onboarding('Verification A',gen_random_uuid()::text);
  if not exists(select 1 from public.schools where id=a and owner_user_id=owner_a) then raise exception 'TEST owner creation'; end if;
  yr:=public.create_academic_year('Verification',date '2026-01-01',date '2026-12-31',true);
  perform public.activate_school_section(yr,'preschool');
  perform public.activate_school_section(yr,'preschool');
  if (select count(*) from public.classes where school_id=a and academic_year_id=yr)<>3 then raise exception 'TEST section activation duplicated classes'; end if;
  perform public.activate_school_section(yr,'preschool',false);
  if exists(select 1 from public.classes where school_id=a and enabled) then raise exception 'TEST section deactivation'; end if;
  period:=public.activate_grading_period(yr,'Verification period','V1','2026-01-01','2026-03-31',array['fundamental']);
  if public.activate_grading_period(yr,'Verification period','V1','2026-01-01','2026-03-31',array['fundamental'])<>period then raise exception 'TEST period duplicated'; end if;
  cls:=public.create_class(yr,'Class A','AF7');
  update public.classes set student_portal_allowed=true where id=cls;
  other_cls:=public.create_class(yr,'Class B','AF2');
  subject:=public.create_subject('Verification Mathematics','VERIFY');
  child1:=public.save_student_record(jsonb_build_object('first_name','Child','last_name','One','class_id',cls,'guardian_name','Guardian','guardian_email',guardian::text||'@example.invalid'));
  child2:=public.save_student_record(jsonb_build_object('first_name','Child','last_name','Two','class_id',cls,'guardian_name','Guardian','guardian_email',guardian::text||'@example.invalid'));
  other_child:=public.save_student_record(jsonb_build_object('first_name','Other','last_name','Child','class_id',other_cls));
  if (select count(*) from public.parents where school_id=a)<>1 then raise exception 'TEST guardian deduplication'; end if;
  select atechos_id into old_id from public.students where id=child1;
  perform public.save_student_record(jsonb_build_object('first_name','Corrected','last_name','One','class_id',cls,'date_of_birth','2013-02-10','place_of_birth','Verification city','address','Verification address','sex','F'),child1);
  if not exists(select 1 from public.students where id=child1 and date_of_birth='2013-02-10' and place_of_birth='Verification city' and address='Verification address' and sex='F') then raise exception 'TEST student demographics'; end if;
  if not exists(select 1 from public.students where id=child1 and atechos_id=old_id and photo_url is null) then raise exception 'TEST stable ID and optional photo'; end if;
  perform public.save_student_record(jsonb_build_object('first_name','Corrected','last_name','One','class_id',other_cls),child1);
  if not exists(select 1 from public.enrollments where student_id=child1 and class_id=cls and status='transferred') or not exists(select 1 from public.enrollments where student_id=child1 and class_id=other_cls and status='active') then raise exception 'TEST transfer did not move active class'; end if;
  perform public.save_student_record(jsonb_build_object('first_name','Corrected','last_name','One','class_id',cls,'date_of_birth','2013-02-10','place_of_birth','Verification city','address','Verification address','sex','F'),child1);
  if not exists(select 1 from public.students where id=child1 and date_of_birth='2013-02-10' and place_of_birth='Verification city' and address='Verification address' and sex='F') then raise exception 'TEST student demographics'; end if;
  if (select count(*) from public.enrollments where student_id=child1 and status='active')<>1 then raise exception 'TEST duplicate active class'; end if;
  if not exists(select 1 from public.get_student_records(child1) r where r ? 'nis') then raise exception 'TEST admin NIS access'; end if;

  -- Owner access alone must not mark attendance, through either old RPC or table.
  failed:=false;begin perform public.scan_student_code(old_id,cls);exception when insufficient_privilege then failed:=true;end;
  if not failed then raise exception 'TEST staff legacy scan access';end if;
  failed:=false;begin insert into public.attendance(school_id,student_id,class_id,attendance_date,status) values(a,child1,cls,current_date,'present');exception when insufficient_privilege then failed:=true;end;
  if not failed then raise exception 'TEST staff direct attendance write';end if;
  if has_table_privilege('authenticated','public.attendance','UPDATE') or has_table_privilege('authenticated','public.attendance','DELETE') then raise exception 'TEST attendance mutation grants';end if;
  if has_function_privilege('authenticated','public.record_attendance(uuid,uuid,date,text,timestamptz,timestamptz,integer,text)','EXECUTE') or has_function_privilege('authenticated','public.update_attendance_checkout(uuid,timestamptz)','EXECUTE') or has_function_privilege('authenticated','public.scan_student_badge(text,uuid,timestamptz,integer)','EXECUTE') then raise exception 'TEST legacy API grant';end if;
  activation:=public.issue_student_activation(child1);
  set local role anon;
  if public.student_kiosk_scan(old_id,'648239')->>'error' is distinct from 'invalid_credentials' then raise exception 'TEST missing PIN accepted';end if;
  device:=public.student_device_login(old_id,'Corrected One',activation,'648239');
  if not(device?'token') then raise exception 'TEST activation';end if;
  for n in 1..5 loop
   if public.student_kiosk_scan(old_id,'111111')->>'error' is distinct from 'invalid_credentials' then raise exception 'TEST wrong PIN';end if;
  end loop;
  if public.student_kiosk_scan(old_id,'648239')->>'error' is distinct from 'invalid_credentials' then raise exception 'TEST locked PIN accepted';end if;
  reset role;
  if exists(select 1 from public.attendance where student_id=child1) then raise exception 'TEST bad PIN recorded attendance';end if;
  update private.student_credentials set locked_until=now()-interval '1 minute' where student_id=child1;
  set local role anon;
  payload:=public.student_kiosk_scan(lower(old_id),'648239');
  if payload->>'action' is distinct from 'check_in' or payload->>'class_name' is distinct from 'Class A' then raise exception 'TEST automatic check-in %',payload;end if;
  if public.student_kiosk_scan(old_id,'648239')->>'action' is distinct from 'duplicate_scan' then raise exception 'TEST duplicate';end if;
  reset role;
  if (select count(*) from public.attendance where student_id=child1)<>1 then raise exception 'TEST duplicate rows';end if;
  update public.attendance set check_in_at=now()-interval '2 minutes' where student_id=child1;
  set local role anon;
  if public.student_kiosk_scan(old_id,'648239')->>'action' is distinct from 'check_out' then raise exception 'TEST checkout';end if;
  if public.student_kiosk_scan(old_id,'648239')->>'action' is distinct from 'already_complete' then raise exception 'TEST complete';end if;
  reset role;
  update public.students set school_status='departed' where id=child1;
  set local role anon;
  if public.student_kiosk_scan(old_id,'648239')->>'error' is distinct from 'invalid_credentials' then raise exception 'TEST departed student';end if;
  reset role;
  update public.students set school_status='active' where id=child1;
  update public.academic_years set is_current=false where id=yr;
  set local role anon;
  if public.student_kiosk_scan(old_id,'648239')->>'error' is distinct from 'current_class_required' then raise exception 'TEST historical class';end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  if not exists(select 1 from public.attendance where student_id=child1 and check_out_at is not null) then raise exception 'TEST staff read';end if;
  reset role;
  if (select count(*) from private.student_sessions where student_id=child1)<>1 then raise exception 'TEST kiosk created portal sessions';end if;
  raise exception using errcode='ZX001',message='Fixture rollback';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
