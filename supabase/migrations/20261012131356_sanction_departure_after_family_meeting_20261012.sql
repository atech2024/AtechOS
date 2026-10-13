create or replace function public.decide_student_sanction_departure(p_sanction uuid,p_decision text,p_resolution text)
returns void language plpgsql security definer set search_path=''
as $$
declare x public.student_sanctions; sid uuid; current_year uuid;
begin
  select * into x from public.student_sanctions where id=p_sanction for update;
  if x.id is null then raise exception 'sanction_not_found'; end if;
  sid:=x.school_id;
  if not private.student_followup_authority(sid) or not private.has_role(sid,array['director','school_admin']) then raise exception 'not_authorized'; end if;
  if x.action_code<>'school_departure' or x.status<>'active' or x.departure_decision<>'pending_meeting' then raise exception 'sanction_departure_not_pending'; end if;
  if x.parent_meeting_at is null then raise exception 'parent_meeting_required'; end if;
  if x.parent_meeting_at>now() then raise exception 'sanction_departure_meeting_not_held'; end if;
  if p_decision not in ('retained','departed') or length(trim(coalesce(p_resolution,''))) not between 3 and 2000 then raise exception 'invalid_departure_decision'; end if;
  if p_decision='departed' then
    select id into current_year from public.academic_years where school_id=sid and is_current;
    update public.students set school_status='departed',departure_year_id=current_year where id=x.student_id and school_id=sid;
  end if;
  update public.student_sanctions set departure_decision=p_decision,status='resolved',resolved_by=auth.uid(),resolved_at=now(),
    resolution=trim(p_resolution),departure_decided_by=auth.uid(),departure_decided_at=now()
  where id=x.id;
  perform private.student_followup_event(sid,x.student_id,'sanction',x.id,
    case when p_decision='departed' then 'school_departure_confirmed' else 'school_departure_cancelled' end,
    jsonb_build_object('decision',p_decision,'resolution',trim(p_resolution)));
end;
$$;
revoke all on function public.decide_student_sanction_departure(uuid,text,text) from public,anon;
grant execute on function public.decide_student_sanction_departure(uuid,text,text) to authenticated;
