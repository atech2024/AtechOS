create or replace function private.open_weekly_lateness_cases(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $$
declare d date:=(p_now at time zone 'America/Port-au-Prince')::date; n integer:=0;
begin
  insert into public.guard_cases(school_id,student_id,kind,event_date,status,reason_due)
  select a.school_id,a.student_id,'lateness',d,'awaiting_reason',p_now+interval '24 hours'
  from public.attendance a
  where a.status='late'
    and a.attendance_date between date_trunc('week',d::timestamp)::date and d
  group by a.school_id,a.student_id
  having count(*)>=3
  on conflict(student_id,kind,event_date) do nothing;
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function private.open_weekly_lateness_cases(timestamptz) from public,anon,authenticated;
do $$ begin
  if not exists(select 1 from cron.job where jobname='atechos-weekly-lateness-guard') then
    perform cron.schedule('atechos-weekly-lateness-guard','*/10 * * * *','select private.open_weekly_lateness_cases();');
  end if;
end $$;