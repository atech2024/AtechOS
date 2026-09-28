-- Class schedules are separate from teacher grade-entry deadlines.
create table public.exam_schedule (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 class_id uuid not null references public.classes(id), subject_id uuid not null references public.subjects(id),
 period_id uuid not null references public.grading_periods(id), starts_at timestamptz not null, ends_at timestamptz not null,
 published_version_id uuid, cancelled boolean not null default false, created_by uuid references public.users(id),
 check(ends_at>starts_at)
);
create index exam_schedule_class_time on public.exam_schedule(class_id,starts_at);
create table public.exam_schedule_versions (
 id uuid primary key default gen_random_uuid(),exam_id uuid not null references public.exam_schedule(id),
 version integer not null,starts_at timestamptz not null,ends_at timestamptz not null,cancelled boolean not null default false,
 revision_start date,revision_end date,reason text not null,snapshot jsonb not null,
 state text not null default 'pending' check(state in ('pending','published','returned','superseded')),
 created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 published_by uuid references public.users(id),published_at timestamptz,unique(exam_id,version),
 check(ends_at>starts_at),check((revision_start is null and revision_end is null) or (revision_start is not null and revision_end is not null and revision_end>=revision_start))
);
create unique index exam_schedule_one_pending on public.exam_schedule_versions(exam_id) where state='pending';
alter table public.exam_schedule add foreign key(published_version_id) references public.exam_schedule_versions(id);
create table public.exam_schedule_events(
 id uuid primary key default gen_random_uuid(),exam_id uuid not null references public.exam_schedule(id),version_id uuid references public.exam_schedule_versions(id),
 actor_id uuid,actor_name text,actor_role text,action text not null,reason text,old_value jsonb,new_value jsonb,created_at timestamptz not null default now()
);
alter table public.exam_schedule_versions enable row level security;
alter table public.exam_schedule_events enable row level security;
revoke all on public.exam_schedule_versions,public.exam_schedule_events from public,anon,authenticated;
create table public.exam_presence (
 exam_id uuid not null references public.exam_schedule(id), version_id uuid not null references public.exam_schedule_versions(id), student_id uuid not null references public.students(id),
 scanned_at timestamptz not null, source text not null default 'KIOS' check(source='KIOS'),
 primary key(exam_id,version_id,student_id)
);
alter table public.exam_schedule enable row level security;
alter table public.exam_presence enable row level security;
revoke all on public.exam_schedule,public.exam_presence from public,anon,authenticated;

create function private.calendar_student_class(p_student uuid,p_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id
 join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id
 where e.student_id=p_student and e.class_id=p_class and s.school_id=c.school_id
 and (e.status<>'transferred' or exists(select 1 from public.exam_presence ep join public.exam_schedule ex on ex.id=ep.exam_id where ep.student_id=s.id and ex.class_id=c.id))
 and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id)))
