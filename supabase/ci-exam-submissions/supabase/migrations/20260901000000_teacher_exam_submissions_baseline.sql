-- Isolated synthetic schema for the teacher exam submission migration check.
-- This stack contains no production data or credentials.
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.schools(id uuid primary key,name text not null);
create table public.users(id uuid primary key,full_name text not null,email text);
create table public.school_members(
 school_id uuid not null references public.schools(id),
 user_id uuid not null references public.users(id),
 role text not null,enabled boolean not null default true,
 primary key(school_id,user_id,role)
);
create table public.grade_levels(id uuid primary key,code text not null,name text not null,is_active boolean not null default true,sort_order integer not null default 0);
create table public.academic_years(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 name text not null,start_date date not null,end_date date not null,is_current boolean not null default false
);
create table public.classes(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 grade_level_id uuid references public.grade_levels(id),academic_year_id uuid not null references public.academic_years(id),
 grade_level text,section text,room text,name text not null,enabled boolean not null default true
);
create table public.subjects(
 id uuid primary key,school_id uuid not null references public.schools(id),name text not null,active boolean not null default true
);
create table public.class_subjects(
 school_id uuid not null references public.schools(id),class_id uuid not null references public.classes(id),
 subject_id uuid not null references public.subjects(id),teacher_id uuid not null references public.users(id),
 primary key(school_id,class_id,subject_id,teacher_id)
);
create table public.grading_periods(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 academic_year_id uuid not null references public.academic_years(id),name text not null,code text not null,
 start_date date not null,end_date date not null,sections text[] not null,is_active boolean not null default true
);
create table public.notifications(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 recipient_id uuid not null references public.users(id),type text not null,title text not null,
 description text not null,priority text not null,href text not null,event_key text not null,
 created_at timestamptz not null default now(),unique(school_id,recipient_id,event_key)
);

create or replace function public.get_my_school_id() returns uuid
language sql stable security definer set search_path=''
as $$ select m.school_id from public.school_members m where m.user_id=auth.uid() and m.enabled order by m.school_id limit 1 $$;
create or replace function private.has_role(p_school uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role=any(p_roles)) $$;
create or replace function public.grade_section(p_code text) returns text
language sql immutable set search_path=''
as $$ select case
 when upper(coalesce(p_code,'')) in ('PS1','PS2','PS3') then 'preschool'
 when upper(coalesce(p_code,'')) in ('AF1','AF2','AF3','AF4','AF5','AF6') then 'primary'
 when upper(coalesce(p_code,'')) in ('AF7','AF8','AF9') then 'fundamental'
 when upper(coalesce(p_code,'')) in ('NS1','NS2','NS3','NS4') then 'secondary'
 end $$;
