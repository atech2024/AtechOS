create or replace function private.guard_school_day(p_school uuid,p_day date)
returns boolean language sql stable security definer set search_path=''
as $$
  select extract(isodow from p_day) between 1 and 5
    and exists(select 1 from public.academic_years y where y.school_id=p_school and y.is_current and p_day between y.start_date and y.end_date)
    and not exists(select 1 from public.school_closures c where c.school_id=p_school and c.day=p_day)
$$;

create or replace function private.guard_school_deadline(p_school uuid,p_start timestamptz,p_days integer)
returns timestamptz language plpgsql stable security definer set search_path=''
as $$
declare d date:=(p_start at time zone 'America/Port-au-Prince')::date;n integer:=0;i integer:=0;t time:=(p_start at time zone 'America/Port-au-Prince')::time;
begin
  if p_days<1 then raise exception 'invalid_school_days'; end if;
  while n<p_days and i<740 loop
    d:=d+1;i:=i+1;
    if private.guard_school_day(p_school,d) then n:=n+1; end if;
  end loop;
  if n<p_days then return null; end if;
  return (d+t) at time zone 'America/Port-au-Prince';
end $$;

alter table public.guard_cases alter column reason_due drop not null;
create or replace function private.guard_can_read(p_student uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.students s where s.id=p_student and (
    private.has_role(s.school_id,array['school_admin','director','secretary','surveillant'])
    or exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id and p.school_id=s.school_id where sp.student_id=s.id and p.user_id=auth.uid())
  ))
$$;

create or replace function private.guard_notify_case()
returns trigger language plpgsql security definer set search_path=''
as $$
declare student_label text;status_label text;event text;href text;description_text text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select s.first_name||' '||s.last_name into student_label from public.students s where s.id=new.student_id;
  status_label:=case new.status when 'awaiting_reason' then 'needs_family_reason' when 'review' then 'reason_submitted' when 'meeting' then 'meeting_required' when 'overdue' then 'deadline_passed' else 'resolved' end;
  event:='guard:'||new.id::text||':'||new.status;
  description_text:=coalesce(student_label,'Student')||' · '||new.kind||' · '||new.event_date::text;
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select new.school_id,p.user_id,'guard', 'GUARD · '||status_label,description_text,case when new.status in ('meeting','overdue') then 'high' else 'normal' end,'/dashboard/parent-portal',event
  from public.student_parents sp join public.parents p on p.id=sp.parent_id and p.school_id=new.school_id
  where sp.student_id=new.student_id and p.user_id is not null
  on conflict(school_id,recipient_id,event_key) do nothing;
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select new.school_id,m.user_id,'guard','GUARD · '||status_label,description_text,case when new.status in ('meeting','overdue') then 'high' else 'normal' end,'/dashboard/guard',event
  from public.school_members m where m.school_id=new.school_id and m.enabled and m.role::text=any(array['school_admin','director','secretary','surveillant','censeur'])
  on conflict(school_id,recipient_id,event_key) do nothing;
  return new;
end $$;
drop trigger if exists guard_case_notifications on public.guard_cases;
create trigger guard_case_notifications after insert or update of status on public.guard_cases for each row execute function private.guard_notify_case();

create or replace function public.submit_guard_reason(p_case uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;st uuid;due timestamptz;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
  select school_id,student_id,reason_due into sid,st,due from public.guard_cases where id=p_case for update;
  if sid is null or not exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id and p.school_id=sid where sp.student_id=st and p.user_id=auth.uid()) then raise exception 'not_authorized'; end if;
  if due is not null and now()>due then raise exception 'reason_deadline_passed'; end if;
  update public.guard_cases set reason=trim(p_reason),reason_by=auth.uid(),reason_source='family_portal',reason_at=now(),status='review'
  where id=p_case and status='awaiting_reason';
  if not found then raise exception 'case_not_waiting_for_reason'; end if;
