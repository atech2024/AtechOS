-- Store grading period dates per school section while preserving legacy shared dates.
alter table public.grading_periods
 add column if not exists section_dates jsonb not null default '{}'::jsonb;

alter table public.grading_periods
 drop constraint if exists grading_periods_section_dates_object;
alter table public.grading_periods
 add constraint grading_periods_section_dates_object
 check (jsonb_typeof(section_dates)='object');

create or replace function public.activate_grading_period_by_section_dates(
 p_year uuid,p_name text,p_code text,p_sections text[],p_section_dates jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
 sid uuid:=public.get_my_school_id(); pid uuid; y public.academic_years;
 section_name text; start_day date; end_day date; revision_start date; revision_end date;
 stored jsonb:='{}'::jsonb; min_day date; max_day date;
begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 select * into y from public.academic_years where id=p_year and school_id=sid;
 if not found then raise exception 'invalid_year'; end if;
 if nullif(trim(p_name),'') is null or nullif(trim(p_code),'') is null
   or p_sections is null or cardinality(p_sections)=0 or p_section_dates is null
   or jsonb_typeof(p_section_dates)<>'object'
   or cardinality(p_sections)<>(select count(*) from jsonb_object_keys(p_section_dates))
   or exists(select 1 from unnest(p_sections) s where s not in ('preschool','primary','fundamental','secondary'))
   or exists(select 1 from unnest(p_sections) s group by s having count(*)>1)
 then raise exception 'invalid_period'; end if;

 for section_name in select unnest(p_sections) loop
  if not (p_section_dates ? section_name)
    or jsonb_typeof(p_section_dates->section_name)<>'object'
    or coalesce(p_section_dates->section_name->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_section_dates->section_name->>'end_date','') !~ '^\d{4}-\d{2}-\d{2}$'
  then raise exception 'invalid_period'; end if;
  begin
   start_day:=(p_section_dates->section_name->>'start_date')::date;
   end_day:=(p_section_dates->section_name->>'end_date')::date;
  exception when others then raise exception 'invalid_period'; end;
  if start_day>end_day or start_day<y.start_date or end_day>y.end_date then raise exception 'invalid_period'; end if;
  -- The revision window is the Monday-Friday of the immediately preceding calendar week.
  revision_start:=start_day-((extract(isodow from start_day)::integer-1)+7);
  revision_end:=revision_start+4;
  stored:=stored||jsonb_build_object(section_name,jsonb_build_object(
   'start_date',start_day,'end_date',end_day,
   'revision_start',revision_start,'revision_end',revision_end));
  min_day:=least(coalesce(min_day,start_day),start_day);
  max_day:=greatest(coalesce(max_day,end_day),end_day);
 end loop;

 perform pg_advisory_xact_lock(hashtextextended(sid::text||p_year::text||p_code,0));
 select id into pid from public.grading_periods
  where school_id=sid and code=p_code and academic_year_id=p_year limit 1;
 if pid is null then
  insert into public.grading_periods(school_id,name,code,start_date,end_date,weight,academic_year_id,sections,is_active,section_dates)
  values(sid,p_name,p_code,min_day,max_day,100,p_year,p_sections,true,stored) returning id into pid;
 else
  update public.grading_periods set name=p_name,sections=p_sections,is_active=true,
   start_date=min_day,end_date=max_day,section_dates=stored where id=pid;
 end if;
 return pid;
end $$;

revoke all on function public.activate_grading_period_by_section_dates(uuid,text,text,text[],jsonb) from public,anon;
grant execute on function public.activate_grading_period_by_section_dates(uuid,text,text,text[],jsonb) to authenticated;

-- Preserve backward compatibility when the legacy RPCs are present.
-- The isolated migration fixture intentionally contains only selected functions.
do $$
declare src text; old_clause text; new_clause text;
begin
 if to_regprocedure('public.activate_grading_period(uuid,text,text,date,date,text[])') is not null then
  select pg_get_functiondef('public.activate_grading_period(uuid,text,text,date,date,text[])'::regprocedure) into src;
  old_clause:='set sections=p_sections,is_active=true,start_date=p_start,end_date=p_end where id=pid';
  new_clause:='set sections=p_sections,is_active=true,start_date=p_start,end_date=p_end,section_dates=''{}''::jsonb where id=pid';
  if position(old_clause in src)=0 then raise exception 'legacy_activate_definition_changed'; end if;
  execute replace(src,old_clause,new_clause);
 end if;
 if to_regprocedure('public.configure_grading_period(uuid,uuid,text[],boolean)') is not null then
  select pg_get_functiondef('public.configure_grading_period(uuid,uuid,text[],boolean)'::regprocedure) into src;
  old_clause:='set academic_year_id=p_year,sections=p_sections,is_active=p_active where id=p_id and school_id=sid';
  new_clause:='set academic_year_id=p_year,sections=p_sections,is_active=p_active,section_dates=case when p_sections is distinct from sections then ''{}''::jsonb else section_dates end where id=p_id and school_id=sid';
  if position(old_clause in src)=0 then raise exception 'legacy_configure_definition_changed'; end if;
  execute replace(src,old_clause,new_clause);
 end if;
end $$;

-- Keep exam date authorization section-aware while retaining legacy-period fallback.
do $$
declare src text; old_clause text; new_clause text;
begin
 select pg_get_functiondef('private.validate_exam_scope(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,date,date)'::regprocedure) into src;
 old_clause:='and d between p.start_date and p.end_date';
 new_clause:='and d between coalesce((p.section_dates->public.grade_section(c.grade_level)->>''start_date'')::date,p.start_date) and coalesce((p.section_dates->public.grade_section(c.grade_level)->>''end_date'')::date,p.end_date)';
 if position(old_clause in src)=0 then raise exception 'validate_exam_scope_definition_changed'; end if;
 execute replace(src,old_clause,new_clause);
 select pg_get_functiondef('public.school_calendar(uuid,text)'::regprocedure) into src;
 old_clause:= '''sections'',p.sections,''start_date'',p.start_date,''end_date'',p.end_date';
 new_clause:= '''sections'',p.sections,''start_date'',p.start_date,''end_date'',p.end_date,''section_dates'',case when p.section_dates=''{}''::jsonb then jsonb_build_object(''legacy'',jsonb_build_object(''start_date'',p.start_date,''end_date'',p.end_date)) else p.section_dates end';
 if position(old_clause in src)=0 then raise exception 'school_calendar_period_payload_changed'; end if;
 execute replace(src,old_clause,new_clause);
end $$;
