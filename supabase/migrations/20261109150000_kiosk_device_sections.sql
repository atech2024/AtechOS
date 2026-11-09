-- Keep existing Kind and school-wide devices compatible with older clients.
alter table private.kiosk_devices add column section text
 check (section in ('school','preschool','primary','fundamental','secondary'));
alter table private.kiosk_devices add constraint kiosk_section_preschool_consistent
 check (section is null or preschool_only = (section = 'preschool'));

create function private.kiosk_device_scan_result(p_school uuid,p_token text,p_student uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare device private.kiosk_devices; scope text; admin_access boolean;
begin
 if auth.uid() is null or p_school is null or p_student is null or length(coalesce(p_token,''))<>64 then return 'invalid_device'; end if;
 admin_access:=private.has_role(p_school,array['school_admin','director','secretary','surveillant','censeur']);
 if not admin_access and not private.has_role(p_school,array['preschool_coordinator']) then return 'invalid_device'; end if;
 select * into device from private.kiosk_devices
 where school_id=p_school and revoked_at is null
 and device_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if device.id is null or (not admin_access and not device.preschool_only) then return 'invalid_device'; end if;
 scope:=coalesce(device.section,case when device.preschool_only then 'preschool' else 'school' end);
 if scope<>'school' and not exists (
   select 1 from public.students s
   join public.enrollments e on e.student_id=s.id and e.school_id=p_school and e.status='active'
   join public.classes c on c.id=e.class_id and c.school_id=p_school and c.enabled
   join public.academic_years y on y.id=c.academic_year_id and y.school_id=p_school and y.is_current
   left join public.grade_levels gl on gl.id=c.grade_level_id
   where s.id=p_student and s.school_id=p_school and s.active and s.school_status='active'
   and public.grade_section(coalesce(nullif(c.grade_level,''),gl.code))=scope
 ) then return 'kiosk_wrong_section_'||scope; end if;
 update private.kiosk_devices set last_used_at=now() where id=device.id;
 return 'authorized';
end $$;
revoke all on function private.kiosk_device_scan_result(uuid,text,uuid) from public,anon,authenticated;

create or replace function private.kiosk_device_authorized(p_school uuid,p_token text,p_student uuid)
returns boolean language sql security definer set search_path=''
as $$ select private.kiosk_device_scan_result(p_school,p_token,p_student)='authorized' $$;

-- For verified QR tokens, expose the scope mismatch without identifying the student.
do $scope_patch$
declare src text; anchor text;
begin
 select pg_get_functiondef('public.student_kiosk_badge(text,text)'::regprocedure) into src;
 anchor:='if not private.kiosk_device_authorized(b.school_id,p_device_token,b.student_id) then return jsonb_build_object(''error'',''invalid_badge'');end if;';
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then raise exception 'kiosk_badge_scope_anchor_mismatch';end if;
 execute replace(src,anchor,$body$
 declare scope_result text:=private.kiosk_device_scan_result(b.school_id,p_device_token,b.student_id);
 begin
   if scope_result<>'authorized' then
     return jsonb_build_object('error',case when scope_result='invalid_device' then 'invalid_badge' else scope_result end);
   end if;
 end;
 $body$);
end
$scope_patch$;

create function public.create_section_kiosk_pairing_code(p_name text,p_section text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare pairing jsonb;
begin
 if p_section is null or p_section not in ('school','preschool','primary','fundamental','secondary') then raise exception 'invalid_kiosk_section';end if;
 pairing:=public.create_kiosk_device_pairing_code(p_name,p_section='preschool');
 update private.kiosk_devices set section=p_section
 where id=(pairing->>'id')::uuid and school_id=public.get_my_school_id();
 if not found then raise exception 'not_authorized';end if;
 return pairing||jsonb_build_object('section',p_section);
end $$;
revoke all on function public.create_section_kiosk_pairing_code(text,text) from public,anon,authenticated;
grant execute on function public.create_section_kiosk_pairing_code(text,text) to authenticated;

create or replace function public.kiosk_device_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); is_admin boolean;
begin
 is_admin:=sid is not null and private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']);
 if auth.uid() is null or sid is null or (not is_admin and not private.has_role(sid,array['preschool_coordinator'])) then raise exception 'not_authorized';end if;
 return jsonb_build_object('devices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'preschool_only',preschool_only,'section',coalesce(section,case when preschool_only then 'preschool' else 'school' end),'created_at',created_at,'paired_at',paired_at,'last_used_at',last_used_at,'revoked_at',revoked_at,'pending',device_token_hash is null and pairing_expires_at>now()) order by created_at desc) from private.kiosk_devices where school_id=sid and (is_admin or preschool_only)),'[]'::jsonb));
end $$;

