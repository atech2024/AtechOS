-- The GUARD page exposes a reschedule action for an existing meeting.
-- Allow that action through the same guarded RPC; the function already
-- replaces the meeting deadline when p_accept is false.
create or replace function public.review_guard_case(p_case uuid,p_accept boolean,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;st uuid;old_status text;old_meeting_due timestamptz;
begin
  select school_id,student_id,status,meeting_due into sid,st,old_status,old_meeting_due from public.guard_cases where id=p_case for update;
  if sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized'; end if;
  update public.guard_cases set status=case when p_accept then 'resolved' else 'meeting' end,
    reviewed_by=auth.uid(),reviewed_at=now(),staff_note=nullif(trim(p_note),''),
    meeting_due=case when p_accept then null else private.guard_school_deadline(sid,
      case when old_status='meeting' and old_meeting_due is not null then greatest(now(),old_meeting_due) else now() end,2) end
  where id=p_case and status in ('review','overdue','meeting');
  if not found then raise exception 'case_not_reviewable'; end if;

  if p_accept and not exists(select 1 from public.guard_cases
      where student_id=st and status in ('meeting','overdue') and meeting_due is not null) then
    update public.students set portal_enabled=true
      where id=st and active and school_status='active'
        and exists(select 1 from public.guard_cases where student_id=st and portal_disabled_by_guard);
    delete from private.student_sessions where student_id=st;
    update public.guard_cases set portal_disabled_by_guard=false
      where student_id=st and portal_disabled_by_guard;
  end if;
end $$;
revoke all on function public.review_guard_case(uuid,boolean,text) from public,anon;
grant execute on function public.review_guard_case(uuid,boolean,text) to authenticated;
