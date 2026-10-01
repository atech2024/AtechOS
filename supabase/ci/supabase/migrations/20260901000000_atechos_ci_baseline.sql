-- Small, synthetic-only baseline for exercising the two pending migrations.
-- This is deliberately separate from production migration history and contains
-- no production data or credentials.
create schema if not exists private;

create table public.schools (id uuid primary key);
create table public.users (id uuid primary key, full_name text not null);
create table public.grade_levels (id uuid primary key, code text not null);
create table public.classes (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 grade_level_id uuid references public.grade_levels(id),
 grade_level text,
 name text not null
);
create table public.students (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 first_name text not null,
 last_name text not null,
 atechos_id text,
 active boolean not null default true
);
create table public.attendance (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 class_id uuid not null references public.classes(id),
 attendance_date date not null,
 check_in_at timestamptz,
 check_out_at timestamptz,
 status text not null,
 recorded_by uuid references public.users(id)
);
create table public.enrollments (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 class_id uuid not null references public.classes(id),
 status text not null
);
create table public.parents (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 user_id uuid not null references public.users(id),
 full_name text not null,
 email text,
 relationship text
);
create table public.student_parents (
 student_id uuid not null references public.students(id),
 parent_id uuid not null references public.parents(id),
 is_primary boolean not null default false,
 relationship text not null default 'parent',
 primary key(student_id,parent_id)
);
create table public.school_members (
 school_id uuid not null references public.schools(id),
 user_id uuid not null references public.users(id),
 role text not null,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(school_id,user_id,role)
);
create table public.kindergarten_pickups (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 pickup_date date not null,
 recorded_by uuid not null references public.users(id)
);

create or replace function public.get_my_school_id() returns uuid
language sql stable security definer set search_path=''
as $$ select m.school_id from public.school_members m where m.user_id=auth.uid() and m.enabled order by m.school_id limit 1 $$;

create or replace function public.grade_section(p_code text) returns text
language sql immutable
as $$ select case when upper(coalesce(p_code,'')) like 'PS%' then 'preschool' else lower(coalesce(p_code,'')) end $$;

create or replace function private.is_preschool_student(p_student uuid) returns boolean
language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.enrollments e
  join public.classes c on c.id=e.class_id and c.school_id=e.school_id
  left join public.grade_levels gl on gl.id=c.grade_level_id
  where e.student_id=p_student and e.status='active'
    and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
 )
$$;

create or replace function private.can_operate_kindergarten_pickup(p_school uuid) returns boolean
language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role in ('school_admin','director','secretary','censeur','surveillant'))
$$;

create or replace function private.record_student_kiosk(p_student uuid) returns jsonb
language sql security definer set search_path=''
as $$ select jsonb_build_object('atechos_id',s.atechos_id,'name',s.first_name||' '||s.last_name) from public.students s where s.id=p_student $$;

create or replace function public.scan_student_code(p_code text,p_school uuid) returns jsonb
language sql security definer set search_path=''
as $$ select jsonb_build_object('atechos_id',s.atechos_id,'name',s.first_name||' '||s.last_name) from public.students s where s.atechos_id=p_code and s.school_id=p_school limit 1 $$;
