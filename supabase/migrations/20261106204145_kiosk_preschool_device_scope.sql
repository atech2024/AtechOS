-- Scope coordinator-managed kiosk devices to active Preschool / Kind students.
alter table private.kiosk_devices
 add column if not exists preschool_only boolean not null default false;

create or replace function private.kiosk_student_is_preschool(p_school uuid,p_student uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1
  from public.students s
  join public.enrollments e on e.student_id=s.id and e.school_id=p_school and e.status='active'
  join public.classes c on c.id=e.class_id and c.school_id=p_school and c.enabled
  join public.academic_years ay on ay.id=c.academic_year_id and ay.school_id=p_school and ay.is_current
  left join public.grade_levels gl on gl.id=c.grade_level_id
  where s.id=p_student and s.school_id=p_school and s.active and s.school_status='active'
    and public.grade_section(coalesce(nullif(c.grade_level,''),gl.code))='preschool'
 );
$$;

revoke all on function private.kiosk_student_is_preschool(uuid,uuid) from public,anon,authenticated;

create or replace function private.kiosk_device_authorized(p_school uuid,p_token text,p_student uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare device_id uuid; device_is_preschool boolean;
 admin_access boolean;
begin
 if auth.uid() is null or p_school is null or p_student is null or length(coalesce(p_token,''))<>64 then return false;end if;
 admin_access:=private.has_role(p_school,array['school_admin','director','secretary','surveillant','censeur']);
 if not admin_access and not private.has_role(p_school,array['preschool_coordinator']) then return false;end if;
 select id,preschool_only into device_id,device_is_preschool
 from private.kiosk_devices
 where school_id=p_school and revoked_at is null
   and device_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 for update;
 if device_id is null then return false;end if;
 if device_is_preschool then
  if not private.kiosk_student_is_preschool(p_school,p_student) then return false;end if;
 elsif not admin_access then
  return false;
 end if;
 update private.kiosk_devices set last_used_at=now() where id=device_id and revoked_at is null;
 return found;
end
$$;

revoke all on function private.kiosk_device_authorized(uuid,text) from public,anon,authenticated;
revoke all on function private.kiosk_device_authorized(uuid,text,uuid) from public,anon,authenticated;

-- Keep the legacy attendance rules intact while making the device authorization student-aware.
do $kiosk_scope_scan_patch$
declare src text; anchor text;
begin
 select pg_get_functiondef('public.student_kiosk_scan(text,text,text)'::regprocedure) into src;
 anchor:='private.kiosk_device_authorized(s.school_id,p_device_token)';
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then raise exception 'kiosk_scope_scan_anchor_mismatch';end if;
 src:=replace(src,anchor,'private.kiosk_device_authorized(s.school_id,p_device_token,s.id)');
 execute src;

 select pg_get_functiondef('public.student_kiosk_badge(text,text)'::regprocedure) into src;
 anchor:='private.kiosk_device_authorized(b.school_id,p_device_token)';
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then raise exception 'kiosk_scope_badge_anchor_mismatch';end if;
 src:=replace(src,anchor,'private.kiosk_device_authorized(b.school_id,p_device_token,b.student_id)');
 execute src;
end
$kiosk_scope_scan_patch$;

-- The one-argument overload would make PostgREST calls ambiguous with the new defaulted scope argument.
drop function public.create_kiosk_device_pairing_code(text);
create function public.create_kiosk_device_pairing_code(p_name text,p_preschool_only boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); code text; device_id uuid; expiry timestamptz:=now()+interval '10 minutes';
 is_admin boolean; is_coordinator boolean;
begin
 is_admin:=sid is not null and private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']);
 is_coordinator:=sid is not null and private.has_role(sid,array['preschool_coordinator']);
 if auth.uid() is null or sid is null or (not is_admin and (not is_coordinator or not coalesce(p_preschool_only,false))) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_name,'')))<2 or length(p_name)>80 then raise exception 'invalid_kiosk_device_name';end if;
 code:=encode(extensions.gen_random_bytes(16),'hex');
 insert into private.kiosk_devices(school_id,name,preschool_only,pairing_code_hash,pairing_expires_at,created_by)
 values(sid,trim(p_name),coalesce(p_preschool_only,false),encode(extensions.digest(code,'sha256'),'hex'),expiry,auth.uid()) returning id into device_id;
 return jsonb_build_object('id',device_id,'name',trim(p_name),'preschool_only',coalesce(p_preschool_only,false),'pairing_code',code,'expires_at',expiry);
