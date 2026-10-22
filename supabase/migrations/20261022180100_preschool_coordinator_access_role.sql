-- A Preschool coordinator is an additional, tenant-scoped school access role.
-- The original staff role stays active; only the coordinator-role row is replaced.

insert into public.school_members(school_id,user_id,role,enabled)
select ps.school_id,ps.coordinator_user_id,'preschool_coordinator',true
from public.preschool_program_settings ps
where ps.coordinator_user_id is not null
  and exists(
    select 1 from public.school_members m
    where m.school_id=ps.school_id and m.user_id=ps.coordinator_user_id and m.enabled
      and m.role in ('teacher','school_admin','director','secretary')
  )
on conflict(school_id,user_id,role) do update set enabled=true;

create unique index if not exists school_members_one_enabled_preschool_coordinator_per_school
 on public.school_members(school_id)
 where role='preschool_coordinator' and enabled;

create or replace function private.can_manage_preschool(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and (
  private.has_role(p_school,array['school_admin','director','secretary','censeur','preschool_coordinator'])
  or exists(
   select 1 from public.preschool_program_settings ps
   join public.school_members m on m.school_id=ps.school_id and m.user_id=auth.uid() and m.enabled
   where ps.school_id=p_school and ps.coordinator_user_id=auth.uid()
     and m.role in ('teacher','school_admin','director','secretary')
  )
 )
$$;

create or replace function private.can_manage_teacher_access(p_school uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select p_school is not null and p_user is not null and (
   exists(select 1 from public.schools s where s.id=p_school and s.owner_user_id=p_user)
   or exists(select 1 from public.school_members m where m.school_id=p_school and m.user_id=p_user and m.enabled and m.role in ('school_admin','director','censeur','preschool_coordinator'))
   or exists(
     select 1 from public.preschool_program_settings ps
     join public.school_members m on m.school_id=ps.school_id and m.user_id=p_user and m.enabled
     where ps.school_id=p_school and ps.coordinator_user_id=p_user
       and m.role in ('teacher','school_admin','director','secretary')
   )
 )
$$;
revoke all on function private.can_manage_teacher_access(uuid,uuid) from public,anon,authenticated;

create or replace function private.sync_preschool_coordinator_role(p_school uuid,p_coordinator uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_school is null then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school::text||':preschool-coordinator',0));
 if p_coordinator is not null and not exists(
   select 1 from public.school_members
   where school_id=p_school and user_id=p_coordinator and enabled
     and role in ('teacher','school_admin','director','secretary')
 ) then raise exception 'staff_member_not_found';end if;

 -- Keep exactly one active coordinator membership while preserving every
 -- unrelated membership for both the outgoing and incoming staff members.
 delete from public.school_members
 where school_id=p_school and role='preschool_coordinator'
   and (p_coordinator is null or user_id is distinct from p_coordinator);

 if p_coordinator is not null then
   insert into public.school_members(school_id,user_id,role,enabled)
   values(p_school,p_coordinator,'preschool_coordinator',true)
   on conflict(school_id,user_id,role) do update set enabled=true;
 end if;

 insert into public.preschool_program_settings(school_id,coordinator_user_id,updated_by,updated_at)
 values(p_school,p_coordinator,auth.uid(),now())
 on conflict(school_id) do update
   set coordinator_user_id=excluded.coordinator_user_id,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function private.sync_preschool_coordinator_role(uuid,uuid) from public,anon,authenticated;

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
 perform private.sync_preschool_coordinator_role(sid,p_coordinator);
 insert into public.preschool_program_settings(school_id,coordinator_user_id,english_enabled,religion_enabled,direction_signature,updated_by,updated_at)
 values(sid,p_coordinator,p_english,p_religion,p_direction_signature,auth.uid(),now())
 on conflict(school_id) do update set coordinator_user_id=excluded.coordinator_user_id,
  english_enabled=excluded.english_enabled,religion_enabled=excluded.religion_enabled,
  direction_signature=excluded.direction_signature,updated_by=auth.uid(),updated_at=now();
end $$;

create or replace function public.save_preschool_coordinator(p_coordinator uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if sid is null or auth.uid() is null or not (
   exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid())
   or private.has_role(sid,array['school_admin','director'])
 ) then raise exception 'not_authorized';end if;
 perform private.sync_preschool_coordinator_role(sid,p_coordinator);
end $$;

create function public.assign_preschool_coordinator(p_member_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); target public.school_members;
begin
 if sid is null or auth.uid() is null or not (
   exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid())
   or private.has_role(sid,array['school_admin','director'])
 ) then raise exception 'not_authorized';end if;
 select * into target from public.school_members
 where id=p_member_id and school_id=sid and enabled
   and role in ('teacher','school_admin','director','secretary')
 for update;
 if target.id is null then raise exception 'staff_member_not_found';end if;
 perform private.sync_preschool_coordinator_role(sid,target.user_id);
