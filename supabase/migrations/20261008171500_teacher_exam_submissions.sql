create table public.teacher_exam_submissions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 academic_year_id uuid not null references public.academic_years(id),
 period_id uuid not null references public.grading_periods(id),
 class_id uuid not null references public.classes(id),
 subject_id uuid not null references public.subjects(id),
 teacher_id uuid not null references public.users(id),
 submitted_by uuid not null references public.users(id),
 submitted_at timestamptz not null default now(),
 entry_channel text not null check (entry_channel in ('teacher_portal','direction')),
 file_path text,
 file_uploaded_by uuid references public.users(id),
 file_uploaded_at timestamptz,
 file_source text check (file_source is null or file_source in ('teacher_upload','office_usb')),
 check (
  (file_path is null and file_uploaded_by is null and file_uploaded_at is null and file_source is null)
  or (file_path is not null and file_uploaded_by is not null and file_uploaded_at is not null and file_source is not null)
 ),
 unique(school_id,academic_year_id,period_id,class_id,subject_id,teacher_id)
);
create index teacher_exam_submissions_school_year_date on public.teacher_exam_submissions(school_id,academic_year_id,submitted_at desc);
alter table public.teacher_exam_submissions enable row level security;
revoke all on public.teacher_exam_submissions from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teacher-exam-files','teacher-exam-files',false,26214400,
 array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists teacher_exam_files_read on storage.objects;
drop policy if exists teacher_exam_files_insert on storage.objects;
create policy teacher_exam_files_read on storage.objects for select to authenticated using(
 bucket_id='teacher-exam-files' and exists(
  select 1 from public.teacher_exam_submissions s
  where s.id::text=(storage.foldername(name))[2] and s.school_id::text=(storage.foldername(name))[1]
   and (private.has_role(s.school_id,array['school_admin','director','secretary','censeur'])
    or (s.teacher_id=auth.uid() and private.has_role(s.school_id,array['teacher'])))
 )
);
create policy teacher_exam_files_insert on storage.objects for insert to authenticated with check(
 bucket_id='teacher-exam-files' and exists(
  select 1 from public.teacher_exam_submissions s
  where s.id::text=(storage.foldername(name))[2] and s.school_id::text=(storage.foldername(name))[1]
   and (private.has_role(s.school_id,array['school_admin','director','secretary','censeur'])
    or (s.teacher_id=auth.uid() and private.has_role(s.school_id,array['teacher'])))
 )
);

create or replace function public.create_teacher_exam_submission(
 p_class_id uuid,p_subject_id uuid,p_period_id uuid,p_teacher_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 sid uuid:=public.get_my_school_id(); actor uuid:=auth.uid(); manager boolean;
 teacher uuid; year_id uuid; submission uuid;
begin
 if actor is null or sid is null then raise exception 'not_authorized'; end if;
 manager:=private.has_role(sid,array['school_admin','director','secretary','censeur']);
 if manager then
  teacher:=p_teacher_id;
  if teacher is null then raise exception 'teacher_required'; end if;
 elsif private.has_role(sid,array['teacher']) then
  teacher:=actor;
  if p_teacher_id is not null and p_teacher_id<>actor then raise exception 'not_authorized'; end if;
 else raise exception 'not_authorized';
 end if;
 if not exists(select 1 from public.school_members m where m.school_id=sid and m.user_id=teacher and m.enabled and m.role='teacher') then
  raise exception 'teacher_exam_scope_invalid';
 end if;
 select c.academic_year_id into year_id
 from public.classes c
 join public.academic_years y on y.id=c.academic_year_id and y.is_current and y.school_id=sid
 join public.class_subjects cs on cs.class_id=c.id and cs.school_id=sid and cs.subject_id=p_subject_id and cs.teacher_id=teacher
 join public.subjects su on su.id=cs.subject_id and su.school_id=sid and su.active
 join public.grading_periods p on p.id=p_period_id and p.school_id=sid and p.academic_year_id=y.id and p.is_active
 left join public.grade_levels gl on gl.id=c.grade_level_id
 where c.id=p_class_id and c.school_id=sid and c.enabled
  and coalesce(c.section,public.grade_section(coalesce(c.grade_level,gl.code)))=any(p.sections)
 limit 1;
 if year_id is null then raise exception 'teacher_exam_scope_invalid'; end if;
 insert into public.teacher_exam_submissions(school_id,academic_year_id,period_id,class_id,subject_id,teacher_id,submitted_by,entry_channel)
 values(sid,year_id,p_period_id,p_class_id,p_subject_id,teacher,actor,case when manager then 'direction' else 'teacher_portal' end)
 returning id into submission;
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select sid,m.user_id,'exams','Nouvel examen reçu',
  format('Période : %s · Classe : %s · Matière : %s · Enseignant : %s',p.name,c.name,su.name,u.full_name),
  'normal','/dashboard/exam-submissions','teacher-exam-submission:'||submission::text||':'||m.user_id::text
 from public.school_members m
 join public.grading_periods p on p.id=p_period_id
 join public.classes c on c.id=p_class_id
 join public.subjects su on su.id=p_subject_id
 join public.users u on u.id=teacher
 where m.school_id=sid and m.enabled and m.role in ('school_admin','director','secretary','censeur')
 on conflict do nothing;
 return submission;
end $$;

create or replace function public.attach_teacher_exam_file(p_submission_id uuid,p_storage_path text)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); actor uuid:=auth.uid(); s public.teacher_exam_submissions; manager boolean;
begin
 if actor is null or sid is null then raise exception 'not_authorized'; end if;
 select * into s from public.teacher_exam_submissions where id=p_submission_id and school_id=sid for update;
 if s.id is null then raise exception 'not_authorized'; end if;
 manager:=private.has_role(sid,array['school_admin','director','secretary','censeur']);
 if not manager and not (s.teacher_id=actor and private.has_role(sid,array['teacher'])) then raise exception 'not_authorized'; end if;
 if s.file_path is not null then raise exception 'exam_file_already_attached'; end if;
 if p_storage_path is null or length(p_storage_path)>300
  or p_storage_path !~ ('^'||sid::text||'/'||s.id::text||'/[A-Za-z0-9][A-Za-z0-9._-]{0,220}$')
  or not exists(select 1 from storage.objects o where o.bucket_id='teacher-exam-files' and o.name=p_storage_path)
 then raise exception 'invalid_exam_file_path'; end if;
 update public.teacher_exam_submissions set file_path=p_storage_path,file_uploaded_by=actor,file_uploaded_at=now(),
  file_source=case when manager then 'office_usb' else 'teacher_upload' end where id=s.id;