end $$;

create or replace function public.pair_kiosk_device(p_pairing_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare device_row private.kiosk_devices; token text; is_admin boolean;
begin
 if auth.uid() is null or length(coalesce(p_pairing_code,''))<>32 then raise exception 'invalid_kiosk_pairing_code';end if;
 select * into device_row from private.kiosk_devices
 where pairing_code_hash=encode(extensions.digest(p_pairing_code,'sha256'),'hex')
 and device_token_hash is null and revoked_at is null and pairing_expires_at>now()
 for update;
 is_admin:=device_row.id is not null and private.has_role(device_row.school_id,array['school_admin','director','secretary','surveillant','censeur']);
 if device_row.id is null or (not is_admin and (not device_row.preschool_only or not private.has_role(device_row.school_id,array['preschool_coordinator']))) then raise exception 'invalid_kiosk_pairing_code';end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update private.kiosk_devices set device_token_hash=encode(extensions.digest(token,'sha256'),'hex'),
  pairing_code_hash=null,pairing_expires_at=null,paired_by=auth.uid(),paired_at=now()
 where id=device_row.id;
 return jsonb_build_object('token',token,'device_id',device_row.id,'name',device_row.name,'preschool_only',device_row.preschool_only);
end $$;

create or replace function public.kiosk_device_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); is_admin boolean;
begin
 is_admin:=sid is not null and private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']);
 if auth.uid() is null or sid is null or (not is_admin and not private.has_role(sid,array['preschool_coordinator'])) then raise exception 'not_authorized';end if;
 return jsonb_build_object('devices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'preschool_only',preschool_only,'created_at',created_at,'paired_at',paired_at,'last_used_at',last_used_at,'revoked_at',revoked_at,'pending',device_token_hash is null and pairing_expires_at>now()) order by created_at desc) from private.kiosk_devices where school_id=sid and (is_admin or preschool_only)),'[]'::jsonb));
end $$;

create or replace function public.revoke_kiosk_device(p_device_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); is_admin boolean;
begin
 is_admin:=sid is not null and private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']);
 if auth.uid() is null or sid is null or (not is_admin and not private.has_role(sid,array['preschool_coordinator'])) then raise exception 'not_authorized';end if;
 update private.kiosk_devices set revoked_at=coalesce(revoked_at,now()),pairing_code_hash=null,pairing_expires_at=null
 where id=p_device_id and school_id=sid and (is_admin or preschool_only);
 if not found then raise exception 'not_authorized';end if;
end $$;

create or replace function public.school_kiosk_schedule_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); schedule_row public.school_kiosk_schedules; protocol_row public.school_release_protocols; today date:=(now() at time zone 'America/Port-au-Prince')::date;
 is_admin boolean; can_manage_preschool boolean;
