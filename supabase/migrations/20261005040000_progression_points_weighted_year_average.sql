create or replace function public.preview_student_progression(p_source uuid,p_target uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=''
as $$
declare
 sid uuid:=public.get_my_school_id();
 threshold numeric;
 result jsonb;
begin
 if not private.has_role(sid,array['school_admin','director']) then
  raise exception 'not_authorized';
 end if;
 if not exists(
  select 1 from public.academic_years a
  join public.academic_years b on b.id=p_target
  where a.id=p_source and a.school_id=sid
   and b.school_id=sid and b.start_date>a.start_date
 ) then
  raise exception 'invalid_years';
 end if;

 select passing_average into threshold
 from public.school_grading_settings where school_id=sid;
 threshold:=coalesce(threshold,5);

 with source_periods as (
  select p.id,p.sections
  from public.grading_periods p
  where p.school_id=sid and p.is_active
   and (p.academic_year_id=p_source or p.academic_year_id is null)
 ), roster as (
  select distinct on (s.id)
   s.id,s.first_name,s.last_name,s.atechos_id,c.id as class_id,c.name as class_name,
   c.grade_level_id,coalesce(nullif(c.grade_level,''),gl.code) as grade_code
  from public.students s
  join public.enrollments e on e.student_id=s.id and e.status='active'
  join public.classes c on c.id=e.class_id and c.academic_year_id=p_source
  left join public.grade_levels gl on gl.id=c.grade_level_id
  where s.school_id=sid and s.active and s.school_status='active'
  order by s.id,c.id
 ), active_subjects as (
  select r.id as student_id,r.class_id,cs.subject_id
  from roster r
  join public.class_subjects cs on cs.class_id=r.class_id
  join public.subjects su on su.id=cs.subject_id and su.active
 ), required as (
  select a.student_id,a.class_id,a.subject_id,p.id as period_id
  from active_subjects a
  join roster r on r.id=a.student_id
  join source_periods p on p.sections &&
   case
    when r.grade_code like 'PS%' then array['preschool']::text[]
    when r.grade_code in ('AF1','AF2','AF3','AF4','AF5','AF6') then array['primary','fundamental']::text[]
    when r.grade_code like 'AF%' then array['fundamental']::text[]
    else array['secondary']::text[]
   end
 ), totals as (
  select a.student_id,
   sum(g.score*coalesce(g.assessment_weight,100)/100) as earned,
   sum(g.max_score*coalesce(g.assessment_weight,100)/100) as possible
  from active_subjects a
  join public.grades g on g.student_id=a.student_id and g.class_id=a.class_id
   and g.subject_id=a.subject_id and g.school_id=sid and g.published
  join source_periods p on p.id=g.grading_period_id
  join roster r on r.id=a.student_id
  where p.sections &&
   case
    when r.grade_code like 'PS%' then array['preschool']::text[]
    when r.grade_code in ('AF1','AF2','AF3','AF4','AF5','AF6') then array['primary','fundamental']::text[]
    when r.grade_code like 'AF%' then array['fundamental']::text[]
    else array['secondary']::text[]
   end
  group by a.student_id
 ), means as (
  select r.id as student_id,t.earned/nullif(t.possible,0)*10 as general_average
  from roster r join totals t on t.student_id=r.id
 ), reviewed as (
  select r.*,
   exists(select 1 from active_subjects a where a.student_id=r.id)
   and exists(select 1 from source_periods p where p.sections &&
    case
     when r.grade_code like 'PS%' then array['preschool']::text[]
     when r.grade_code in ('AF1','AF2','AF3','AF4','AF5','AF6') then array['primary','fundamental']::text[]
     when r.grade_code like 'AF%' then array['fundamental']::text[]
     else array['secondary']::text[]
    end)
   and not exists(
    select 1 from required q
    where q.student_id=r.id and not exists(
     select 1 from public.grades g
     where g.student_id=q.student_id and g.class_id=q.class_id
      and g.subject_id=q.subject_id and g.grading_period_id=q.period_id
      and g.school_id=sid and g.published
    )
   ) as complete
  from roster r
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'name',r.first_name||' '||r.last_name,'atechos_id',r.atechos_id,
   'class_name',r.class_name,'average',case when r.complete then m.general_average end,'passing',threshold,
   'complete',r.complete,
   'recommended_grade',case
    when m.general_average is null or not r.complete then null
    when m.general_average<threshold then g.code
    else (select n.code from public.grade_levels n
     where n.is_active and n.sort_order>g.sort_order
     order by n.sort_order limit 1)
   end
  ) order by r.class_name,r.last_name,r.first_name),'[]'::jsonb)
 into result
 from reviewed r
 left join means m on m.student_id=r.id
 left join public.grade_levels g on g.id=r.grade_level_id;

 return result;
end;
$$;

revoke all on function public.preview_student_progression(uuid,uuid) from public,anon;
grant execute on function public.preview_student_progression(uuid,uuid) to authenticated;
