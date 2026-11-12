-- Keep a KIOS suspension limited to physical entry/exit scans.
-- Student account suspension remains the separate action that blocks portal sessions.
create or replace function private.student_sanction_restriction(p_student uuid,p_scope text)
returns text language sql stable security definer set search_path=''
as $$
  select case
    when exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='student_suspension' and x.action_started_at<=now() and x.action_until>now())
      then 'sanction_student_suspended'
    when exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='school_departure' and x.departure_decision='pending_meeting')
      then 'sanction_school_departure_pending'
    when exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='parent_meeting')
      then 'sanction_parent_meeting'
    when p_scope='kiosk' and exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='kiosk_suspension' and x.action_started_at<=now() and x.action_until>now())
      then 'sanction_kiosk_suspended'
    else null end
$$;
revoke all on function private.student_sanction_restriction(uuid,text) from public,anon,authenticated;
