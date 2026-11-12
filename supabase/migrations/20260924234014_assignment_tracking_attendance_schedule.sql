alter table public.assignments add column online_submission boolean not null default false;
create table public.assignment_receipts (
 assignment_id uuid references public.assignments(id) on delete cascade,
 student_id uuid references public.students(id) on delete cascade,
 received_at timestamptz not null default now(), source text not null check(source in ('teacher','online')),
 recorded_by uuid references public.users(id), response text,
 primary key(assignment_id,student_id)
);
alter table public.assignment_receipts enable row level security;
revoke all on public.assignment_receipts from public,anon,authenticated;
create or replace function public.set_assignment_online(p_assignment uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare a public.assignments;begin
 select * into a from public.assignments where id=p_assignment for update;
 if a.id is null or not private.write_academic(a.school_id,a.class_id,a.subject_id) then raise exception 'not_authorized';end if;
 if p_enabled and a.due_at is null then raise exception 'deadline_required';end if;
 update public.assignments set online_submission=p_enabled where id=a.id;
end $$;
create or replace function public.assignment_roster(p_assignment uuid) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare a public.assignments;begin
 select * into a from public.assignments where id=p_assignment;
 if a.id is null or not private.write_academic(a.school_id,a.class_id,a.subject_id) then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'code',s.atechos_id,'received_at',r.received_at,'response',r.response,'source',r.source,'status',case when r.received_at is not null then case when a.due_at is not null and r.received_at>a.due_at then 'late' else 'received' end when a.due_at<now() then 'missing' else 'pending' end)) from public.students s join public.enrollments e on e.student_id=s.id and e.class_id=a.class_id and e.status='active' left join public.assignment_receipts r on r.student_id=s.id and r.assignment_id=a.id where s.school_id=a.school_id and s.active),'[]');
end $$;
create or replace function public.mark_assignment_received(p_assignment uuid,p_student uuid,p_received boolean) returns void language plpgsql security definer set search_path='' as $$
declare a public.assignments;begin
 select * into a from public.assignments where id=p_assignment for update;
 if a.id is null or not private.write_academic(a.school_id,a.class_id,a.subject_id) then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.student_id=p_student and e.class_id=a.class_id and e.status='active' and s.school_id=a.school_id and s.active) then raise exception 'student_not_enrolled';end if;
 if p_received then insert into public.assignment_receipts(assignment_id,student_id,source,recorded_by) values(a.id,p_student,'teacher',auth.uid()) on conflict do nothing;
 else delete from public.assignment_receipts where assignment_id=a.id and student_id=p_student and source='teacher';end if;
end $$;
create or replace function public.submit_student_assignment(p_token text,p_assignment uuid,p_response text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.students; a public.assignments;begin
 if length(coalesce(p_response,''))>20000 or nullif(trim(p_response),'') is null then return jsonb_build_object('error','response_required');end if;
 select st.* into s from private.student_sessions se join public.students st on st.id=se.student_id where se.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and se.expires_at>now() and st.portal_enabled and st.active and st.school_status='active';
 if s.id is null then return jsonb_build_object('error','not_authorized');end if;
 select * into a from public.assignments where id=p_assignment for update;
 if a.id is null or a.school_id<>s.school_id or not a.online_submission or not exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id where e.student_id=s.id and e.class_id=a.class_id and e.status='active' and c.enabled and y.is_current) then return jsonb_build_object('error','not_authorized');end if;
 if a.due_at is null or now()>a.due_at then return jsonb_build_object('error','deadline_passed');end if;
 insert into public.assignment_receipts(assignment_id,student_id,source,response) values(a.id,s.id,'online',trim(p_response)) on conflict(assignment_id,student_id) do update set response=excluded.response,source='online',recorded_by=null;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.set_assignment_online(uuid,boolean),public.assignment_roster(uuid),public.mark_assignment_received(uuid,uuid,boolean),public.submit_student_assignment(text,uuid,text) from public,anon,authenticated;