$$;
create function public.school_calendar(p_student uuid default null,p_token text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sid uuid; st uuid:=p_student; manage boolean:=false; staff_view boolean:=false; teacher boolean:=false; base jsonb;
begin
 if p_token is not null then
  base:=public.student_device_data(p_token);
  if base is null then raise exception 'not_authorized';end if;
  st:=(base->'student'->>'id')::uuid;select school_id into sid from public.students where id=st;
 elsif st is not null then
  select school_id into sid from public.students where id=st;
  if sid is null or not (private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) or exists(
   select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent'
   where sp.student_id=st and p.school_id=sid and p.user_id=auth.uid())) then raise exception 'not_authorized';end if;
 else
  sid:=public.get_my_school_id();staff_view:=private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']);manage:=private.has_role(sid,array['school_admin','director','censeur']);teacher:=private.has_role(sid,array['teacher']);
  if sid is null or not (staff_view or teacher) then raise exception 'not_authorized';end if;
 end if;
 return jsonb_build_object('can_manage',manage,'can_publish',manage and exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and role='censeur' and enabled),
 'exams',coalesce((select jsonb_agg(jsonb_build_object('id',ex.id,'class_id',c.id,'class',c.name,'year_id',y.id,'year',y.name,'subject_id',su.id,'subject',su.name,'period_id',p.id,'period',p.name,'starts_at',ex.starts_at,'ends_at',ex.ends_at,'cancelled',ex.cancelled,'version',ver.version,'published_at',ver.published_at,'revision_start',ver.revision_start,'revision_end',ver.revision_end,'scanned_at',(select ep.scanned_at from public.exam_presence ep where ep.exam_id=ex.id and ep.version_id=ex.published_version_id and ep.student_id=st)) order by ex.starts_at)
 from public.exam_schedule ex join public.exam_schedule_versions ver on ver.id=ex.published_version_id join public.classes c on c.id=ex.class_id join public.academic_years y on y.id=c.academic_year_id join public.subjects su on su.id=ex.subject_id join public.grading_periods p on p.id=ex.period_id
 where ex.school_id=sid and (staff_view or (st is not null and private.calendar_student_class(st,c.id) and (exists(select 1 from public.enrollments en where en.student_id=st and en.class_id=c.id and en.status<>'transferred') or exists(select 1 from public.exam_presence ep where ep.student_id=st and ep.exam_id=ex.id))) or (teacher and exists(select 1 from public.class_subjects cs where cs.class_id=c.id and cs.subject_id=su.id and cs.teacher_id=auth.uid())))),'[]'),
 'closures',coalesce((select jsonb_agg(jsonb_build_object('day',cl.day,'title',cl.title) order by cl.day) from public.school_closures cl where cl.school_id=sid and (st is null or exists(select 1 from public.classes c join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and private.calendar_student_class(st,c.id) and cl.day between y.start_date and y.end_date))),'[]'),
 'classes',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'year_id',y.id,'year',y.name,'section',public.grade_section(c.grade_level)) order by y.start_date desc,c.name) from public.classes c join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and c.enabled),'[]') else '[]'::jsonb end,
 'subjects',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',su.id,'name',su.name,'class_id',cs.class_id)) from public.class_subjects cs join public.subjects su on su.id=cs.subject_id where cs.school_id=sid and su.active),'[]') else '[]'::jsonb end,
 'periods',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'year_id',p.academic_year_id,'sections',p.sections,'start_date',p.start_date,'end_date',p.end_date) order by p.start_date)
 from public.grading_periods p where p.school_id=sid and p.is_active and (staff_view or exists(select 1 from public.classes c where c.school_id=sid and c.academic_year_id=p.academic_year_id and public.grade_section(c.grade_level)=any(p.sections) and ((st is not null and private.calendar_student_class(st,c.id)) or (teacher and exists(select 1 from public.class_subjects cs where cs.class_id=c.id and cs.teacher_id=auth.uid())))))),'[]'));
end $$;

-- Version creation and publication functions are defined below.

-- Preserve the first authenticated kiosk scan for each exam on that class day.
-- This records school arrival, not proof of completion of an examination.
create function private.capture_exam_presence(p_student uuid,p_class uuid,p_scan timestamptz) returns void
language sql security definer set search_path='' as $$
 insert into public.exam_presence(exam_id,version_id,student_id,scanned_at)
 select ex.id,ex.published_version_id,p_student,p_scan from public.exam_schedule ex join public.students s on s.id=p_student
 where ex.class_id=p_class and ex.school_id=s.school_id and ex.published_version_id is not null and not ex.cancelled
 and (ex.starts_at at time zone 'America/Port-au-Prince')::date=(p_scan at time zone 'America/Port-au-Prince')::date
 and p_scan<=ex.ends_at and s.active and s.school_status='active'
 and exists(select 1 from public.enrollments en where en.student_id=p_student and en.class_id=p_class and en.status='active')
 and not exists(select 1 from public.school_closures cl where cl.school_id=s.school_id and cl.day=(p_scan at time zone 'America/Port-au-Prince')::date)
 on conflict(exam_id,version_id,student_id) do nothing
$$;
do $$declare src text;begin
 select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
 if position('return jsonb_build_object(''action'',result' in src)=0 then raise exception 'kiosk_patch_anchor_missing';end if;
 src:=replace(src,'return jsonb_build_object(''action'',result',
 'if result in (''check_in'',''duplicate_scan'',''check_out'') then perform private.capture_exam_presence(s.id,cl.id,ts);end if; return jsonb_build_object(''action'',result');
 execute src;
end $$;

revoke all on function private.calendar_student_class(uuid,uuid),private.capture_exam_presence(uuid,uuid,timestamptz),public.school_calendar(uuid,text) from public,anon,authenticated;
grant execute on function public.school_calendar(uuid,text) to anon,authenticated;

create function private.exam_event(p_exam uuid,p_version uuid,p_action text,p_reason text,p_old jsonb,p_new jsonb) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 select school_id into sid from public.exam_schedule where id=p_exam;
 insert into public.exam_schedule_events(exam_id,version_id,actor_id,actor_name,actor_role,action,reason,old_value,new_value)
 select p_exam,p_version,auth.uid(),u.full_name,(select role::text from public.school_members where school_id=sid and user_id=auth.uid() and enabled order by case role::text when 'censeur' then 0 when 'director' then 1 else 2 end limit 1),p_action,p_reason,p_old,p_new from public.users u where u.id=auth.uid();
