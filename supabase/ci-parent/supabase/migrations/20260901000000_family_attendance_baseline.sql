-- Isolated, synthetic-only baseline for the family attendance RPC.
create table public.schools(id uuid primary key);
create table public.academic_years(
 id uuid primary key,school_id uuid not null references public.schools(id),
 start_date date not null,end_date date not null
);
create table public.students(
 id uuid primary key,school_id uuid not null references public.schools(id),
 first_name text not null,last_name text not null,departure_year_id uuid references public.academic_years(id)
);
create table public.attendance(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),attendance_date date not null,
 status text not null,late_minutes integer,check_in_at timestamptz,check_out_at timestamptz
);
create index family_attendance_student_date_idx on public.attendance(school_id,student_id,attendance_date desc);
create table public.parents(
 id uuid primary key,school_id uuid not null references public.schools(id),user_id uuid not null references auth.users(id)
);
create table public.student_parents(student_id uuid not null references public.students(id),parent_id uuid not null references public.parents(id));
create table public.school_members(
 school_id uuid not null references public.schools(id),user_id uuid not null references auth.users(id),
 role text not null,enabled boolean not null default true
);
grant usage on schema public to authenticated;