grant execute on function public.set_assignment_online(uuid,boolean),public.assignment_roster(uuid),public.mark_assignment_received(uuid,uuid,boolean) to authenticated;
grant execute on function public.submit_student_assignment(text,uuid,text) to anon,authenticated;
do $$ declare src text;begin
 select pg_get_functiondef('public.student_device_data(text)'::regprocedure) into src;
 src:=replace(src,'''title'',a.title,''description''','''title'',a.title,''subject'',(select name from public.subjects where id=a.subject_id),''teacher'',(select full_name from public.users where id=a.teacher_id),''online_submission'',a.online_submission,''received_at'',(select received_at from public.assignment_receipts r where r.assignment_id=a.id and r.student_id=s.id),''submission_status'',case when exists(select 1 from public.assignment_receipts r where r.assignment_id=a.id and r.student_id=s.id) then ''received'' when a.due_at<now() then ''missing'' else ''pending'' end,''description''');
 execute src;
end $$;

create table public.attendance_events (
 id uuid primary key default gen_random_uuid(),attendance_id uuid not null references public.attendance(id),student_id uuid not null references public.students(id),
 source text not null check(source in ('KIOS','STAFF')),actor_id uuid references public.users(id),actor_name text not null,actor_role text not null,
 action text not null,recorded_at timestamptz not null default now(),attendance_date date not null default (now() at time zone 'America/Port-au-Prince')::date
);
alter table public.attendance_events enable row level security;
revoke all on public.attendance_events from public,anon,authenticated;
grant select on public.attendance_events to authenticated;
create policy attendance_event_read on public.attendance_events for select to authenticated using(private.read_student(student_id));
create function private.kiosk_window(p_time time) returns text language sql immutable set search_path='' as $$
 select case when p_time<time '07:46' then 'present' when p_time<time '08:01' then 'late' when p_time<time '13:00' then 'blocked' else 'checkout' end;
$$;
revoke all on function private.kiosk_window(time) from public,anon,authenticated;
create function public.staff_mark_attendance(p_student uuid,p_class uuid,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.students; a public.attendance; actor_role text;actor_name text;ts timestamptz:=now();d date:=(now() at time zone 'America/Port-au-Prince')::date;
begin
 select * into s from public.students where id=p_student and active and school_status='active';
 if s.id is null or not private.has_role(s.school_id,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized';end if;
 if p_status not in ('present','late','absent','checkout') then raise exception 'invalid_status';end if;
 if not exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id where e.student_id=s.id and e.class_id=p_class and e.status='active' and c.school_id=s.school_id and c.enabled and y.is_current) then raise exception 'current_enrollment_required';end if;
 select full_name into actor_name from public.users where id=auth.uid();
 if exists(select 1 from public.schools where id=s.school_id and owner_user_id=auth.uid()) then actor_role:='school_admin';else
 select role::text into actor_role from public.school_members where school_id=s.school_id and user_id=auth.uid() and enabled and role in ('school_admin','director','secretary','surveillant') order by case role when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 else 3 end limit 1;end if;
 perform pg_advisory_xact_lock(hashtextextended(s.id::text||d::text,0));
 select * into a from public.attendance where student_id=s.id and attendance_date=d for update;
 if p_status='checkout' then
  if a.check_in_at is null then raise exception 'check_in_required';end if;
  if a.check_out_at is not null then return a.id;end if;
  update public.attendance set check_out_at=ts,recorded_by=auth.uid(),updated_at=ts where id=a.id returning * into a;
 else
  if a.check_out_at is not null then raise exception 'attendance_already_complete';end if;
  insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,recorded_by)
  values(s.school_id,s.id,p_class,d,p_status,case when p_status<>'absent' then ts end,auth.uid())
  on conflict(student_id,attendance_date) do update set status=excluded.status,check_in_at=case when excluded.status='absent' then null else coalesce(attendance.check_in_at,excluded.check_in_at) end,recorded_by=auth.uid(),updated_at=ts returning * into a;
 end if;
 insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action) values(a.id,s.id,'STAFF',auth.uid(),coalesce(actor_name,auth.uid()::text),actor_role,p_status);
 return a.id;
