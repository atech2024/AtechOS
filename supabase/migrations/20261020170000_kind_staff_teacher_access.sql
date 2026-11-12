-- Give school leadership and the designated Preschool coordinator the narrow
-- ability to invite and approve teachers without granting general staff access.
create or replace function private.can_manage_teacher_access(p_school uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select p_school is not null and p_user is not null and (
   exists(select 1 from public.schools s where s.id=p_school and s.owner_user_id=p_user)
   or exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=p_user and m.enabled and m.role in ('school_admin','director','censeur'))
   or exists(
     select 1 from public.preschool_program_settings ps
     join public.school_members m on m.school_id=ps.school_id and m.user_id=p_user and m.enabled
     where ps.school_id=p_school and ps.coordinator_user_id=p_user
       and m.role in ('teacher','school_admin','director','secretary')
   )
 )
$$;
revoke all on function private.can_manage_teacher_access(uuid,uuid) from public,anon,authenticated;

create function public.teacher_staff_management_access()
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and private.can_manage_teacher_access(public.get_my_school_id(),auth.uid()) $$;
revoke all on function public.teacher_staff_management_access() from public,anon;
grant execute on function public.teacher_staff_management_access() to authenticated;

-- The staff page uses this existing scoped settings RPC to list teacher requests.
create or replace function public.get_teacher_requests()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',u.full_name,'email',u.email,'status',r.status)),'[]')
 from public.teacher_join_requests r join public.users u on u.id=r.user_id
 where r.school_id=public.get_my_school_id() and r.status='pending'
   and private.can_manage_teacher_access(r.school_id,auth.uid())
$$;

create or replace function public.review_teacher_request(p_request uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare r public.teacher_join_requests;
begin
 select * into r from public.teacher_join_requests where id=p_request for update;
 if r.id is null or not private.can_manage_teacher_access(r.school_id,auth.uid()) then raise exception 'not_authorized';end if;
 if r.status<>'pending' then raise exception 'request_already_reviewed';end if;
 if p_approve is null then raise exception 'decision_required';end if;
 if p_approve then
  insert into public.school_members(school_id,user_id,role,enabled) values(r.school_id,r.user_id,'teacher',true)
  on conflict(school_id,user_id,role) do update set enabled=true;
 end if;
 update public.teacher_join_requests set status=case when p_approve then 'approved' else 'rejected' end,
  reviewed_at=now(),reviewed_by=auth.uid() where id=r.id;
end $$;

do $$
begin
 if to_regclass('public.teacher_join_requests') is not null then
  execute 'drop policy if exists join_requests_read on public.teacher_join_requests';
  execute 'create policy join_requests_read on public.teacher_join_requests for select to authenticated using(user_id=auth.uid() or (school_id=public.get_my_school_id() and public.teacher_staff_management_access()))';
 end if;
end $$;

-- Permit the four explicitly authorized actors to issue teacher invitations.
-- Other invitation types remain restricted to the existing school-admin path.
do $$
declare src text; old_guard text; director_guard text; new_guard text;
begin
 if to_regprocedure('public.create_school_invitation(text,text,public.school_role,uuid,uuid)') is not null then
  select pg_get_functiondef('public.create_school_invitation(text,text,public.school_role,uuid,uuid)'::regprocedure) into src;
  old_guard:='if not private.has_role(sid,array[''school_admin'']) then raise exception ''not_authorized''; end if;';
  director_guard:='if not (private.has_role(sid,array[''school_admin'']) or (p_role=''parent'' and private.has_role(sid,array[''director'']))) then raise exception ''not_authorized''; end if;';
  new_guard:='if p_role=''teacher'' then if not private.can_manage_teacher_access(sid,auth.uid()) then raise exception ''not_authorized''; end if; elsif not private.has_role(sid,array[''school_admin'']) and not (p_role=''parent'' and private.has_role(sid,array[''director''])) then raise exception ''not_authorized''; end if;';
  if position(old_guard in src)>0 then src:=replace(src,old_guard,new_guard);
  elsif position(director_guard in src)>0 then src:=replace(src,director_guard,new_guard);
  else raise exception 'school_invitation_authorization_anchor_missing';end if;
  execute src;
 end if;

 if to_regprocedure('public.cancel_school_invitation(uuid)') is not null then
  select pg_get_functiondef('public.cancel_school_invitation(uuid)'::regprocedure) into src;
  old_guard:='and private.has_role(school_id,array[''school_admin'']);';
  new_guard:='and ((role=''teacher'' and private.can_manage_teacher_access(school_id,auth.uid())) or (role<>''teacher'' and private.has_role(school_id,array[''school_admin''])));';
  if position(old_guard in src)=0 then raise exception 'school_invitation_cancel_authorization_anchor_missing';end if;
  execute replace(src,old_guard,new_guard);
 end if;

 if to_regprocedure('public.accept_school_invitation(text)') is not null then
  select pg_get_functiondef('public.accept_school_invitation(text)'::regprocedure) into src;
  old_guard:='if not exists(select 1 from public.schools s where s.id=i.school_id and s.owner_user_id=i.invited_by) and not exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and m.role=''school_admin'' and m.enabled) then raise exception ''invitation_invalid_or_expired''; end if;';
  director_guard:='if not exists(select 1 from public.schools s where s.id=i.school_id and s.owner_user_id=i.invited_by) and not exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and (m.role=''school_admin'' or (i.role=''parent'' and m.role=''director'')) and m.enabled) then raise exception ''invitation_invalid_or_expired''; end if;';
  new_guard:='if i.role=''teacher'' then if not private.can_manage_teacher_access(i.school_id,i.invited_by) then raise exception ''invitation_invalid_or_expired''; end if; elsif not exists(select 1 from public.schools s where s.id=i.school_id and s.owner_user_id=i.invited_by) and not exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and m.role=''school_admin'' and m.enabled) and not (i.role=''parent'' and exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and m.role=''director'' and m.enabled)) then raise exception ''invitation_invalid_or_expired''; end if;';
  if position(old_guard in src)>0 then src:=replace(src,old_guard,new_guard);
  elsif position(director_guard in src)>0 then src:=replace(src,director_guard,new_guard);
  else raise exception 'school_invitation_accept_authorization_anchor_missing';end if;
  execute src;
 end if;
end $$;

-- Coordinator reassignment belongs to school administration. A coordinator may
-- still edit other Kind preferences, but cannot appoint or replace themself.
create or replace function public.save_preschool_settings(p_coordinator uuid,p_english boolean,p_religion boolean,p_direction_signature boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); current_coordinator uuid; is_administration boolean;
begin
 if sid is null or auth.uid() is null or (not private.can_manage_preschool(sid) and not exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid())) then raise exception 'not_authorized';end if;
 select coordinator_user_id into current_coordinator from public.preschool_program_settings where school_id=sid for update;
 select exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid())
   or private.has_role(sid,array['school_admin','director']) into is_administration;
 if p_coordinator is distinct from current_coordinator and not is_administration then raise exception 'coordinator_assignment_requires_administration';end if;
 if p_coordinator is not null and not exists(select 1 from public.school_members where school_id=sid and user_id=p_coordinator and enabled and role in ('teacher','school_admin','director','secretary')) then raise exception 'staff_member_not_found';end if;
 insert into public.preschool_program_settings(school_id,coordinator_user_id,english_enabled,religion_enabled,direction_signature,updated_by,updated_at)
 values(sid,p_coordinator,p_english,p_religion,p_direction_signature,auth.uid(),now())
 on conflict(school_id) do update set coordinator_user_id=excluded.coordinator_user_id,
  english_enabled=excluded.english_enabled,religion_enabled=excluded.religion_enabled,
  direction_signature=excluded.direction_signature,updated_by=auth.uid(),updated_at=now();
