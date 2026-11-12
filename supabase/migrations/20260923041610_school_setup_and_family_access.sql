-- Keep NISU accessible only through an explicitly authorized administrative API.
create or replace function public.get_student_records(p_id uuid default null) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select case when private.has_role(s.school_id,array['school_admin','director','secretary']) then to_jsonb(s)
 else jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id,'active',s.active) end
 from public.students s where s.school_id=public.get_my_school_id() and private.read_student(s.id) and (p_id is null or s.id=p_id) order by s.last_name,s.first_name;
$$;
revoke select on public.students from authenticated,anon,public;
revoke select(nis) on public.students from authenticated,anon,public;
do $$ declare cols text; begin
 select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name='students' and column_name<>'nis';
 execute 'grant select('||cols||') on public.students to authenticated';
end $$;
alter table public.classes add column enabled boolean not null default true;
alter table public.grading_periods add column academic_year_id uuid references public.academic_years(id);
alter table public.grading_periods add column sections text[] not null default array['preschool','primary','fundamental','secondary'];
alter table public.grading_periods add constraint period_sections_valid check(cardinality(sections)>0 and sections <@ array['preschool','primary','fundamental','secondary']::text[]);
create index grading_periods_year_idx on public.grading_periods(academic_year_id);
create or replace function public.grade_section(p_code text) returns text language sql immutable set search_path='' as $$
 select case when p_code in ('PS1','PS2','PS3') then 'preschool' when p_code in ('AF1','AF2','AF3','AF4','AF5','AF6') then 'primary' when p_code in ('AF7','AF8','AF9') then 'fundamental' when p_code in ('NS1','NS2','NS3','NS4') then 'secondary' end;
$$;
create or replace function public.activate_school_section(p_year uuid,p_section text,p_enabled boolean default true) returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); g record;
begin
 if not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized'; end if;
 if p_section not in ('preschool','primary','fundamental','secondary') or p_section is null or p_enabled is null then raise exception 'invalid_section'; end if;
 if not exists(select 1 from public.academic_years where id=p_year and school_id=sid) then raise exception 'invalid_year'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text||p_year::text||p_section,0));
 if p_enabled then
  for g in select * from public.grade_levels where is_active and public.grade_section(code)=p_section order by sort_order loop
   if not exists(select 1 from public.classes where school_id=sid and academic_year_id=p_year and (grade_level_id=g.id or grade_level=g.code)) then
    perform public.create_class(p_year,g.name,g.code);
   end if;
  end loop;
 end if;
 update public.classes c set enabled=p_enabled where c.school_id=sid and c.academic_year_id=p_year and public.grade_section(coalesce((select code from public.grade_levels where id=c.grade_level_id),c.grade_level))=p_section;
end $$;
create or replace function public.configure_grading_period(p_id uuid,p_year uuid,p_sections text[],p_active boolean) returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.academic_years where id=p_year and school_id=sid) then raise exception 'invalid_year'; end if;
 update public.grading_periods set academic_year_id=p_year,sections=p_sections,is_active=p_active where id=p_id and school_id=sid;
 if not found then raise exception 'period_not_found'; end if;
end $$;
create or replace function public.activate_grading_period(p_year uuid,p_name text,p_code text,p_start date,p_end date,p_sections text[]) returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); pid uuid; begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.academic_years where id=p_year and school_id=sid) then raise exception 'invalid_year'; end if;
 if p_start is null or p_end is null or p_start>p_end or nullif(trim(p_name),'') is null or nullif(trim(p_code),'') is null then raise exception 'invalid_period'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text||p_year::text||p_code,0));
 select id into pid from public.grading_periods where school_id=sid and code=p_code and academic_year_id=p_year limit 1;
 if pid is null then
  insert into public.grading_periods(school_id,name,code,start_date,end_date,weight,academic_year_id,sections,is_active) values(sid,p_name,p_code,p_start,p_end,100,p_year,p_sections,true) returning id into pid;
 else
  update public.grading_periods set sections=p_sections,is_active=true,start_date=p_start,end_date=p_end where id=pid;
 end if;
 return pid;