end $$;

create or replace function public.teacher_exam_submission_workspace()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); actor uuid:=auth.uid(); manager boolean;
begin
 if actor is null or sid is null then raise exception 'not_authorized'; end if;
 manager:=private.has_role(sid,array['school_admin','director','secretary','censeur']);
 if not manager and not private.has_role(sid,array['teacher']) then raise exception 'not_authorized'; end if;
 return jsonb_build_object(
 'school_id',sid,'can_manage',manager,
 'periods',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'academic_year_id',p.academic_year_id,'start_date',p.start_date,'end_date',p.end_date,'sections',p.sections) order by p.start_date,p.name)
  from public.grading_periods p join public.academic_years y on y.id=p.academic_year_id
  where p.school_id=sid and y.is_current and p.is_active),'[]'::jsonb),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'academic_year_id',c.academic_year_id,'section',coalesce(c.section,public.grade_section(coalesce(c.grade_level,gl.code)))) order by c.name)
  from public.classes c join public.academic_years y on y.id=c.academic_year_id and y.is_current
  left join public.grade_levels gl on gl.id=c.grade_level_id
  where c.school_id=sid and c.enabled and (manager or exists(select 1 from public.class_subjects cs where cs.school_id=sid and cs.class_id=c.id and cs.teacher_id=actor))),'[]'::jsonb),
 'subjects',coalesce((select jsonb_agg(jsonb_build_object('class_id',cs.class_id,'subject_id',su.id,'subject_name',su.name,'teacher_id',cs.teacher_id) order by cs.class_id,su.name)
  from public.class_subjects cs join public.subjects su on su.id=cs.subject_id and su.school_id=sid and su.active
  join public.classes c on c.id=cs.class_id join public.academic_years y on y.id=c.academic_year_id and y.is_current
  where cs.school_id=sid and c.school_id=sid and (manager or cs.teacher_id=actor)),'[]'::jsonb),
 'teachers',case when manager then coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name) order by u.full_name)
  from (select distinct u.id,u.full_name from public.class_subjects cs
   join public.classes c on c.id=cs.class_id join public.academic_years y on y.id=c.academic_year_id and y.is_current
   join public.school_members m on m.school_id=sid and m.user_id=cs.teacher_id and m.enabled and m.role='teacher'
   join public.users u on u.id=cs.teacher_id where cs.school_id=sid and c.school_id=sid) u),'[]'::jsonb) else '[]'::jsonb end,
 'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'academic_year_id',s.academic_year_id,'period_id',s.period_id,'period_name',p.name,'class_id',s.class_id,'class_name',c.name,'subject_id',s.subject_id,'subject_name',su.name,'teacher_id',s.teacher_id,'teacher_name',teacher.full_name,'submitted_by_name',submitter.full_name,'submitted_at',s.submitted_at,'entry_channel',s.entry_channel,'file_path',s.file_path,'file_source',s.file_source,'file_uploaded_at',s.file_uploaded_at) order by s.submitted_at desc)
  from public.teacher_exam_submissions s join public.academic_years y on y.id=s.academic_year_id and y.is_current
  join public.grading_periods p on p.id=s.period_id join public.classes c on c.id=s.class_id
  join public.subjects su on su.id=s.subject_id join public.users teacher on teacher.id=s.teacher_id
  join public.users submitter on submitter.id=s.submitted_by
  where s.school_id=sid and (manager or s.teacher_id=actor)),'[]'::jsonb)
 );
end $$;

revoke all on function public.create_teacher_exam_submission(uuid,uuid,uuid,uuid),public.attach_teacher_exam_file(uuid,text),public.teacher_exam_submission_workspace() from public,anon;
grant execute on function public.create_teacher_exam_submission(uuid,uuid,uuid,uuid),public.attach_teacher_exam_file(uuid,text),public.teacher_exam_submission_workspace() to authenticated;
comment on table public.teacher_exam_submissions is 'Teacher exam submissions scoped to current assignments and periods; attached files are private.';