end $$;

create function public.save_preschool_coordinator(p_coordinator uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if sid is null or auth.uid() is null or not (
   exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid())
   or private.has_role(sid,array['school_admin','director'])
 ) then raise exception 'not_authorized';end if;
 if p_coordinator is not null and not exists(select 1 from public.school_members where school_id=sid and user_id=p_coordinator and enabled and role in ('teacher','school_admin','director','secretary')) then raise exception 'staff_member_not_found';end if;
 insert into public.preschool_program_settings(school_id,coordinator_user_id,updated_by,updated_at)
 values(sid,p_coordinator,auth.uid(),now())
 on conflict(school_id) do update set coordinator_user_id=excluded.coordinator_user_id,updated_by=auth.uid(),updated_at=now();
end $$;

create function public.preschool_coordinator_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); current_coordinator uuid;
begin
 if sid is null or auth.uid() is null or not (
   exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid())
   or private.has_role(sid,array['school_admin','director'])
 ) then raise exception 'not_authorized';end if;
 select coordinator_user_id into current_coordinator from public.preschool_program_settings where school_id=sid;
 return jsonb_build_object('coordinator_user_id',current_coordinator);
end $$;

revoke all on function public.save_preschool_settings(uuid,boolean,boolean,boolean),public.save_preschool_coordinator(uuid),public.preschool_coordinator_workspace(),public.get_teacher_requests(),public.review_teacher_request(uuid,boolean) from public,anon;
grant execute on function public.save_preschool_settings(uuid,boolean,boolean,boolean),public.save_preschool_coordinator(uuid),public.preschool_coordinator_workspace(),public.get_teacher_requests(),public.review_teacher_request(uuid,boolean) to authenticated;