end $$;
revoke all on function public.staff_mark_attendance(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.staff_mark_attendance(uuid,uuid,text) to authenticated;

create or replace function public.student_kiosk_scan(p_code text,p_pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.students; cred private.student_credentials; cl public.classes; a public.attendance;
 ts timestamptz:=now(); d date:=(now() at time zone 'America/Port-au-Prince')::date; result text; class_count integer; window_name text:=private.kiosk_window((now() at time zone 'America/Port-au-Prince')::time);
begin
 if length(coalesce(p_code,''))>80 or coalesce(p_pin,'') !~ '^[0-9]{6,12}$' then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into s from public.students where upper(atechos_id)=upper(trim(p_code)) and active and portal_enabled and school_status='active';
 if s.id is null then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into cred from private.student_credentials where student_id=s.id for update;
 if cred.student_id is null or cred.locked_until>ts then return jsonb_build_object('error','invalid_credentials'); end if;
 if cred.pin_hash is null or cred.pin_hash<>extensions.crypt(p_pin,cred.pin_hash) then
  update private.student_credentials set failures=case when locked_until<=ts then 1 else failures+1 end,
   locked_until=case when locked_until<=ts then null when failures>=4 then ts+interval '15 minutes' else locked_until end where student_id=s.id;
  return jsonb_build_object('error','invalid_credentials');
 end if;
 update private.student_credentials set failures=0,locked_until=null where student_id=s.id;
 select count(*) into class_count from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id
 where e.student_id=s.id and e.status='active' and c.school_id=s.school_id and c.enabled and y.is_current;
 if class_count<>1 then return jsonb_build_object('error','current_class_required'); end if;
 select c.* into cl from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id
 where e.student_id=s.id and e.status='active' and c.school_id=s.school_id and c.enabled and y.is_current;
 perform pg_advisory_xact_lock(hashtextextended(s.id::text||d::text,0));
 select * into a from public.attendance where student_id=s.id and attendance_date=d for update;
 if window_name='blocked' then return jsonb_build_object('error','kiosk_closed');end if;
 if window_name='checkout' then
  if a.check_in_at is null then return jsonb_build_object('error','check_in_required');end if;
  if a.check_out_at is not null then result:='already_complete';else
   update public.attendance set check_out_at=ts,recorded_by=s.user_id,updated_at=ts where id=a.id returning * into a;result:='check_out';end if;
 elsif a.check_in_at is not null then result:='duplicate_scan';
 else
  insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,late_minutes,recorded_by)
  values(s.school_id,s.id,cl.id,d,window_name,ts,case when window_name='late' then greatest(1,floor(extract(epoch from ((ts at time zone 'America/Port-au-Prince')::time-time '07:45'))/60)::integer) else 0 end,s.user_id)
  on conflict(student_id,attendance_date) do update set status=excluded.status,check_in_at=excluded.check_in_at,late_minutes=excluded.late_minutes,recorded_by=excluded.recorded_by,updated_at=ts returning * into a;result:='check_in';
 end if;
 if result in ('check_in','check_out') then
  insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action) values(a.id,s.id,'KIOS',s.user_id,s.first_name||' '||s.last_name,'student',result);
 end if;
 return jsonb_build_object('action',result,'first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id,'class_name',cl.name,'check_in_at',a.check_in_at,'check_out_at',a.check_out_at);
end $$;
revoke all on function public.student_kiosk_scan(text,text) from public,anon,authenticated;
-- Public kiosk authenticates using the student's private PIN; no staff/session bypass.
grant execute on function public.student_kiosk_scan(text,text) to anon,authenticated;

-- Isolated fixtures: the deliberate final exception rolls back this entire
-- subtransaction. Any failed assertion propagates and aborts the migration.
do $test$
declare owner_a uuid:=gen_random_uuid(); owner_b uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid(); guardian uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 assignment_id uuid; other_assignment uuid; expected text; activation text; device jsonb; payload jsonb; next_year uuid; next_class uuid; request_id uuid; a uuid; b uuid; yr uuid; cls uuid; other_cls uuid; subject uuid; child1 uuid; child2 uuid; other_child uuid; member uuid; invitation jsonb; invited jsonb; pid uuid; period uuid; n integer; rowcount integer; old_id text; failed boolean;
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

  assignment_id:=public.create_assignment(cls,subject,'Task',null,now()+interval '1 day',null,null,null);
  other_assignment:=public.create_assignment(other_cls,subject,'Other task',null,now()+interval '1 day',null,null,null);
  perform public.set_assignment_online(assignment_id,true);
  activation:=public.issue_student_activation(child1);
  set local role anon;
  device:=public.student_device_login(old_id,'Corrected One',activation,'648239');
  payload:=public.student_device_data(device->>'token');
  if not exists(select 1 from jsonb_array_elements(payload->'assignments') v where v->>'id'=assignment_id::text and v->>'subject'='Verification Mathematics') then raise exception 'TEST assignment subject missing';end if;
  if public.submit_student_assignment('invalid',assignment_id,'Answer')->>'error' is distinct from 'not_authorized' then raise exception 'TEST forged session';end if;
  if public.submit_student_assignment(device->>'token',other_assignment,'Answer')->>'error' is distinct from 'not_authorized' then raise exception 'TEST assignment cross class';end if;
  if public.submit_student_assignment(device->>'token',assignment_id,'Answer')->>'success' is distinct from 'true' then raise exception 'TEST submit';end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  payload:=public.assignment_roster(assignment_id);
  if not exists(select 1 from jsonb_array_elements(payload) v where v->>'id'=child1::text and v->>'response'='Answer' and v->>'source'='online') then raise exception 'TEST teacher sees submission';end if;
  perform public.mark_assignment_received(assignment_id,child2,true);
  perform public.mark_assignment_received(assignment_id,child2,false);
  reset role;
  update public.assignments set due_at=now()-interval '1 minute' where id=assignment_id;
  set local role authenticated;
  payload:=public.assignment_roster(assignment_id);
  if not exists(select 1 from jsonb_array_elements(payload) v where v->>'id'=child2::text and v->>'status'='missing') then raise exception 'TEST missing after deadline';end if;
  set local role anon;
  if public.submit_student_assignment(device->>'token',assignment_id,'Late answer')->>'error' is distinct from 'deadline_passed' then raise exception 'TEST late submission';end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',owner_b::text,true);
  failed:=false;begin perform public.assignment_roster(assignment_id);exception when others then failed:=true;end;
  if not failed then raise exception 'TEST stranger roster';end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  perform public.staff_mark_attendance(child1,cls,'present');
  if not exists(select 1 from public.attendance_events where student_id=child1 and actor_id=owner_a and actor_role='school_admin' and source='STAFF') then raise exception 'TEST staff attribution';end if;
  failed:=false;begin delete from public.attendance_events where student_id=child1;exception when insufficient_privilege then failed:=true;end;
  if not failed then raise exception 'TEST audit deletion';end if;
  reset role;
  if private.kiosk_window('00:00')<>'present' or private.kiosk_window('07:45:59')<>'present' or private.kiosk_window('07:46')<>'late' or private.kiosk_window('08:00:59')<>'late' or private.kiosk_window('08:01')<>'blocked' or private.kiosk_window('12:59:59')<>'blocked' or private.kiosk_window('13:00')<>'checkout' or private.kiosk_window('23:59:59')<>'checkout' then raise exception 'TEST schedule boundaries';end if;
  expected:=private.kiosk_window((now() at time zone 'America/Port-au-Prince')::time);
  set local role anon;
  payload:=public.student_kiosk_scan(old_id,'648239');
  if expected='blocked' and payload->>'error' is distinct from 'kiosk_closed' then raise exception 'TEST blocked window';end if;
  if expected in ('present','late') and payload->>'action' is distinct from 'duplicate_scan' then raise exception 'TEST duplicate toggled';end if;
  if expected='checkout' then
   if payload->>'action' is distinct from 'check_out' then raise exception 'TEST scheduled checkout';end if;
   if public.student_kiosk_scan(old_id,'648239')->>'action' is distinct from 'already_complete' then raise exception 'TEST duplicate checkout';end if;
  end if;
  reset role;
  raise exception using errcode='ZX001',message='Fixture rollback';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
