-- Require both an authorized school staff session and an enrolled KIOS browser for attendance writes.
create table private.kiosk_devices (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 80),
 pairing_code_hash text unique,
 pairing_expires_at timestamptz,
 device_token_hash text unique,
 created_by uuid references public.users(id),
 created_at timestamptz not null default now(),
 paired_by uuid references public.users(id),
 paired_at timestamptz,
 last_used_at timestamptz,
 revoked_at timestamptz,
 check ((device_token_hash is null) = (paired_at is null))
);
alter table private.kiosk_devices enable row level security;
revoke all on private.kiosk_devices from public,anon,authenticated;

create function public.create_kiosk_device_pairing_code(p_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); code text; device_id uuid; expiry timestamptz:=now()+interval '10 minutes';
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_name,'')))<2 or length(p_name)>80 then raise exception 'invalid_kiosk_device_name';end if;
 code:=encode(extensions.gen_random_bytes(16),'hex');
 insert into private.kiosk_devices(school_id,name,pairing_code_hash,pairing_expires_at,created_by)
 values(sid,trim(p_name),encode(extensions.digest(code,'sha256'),'hex'),expiry,auth.uid()) returning id into device_id;
 return jsonb_build_object('id',device_id,'name',trim(p_name),'pairing_code',code,'expires_at',expiry);
end $$;

create function public.pair_kiosk_device(p_pairing_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare device_row private.kiosk_devices; token text;
begin
 if auth.uid() is null or length(coalesce(p_pairing_code,''))<>32 then raise exception 'invalid_kiosk_pairing_code';end if;
 select * into device_row from private.kiosk_devices
 where pairing_code_hash=encode(extensions.digest(p_pairing_code,'sha256'),'hex')
 and device_token_hash is null and revoked_at is null and pairing_expires_at>now()
 for update;
 if device_row.id is null or not private.has_role(device_row.school_id,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'invalid_kiosk_pairing_code';end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update private.kiosk_devices set device_token_hash=encode(extensions.digest(token,'sha256'),'hex'),
  pairing_code_hash=null,pairing_expires_at=null,paired_by=auth.uid(),paired_at=now()
 where id=device_row.id;
 return jsonb_build_object('token',token,'device_id',device_row.id,'name',device_row.name);
end $$;

create function public.kiosk_device_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 return jsonb_build_object('devices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'created_at',created_at,'paired_at',paired_at,'last_used_at',last_used_at,'revoked_at',revoked_at,'pending',device_token_hash is null and pairing_expires_at>now()) order by created_at desc) from private.kiosk_devices where school_id=sid),'[]'::jsonb));
end $$;

create function public.revoke_kiosk_device(p_device_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 update private.kiosk_devices set revoked_at=coalesce(revoked_at,now()),pairing_code_hash=null,pairing_expires_at=null
 where id=p_device_id and school_id=sid;
 if not found then raise exception 'not_authorized';end if;
end $$;

create function private.kiosk_device_authorized(p_school uuid,p_token text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare matched uuid;
begin
 if auth.uid() is null or length(coalesce(p_token,''))<>64 or not private.has_role(p_school,array['school_admin','director','secretary','surveillant','censeur','preschool_coordinator']) then return false;end if;
 update private.kiosk_devices set last_used_at=now()
 where school_id=p_school and revoked_at is null and device_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 returning id into matched;
 return matched is not null;
end $$;

-- Add a device token to the existing student-ID/PIN scan RPC without changing its attendance or lockout logic.
do $kiosk_scan_patch$
declare src text; signature text; anchor text; replacement text;
begin
 select pg_get_functiondef('public.student_kiosk_scan(text,text)'::regprocedure) into src;
 signature:='public.student_kiosk_scan(p_code text, p_pin text)';
 if position(signature in src)=0 then raise exception 'kiosk_scan_signature_anchor_missing';end if;
 src:=replace(src,signature,'public.student_kiosk_scan(p_code text, p_pin text, p_device_token text)');
 anchor:='if s.id is null then return jsonb_build_object(''error'',''invalid_credentials''); end if;';
 if position(anchor in src)=0 then anchor:='if s.id is null then return jsonb_build_object(''error'',''invalid_credentials'');end if;';end if;
 if position(anchor in src)=0 then raise exception 'kiosk_scan_student_anchor_missing';end if;
 replacement:=anchor||' if not private.kiosk_device_authorized(s.school_id,p_device_token) then return jsonb_build_object(''error'',''invalid_credentials'');end if;';
 src:=replace(src,anchor,replacement);
 execute src;
end
$kiosk_scan_patch$;

-- The old one-argument badge API is deliberately disabled; the new overload requires an enrolled device token.
do $kiosk_badge_patch$
declare src text; signature text; anchor text; replacement text;
begin
 select pg_get_functiondef('public.student_kiosk_badge(text)'::regprocedure) into src;
 signature:='public.student_kiosk_badge(p_qr text)';
 if position(signature in src)=0 then raise exception 'kiosk_badge_signature_anchor_missing';end if;
 src:=replace(src,signature,'public.student_kiosk_badge(p_qr text, p_device_token text)');
 anchor:='if b.id is null then return jsonb_build_object(''error'',''invalid_badge''); end if;';
 if position(anchor in src)=0 then anchor:='if b.id is null then return jsonb_build_object(''error'',''invalid_badge'');end if;';end if;
 if position(anchor in src)=0 then raise exception 'kiosk_badge_student_anchor_missing';end if;
 replacement:=anchor||' if not private.kiosk_device_authorized(b.school_id,p_device_token) then return jsonb_build_object(''error'',''invalid_badge'');end if;';
 src:=replace(src,anchor,replacement);
 execute src;
end
$kiosk_badge_patch$;

revoke all on function private.kiosk_device_authorized(uuid,text) from public,anon,authenticated;
revoke all on function public.create_kiosk_device_pairing_code(text),public.pair_kiosk_device(text),public.kiosk_device_workspace(),public.revoke_kiosk_device(uuid) from public,anon;
grant execute on function public.create_kiosk_device_pairing_code(text),public.pair_kiosk_device(text),public.kiosk_device_workspace(),public.revoke_kiosk_device(uuid) to authenticated;
revoke all on function public.student_kiosk_scan(text,text),public.student_kiosk_badge(text) from public,anon,authenticated;
revoke all on function public.student_kiosk_scan(text,text,text),public.student_kiosk_badge(text,text) from public,anon,authenticated;
grant execute on function public.student_kiosk_scan(text,text,text),public.student_kiosk_badge(text,text) to authenticated;
