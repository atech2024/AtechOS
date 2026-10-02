-- A linked parent must still have an enabled parent membership to access GUARD.
-- This keeps revoked family accounts from reading cases or submitting reasons.
create or replace function private.guard_can_read(p_student uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.students s where s.id=p_student and (
    private.has_role(s.school_id,array['school_admin','director','secretary','surveillant'])
    or exists(
      select 1 from public.student_parents sp
      join public.parents p on p.id=sp.parent_id and p.school_id=s.school_id
      join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id
        and m.role='parent' and m.enabled
      where sp.student_id=s.id and p.user_id=auth.uid()
    )
  ))
$$;

create or replace function private.guard_notify_case()
returns trigger language plpgsql security definer set search_path=''
as $$
declare student_label text;status_label text;event text;description_text text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select s.first_name||' '||s.last_name into student_label from public.students s where s.id=new.student_id;
  status_label:=case new.status when 'awaiting_reason' then 'needs_family_reason' when 'review' then 'reason_submitted' when 'meeting' then 'meeting_required' when 'overdue' then 'deadline_passed' else 'resolved' end;
  event:='guard:'||new.id::text||':'||new.status;
  description_text:=coalesce(student_label,'Student')||' · '||new.kind||' · '||new.event_date::text;
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select new.school_id,p.user_id,'guard','GUARD · '||status_label,description_text,
    case when new.status in ('meeting','overdue') then 'high' else 'normal' end,
    '/dashboard/parent-portal',event
  from public.student_parents sp
  join public.parents p on p.id=sp.parent_id and p.school_id=new.school_id
  join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id
    and m.role='parent' and m.enabled
  where sp.student_id=new.student_id and p.user_id is not null
  on conflict(school_id,recipient_id,event_key) do nothing;
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select new.school_id,m.user_id,'guard','GUARD · '||status_label,description_text,
    case when new.status in ('meeting','overdue') then 'high' else 'normal' end,
    '/dashboard/guard','guard:'||new.id::text||':'||new.status
  from public.school_members m
  where m.school_id=new.school_id and m.enabled
    and m.role::text=any(array['school_admin','director','secretary','surveillant','censeur'])
  on conflict(school_id,recipient_id,event_key) do nothing;
  return new;
end $$;

create or replace function public.submit_guard_reason(p_case uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;st uuid;due timestamptz;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
  select school_id,student_id,reason_due into sid,st,due
  from public.guard_cases where id=p_case for update;
  if sid is null or not exists(
    select 1 from public.student_parents sp
    join public.parents p on p.id=sp.parent_id and p.school_id=sid
    join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id
      and m.role='parent' and m.enabled
    where sp.student_id=st and p.user_id=auth.uid()
  ) then raise exception 'not_authorized'; end if;
  if due is not null and now()>due then raise exception 'reason_deadline_passed'; end if;
  update public.guard_cases set reason=trim(p_reason),reason_by=auth.uid(),reason_source='family_portal',
    reason_at=now(),status='review'
  where id=p_case and status='awaiting_reason';
  if not found then raise exception 'case_not_waiting_for_reason'; end if;
end $$;
revoke all on function public.submit_guard_reason(uuid,text) from public,anon;
grant execute on function public.submit_guard_reason(uuid,text) to authenticated;