end $$;
create or replace function private.validate_grade_period() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.classes; p public.grading_periods; code text;
begin
 select * into c from public.classes where id=new.class_id;
 if not c.enabled then raise exception 'class_disabled'; end if;
 if new.grading_period_id is not null then
  select * into p from public.grading_periods where id=new.grading_period_id;
  select g.code into code from public.grade_levels g where g.id=c.grade_level_id;
  if p.school_id is distinct from c.school_id or not p.is_active or (p.academic_year_id is not null and p.academic_year_id<>c.academic_year_id) or not(coalesce(public.grade_section(coalesce(code,c.grade_level)),'unknown')=any(p.sections)) then raise exception 'period_not_enabled_for_class'; end if;
 end if;
 return new;
end $$;
create trigger validate_grade_period before insert or update of class_id,grading_period_id on public.grades for each row execute function private.validate_grade_period();
create or replace function public.save_parent_for_student(p_student uuid,p_name text,p_email text,p_phone text default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); pid uuid; em text:=lower(trim(p_email)); begin
 if not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.students where id=p_student and school_id=sid) then raise exception 'student_not_found'; end if;
 if nullif(trim(p_name),'') is null or em is null or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'parent_name_and_email_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text||em,0));
 select id into pid from public.parents where school_id=sid and lower(email)=em;
 if pid is null then insert into public.parents(school_id,full_name,email,phone,relationship) values(sid,trim(p_name),em,nullif(trim(p_phone),''),'parent') returning id into pid; end if;
 insert into public.student_parents(student_id,parent_id,is_primary,relationship) values(p_student,pid,not exists(select 1 from public.student_parents where student_id=p_student),'parent') on conflict do nothing;
 return pid;
end $$;
-- A director can invite parents, but cannot grant staff or administrator roles.
do $$ declare src text; begin
 select pg_get_functiondef('public.create_school_invitation(text,text,public.school_role,uuid,uuid)'::regprocedure) into src;
 src:=replace(src,'if not private.has_role(sid,array[''school_admin'']) then','if not (private.has_role(sid,array[''school_admin'']) or (p_role=''parent'' and private.has_role(sid,array[''director'']))) then');
 execute src;
 select pg_get_functiondef('public.accept_school_invitation(text)'::regprocedure) into src;
 src:=replace(src,'m.role=''school_admin'' and m.enabled','(m.role=''school_admin'' or (i.role=''parent'' and m.role=''director'')) and m.enabled');
 execute src;
end $$;

alter table public.grading_periods drop constraint grading_periods_school_id_code_key;
alter table public.grading_periods drop constraint grading_periods_school_id_name_key;
alter table public.grading_periods add unique nulls not distinct (school_id,academic_year_id,code);
alter table public.grading_periods add unique nulls not distinct (school_id,academic_year_id,name);
create or replace function private.validate_enabled_enrollment() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status='active' and not exists(select 1 from public.classes where id=new.class_id and enabled) then raise exception 'class_disabled'; end if; return new;
end $$;
create trigger validate_enabled_enrollment before insert or update of class_id,status on public.enrollments for each row execute function private.validate_enabled_enrollment();
revoke all on function public.get_student_records(uuid),public.grade_section(text),public.activate_school_section(uuid,text,boolean),public.configure_grading_period(uuid,uuid,text[],boolean),public.activate_grading_period(uuid,text,text,date,date,text[]),public.save_parent_for_student(uuid,text,text,text) from public,anon;
grant execute on function public.get_student_records(uuid),public.grade_section(text),public.activate_school_section(uuid,text,boolean),public.configure_grading_period(uuid,uuid,text[],boolean),public.activate_grading_period(uuid,text,text,date,date,text[]),public.save_parent_for_student(uuid,text,text,text) to authenticated;
revoke all on function private.validate_grade_period(),private.validate_enabled_enrollment() from public,anon,authenticated;

create or replace function public.publish_class_grades(p_class uuid,p_period uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); n integer; begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.classes where id=p_class and school_id=sid) or not exists(select 1 from public.grading_periods where id=p_period and school_id=sid) then raise exception 'invalid_class_or_period'; end if;
 update public.grades set published=true where class_id=p_class and grading_period_id=p_period;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.publish_class_grades(uuid,uuid) from public,anon;
grant execute on function public.publish_class_grades(uuid,uuid) to authenticated;
create or replace function private.protect_grade_publication() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if (new.published and tg_op='INSERT') or (tg_op='UPDATE' and new.published is distinct from old.published) then
  if not private.has_role(new.school_id,array['school_admin','director']) then raise exception 'publication_requires_administration'; end if;
 end if;
 return new;
end $$;
create trigger protect_grade_publication before insert or update of published on public.grades for each row execute function private.protect_grade_publication();
revoke all on function private.protect_grade_publication() from public,anon,authenticated;
