-- Small, synthetic-only baseline for exercising selected pending migrations.
-- This is deliberately separate from production migration history and contains
-- no production data or credentials.
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pg_cron;
create extension if not exists pgcrypto with schema extensions;

create table public.schools (id uuid primary key, name text not null default 'CI School', code text, address text, phone text, logo_url text);
create table public.users (id uuid primary key, full_name text not null, email text);
create table public.grade_levels (id uuid primary key, code text not null);
create table public.classes (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 grade_level_id uuid references public.grade_levels(id),
 academic_year_id uuid,
 grade_level text,
 homeroom_teacher_id uuid references public.users(id),
 name text not null,
 enabled boolean not null default true
);
create table public.academic_years (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 name text not null default 'CI Year',
 start_date date not null,
 end_date date not null,
 is_current boolean not null default false
);
alter table public.classes add constraint classes_academic_year_fk foreign key(academic_year_id) references public.academic_years(id);
create table public.grading_periods (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 academic_year_id uuid not null references public.academic_years(id),
 name text not null default 'P1',
 code text not null,
 start_date date not null default current_date,
 end_date date not null default current_date,
 sections text[] not null default array['preschool']::text[],
 is_active boolean not null default true
);
create table public.students (
 id uuid primary key,
 school_id uuid not null references public.schools(id),
 first_name text not null,
 last_name text not null,
 atechos_id text,
 active boolean not null default true,
 school_status text not null default 'active',
 portal_enabled boolean not null default true,
 photo_url text,
 departure_year_id uuid references public.academic_years(id)
);
create table public.attendance (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 class_id uuid not null references public.classes(id),
 attendance_date date not null,
 check_in_at timestamptz,
 check_out_at timestamptz,
 status text not null,
 recorded_by uuid references public.users(id),
 updated_at timestamptz not null default now(),
 unique(student_id,attendance_date)
);
create table public.attendance_events (
 id uuid primary key default gen_random_uuid(),
 attendance_id uuid not null references public.attendance(id),
 student_id uuid not null references public.students(id),
 source text not null,
 actor_id uuid,
 actor_name text,
 actor_role text,
 action text not null,
 recorded_at timestamptz not null default now(),
 attendance_date date not null
);
create table public.student_badges (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 badge_uid text not null,
 badge_type text not null default 'qr',
 active boolean not null default true,
 state text not null default 'active',
 issued_at timestamptz not null default now()
);
create table private.badge_token_history (
 token_hash text primary key,
 badge_id uuid not null references public.student_badges(id)
);
create table public.badge_scans (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 badge_id uuid not null references public.student_badges(id),
 source text not null default 'KIOS',
 result text not null,
 created_at timestamptz not null default now()
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
create table public.school_closures (
 school_id uuid not null references public.schools(id),
 day date not null,
 title text not null,
 primary key(school_id,day)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 recipient_id uuid not null references public.users(id),
 type text not null,
 title text not null,
 description text not null,
 priority text not null,
 href text not null,
 event_key text not null,
 created_at timestamptz not null default now(),
 unique(school_id,recipient_id,event_key)
);
create table private.student_sessions (
 student_id uuid not null references public.students(id),
 token_hash text not null unique,
 expires_at timestamptz not null
);
create function private.family_student(p_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.students s on s.id=sp.student_id where sp.student_id=p_student and p.user_id=auth.uid() and s.active)
$$;
create table public.bulletin_versions (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),student_id uuid not null references public.students(id),
 class_id uuid not null references public.classes(id),period_id uuid not null references public.grading_periods(id),version integer not null,
 payload jsonb not null,published_at timestamptz not null default now()
);
create function private.calculated_student_report_cards(p_student uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('student',jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name),'cards','[]'::jsonb,'attendance','[]'::jsonb) from public.students s where s.id=p_student
$$;
create function private.bulletin_card(v public.bulletin_versions) returns jsonb language sql stable set search_path='' as $$
 select coalesce(v.payload->'card','{}'::jsonb)||jsonb_build_object('document',jsonb_build_object('id',v.id,'version',v.version,'published_at',v.published_at))
$$;
create function private.student_report_cards(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb;cards jsonb;history jsonb;begin
 base:=private.calculated_student_report_cards(p_student);if base is null then return null;end if;
 select coalesce(jsonb_agg(private.bulletin_card(v) order by v.published_at desc,v.version desc),'[]') into history from public.bulletin_versions v where v.student_id=p_student;
 with latest as(select distinct on (c->>'class_id',c->>'period_id') c from jsonb_array_elements(history) c order by c->>'class_id',c->>'period_id',(c->'document'->>'version')::int desc),
 visible as(select c from latest union all select c from jsonb_array_elements(base->'cards') c where not exists(select 1 from latest l where l.c->>'class_id'=c->>'class_id' and l.c->>'period_id'=c->>'period_id'))
 select coalesce(jsonb_agg(c),'[]') into cards from visible;
 return base||jsonb_build_object('cards',cards,'document_history',history);
end $$;
create function public.get_report_card(p_student uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.student_report_cards(p_student)
$$;
create or replace function public.get_my_school_id() returns uuid
language sql stable security definer set search_path=''
as $$ select m.school_id from public.school_members m where m.user_id=auth.uid() and m.enabled order by m.school_id limit 1 $$;

create or replace function private.has_role(p_school uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role=any(p_roles)) $$;

create or replace function public.create_academic_year(p_name text,p_start_date date,p_end_date date,p_is_current boolean default false)
returns uuid language plpgsql security invoker set search_path='public','pg_temp' as $$
declare sid uuid:=public.get_my_school_id();v_id uuid;
begin
 if not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized'; end if;
 if nullif(trim(p_name),'') is null or p_end_date<p_start_date then raise exception 'invalid_date_range'; end if;
 if p_is_current then update public.academic_years set is_current=false where school_id=sid; end if;
 insert into public.academic_years(school_id,name,start_date,end_date,is_current) values(sid,trim(p_name),p_start_date,p_end_date,p_is_current) returning id into v_id;
 return v_id;
end $$;

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
language plpgsql security definer set search_path=''
as $$
declare s public.students%rowtype;ts timestamptz:=now();result text:='check_in';
begin
 select * into s from public.students where id=p_student;
 if s.id is null then return jsonb_build_object('error','invalid_credentials');end if;
 return jsonb_build_object('action',result,'atechos_id',s.atechos_id,'name',s.first_name||' '||s.last_name);
end $$;

create or replace function public.scan_student_code(p_code text,p_school uuid) returns jsonb
language sql security definer set search_path=''
as $$ select jsonb_build_object('atechos_id',s.atechos_id,'name',s.first_name||' '||s.last_name) from public.students s where s.atechos_id=p_code and s.school_id=p_school limit 1 $$;

create or replace function public.student_kiosk_scan(p_code text,p_pin text) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare s public.students%rowtype;ts timestamptz:=now();
begin
 select * into s from public.students where atechos_id=p_code and active and portal_enabled and school_status='active' limit 1;
 if s.id is null then return jsonb_build_object('error','invalid_credentials');end if;
 return private.record_student_kiosk(s.id);
end $$;

create or replace function public.student_device_login(p_code text,p_full_name text,p_pin text,p_new_pin text) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare s public.students%rowtype;
begin
 select * into s from public.students where atechos_id=p_code and active and portal_enabled limit 1;
 if s.id is null then return jsonb_build_object('error','invalid_credentials');end if;
 if nullif(p_new_pin,'') is not null and p_new_pin !~ '^[0-9]{6,12}$' then return jsonb_build_object('error','invalid_pin');end if;
 return jsonb_build_object('ok',true);
end $$;
