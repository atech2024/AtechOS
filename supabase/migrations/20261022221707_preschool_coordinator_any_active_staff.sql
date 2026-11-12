-- Keep access synchronized through the existing assignment RPCs. This migration
-- updates eligibility checks only; it does not backfill or rewrite memberships.

create or replace function private.sync_preschool_coordinator_role(p_school uuid,p_coordinator uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_school is null then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school::text||':preschool-coordinator',0));
 if p_coordinator is not null and not exists(
   select 1 from public.school_members
   where school_id=p_school and user_id=p_coordinator and enabled
     and role in ('school_admin','director','censeur','secretary','surveillant','teacher','accountant')
 ) then raise exception 'staff_member_not_found';end if;

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

create or replace function public.assign_preschool_coordinator(p_member_id uuid)
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
   and role in ('school_admin','director','censeur','secretary','surveillant','teacher','accountant')
 for update;
 if target.id is null then raise exception 'staff_member_not_found';end if;
 perform private.sync_preschool_coordinator_role(sid,target.user_id);
end $$;

revoke all on function public.assign_preschool_coordinator(uuid) from public,anon;
grant execute on function public.assign_preschool_coordinator(uuid) to authenticated;