end $$;
create function private.validate_exam_scope(p_class uuid,p_subject uuid,p_period uuid,p_start timestamptz,p_end timestamptz,p_revision_start date,p_revision_end date)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();d date:=(p_start at time zone 'America/Port-au-Prince')::date;begin
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or (p_end at time zone 'America/Port-au-Prince')::date<>d then raise exception 'invalid_exam_time';end if;
 if (p_revision_start is null)<>(p_revision_end is null) or p_revision_end<p_revision_start or p_revision_end>d then raise exception 'invalid_revision_week';end if;
 if not exists(select 1 from public.classes c join public.academic_years y on y.id=c.academic_year_id
 join public.class_subjects cs on cs.class_id=c.id and cs.subject_id=p_subject join public.subjects su on su.id=cs.subject_id and su.active
 join public.grading_periods p on p.id=p_period and p.school_id=c.school_id and p.academic_year_id=c.academic_year_id and public.grade_section(c.grade_level)=any(p.sections)
 where c.id=p_class and c.enabled and c.school_id=sid and p.is_active and d between p.start_date and p.end_date and d between y.start_date and y.end_date and (p_revision_start is null or p_revision_start between y.start_date and y.end_date)) then raise exception 'invalid_exam_scope_or_date';end if;
 if exists(select 1 from public.school_closures where school_id=sid and day=d) then raise exception 'school_closed';end if;
end $$;
create function public.save_exam(p_class uuid,p_subject uuid,p_period uuid,p_start timestamptz,p_end timestamptz,p_reason text,p_exam uuid default null,p_revision_start date default null,p_revision_end date default null,p_cancelled boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();ex public.exam_schedule;old_version public.exam_schedule_versions;v public.exam_schedule_versions;n integer;begin
 if not private.has_role(sid,array['school_admin','director','censeur']) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 or p_cancelled is null then raise exception 'reason_required';end if;
 perform 1 from public.classes where id=p_class and school_id=sid for update;if not found then raise exception 'invalid_exam_scope';end if;
 if p_exam is not null then
  select * into ex from public.exam_schedule where id=p_exam for update;
  if ex.id is null or ex.school_id is distinct from sid or ex.class_id<>p_class or ex.subject_id<>p_subject or ex.period_id<>p_period then raise exception 'invalid_exam_scope';end if;
  select * into old_version from public.exam_schedule_versions where id=ex.published_version_id;
 elsif p_cancelled then raise exception 'invalid_exam_scope';end if;
 if p_cancelled then p_start:=ex.starts_at;p_end:=ex.ends_at;p_revision_start:=old_version.revision_start;p_revision_end:=old_version.revision_end;end if;
 if not p_cancelled then perform private.validate_exam_scope(p_class,p_subject,p_period,p_start,p_end,p_revision_start,p_revision_end);end if;
 if ex.id is null then
  insert into public.exam_schedule(school_id,class_id,subject_id,period_id,starts_at,ends_at,created_by) values(sid,p_class,p_subject,p_period,p_start,p_end,auth.uid()) returning * into ex;
 end if;
 select coalesce(max(version),0)+1 into n from public.exam_schedule_versions where exam_id=ex.id;
 update public.exam_schedule_versions set state='superseded' where exam_id=ex.id and state='pending';
 insert into public.exam_schedule_versions(exam_id,version,starts_at,ends_at,cancelled,revision_start,revision_end,reason,snapshot,created_by)
 select ex.id,n,p_start,p_end,p_cancelled,p_revision_start,p_revision_end,trim(p_reason),jsonb_build_object('class',c.name,'year',y.name,'subject',su.name,'period',p.name),auth.uid()
 from public.classes c join public.academic_years y on y.id=c.academic_year_id join public.subjects su on su.id=p_subject join public.grading_periods p on p.id=p_period where c.id=p_class returning * into v;
 perform private.exam_event(ex.id,v.id,'proposed',trim(p_reason),to_jsonb(old_version),to_jsonb(v));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select distinct sid,m.user_id,'exams','Exam schedule awaiting publication','Review the proposed schedule. The official version has not changed.','normal','/dashboard/calendar','exam-proposed:'||v.id::text||':'||m.user_id::text from public.school_members m where m.school_id=sid and m.enabled and m.role in ('censeur','director','school_admin');
 return v.id;
end $$;
create function public.publish_exam_version(p_version uuid) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();ex public.exam_schedule;v public.exam_schedule_versions;old_version public.exam_schedule_versions;begin
 -- School ownership alone is not a Censeur signature or publication authority.
 if auth.uid() is null or not exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and role='censeur' and enabled) then raise exception 'censeur_publication_required';end if;
 select * into v from public.exam_schedule_versions where id=p_version;select * into ex from public.exam_schedule where id=v.exam_id;
 if ex.id is null or ex.school_id is distinct from sid then raise exception 'not_authorized';end if;
 perform 1 from public.classes where id=ex.class_id for update;
 select * into ex from public.exam_schedule where id=ex.id for update;
 select * into v from public.exam_schedule_versions where id=p_version for update;
 if v.state<>'pending' then raise exception 'version_not_pending';end if;
 select * into old_version from public.exam_schedule_versions where id=ex.published_version_id;
 if not v.cancelled then
  perform private.validate_exam_scope(ex.class_id,ex.subject_id,ex.period_id,v.starts_at,v.ends_at,v.revision_start,v.revision_end);
  if exists(select 1 from public.exam_schedule where class_id=ex.class_id and id<>ex.id and published_version_id is not null and not cancelled and starts_at<v.ends_at and ends_at>v.starts_at) then raise exception 'exam_time_conflict';end if;
 end if;
 update public.exam_schedule_versions set state='published',published_by=auth.uid(),published_at=now() where id=v.id;
 update public.exam_schedule set published_version_id=v.id,starts_at=v.starts_at,ends_at=v.ends_at,cancelled=v.cancelled where id=ex.id;
 perform private.exam_event(ex.id,v.id,'published',v.reason,to_jsonb(old_version),to_jsonb(v)||jsonb_build_object('published_by',auth.uid(),'published_at',now(),'state','published'));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select distinct sid,rec.user_id,'exams','Exam schedule published','A new official exam schedule version is available.','normal',rec.href,'exam-published:'||v.id::text||':'||rec.user_id::text from (
  select m.user_id,'/dashboard/calendar'::text href from public.school_members m where m.school_id=sid and m.enabled and (m.role in ('school_admin','director','censeur','secretary','surveillant') or (m.role='teacher' and exists(select 1 from public.class_subjects cs where cs.class_id=ex.class_id and cs.subject_id=ex.subject_id and cs.teacher_id=m.user_id)))
  union select p.user_id,'/dashboard/parent-portal' from public.parents p join public.student_parents sp on sp.parent_id=p.id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.role='parent' and m.enabled where p.school_id=sid and private.calendar_student_class(sp.student_id,ex.class_id)
  union select s.user_id,'/student' from public.students s where s.school_id=sid and s.user_id is not null and private.calendar_student_class(s.id,ex.class_id)
 ) rec on conflict do nothing;
