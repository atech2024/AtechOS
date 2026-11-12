-- Keep newly published official school-calendar documents visible to school staff.
-- Discovery is global because the Ministry publishes one national calendar; dates
-- are never copied into school_closures by this process.
create table if not exists public.official_calendar_sources (
  url text primary key,
  source text not null check(source in ('MENFP','Haitian Government')),
  label text not null,
  school_year text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.official_calendar_sources enable row level security;
revoke all on public.official_calendar_sources from public,anon,authenticated;
grant select on public.official_calendar_sources to authenticated;
create policy official_calendar_sources_read on public.official_calendar_sources
 for select to authenticated using (true);
