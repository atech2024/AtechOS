-- Isolated synthetic schema for parent assignment attachment access.
-- No production data or credentials are used.
create schema if not exists private;
create table public.schools(id uuid primary key);
create table public.academic_years(
 id uuid primary key,school_id uuid not null references public.schools(id),is_current boolean not null
);
create table public.classes(
 id uuid primary key,school_id uuid not null references public.schools(id),
 academic_year_id uuid not null references public.academic_years(id)
);
create table public.students(
 id uuid primary key,school_id uuid not null references public.schools(id),
 active boolean not null,school_status text not null
);
create table public.enrollments(
 student_id uuid not null references public.students(id),class_id uuid not null references public.classes(id),
 school_id uuid not null references public.schools(id),status text not null
);
create table public.parents(
 id uuid primary key,school_id uuid not null references public.schools(id),user_id uuid not null references auth.users(id)
);
create table public.student_parents(student_id uuid not null references public.students(id),parent_id uuid not null references public.parents(id));
create table public.school_members(
 school_id uuid not null references public.schools(id),user_id uuid not null references auth.users(id),
 role text not null,enabled boolean not null
);
create table public.assignments(
 id uuid primary key,school_id uuid not null references public.schools(id),
 class_id uuid not null references public.classes(id),attachment_url text not null
);
grant usage on schema public,private to authenticated;
grant select on storage.objects to anon,authenticated;
