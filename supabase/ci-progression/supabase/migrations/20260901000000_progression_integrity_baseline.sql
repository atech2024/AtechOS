create schema if not exists private;

create table public.schools(id uuid primary key);
create table public.academic_years(
 id uuid primary key,school_id uuid not null references public.schools(id),
 name text not null,start_date date not null,end_date date not null
);
create table public.grade_levels(
 id uuid primary key,code text not null,name text not null,is_active boolean not null default true,
 sort_order integer not null
);
create table public.classes(
 id uuid primary key,school_id uuid not null references public.schools(id),
 academic_year_id uuid not null references public.academic_years(id),
 grade_level_id uuid not null references public.grade_levels(id),grade_level text not null,
 name text not null,enabled boolean not null default true
);
create table public.students(
 id uuid primary key,school_id uuid not null references public.schools(id),
 first_name text not null,last_name text not null,atechos_id text not null,
 active boolean not null default true,school_status text not null default 'active'
);
create table public.enrollments(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),
 class_id uuid not null references public.classes(id),status text not null
);
create table public.school_members(
 school_id uuid not null references public.schools(id),user_id uuid not null references auth.users(id),
 role text not null
);
create table public.school_grading_settings(
 school_id uuid primary key references public.schools(id),controls_per_period integer not null,
 passing_average numeric not null
);
create table public.grading_periods(
 id uuid primary key,school_id uuid not null references public.schools(id),
 academic_year_id uuid references public.academic_years(id),is_active boolean not null,
 sections text[] not null
);
create table public.subjects(
 id uuid primary key,school_id uuid not null references public.schools(id),
 name text not null,active boolean not null default true
);
create table public.class_subjects(
 class_id uuid not null references public.classes(id),subject_id uuid not null references public.subjects(id),
 primary key(class_id,subject_id)
);
create table public.grades(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),class_id uuid not null references public.classes(id),
 subject_id uuid not null references public.subjects(id),grading_period_id uuid references public.grading_periods(id),
 assessment_name text not null,score numeric not null,max_score numeric not null,
 assessment_weight numeric default 100,published boolean not null default false
);

create or replace function public.get_my_school_id() returns uuid
language sql stable security definer set search_path=''
as $$ select school_id from public.school_members where user_id=auth.uid() order by school_id limit 1 $$;

create or replace function private.has_role(p_school uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.school_members where school_id=p_school and user_id=auth.uid() and role=any(p_roles)) $$;

grant usage on schema public,private to authenticated;
