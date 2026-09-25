CREATE OR REPLACE FUNCTION private.validate_tenant_links()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j jsonb:=to_jsonb(new); sid uuid; linked uuid; col text; target text; foreign_school uuid;
begin
 sid:=(j->>'school_id')::uuid;
 if tg_op='UPDATE' and (to_jsonb(old)->>'school_id') is distinct from j->>'school_id' then raise exception 'school_immutable'; end if;
 for col,target in select * from (values ('student_id','students'),('class_id','classes'),('subject_id','subjects'),('academic_year_id','academic_years'),('grading_period_id','grading_periods'),('parent_id','parents')) as refs(c,t) loop
  linked:=nullif(j->>col,'')::uuid;
  if linked is not null then
   execute format('select school_id from public.%I where id=$1',target) into foreign_school using linked;
   if foreign_school is null then raise exception 'invalid_reference'; end if;
   if sid is null then sid:=foreign_school; elsif sid<>foreign_school then raise exception 'cross_school_reference'; end if;
  end if;
 end loop;
 if (tg_op='INSERT' or (to_jsonb(old)->>'teacher_id') is distinct from j->>'teacher_id') and j->>'teacher_id' is not null and not exists(select 1 from public.school_members where school_id=sid and user_id=(j->>'teacher_id')::uuid and enabled and role in ('teacher','school_admin','director')) and not exists(select 1 from public.schools where id=sid and owner_user_id=(j->>'teacher_id')::uuid) then raise exception 'teacher_access_denied'; end if;
 return new;
end $function$;

create table public.category_grade_deadlines (
 period_id uuid references public.grading_periods(id) on delete cascade,
 section text check(section in ('preschool','primary','fundamental','secondary')),
 deadline timestamptz not null,exam_start date,exam_end date,
 primary key(period_id,section),check(exam_end is null or exam_start is not null and exam_end>=exam_start)
);
alter table public.category_grade_deadlines enable row level security;
revoke all on public.category_grade_deadlines from public,anon,authenticated;
grant select on public.category_grade_deadlines to authenticated;
create policy deadline_read on public.category_grade_deadlines for select to authenticated using(exists(select 1 from public.grading_periods p where p.id=period_id and private.has_role(p.school_id,array['school_admin','director','secretary','surveillant','teacher'])));
create function public.set_category_grade_deadline(p_period uuid,p_section text,p_deadline timestamptz,p_exam_start date default null,p_exam_end date default null) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 select school_id into sid from public.grading_periods where id=p_period;
 if sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized';end if;
 insert into public.category_grade_deadlines values(p_period,p_section,p_deadline,p_exam_start,p_exam_end) on conflict(period_id,section) do update set deadline=excluded.deadline,exam_start=excluded.exam_start,exam_end=excluded.exam_end;
end $$;
create function private.enforce_grade_deadline() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.grades;begin
 if tg_op='DELETE' then g:=old;else g:=new;end if;
 if not private.has_role(g.school_id,array['school_admin','director','secretary','surveillant']) and exists(select 1 from public.category_grade_deadlines d join public.classes c on c.id=g.class_id where d.period_id=g.grading_period_id and d.section=public.grade_section(c.grade_level) and now()>d.deadline) then raise exception 'grade_deadline_passed';end if;
 if tg_op='UPDATE' and not private.has_role(old.school_id,array['school_admin','director','secretary','surveillant']) and exists(select 1 from public.category_grade_deadlines d join public.classes c on c.id=old.class_id where d.period_id=old.grading_period_id and d.section=public.grade_section(c.grade_level) and now()>d.deadline) then raise exception 'grade_deadline_passed';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger enforce_grade_deadline before insert or update or delete on public.grades for each row execute function private.enforce_grade_deadline();
create or replace function private.protect_grade_publication() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.published and tg_op='INSERT') or (tg_op='UPDATE' and new.published is distinct from old.published) then
 if not private.has_role(new.school_id,array['school_admin','director','secretary','surveillant']) then raise exception 'publication_requires_administration';end if;end if;return new;
end $$;
create function public.grade_publication_review() returns jsonb language plpgsql security definer stable set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized';end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'student',s.first_name||' '||s.last_name,'code',s.atechos_id,'class_id',c.id,'class',c.name,'section',public.grade_section(c.grade_level),'year_id',y.id,'year',y.name,'period_id',p.id,'period',p.name,'subject_id',su.id,'subject',su.name,'teacher_id',g.teacher_id,'teacher',u.full_name,'assessment',g.assessment_name,'score',g.score,'max_score',g.max_score,'published',g.published)) from public.grades g join public.students s on s.id=g.student_id join public.classes c on c.id=g.class_id join public.academic_years y on y.id=c.academic_year_id join public.subjects su on su.id=g.subject_id left join public.grading_periods p on p.id=g.grading_period_id left join public.users u on u.id=g.teacher_id where g.school_id=sid),'[]'),
 'periods',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'year',y.name)) from public.grading_periods p left join public.academic_years y on y.id=p.academic_year_id where p.school_id=sid),'[]'),
 'deadlines',coalesce((select jsonb_agg(to_jsonb(d)) from public.category_grade_deadlines d join public.grading_periods p on p.id=d.period_id where p.school_id=sid),'[]'));
