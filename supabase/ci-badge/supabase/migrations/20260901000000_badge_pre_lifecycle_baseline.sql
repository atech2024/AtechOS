-- Synthetic badge-only pre-lifecycle schema. The workflow applies the real
-- badge lifecycle migration after this baseline and always rolls test data back.
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.schools(id uuid primary key, owner_user_id uuid);
create table public.users(id uuid primary key, full_name text);
create table public.students(
 id uuid primary key, school_id uuid not null references public.schools(id),
 first_name text not null, last_name text not null, atechos_id text,
 user_id uuid, active boolean not null default true,
 portal_enabled boolean not null default true, school_status text not null default 'active'
);
create table public.academic_years(id uuid primary key,school_id uuid not null references public.schools(id),is_current boolean not null default false);
create table public.grade_levels(id uuid primary key,code text not null);
create table public.classes(id uuid primary key,school_id uuid not null references public.schools(id),academic_year_id uuid not null references public.academic_years(id),name text not null,grade_level text,grade_level_id uuid references public.grade_levels(id),enabled boolean not null default true);
create table public.enrollments(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),student_id uuid not null references public.students(id),class_id uuid not null references public.classes(id),status text not null default 'active');
create table public.school_kiosk_schedules(school_id uuid primary key references public.schools(id),entry_opens_at time not null default time '05:00',entry_ends_at time not null default time '07:45',late_ends_at time not null default time '08:00',checkout_starts_at time not null default time '13:00',checkout_ends_at time not null default time '23:59',preschool_entry_opens_at time not null default time '05:00',preschool_entry_ends_at time not null default time '07:45',preschool_late_ends_at time not null default time '08:00',preschool_checkout_starts_at time not null default time '13:00',preschool_checkout_ends_at time not null default time '23:59',updated_by uuid,updated_at timestamptz not null default now());
create table public.school_release_protocols(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),protocol_date date not null,release_at time not null,reason text not null,activated_name text,activated_role text,activated_at timestamptz not null default now());
create function public.save_school_kiosk_schedule(p_entry_opens_at time,p_entry_ends_at time,p_late_ends_at time,p_checkout_starts_at time,p_checkout_ends_at time,p_preschool_entry_opens_at time,p_preschool_entry_ends_at time,p_preschool_late_ends_at time,p_preschool_checkout_starts_at time,p_preschool_checkout_ends_at time)
returns void language plpgsql security definer set search_path=''
as $school_save$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 update public.school_kiosk_schedules set entry_opens_at=p_entry_opens_at,entry_ends_at=p_entry_ends_at,late_ends_at=p_late_ends_at,checkout_starts_at=p_checkout_starts_at,checkout_ends_at=p_checkout_ends_at,preschool_entry_opens_at=p_preschool_entry_opens_at,preschool_entry_ends_at=p_preschool_entry_ends_at,preschool_late_ends_at=p_preschool_late_ends_at,preschool_checkout_starts_at=p_preschool_checkout_starts_at,preschool_checkout_ends_at=p_preschool_checkout_ends_at where school_id=sid;
end $school_save$;
create or replace function public.grade_section(p_code text) returns text language sql immutable set search_path='' as $grade_section$ select case when p_code in ('PS1','PS2','PS3') then 'preschool' when p_code in ('AF1','AF2','AF3','AF4','AF5','AF6') then 'primary' when p_code in ('AF7','AF8','AF9') then 'fundamental' when p_code in ('NS1','NS2','NS3','NS4') then 'secondary' end $grade_section$;
create table public.student_badges(
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id), badge_uid text not null,
 badge_type text not null default 'qr', active boolean not null default true,
 issued_at timestamptz not null default now(), revoked_at timestamptz, updated_at timestamptz not null default now()
);
create table private.student_badge_credentials(
 student_id uuid primary key references public.students(id) on delete cascade,
 token text not null unique default encode(extensions.gen_random_bytes(32),'hex'),
 updated_at timestamptz not null default now()
);
create table public.parents(id uuid primary key, school_id uuid not null references public.schools(id), user_id uuid not null references public.users(id));
create table public.student_parents(student_id uuid not null references public.students(id), parent_id uuid not null references public.parents(id), primary key(student_id,parent_id));
create table public.school_members(
 school_id uuid not null references public.schools(id), user_id uuid not null references public.users(id),
 role text not null, enabled boolean not null default true, primary key(school_id,user_id,role)
);
create table public.notifications(
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 recipient_id uuid not null references public.users(id), type text not null, title text not null,
 description text not null, priority text not null, href text not null, event_key text not null,
 created_at timestamptz not null default now(), unique(school_id,recipient_id,event_key)
);
create table private.badge_ci_scans(student_id uuid primary key references public.students(id), scans integer not null default 0);

create or replace function public.get_my_school_id() returns uuid
language sql stable security definer set search_path=''
as $$ select school_id from public.school_members where user_id=auth.uid() and enabled order by school_id limit 1 $$;

create or replace function private.has_role(p_school uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role=any(p_roles)) $$;

create or replace function private.record_student_kiosk(p_student uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare n integer;
begin
 insert into private.badge_ci_scans(student_id,scans) values(p_student,1)
 on conflict(student_id) do update set scans=private.badge_ci_scans.scans+1 returning scans into n;
 return jsonb_build_object('action',case when n=1 then 'check_in' else 'duplicate_scan' end,'name',
   (select first_name||' '||last_name from public.students where id=p_student));
end $$;

-- Required pre-existing function signatures that the real migration revokes or patches.
create function public.scan_student_badge(text,uuid,timestamptz,integer) returns jsonb
language sql security definer set search_path='' as $$ select '{}'::jsonb $$;
create function public.assign_student_badge(uuid,text,text) returns void
language plpgsql security definer set search_path='' as $$ begin return; end $$;
create function public.student_portal_overview(p_session text) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare s public.students; token text;
begin
 select * into s from public.students where id=p_session::uuid;
 if s.id is null then return null; end if;
 select 'AOSQ1.'||token from private.student_badge_credentials where student_id=s.id into token;
 return jsonb_build_object('badge_qr',token);
end $$;
create function public.student_kiosk_scan(p_code text,p_pin text) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare s public.students;
begin
 select * into s from public.students where atechos_id=p_code and active and portal_enabled and school_status='active' limit 1;
 if s.id is null then return jsonb_build_object('error','invalid_credentials');end if;
 return private.record_student_kiosk(s.id);
end $$;
create function public.student_kiosk_badge(p_qr text) returns jsonb
language sql security definer set search_path='' as $$ select '{}'::jsonb $$;
