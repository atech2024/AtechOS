create or replace function private.process_guard_cases(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=''
as $$
declare n integer:=0;
begin
  update public.guard_cases set status='overdue'
  where status='awaiting_reason' and reason_due < p_now;
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function private.process_guard_cases(timestamptz) from public,anon,authenticated;
do $$ begin
  if not exists(select 1 from cron.job where jobname='atechos-process-guard-cases') then
    perform cron.schedule('atechos-process-guard-cases','*/5 * * * *','select private.process_guard_cases();');
  end if;
end $$;