end $$;

create or replace function public.manage_school_member(p_member_id uuid,p_action text,p_role public.school_role default null)
returns void language plpgsql security definer set search_path='' as $$
declare m public.school_members; owner_id uuid; person public.users; parent_record public.parents;
begin
 select * into m from public.school_members where id=p_member_id for update;
 select owner_user_id into owner_id from public.schools where id=m.school_id;
 if not private.has_role(m.school_id,array['school_admin']) or auth.uid() is null then raise exception 'not_authorized'; end if;
 if m.user_id=owner_id or m.user_id=auth.uid() then raise exception 'owner_or_self_protected'; end if;
 if m.role='preschool_coordinator' or p_role='preschool_coordinator' then raise exception 'use_preschool_coordinator_assignment';end if;
 if auth.uid()<>owner_id and (m.role='school_admin' or p_role='school_admin') then raise exception 'owner_required'; end if;
 if p_action='disable' then update public.school_members set enabled=false where id=m.id;
 elsif p_action='enable' then update public.school_members set enabled=true where id=m.id;
 elsif p_action='remove' then delete from public.school_members where id=m.id;
 elsif p_action='role' and p_role is not null then
  if p_role=m.role then return; end if;
  if exists(select 1 from public.school_members where school_id=m.school_id and user_id=m.user_id and role=p_role and id<>m.id) then raise exception 'role_already_assigned'; end if;
  if p_role='student' and not exists(select 1 from public.students where school_id=m.school_id and user_id=m.user_id) then raise exception 'link_student_account_with_invitation_first'; end if;
  if p_role='parent' then
   select * into person from public.users where id=m.user_id;
   perform pg_advisory_xact_lock(hashtextextended(m.school_id::text||m.user_id::text,0));
   select * into parent_record from public.parents where school_id=m.school_id and user_id=m.user_id limit 1;
   if parent_record.id is null then
    select * into parent_record from public.parents where school_id=m.school_id and lower(email)=lower(person.email) limit 1 for update;
    if parent_record.id is not null and parent_record.user_id is not null and parent_record.user_id<>m.user_id then raise exception 'parent_record_belongs_to_another_account'; end if;
    if parent_record.id is null then insert into public.parents(school_id,user_id,full_name,email) values(m.school_id,m.user_id,person.full_name,person.email);
    else update public.parents set user_id=m.user_id where id=parent_record.id; end if;
   end if;
  end if;
  update public.school_members set role=p_role where id=m.id;
 else raise exception 'invalid_action'; end if;
end $$;
revoke all on function public.manage_school_member(uuid,text,public.school_role) from public,anon;
grant execute on function public.manage_school_member(uuid,text,public.school_role) to authenticated;

create or replace function private.reject_preschool_coordinator_invitation()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.role='preschool_coordinator' then raise exception 'coordinator_must_be_assigned_to_existing_staff';end if;
 return new;
end $$;
revoke all on function private.reject_preschool_coordinator_invitation() from public,anon,authenticated;
drop trigger if exists school_invitation_coordinator_must_be_existing_staff on public.school_invitations;
create trigger school_invitation_coordinator_must_be_existing_staff
before insert or update of role on public.school_invitations
for each row execute function private.reject_preschool_coordinator_invitation();

revoke all on function public.save_preschool_settings(uuid,boolean,boolean,boolean),public.save_preschool_coordinator(uuid),public.assign_preschool_coordinator(uuid) from public,anon;
grant execute on function public.save_preschool_settings(uuid,boolean,boolean,boolean),public.save_preschool_coordinator(uuid),public.assign_preschool_coordinator(uuid) to authenticated;
