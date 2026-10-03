-- A source proposal becomes school-visible only after an authorized staff member
-- confirms its exact saved wording, dates, school year, and section.
-- Keep unreviewed source proposals in the staff workspace. Families receive
-- confirmed dates through school_calendar, not the global source registry.
drop policy if exists official_calendar_sources_read on public.official_calendar_sources;
create policy official_calendar_sources_staff_read on public.official_calendar_sources
 for select to authenticated
 using (private.has_role(public.get_my_school_id(),array['school_admin','director','secretary','surveillant','censeur']));

create table public.confirmed_official_exam_dates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  section text not null check (section in ('preschool','primary','fundamental','secondary')),
  source_url text not null references public.official_calendar_sources(url),
  source_name text not null,
  source_label text not null,
  source_wording text not null,
  source_context text not null,
  category text not null check (category in ('exam_period','official_exam')),
  starts_on date not null,
  ends_on date not null,
  proposal_snapshot jsonb not null,
  proposal_hash text not null,
  confirmed_by uuid not null references public.users(id),
  confirmed_by_name text not null,
  confirmed_by_role text not null,
  confirmed_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (school_id, academic_year_id, section, source_url, proposal_hash)
);
create index confirmed_official_exam_dates_scope_idx
  on public.confirmed_official_exam_dates (school_id, academic_year_id, section, starts_on);
alter table public.confirmed_official_exam_dates enable row level security;
revoke all on public.confirmed_official_exam_dates from public, anon, authenticated;