begin
 is_admin:=sid is not null and private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']);
 can_manage_preschool:=is_admin or (sid is not null and private.has_role(sid,array['preschool_coordinator']));
 if auth.uid() is null or sid is null or not can_manage_preschool then raise exception 'not_authorized';end if;
 select * into schedule_row from public.school_kiosk_schedules where school_id=sid;
 if is_admin then select * into protocol_row from public.school_release_protocols where school_id=sid and protocol_date=today;end if;
 return jsonb_build_object(
  'date',today,
  'can_manage',is_admin,
  'can_manage_preschool',can_manage_preschool,
  'schedule',case when is_admin then jsonb_build_object(
   'entry_opens_at',coalesce(schedule_row.entry_opens_at,time '05:00'),'entry_ends_at',coalesce(schedule_row.entry_ends_at,time '07:45'),'late_ends_at',coalesce(schedule_row.late_ends_at,time '08:00'),'checkout_starts_at',coalesce(schedule_row.checkout_starts_at,time '13:00'),'checkout_ends_at',coalesce(schedule_row.checkout_ends_at,time '23:59'),
   'preschool_entry_opens_at',coalesce(schedule_row.preschool_entry_opens_at,time '05:00'),'preschool_entry_ends_at',coalesce(schedule_row.preschool_entry_ends_at,time '07:45'),'preschool_late_ends_at',coalesce(schedule_row.preschool_late_ends_at,time '08:00'),'preschool_checkout_starts_at',coalesce(schedule_row.preschool_checkout_starts_at,time '13:00'),'preschool_checkout_ends_at',coalesce(schedule_row.preschool_checkout_ends_at,time '23:59'))
  else jsonb_build_object('preschool_entry_opens_at',coalesce(schedule_row.preschool_entry_opens_at,time '05:00'),'preschool_entry_ends_at',coalesce(schedule_row.preschool_entry_ends_at,time '07:45'),'preschool_late_ends_at',coalesce(schedule_row.preschool_late_ends_at,time '08:00'),'preschool_checkout_starts_at',coalesce(schedule_row.preschool_checkout_starts_at,time '13:00'),'preschool_checkout_ends_at',coalesce(schedule_row.preschool_checkout_ends_at,time '23:59')) end,
  'today_release',case when protocol_row.id is null then null else jsonb_build_object('id',protocol_row.id,'release_at',protocol_row.release_at,'reason',protocol_row.reason,'activated_by',protocol_row.activated_name,'activated_role',protocol_row.activated_role,'activated_at',protocol_row.activated_at) end,
  'can_set_today_release',private.has_role(sid,array['school_admin','director','secretary']));
end $$;

create or replace function public.save_preschool_kiosk_schedule(
 p_entry_opens_at time,p_entry_ends_at time,p_late_ends_at time,p_checkout_starts_at time,p_checkout_ends_at time
)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur','preschool_coordinator']) then raise exception 'not_authorized';end if;
 if p_entry_opens_at is null or p_entry_ends_at is null or p_late_ends_at is null or p_checkout_starts_at is null or p_checkout_ends_at is null
  or p_entry_opens_at>=p_entry_ends_at or p_entry_ends_at>=p_late_ends_at or p_late_ends_at>=p_checkout_starts_at or p_checkout_starts_at>=p_checkout_ends_at then raise exception 'invalid_kiosk_schedule';end if;
 insert into public.school_kiosk_schedules(school_id,preschool_entry_opens_at,preschool_entry_ends_at,preschool_late_ends_at,preschool_checkout_starts_at,preschool_checkout_ends_at,updated_by,updated_at)
 values(sid,p_entry_opens_at,p_entry_ends_at,p_late_ends_at,p_checkout_starts_at,p_checkout_ends_at,auth.uid(),now())
 on conflict(school_id) do update set preschool_entry_opens_at=excluded.preschool_entry_opens_at,preschool_entry_ends_at=excluded.preschool_entry_ends_at,preschool_late_ends_at=excluded.preschool_late_ends_at,preschool_checkout_starts_at=excluded.preschool_checkout_starts_at,preschool_checkout_ends_at=excluded.preschool_checkout_ends_at,updated_by=auth.uid(),updated_at=now();
end $$;

revoke all on function public.create_kiosk_device_pairing_code(text,boolean),public.pair_kiosk_device(text),public.kiosk_device_workspace(),public.revoke_kiosk_device(uuid),public.school_kiosk_schedule_workspace(),public.save_preschool_kiosk_schedule(time,time,time,time,time) from public,anon;
grant execute on function public.create_kiosk_device_pairing_code(text,boolean),public.pair_kiosk_device(text),public.kiosk_device_workspace(),public.revoke_kiosk_device(uuid),public.school_kiosk_schedule_workspace(),public.save_preschool_kiosk_schedule(time,time,time,time,time) to authenticated;