end $$;
revoke all on function public.submit_guard_reason(uuid,text) from public,anon;
grant execute on function public.submit_guard_reason(uuid,text) to authenticated;

create or replace function public.review_guard_case(p_case uuid,p_accept boolean,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;
begin
  select school_id into sid from public.guard_cases where id=p_case for update;
  if sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized'; end if;
  update public.guard_cases set status=case when p_accept then 'resolved' else 'meeting' end,
    reviewed_by=auth.uid(),reviewed_at=now(),staff_note=nullif(trim(p_note),''),
    meeting_due=case when p_accept then null else private.guard_school_deadline(sid,now(),2) end
  where id=p_case and status in ('review','overdue');
  if not found then raise exception 'case_not_reviewable'; end if;
end $$;
revoke all on function public.review_guard_case(uuid,boolean,text) from public,anon;
grant execute on function public.review_guard_case(uuid,boolean,text) to authenticated;

create or replace function private.open_weekly_lateness_cases(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $$
declare d date:=(p_now at time zone 'America/Port-au-Prince')::date;week_start date:=date_trunc('week',d::timestamp)::date;n integer:=0;
begin
  insert into public.guard_cases(school_id,student_id,kind,event_date,status,reason_due)
  select a.school_id,a.student_id,'lateness',week_start,'awaiting_reason',private.guard_school_deadline(a.school_id,p_now,1)
  from public.attendance a
  where a.status='late' and a.attendance_date between week_start and d
    and private.guard_school_day(a.school_id,a.attendance_date)
  group by a.school_id,a.student_id
  having count(*)>=3
  on conflict(student_id,kind,event_date) do nothing;
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function private.open_weekly_lateness_cases(timestamptz) from public,anon,authenticated;

create or replace function private.process_guard_cases(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $$
declare n integer:=0;
begin
  update public.guard_cases set status='overdue'
  where (status='awaiting_reason' and reason_due<p_now)
     or (status='meeting' and meeting_due is not null and meeting_due<p_now);
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function private.process_guard_cases(timestamptz) from public,anon,authenticated;

create or replace function public.guard_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();staff boolean;
begin
  staff:=private.has_role(sid,array['school_admin','director','secretary','surveillant']);
  if not staff and not exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id where p.user_id=auth.uid()) then raise exception 'not_authorized'; end if;
  return jsonb_build_object('can_manage',staff,'cases',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'student',s.first_name||' '||s.last_name,'kind',g.kind,'event_date',g.event_date,'status',g.status,'reason',g.reason,'reason_due',g.reason_due,'meeting_due',g.meeting_due,'staff_note',g.staff_note) order by g.event_date desc,g.created_at desc)
    from public.guard_cases g join public.students s on s.id=g.student_id
    where (staff and g.school_id=sid) or (not staff and private.guard_can_read(g.student_id))),'[]'));
end $$;
revoke all on function public.guard_workspace() from public,anon;
grant execute on function public.guard_workspace() to authenticated;

create or replace function private.open_daily_absence_guard_cases(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $$
declare d date:=(p_now at time zone 'America/Port-au-Prince')::date;n integer:=0;
begin
  if (p_now at time zone 'America/Port-au-Prince')::time < time '09:00' then return 0; end if;
  insert into public.guard_cases(school_id,student_id,kind,event_date,status,reason_due)
  select a.school_id,a.student_id,'absence',a.attendance_date,'awaiting_reason',private.guard_school_deadline(a.school_id,p_now,1)
  from public.attendance a
  where a.attendance_date=d and a.status='absent' and private.guard_school_day(a.school_id,d)
  on conflict(student_id,kind,event_date) do nothing;
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function private.open_daily_absence_guard_cases(timestamptz) from public,anon,authenticated;
do $$ begin
  if not exists(select 1 from cron.job where jobname='atechos-daily-absence-guard-cases') then
    perform cron.schedule('atechos-daily-absence-guard-cases','*/10 * * * *','select private.open_daily_absence_guard_cases();');
  end if;
end $$;