create function public.confirm_official_exam_date(
  p_year uuid, p_section text, p_source_url text, p_proposal jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := public.get_my_school_id();
  actor uuid := auth.uid();
  selected_year public.academic_years%rowtype;
  selected_source public.official_calendar_sources%rowtype;
  proposed_start date;
  proposed_end date;
  proposal_digest text;
  actor_name text;
  actor_role text;
  confirmed_id uuid;
begin
  if actor is null or sid is null or not private.has_role(sid, array['school_admin','director','secretary','surveillant','censeur']) then
    raise exception 'not_authorized';
  end if;
  if p_section is null or p_section not in ('preschool','primary','fundamental','secondary') then
    raise exception 'invalid_section';
  end if;
  select * into selected_year from public.academic_years
    where id = p_year and school_id = sid;
  if not found then raise exception 'invalid_academic_year'; end if;
  if not exists (
    select 1 from public.classes c
    where c.school_id = sid and c.academic_year_id = p_year and c.enabled
      and public.grade_section(c.grade_level) = p_section
  ) then raise exception 'section_not_enabled_for_year'; end if;
  select * into selected_source from public.official_calendar_sources
    where url = p_source_url
      and (school_year is null or school_year =
        extract(year from selected_year.start_date)::text || '/' ||
        extract(year from selected_year.end_date)::text)
      and exists (
        select 1 from jsonb_array_elements(suggested_dates) as proposal(item)
        where proposal.item = p_proposal
      );
  if not found then raise exception 'official_exam_proposal_not_found'; end if;
  if jsonb_typeof(p_proposal) is distinct from 'object'
    or p_proposal->>'status' is distinct from 'needs_review'
    or p_proposal->>'category' is null
    or p_proposal->>'category' not in ('exam_period','official_exam')
    or nullif(btrim(p_proposal->>'date_text'),'') is null
    or p_proposal->>'start_date' is null
    or p_proposal->>'end_date' is null
    or p_proposal->>'start_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or p_proposal->>'end_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  then raise exception 'invalid_official_exam_proposal'; end if;
  proposed_start := (p_proposal->>'start_date')::date;
  proposed_end := (p_proposal->>'end_date')::date;
  if proposed_start < selected_year.start_date or proposed_end > selected_year.end_date
    or proposed_end < proposed_start then
    raise exception 'official_exam_date_outside_year';
  end if;
  select u.full_name, m.role::text into actor_name, actor_role
  from public.school_members m join public.users u on u.id = m.user_id
  where m.school_id = sid and m.user_id = actor and m.enabled
    and m.role::text = any(array['school_admin','director','secretary','surveillant','censeur'])
  order by case m.role::text when 'director' then 0 when 'school_admin' then 1 else 2 end
  limit 1;
  if actor_role is null then raise exception 'not_authorized'; end if;
  proposal_digest := md5(p_proposal::text);
  insert into public.confirmed_official_exam_dates (
    school_id, academic_year_id, section, source_url, source_name, source_label,
    source_wording, source_context, category, starts_on, ends_on,
    proposal_snapshot, proposal_hash, confirmed_by, confirmed_by_name, confirmed_by_role
  ) values (
    sid, p_year, p_section, selected_source.url, selected_source.source, selected_source.label,
    p_proposal->>'date_text', coalesce(p_proposal->>'context',''), p_proposal->>'category',
    proposed_start, proposed_end, p_proposal, proposal_digest, actor, actor_name, actor_role
  ) on conflict (school_id, academic_year_id, section, source_url, proposal_hash) do nothing
  returning id into confirmed_id;
  if confirmed_id is null then
    select id into confirmed_id from public.confirmed_official_exam_dates
    where school_id = sid and academic_year_id = p_year and section = p_section
      and source_url = p_source_url and proposal_hash = proposal_digest;
  end if;
  return confirmed_id;
end $$;
revoke all on function public.confirm_official_exam_date(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.confirm_official_exam_date(uuid,text,text,jsonb) to authenticated;
-- Retain the existing access checks and append only confirmed, audience-scoped dates.
create or replace function public.school_calendar(p_student uuid default null,p_token text default null) returns jsonb
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
 'official_exam_dates',coalesce((select jsonb_agg(jsonb_build_object(
 'id',d.id,'year_id',y.id,'year',y.name,'section',d.section,
 'source_url',d.source_url,'source_name',d.source_name,'source_label',d.source_label,
 'source_wording',d.source_wording,'source_context',d.source_context,
 'category',d.category,'start_date',d.starts_on,'end_date',d.ends_on,
 'proposal_snapshot',case when staff_view then d.proposal_snapshot else null end,
 'confirmed_by_name',case when staff_view then d.confirmed_by_name else null end,
 'confirmed_by_role',case when staff_view then d.confirmed_by_role else null end,
 'confirmed_at',d.confirmed_at
) order by d.starts_on,d.section)
 from public.confirmed_official_exam_dates d
 join public.academic_years y on y.id=d.academic_year_id and y.school_id=d.school_id
 where d.school_id=sid and (
  staff_view
  or (st is not null and exists (
   select 1 from public.classes c
   join public.enrollments en on en.class_id=c.id and en.student_id=st and en.status<>'transferred'
   where c.school_id=sid and c.academic_year_id=d.academic_year_id
    and public.grade_section(c.grade_level)=d.section
    and private.calendar_student_class(st,c.id)
  ))
  or (teacher and exists (
   select 1 from public.classes c
   join public.class_subjects cs on cs.class_id=c.id and cs.teacher_id=auth.uid()
   where c.school_id=sid and c.academic_year_id=d.academic_year_id
    and public.grade_section(c.grade_level)=d.section
  ))
 )),'[]'),
 'confirmable_sections',case when staff_view then coalesce((
  select jsonb_agg(jsonb_build_object('year_id',scope.year_id,'section',scope.section) order by scope.year_id,scope.section)
  from (
   select distinct c.academic_year_id as year_id,public.grade_section(c.grade_level) as section
   from public.classes c where c.school_id=sid and c.enabled
    and public.grade_section(c.grade_level) is not null
  ) scope
 ),'[]') else '[]'::jsonb end,
 'closures',coalesce((select jsonb_agg(jsonb_build_object('day',cl.day,'title',cl.title) order by cl.day) from public.school_closures cl where cl.school_id=sid and (st is null or exists(select 1 from public.classes c join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and private.calendar_student_class(st,c.id) and cl.day between y.start_date and y.end_date))),'[]'),
 'classes',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'year_id',y.id,'year',y.name,'section',public.grade_section(c.grade_level)) order by y.start_date desc,c.name) from public.classes c join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and c.enabled),'[]') else '[]'::jsonb end,
 'subjects',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',su.id,'name',su.name,'class_id',cs.class_id)) from public.class_subjects cs join public.subjects su on su.id=cs.subject_id where cs.school_id=sid and su.active),'[]') else '[]'::jsonb end,
 'periods',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'year_id',p.academic_year_id,'sections',p.sections,'start_date',p.start_date,'end_date',p.end_date) order by p.start_date)
 from public.grading_periods p where p.school_id=sid and p.is_active and (staff_view or exists(select 1 from public.classes c where c.school_id=sid and c.academic_year_id=p.academic_year_id and public.grade_section(c.grade_level)=any(p.sections) and ((st is not null and private.calendar_student_class(st,c.id)) or (teacher and exists(select 1 from public.class_subjects cs where cs.class_id=c.id and cs.teacher_id=auth.uid())))))),'[]'));
end $$;
revoke all on function public.school_calendar(uuid,text) from public, anon, authenticated;
grant execute on function public.school_calendar(uuid,text) to anon, authenticated;
