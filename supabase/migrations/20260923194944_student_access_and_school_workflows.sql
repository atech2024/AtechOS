alter table public.students add column departure_year_id uuid references public.academic_years(id);
alter table public.students add column school_status text not null default 'active' check(school_status in ('active','departed'));
grant select(departure_year_id,school_status) on public.students to authenticated;
create index students_departure_year_idx on public.students(departure_year_id);
alter table public.students add column place_of_birth text;
grant select(place_of_birth),update(place_of_birth) on public.students to authenticated;
do $$ declare src text; begin
 select pg_get_functiondef('public.save_student_record(jsonb,uuid)'::regprocedure) into src;
 src:=replace(src,'set notes=nullif(p_data->>''notes'','''')','set notes=nullif(p_data->>''notes'',''''),place_of_birth=case when p_data ? ''place_of_birth'' then nullif(p_data->>''place_of_birth'','''') else place_of_birth end');
 execute src;
end $$;

-- Family mode never inherits teacher/administrator access.
create or replace function public.family_bulletin_data() returns jsonb
language sql stable security definer set search_path='' as $$
 with children as (
  select s.id,s.first_name,s.last_name,s.atechos_id,s.school_id,s.departure_year_id from public.students s
  where exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id
   join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.role='parent' and m.enabled
   where sp.student_id=s.id and p.school_id=s.school_id and p.user_id=auth.uid())
 )
 select jsonb_build_object('students',coalesce((select jsonb_agg(to_jsonb(c)) from children c),'[]'),
 'grades',coalesce((select jsonb_agg(jsonb_build_object('student_id',g.student_id,'subject',su.name,'period',gp.name,'year',y.name,'score',g.score,'max_score',g.max_score,'weight',g.assessment_weight))
 from public.grades g join children c on c.id=g.student_id join public.subjects su on su.id=g.subject_id
 join public.classes cl on cl.id=g.class_id join public.academic_years y on y.id=cl.academic_year_id
 left join public.grading_periods gp on gp.id=g.grading_period_id where g.published and (c.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=c.departure_year_id))),'[]'));
$$;
revoke all on function public.family_bulletin_data() from public,anon;
grant execute on function public.family_bulletin_data() to authenticated;

create or replace function public.family_child_activity(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.students; last_date date; begin
 select st.* into s from public.students st where st.id=p_student and exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.role='parent' and m.enabled where sp.student_id=st.id and p.school_id=st.school_id and p.user_id=auth.uid());
 if s.id is null then raise exception 'not_authorized'; end if;
 select end_date into last_date from public.academic_years where id=s.departure_year_id;
 return jsonb_build_object(
 'attendance',coalesce((select jsonb_agg(to_jsonb(r)) from (select attendance_date,status,late_minutes,check_in_at,check_out_at from public.attendance where student_id=s.id and (last_date is null or attendance_date<=last_date) order by attendance_date desc limit 20)r),'[]'),
 'grades',coalesce((select jsonb_agg(to_jsonb(r)) from (select g.assessment_name,g.score,g.max_score,g.assessment_weight,g.grading_period_id,g.subject_id from public.grades g join public.classes c on c.id=g.class_id join public.academic_years y on y.id=c.academic_year_id where g.student_id=s.id and g.published and (last_date is null or y.end_date<=last_date) order by g.graded_at desc limit 50)r),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(r)) from (select a.id as assignment_id,a.class_id,c.name as class_name,a.subject_id,su.name as subject_name,a.title,a.description,a.due_at,a.attachment_url,a.created_at from public.assignments a join public.classes c on c.id=a.class_id join public.academic_years y on y.id=c.academic_year_id join public.subjects su on su.id=a.subject_id where a.school_id=s.school_id and s.school_status='active' and y.is_current and exists(select 1 from public.enrollments e where e.student_id=s.id and e.class_id=a.class_id and e.status='active') order by a.created_at desc)r),'[]'));
end $$;
revoke all on function public.family_child_activity(uuid) from public,anon;
grant execute on function public.family_child_activity(uuid) to authenticated;

-- A printed student code identifies the learner at an authorized school kiosk;
-- it is not an authentication secret for the student portal.
create or replace function public.scan_student_code(p_code text,p_class uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); stid uuid; a public.attendance; ts timestamptz:=now(); d date:=(now() at time zone 'America/Port-au-Prince')::date; action text;
begin
 if not private.has_role(sid,array['school_admin','director','secretary','surveillant']) and not private.teaches(p_class) then raise exception 'not_authorized'; end if;
 select s.id into stid from public.students s where s.school_id=sid and s.active and upper(s.atechos_id)=upper(trim(p_code));
 if stid is null then raise exception 'student_not_found'; end if;
 if not exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id where e.student_id=stid and e.class_id=p_class and e.status='active' and c.school_id=sid and c.enabled) then raise exception 'student_not_enrolled_in_class'; end if;
 perform pg_advisory_xact_lock(hashtextextended(stid::text||d::text,0));
 select * into a from public.attendance where student_id=stid and attendance_date=d for update;
 if a.id is null then
  insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,late_minutes,recorded_by) values(sid,stid,p_class,d,'present',ts,0,auth.uid()) returning * into a; action:='check_in';
 elsif a.check_in_at is null then
  update public.attendance set check_in_at=ts,recorded_by=auth.uid() where id=a.id returning * into a; action:='check_in';
 elsif ts-a.check_in_at<interval '60 seconds' then action:='duplicate_scan';
 elsif a.check_out_at is null then
  update public.attendance set check_out_at=ts,recorded_by=auth.uid() where id=a.id returning * into a; action:='check_out';
 else action:='already_complete'; end if;
 return (select jsonb_build_object('action',action,'student_id',s.id,'first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id,'check_in_at',a.check_in_at,'check_out_at',a.check_out_at) from public.students s where s.id=stid);
end $$;
revoke all on function public.scan_student_code(text,uuid) from public,anon;
grant execute on function public.scan_student_code(text,uuid) to authenticated;

create table public.teacher_join_requests (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),user_id uuid not null references public.users(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references public.users(id), unique(school_id,user_id)
);
alter table public.teacher_join_requests enable row level security;
grant select on public.teacher_join_requests to authenticated;
create policy join_requests_read on public.teacher_join_requests for select to authenticated using(user_id=auth.uid() or private.has_role(school_id,array['school_admin','director']));
create index teacher_requests_user_idx on public.teacher_join_requests(user_id);
create index teacher_requests_reviewer_idx on public.teacher_join_requests(reviewed_by);
create or replace function public.request_teacher_access(p_school_code text) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid; em text; begin
 select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if em is null then raise exception 'confirmed_email_required'; end if;
 select id into sid from public.schools where lower(code)=lower(trim(p_school_code));
 if sid is null then raise exception 'school_code_not_found'; end if;
 if exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and role='teacher' and enabled) then raise exception 'already_teacher'; end if;
 insert into public.users(id,email,full_name) values(auth.uid(),em,coalesce((select nullif(raw_user_meta_data->>'full_name','') from auth.users where id=auth.uid()),split_part(em,'@',1))) on conflict(id) do nothing;
 insert into public.teacher_join_requests(school_id,user_id) values(sid,auth.uid()) on conflict(school_id,user_id) do update set status='pending',reviewed_at=null,reviewed_by=null;
end $$;
create or replace function public.review_teacher_request(p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.teacher_join_requests; begin
 select * into r from public.teacher_join_requests where id=p_request for update;
 if r.id is null or not private.has_role(r.school_id,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if r.status<>'pending' then raise exception 'request_already_reviewed'; end if;
 if p_approve is null then raise exception 'decision_required'; end if;
 if p_approve then insert into public.school_members(school_id,user_id,role,enabled) values(r.school_id,r.user_id,'teacher',true) on conflict(school_id,user_id,role) do update set enabled=true; end if;
 update public.teacher_join_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid() where id=r.id;
end $$;
revoke all on function public.request_teacher_access(text),public.review_teacher_request(uuid,boolean) from public,anon;
grant execute on function public.request_teacher_access(text),public.review_teacher_request(uuid,boolean) to authenticated;

create table public.student_progression_log(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),school_id uuid not null references public.schools(id),
 target_year_id uuid not null references public.academic_years(id),target_class_id uuid references public.classes(id),decision text not null,
 decided_by uuid not null references public.users(id),decided_at timestamptz not null default now()
);
alter table public.student_progression_log enable row level security;
grant select on public.student_progression_log to authenticated;
create policy progression_read on public.student_progression_log for select to authenticated using(private.has_role(school_id,array['school_admin','director','secretary']));
create index progression_student_idx on public.student_progression_log(student_id);
create index progression_school_idx on public.student_progression_log(school_id);
create index progression_year_idx on public.student_progression_log(target_year_id);
create index progression_class_idx on public.student_progression_log(target_class_id);
create index progression_author_idx on public.student_progression_log(decided_by);

create or replace function public.preview_student_progression(p_source uuid,p_target uuid) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); threshold numeric; result jsonb;begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.academic_years a join public.academic_years b on b.id=p_target where a.id=p_source and a.school_id=sid and b.school_id=sid and b.start_date>a.start_date) then raise exception 'invalid_years'; end if;
 select passing_average into threshold from public.school_grading_settings where school_id=sid; threshold:=coalesce(threshold,5);
 with period_means as (
 select g.student_id,g.subject_id,g.grading_period_id,sum(g.score/g.max_score*10*g.assessment_weight)/nullif(sum(g.assessment_weight),0) as avg,coalesce(max(p.weight),100) as weight
 from public.grades g join public.classes c on c.id=g.class_id left join public.grading_periods p on p.id=g.grading_period_id
 where c.academic_year_id=p_source and g.school_id=sid and g.published group by g.student_id,g.subject_id,g.grading_period_id
 ),subject_means as (select student_id,subject_id,sum(avg*weight)/nullif(sum(weight),0) as avg from period_means group by student_id,subject_id),
 means as(select student_id,avg(avg) as general_average from subject_means group by student_id),
 roster as(select distinct on(s.id) s.id,s.first_name,s.last_name,s.atechos_id,c.id as class_id,c.name,c.grade_level_id,c.grade_level, m.general_average from public.students s join public.enrollments e on e.student_id=s.id join public.classes c on c.id=e.class_id left join means m on m.student_id=s.id where s.school_id=sid and s.active and s.school_status='active' and c.academic_year_id=p_source and e.status='active' order by s.id,c.id),
 required as(select r.id,cs.subject_id,p.id as period_id,r.class_id from roster r join public.class_subjects cs on cs.class_id=r.class_id join public.grading_periods p on p.school_id=sid and p.is_active and (p.academic_year_id=p_source or p.academic_year_id is null)
 and (case when r.grade_level like 'PS%' then array['preschool'] when r.grade_level in('AF1','AF2','AF3','AF4','AF5','AF6') then array['primary','fundamental'] when r.grade_level like 'AF%' then array['fundamental'] else array['secondary'] end) && p.sections),
 reviewed as(select r.*, exists(select 1 from required q where q.id=r.id) and not exists(select 1 from required q where q.id=r.id and (select count(distinct lower(trim(g.assessment_name))) from public.grades g where g.student_id=q.id and g.subject_id=q.subject_id and g.class_id=q.class_id and g.grading_period_id=q.period_id and g.published)<coalesce((select controls_per_period from public.school_grading_settings where school_id=sid),4)) as complete from roster r)
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'atechos_id',r.atechos_id,'class_name',r.name,'average',r.general_average,'passing',threshold,
 'complete',r.complete,'recommended_grade',case when r.general_average is null or not r.complete then null when r.general_average<threshold then g.code else (select n.code from public.grade_levels n where n.is_active and n.sort_order>g.sort_order order by n.sort_order limit 1) end)), '[]') into result from reviewed r left join public.grade_levels g on g.id=r.grade_level_id;
 return result;
end $$;

create or replace function public.apply_student_progression(p_target uuid,p_decisions jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); d jsonb; st public.students; cls public.classes; n integer:=0;begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.academic_years where id=p_target and school_id=sid) or jsonb_typeof(p_decisions)<>'array' then raise exception 'invalid_year_or_decisions'; end if;
 for d in select value from jsonb_array_elements(p_decisions) loop
  select * into st from public.students where id=(d->>'student_id')::uuid for update;
  select * into cls from public.classes where id=(d->>'class_id')::uuid;
  if st.school_id is distinct from sid or not st.active or st.school_status<>'active' or cls.school_id is distinct from sid or cls.academic_year_id is distinct from p_target or not cls.enabled then raise exception 'invalid_student_or_target_class'; end if;
  update public.enrollments e set status='transferred' where e.student_id=st.id and e.class_id<>cls.id and e.status='active' and e.class_id in(select id from public.classes where academic_year_id=p_target);
  insert into public.enrollments(school_id,student_id,class_id,status) values(sid,st.id,cls.id,'active') on conflict(student_id,class_id) do update set status='active';
  insert into public.student_progression_log(student_id,school_id,target_year_id,target_class_id,decision,decided_by) values(st.id,sid,p_target,cls.id,'placement',auth.uid());
  n:=n+1;
 end loop;return n;
end $$;

create or replace function public.mark_student_departed(p_student uuid,p_last_year uuid) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.students where id=p_student and school_id=sid) or not exists(select 1 from public.academic_years where id=p_last_year and school_id=sid) then raise exception 'invalid_student_or_year'; end if;
 update public.students set school_status='departed',departure_year_id=p_last_year where id=p_student;
 update public.enrollments set status='transferred' where student_id=p_student and status='active';
 insert into public.student_progression_log(student_id,school_id,target_year_id,decision,decided_by) values(p_student,sid,p_last_year,'departed',auth.uid());
end $$;
create or replace function private.enforce_departed_student() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='active' and exists(select 1 from public.students where id=new.student_id and school_status='departed') then raise exception 'student_has_left_school'; end if;return new;
end $$;
create trigger enforce_departed_student before insert or update on public.enrollments for each row execute function private.enforce_departed_student();
revoke all on function private.enforce_departed_student() from public,anon,authenticated;
revoke all on function public.preview_student_progression(uuid,uuid),public.apply_student_progression(uuid,jsonb),public.mark_student_departed(uuid,uuid) from public,anon;
grant execute on function public.preview_student_progression(uuid,uuid),public.apply_student_progression(uuid,jsonb),public.mark_student_departed(uuid,uuid) to authenticated;

create or replace function public.get_teacher_requests() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',u.full_name,'email',u.email,'status',r.status)),'[]') from public.teacher_join_requests r join public.users u on u.id=r.user_id
 where r.school_id=public.get_my_school_id() and r.status='pending' and private.has_role(r.school_id,array['school_admin','director']);
$$;
revoke all on function public.get_teacher_requests() from public,anon;
grant execute on function public.get_teacher_requests() to authenticated;

create or replace function public.confirm_student_progression(p_source uuid,p_target uuid,p_decisions jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); d jsonb; n integer:=0;begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.academic_years a join public.academic_years b on b.id=p_target where a.id=p_source and a.school_id=sid and b.school_id=sid and b.start_date>a.start_date) or jsonb_typeof(p_decisions)<>'array' then raise exception 'invalid_years'; end if;
 for d in select value from jsonb_array_elements(p_decisions) loop
  if not exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id where e.student_id=(d->>'student_id')::uuid and c.academic_year_id=p_source and c.school_id=sid) then raise exception 'invalid_source_student'; end if;
  if d->>'decision'='departed' then perform public.mark_student_departed((d->>'student_id')::uuid,p_source);
  else perform public.apply_student_progression(p_target,jsonb_build_array(d)); end if;
  n:=n+1;
 end loop;return n;
end $$;
revoke all on function public.confirm_student_progression(uuid,uuid,jsonb) from public,anon;
grant execute on function public.confirm_student_progression(uuid,uuid,jsonb) to authenticated;

create or replace function private.family_grade_allowed(p_student uuid,p_class uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.family_student(p_student) and exists(
  select 1 from public.students s join public.classes c on c.id=p_class and c.school_id=s.school_id
  join public.academic_years y on y.id=c.academic_year_id
  left join public.academic_years last_year on last_year.id=s.departure_year_id
  where s.id=p_student and (s.departure_year_id is null or y.start_date<=last_year.start_date)
 );
$$;
revoke all on function private.family_grade_allowed(uuid,uuid) from public,anon;
grant execute on function private.family_grade_allowed(uuid,uuid) to authenticated;
alter policy grades_read on public.grades using(private.write_academic(school_id,class_id,subject_id) or (published and private.family_grade_allowed(student_id,class_id)));

create table private.student_credentials (
 student_id uuid primary key references public.students(id) on delete cascade,
 activation_hash text,activation_expires timestamptz,pin_hash text,
 failures integer not null default 0,locked_until timestamptz
);
create table private.student_sessions (
 token_hash text primary key,student_id uuid not null references public.students(id) on delete cascade,
 expires_at timestamptz not null,created_at timestamptz not null default now()
);
create index student_sessions_student_idx on private.student_sessions(student_id);
alter table private.student_credentials enable row level security;
alter table private.student_sessions enable row level security;
revoke all on private.student_credentials,private.student_sessions from public,anon,authenticated;
create or replace function public.issue_student_activation(p_student uuid) returns text language plpgsql security definer set search_path='' as $$
declare s public.students; token text:=encode(extensions.gen_random_bytes(24),'hex');begin
 select * into s from public.students where id=p_student;
 if s.id is null or not private.has_role(s.school_id,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not s.active then raise exception 'student_inactive'; end if;
 insert into private.student_credentials(student_id,activation_hash,activation_expires) values(s.id,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '2 days')
 on conflict(student_id) do update set activation_hash=excluded.activation_hash,activation_expires=excluded.activation_expires,pin_hash=null,failures=0,locked_until=null;
 delete from private.student_sessions where student_id=s.id;
 update public.students set portal_enabled=true where id=s.id;
 return token;
end $$;
create or replace function public.student_device_login(p_code text,p_name text,p_secret text,p_new_pin text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.students; c private.student_credentials; valid boolean:=false; activating boolean:=false; token text;
begin
 if length(coalesce(p_secret,''))>200 or length(coalesce(p_new_pin,''))>32 then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into s from public.students where upper(atechos_id)=upper(trim(p_code)) and active and portal_enabled;
 if s.id is null then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into c from private.student_credentials where student_id=s.id for update;
 if c.student_id is null or c.locked_until>now() then return jsonb_build_object('error','invalid_credentials'); end if;
 if lower(trim(p_name))=lower(trim(s.first_name||' '||s.last_name)) then
  activating:=c.activation_expires>now() and c.activation_hash=encode(extensions.digest(p_secret,'sha256'),'hex');
  valid:=coalesce(activating,false) or (c.pin_hash is not null and c.pin_hash=extensions.crypt(p_secret,c.pin_hash));
 end if;
 if not coalesce(valid,false) then
  update private.student_credentials set failures=case when locked_until<=now() then 1 else failures+1 end,
   locked_until=case when locked_until<=now() then null when failures>=4 then now()+interval '15 minutes' else locked_until end where student_id=s.id;
  return jsonb_build_object('error','invalid_credentials');
 end if;
 if nullif(p_new_pin,'') is not null and (not activating or p_new_pin !~ '^[0-9]{6,12}$') then return jsonb_build_object('error','PIN must contain 6 to 12 digits and be set during activation.'); end if;
 update private.student_credentials set failures=0,locked_until=null,
  activation_hash=case when activating then null else activation_hash end,
  activation_expires=case when activating then null else activation_expires end,
  pin_hash=case when activating and nullif(p_new_pin,'') is not null then extensions.crypt(p_new_pin,extensions.gen_salt('bf',10)) else pin_hash end where student_id=s.id;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 delete from private.student_sessions where student_id=s.id and expires_at<now();
 insert into private.student_sessions(token_hash,student_id,expires_at) values(encode(extensions.digest(token,'sha256'),'hex'),s.id,now()+interval '14 days');
 return jsonb_build_object('token',token);
end $$;
create or replace function public.student_device_data(p_token text) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare s public.students;begin
 select st.* into s from private.student_sessions se join public.students st on st.id=se.student_id where se.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and se.expires_at>now() and st.portal_enabled and st.active;
 if s.id is null then return null; end if;
 return jsonb_build_object('student',jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id),
 'grades',coalesce((select jsonb_agg(jsonb_build_object('subject',su.name,'period',p.name,'year',y.name,'assessment',g.assessment_name,'score',g.score,'max_score',g.max_score,'weight',g.assessment_weight)) from public.grades g join public.subjects su on su.id=g.subject_id join public.classes cl on cl.id=g.class_id join public.academic_years y on y.id=cl.academic_year_id left join public.grading_periods p on p.id=g.grading_period_id where g.student_id=s.id and g.published and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id))),'[]'),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'description',a.description,'due_at',a.due_at,'attachment_url',a.attachment_url)) from public.assignments a join public.classes cl on cl.id=a.class_id join public.academic_years y on y.id=cl.academic_year_id where a.school_id=s.school_id and s.school_status='active' and y.is_current and exists(select 1 from public.enrollments e where e.student_id=s.id and e.class_id=a.class_id and e.status='active')),'[]'));
end $$;
create or replace function public.student_device_logout(p_token text) returns void language sql security definer set search_path='' as $$delete from private.student_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');$$;
revoke all on function public.issue_student_activation(uuid),public.student_device_login(text,text,text,text),public.student_device_data(text),public.student_device_logout(text) from public,anon,authenticated;
grant execute on function public.issue_student_activation(uuid) to authenticated;
grant execute on function public.student_device_login(text,text,text,text),public.student_device_data(text),public.student_device_logout(text) to anon,authenticated;
