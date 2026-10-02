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
create function public.student_kiosk_badge(p_qr text) returns jsonb
language sql security definer set search_path='' as $$ select '{}'::jsonb $$;
