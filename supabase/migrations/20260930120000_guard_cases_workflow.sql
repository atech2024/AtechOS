create table if not exists public.guard_cases(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id),
  kind text not null check (kind in ('absence','lateness')),
  event_date date not null,
  status text not null default 'awaiting_reason' check (status in ('awaiting_reason','review','meeting','overdue','resolved')),
  reason text, reason_by uuid, reason_source text, reason_at timestamptz,
  reason_due timestamptz not null, meeting_due timestamptz, reviewed_by uuid, reviewed_at timestamptz,
  staff_note text, created_at timestamptz not null default now(),
  unique(student_id,kind,event_date)
);
alter table public.guard_cases enable row level security;
revoke all on public.guard_cases from public, anon, authenticated;
create or replace function private.guard_can_read(p_student uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.students s where s.id=p_student and (
private.has_role(s.school_id,array['school_admin','director','secretary','surveillant']) or exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id where sp.student_id=s.id and p.user_id=auth.uid())
)) $$;
create or replace function public.submit_guard_reason(p_case uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$ declare sid uuid; st uuid; begin
if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
select school_id,student_id into sid,st from public.guard_cases where id=p_case for update;
if sid is null or not private.guard_can_read(st) then raise exception 'not_authorized'; end if;
update public.guard_cases set reason=trim(p_reason),reason_by=auth.uid(),reason_source='family_portal',reason_at=now(),status='review' where id=p_case and status in ('awaiting_reason','overdue');
end $$;
revoke all on function public.submit_guard_reason(uuid,text) from public,anon;
grant execute on function public.submit_guard_reason(uuid,text) to authenticated;
create or replace function public.review_guard_case(p_case uuid,p_accept boolean,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$ declare sid uuid; begin
select school_id into sid from public.guard_cases where id=p_case for update;
if sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized'; end if;
update public.guard_cases set status=case when p_accept then 'resolved' else 'meeting' end,reviewed_by=auth.uid(),reviewed_at=now(),staff_note=nullif(trim(p_note),'') where id=p_case and status in ('review','overdue');
end $$;
revoke all on function public.review_guard_case(uuid,boolean,text) from public,anon;
grant execute on function public.review_guard_case(uuid,boolean,text) to authenticated;
create or replace function private.mark_missing_attendance(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $$ declare n integer:=0; begin
update public.attendance a set status='absent' where a.attendance_date=(p_now at time zone 'America/Port-au-Prince')::date
and a.status is distinct from 'present' and a.status is distinct from 'late' and a.check_in_at is null;
get diagnostics n=row_count; return n; end $$;