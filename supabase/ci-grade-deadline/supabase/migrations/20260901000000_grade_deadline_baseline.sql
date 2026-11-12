create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.users(id uuid primary key,full_name text not null);
create table public.schools(id uuid primary key,owner_user_id uuid);
create table public.school_members(
 school_id uuid not null references public.schools(id),user_id uuid not null references public.users(id),
 role text not null,enabled boolean not null default true,primary key(school_id,user_id,role));
create table public.academic_years(
 id uuid primary key,school_id uuid not null references public.schools(id),is_current boolean not null default false);
create table public.classes(
 id uuid primary key,school_id uuid not null references public.schools(id),academic_year_id uuid not null references public.academic_years(id),
 grade_level text not null,enabled boolean not null default true);
create table public.subjects(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),name text not null,
 code text,active boolean not null default true);
create table public.class_subjects(
 school_id uuid not null references public.schools(id),class_id uuid not null references public.classes(id),
 subject_id uuid not null references public.subjects(id),teacher_id uuid references public.users(id));
create table public.grading_periods(
 id uuid primary key,school_id uuid not null references public.schools(id),academic_year_id uuid not null references public.academic_years(id),
 name text not null,code text not null,start_date date not null,end_date date not null,sections text[] not null,is_active boolean not null default true);
create table public.category_grade_deadlines(
 period_id uuid not null references public.grading_periods(id),section text not null,deadline timestamptz not null,
 exam_start date,exam_end date,primary key(period_id,section));
create table public.students(
 id uuid primary key,school_id uuid not null references public.schools(id),active boolean not null default true);
create table public.enrollments(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),class_id uuid not null references public.classes(id),status text not null);
create table public.grades(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),subject_id uuid not null references public.subjects(id),
 class_id uuid not null references public.classes(id),teacher_id uuid not null references public.users(id),
 assessment_name text not null,score numeric not null,max_score numeric not null,note text,
 grading_period_id uuid references public.grading_periods(id),assessment_weight numeric not null default 100,
 workflow_state text not null default 'draft',published boolean not null default false,graded_at timestamptz default now());

create or replace function public.get_my_school_id() returns uuid
language sql stable security definer set search_path=''
as $$ select m.school_id from public.school_members m where m.user_id=auth.uid() and m.enabled order by m.school_id limit 1 $$;
create or replace function private.has_role(p_school uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role=any(p_roles)) $$;
create or replace function private.grade_reviewer(p_school uuid) returns boolean
language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and private.has_role(p_school,array['school_admin','director','censeur']) $$;
create or replace function public.grade_section(p_code text) returns text
language sql immutable set search_path=''
as $$ select case
 when upper(coalesce(p_code,'')) in ('PS1','PS2','PS3') then 'preschool'
 when upper(coalesce(p_code,'')) in ('AF1','AF2','AF3','AF4','AF5','AF6') then 'primary'
 when upper(coalesce(p_code,'')) in ('AF7','AF8','AF9') then 'fundamental'
 when upper(coalesce(p_code,'')) in ('NS1','NS2','NS3','NS4') then 'secondary' end $$;
create or replace function private.enforce_grade_deadline() returns trigger
language plpgsql security definer set search_path=''
as $$ begin return new; end $$;
create trigger enforce_grade_deadline before insert or update or delete on public.grades
for each row execute function private.enforce_grade_deadline();

create or replace function public.create_grade(
 p_student_id uuid,p_subject_id uuid,p_class_id uuid,p_assessment_name text,p_score numeric,
 p_max_score numeric,p_note text,p_grading_period_id uuid,p_assessment_weight numeric default 100
) returns public.grades language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); result public.grades;
begin
 if sid is null or not private.has_role(sid,array['teacher','school_admin','director']) then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.class_subjects cs where cs.school_id=sid and cs.class_id=p_class_id and cs.subject_id=p_subject_id and cs.teacher_id=auth.uid()) then raise exception 'not_assigned';end if;
 if not exists(select 1 from public.students s join public.enrollments e on e.student_id=s.id where s.id=p_student_id and s.school_id=sid and s.active and e.class_id=p_class_id and e.status='active') then raise exception 'not_enrolled';end if;
 insert into public.grades(school_id,student_id,subject_id,class_id,teacher_id,assessment_name,score,max_score,note,grading_period_id,assessment_weight)
 values(sid,p_student_id,p_subject_id,p_class_id,auth.uid(),p_assessment_name,p_score,p_max_score,p_note,p_grading_period_id,p_assessment_weight)
 returning * into result;
 return result;
end $$;
grant usage on schema public,private to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on function public.create_grade(uuid,uuid,uuid,text,numeric,numeric,text,uuid,numeric) to authenticated;