end $$;
create function public.return_exam_version(p_version uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.exam_schedule_versions;ex public.exam_schedule;begin
 select * into v from public.exam_schedule_versions where id=p_version;select * into ex from public.exam_schedule where id=v.exam_id;
 if ex.id is null or ex.school_id is distinct from public.get_my_school_id() or not private.has_role(ex.school_id,array['school_admin','director','censeur']) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 then raise exception 'reason_required';end if;
 perform 1 from public.classes where id=ex.class_id for update;
 select * into v from public.exam_schedule_versions where id=p_version for update;
 if v.state<>'pending' then raise exception 'version_not_pending';end if;
 update public.exam_schedule_versions set state='returned' where id=v.id;
 perform private.exam_event(ex.id,v.id,'returned',trim(p_reason),to_jsonb(v),to_jsonb(v)||jsonb_build_object('state','returned'));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key) values(ex.school_id,v.created_by,'exams','Exam schedule returned',trim(p_reason),'normal','/dashboard/calendar','exam-returned:'||v.id::text);
end $$;
create function public.exam_schedule_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.has_role(sid,array['school_admin','director','censeur']) then raise exception 'not_authorized';end if;
 return public.school_calendar()||jsonb_build_object('versions',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('class_id',ex.class_id,'subject_id',ex.subject_id,'period_id',ex.period_id,'creator',(select full_name from public.users where id=v.created_by),'publisher',(select full_name from public.users where id=v.published_by),'events',coalesce((select jsonb_agg(to_jsonb(e) order by created_at) from public.exam_schedule_events e where version_id=v.id),'[]')) order by v.created_at desc,v.version desc) from public.exam_schedule_versions v join public.exam_schedule ex on ex.id=v.exam_id where ex.school_id=sid),'[]'));
end $$;
revoke all on function private.exam_event(uuid,uuid,text,text,jsonb,jsonb),private.validate_exam_scope(uuid,uuid,uuid,timestamptz,timestamptz,date,date) from public,anon,authenticated;
revoke all on function public.save_exam(uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,date,date,boolean),public.publish_exam_version(uuid),public.return_exam_version(uuid,text),public.exam_schedule_workspace() from public,anon;
grant execute on function public.save_exam(uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,date,date,boolean),public.publish_exam_version(uuid),public.return_exam_version(uuid,text),public.exam_schedule_workspace() to authenticated;