end $$;
create function public.publish_reviewed_grades(p_ids uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();n integer;begin
 if not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized';end if;
 if coalesce(cardinality(p_ids),0)=0 then return 0;end if;
 perform 1 from public.grades where id=any(p_ids) for update;
 if exists(select 1 from unnest(p_ids) requested(id) where not exists(select 1 from public.grades g where g.id=requested.id and g.school_id=sid and g.grading_period_id is not null)) then raise exception 'invalid_grade_selection';end if;
 update public.grades set published=true where id=any(p_ids) and school_id=sid and not published;get diagnostics n=row_count;return n;
end $$;
revoke all on function public.set_category_grade_deadline(uuid,text,timestamptz,date,date),public.grade_publication_review(),public.publish_reviewed_grades(uuid[]) from public,anon,authenticated;
grant execute on function public.set_category_grade_deadline(uuid,text,timestamptz,date,date),public.grade_publication_review(),public.publish_reviewed_grades(uuid[]) to authenticated;
revoke all on function private.enforce_grade_deadline() from public,anon,authenticated;

create function public.student_portal_overview(p_token text) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare base jsonb; s public.students;cl public.classes;yr public.academic_years;begin
 base:=public.student_device_data(p_token);if base is null then return null;end if;
 select * into s from public.students where id=(base->'student'->>'id')::uuid;
 select c.* into cl from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id where e.student_id=s.id and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id)) order by y.is_current desc,y.start_date desc,(e.status='active') desc limit 1;
 select * into yr from public.academic_years where id=cl.academic_year_id;
 return base||jsonb_build_object('student',base->'student'||jsonb_build_object('photo_available',coalesce(s.photo_url like s.school_id::text||'/'||s.id::text||'-%',false),'photo_path',case when s.photo_url like s.school_id::text||'/'||s.id::text||'-%' then s.photo_url end,'class_name',cl.name,'academic_year',yr.name),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('date',a.attendance_date,'status',a.status,'check_in_at',a.check_in_at,'check_out_at',a.check_out_at,'year',y.name)) from public.attendance a join public.classes c on c.id=a.class_id join public.academic_years y on y.id=c.academic_year_id where a.student_id=s.id and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id))),'[]'),
 'periods',coalesce((select jsonb_agg(distinct jsonb_build_object('id',p.id,'name',p.name,'year',y.name,'start_date',p.start_date,'end_date',p.end_date,'exam_start',d.exam_start,'exam_end',d.exam_end)) from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id join public.grading_periods p on p.academic_year_id=y.id and p.school_id=s.school_id and public.grade_section(c.grade_level)=any(p.sections) left join public.category_grade_deadlines d on d.period_id=p.id and d.section=public.grade_section(c.grade_level) where e.student_id=s.id and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id))),'[]'));
end $$;
revoke all on function public.student_portal_overview(text) from public,anon,authenticated;
grant execute on function public.student_portal_overview(text) to anon,authenticated;

-- Isolated fixtures: the deliberate final exception rolls back this entire
-- subtransaction. Any failed assertion propagates and aborts the migration.
do $test$
declare owner_a uuid:=gen_random_uuid(); owner_b uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid(); guardian uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 other_subject uuid; grade_id uuid; activation text; device jsonb; payload jsonb; next_year uuid; next_class uuid; request_id uuid; a uuid; b uuid; yr uuid; cls uuid; other_cls uuid; subject uuid; child1 uuid; child2 uuid; other_child uuid; member uuid; invitation jsonb; invited jsonb; pid uuid; period uuid; n integer; rowcount integer; old_id text; failed boolean;
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
  invitation:=public.create_school_invitation(outsider::text||'@example.invalid','Director','director');
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform public.accept_school_invitation(invitation->>'token');
  pid:=public.save_parent_for_student(child1,'Guardian',guardian::text||'@example.invalid');
  if public.save_parent_for_student(child2,'Guardian',guardian::text||'@example.invalid')<>pid then raise exception 'TEST duplicate parent'; end if;
  invitation:=public.create_school_invitation(guardian::text||'@example.invalid','Guardian','parent',null,pid);
  failed:=false; begin perform public.create_school_invitation(teacher::text||'@example.invalid','Teacher','teacher'); exception when others then failed:=true; end;
  if not failed then raise exception 'TEST director grants staff'; end if;
  perform set_config('request.jwt.claim.sub',guardian::text,true);
  perform public.accept_school_invitation(invitation->>'token');
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  invitation:=public.create_school_invitation(teacher::text||'@example.invalid','Teacher','teacher');
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  failed:=false;
  begin perform public.accept_school_invitation(invitation->>'token'); exception when others then failed:=true; end;
  if not failed then raise exception 'TEST wrong email accepted'; end if;
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  perform public.accept_school_invitation(invitation->>'token');
  failed:=false;
  begin perform public.accept_school_invitation(invitation->>'token'); exception when others then failed:=true; end;
  if not failed then raise exception 'TEST invitation replay'; end if;
  if exists(select 1 from public.students where school_id=a) then raise exception 'TEST unassigned teacher sees students'; end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  perform public.assign_subject_to_class(cls,subject,teacher);
  invitation:=public.create_school_invitation(guardian::text||'@example.invalid','Guardian','parent',null,(select id from public.parents where school_id=a));
  invited:=public.create_school_invitation(learner::text||'@example.invalid','Learner','student',child1);
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  if (select count(*) from public.students where school_id=a)<>2 then raise exception 'TEST assigned teacher scope'; end if;
  failed:=false; begin perform nis from public.students where id=child1; exception when insufficient_privilege then failed:=true; end;
  if not failed then raise exception 'TEST teacher reads NIS'; end if;
  if exists(select 1 from public.get_student_records(child1) r where r ? 'nis') then raise exception 'TEST teacher RPC exposes NIS'; end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  other_subject:=public.create_subject('Unassigned subject','UNASSIGNED');
  insert into public.class_subjects(school_id,class_id,subject_id) values(a,cls,other_subject);
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  if exists(select 1 from public.subjects where id=other_subject) or exists(select 1 from public.class_subjects where subject_id=other_subject) then raise exception 'TEST teacher sees another subject in own class'; end if;
  if not exists(select 1 from public.subjects where id=subject) then raise exception 'TEST assigned subject hidden'; end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  delete from public.class_subjects where subject_id=other_subject;
  perform set_config('request.jwt.claim.sub',teacher::text,true);


  perform public.create_grade(child1,subject,cls,'Verification',8,10,null,period);
  select id into grade_id from public.grades where student_id=child1 and subject_id=subject and grading_period_id=period;
  failed:=false;begin perform public.grade_publication_review();exception when others then failed:=true;end;
  if not failed then raise exception 'TEST teacher reviews school grades';end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  perform public.set_category_grade_deadline(period,'fundamental',now()-interval '1 minute','2026-02-01','2026-02-05');
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  failed:=false;begin perform public.create_grade(child1,subject,cls,'Blocked',9,10,null,period);exception when others then if sqlerrm='grade_deadline_passed' then failed:=true;else raise;end if;end;
  if not failed then raise exception 'TEST teacher ignores deadline';end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  select id into member from public.school_members where school_id=a and user_id=teacher and role='teacher';
  perform public.manage_school_member(member,'role','secretary');
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  payload:=public.grade_publication_review();
  if not exists(select 1 from jsonb_array_elements(payload->'rows') v where v->>'id'=grade_id::text and v->>'code'=old_id) then raise exception 'TEST secretary review';end if;
  failed:=false;begin perform public.publish_reviewed_grades(array[grade_id,gen_random_uuid()]);exception when others then failed:=true;end;
  if not failed or exists(select 1 from public.grades where id=grade_id and published) then raise exception 'TEST invalid publication partial write';end if;
  if public.publish_reviewed_grades(array[grade_id])<>1 then raise exception 'TEST secretary publication';end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  perform public.manage_school_member(member,'role','surveillant');
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  if public.publish_reviewed_grades(array[grade_id])<>0 then raise exception 'TEST repeat publication';end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  -- The fixture outsider is a director of this school and may review.
  perform public.grade_publication_review();
  perform set_config('request.jwt.claim.sub',owner_b::text,true);
  failed:=false;begin perform public.publish_reviewed_grades(array[grade_id]);exception when others then failed:=true;end;
  if not failed then raise exception 'TEST external school publication';end if;
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  activation:=public.issue_student_activation(child1);
  set local role anon;
  device:=public.student_device_login(old_id,'Corrected One',activation,'648239');
  if public.student_portal_overview('invalid') is not null then raise exception 'TEST forged overview';end if;
  payload:=public.student_portal_overview(device->>'token');
  if payload->'student'->>'class_name'<>'Class A' or payload->'student'->>'academic_year'<>'Verification' or jsonb_array_length(payload->'grades')<>1 then raise exception 'TEST profile or published bulletin';end if;
  if not exists(select 1 from jsonb_array_elements(payload->'periods') p where p->>'exam_start'='2026-02-01') then raise exception 'TEST exam dates';end if;
  reset role;
  update public.students set photo_url='other-school/other-photo.jpg' where id=child1;
  set local role anon;
  payload:=public.student_portal_overview(device->>'token');
  if payload->'student'->>'photo_path' is not null then raise exception 'TEST unsafe photo path';end if;
  reset role;
  raise exception using errcode='ZX001',message='Fixture rollback';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
