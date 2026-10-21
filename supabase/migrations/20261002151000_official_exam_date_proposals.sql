-- Store extracted dates as unapproved references for authorized staff review.
alter table public.official_calendar_sources
  add column if not exists suggested_dates jsonb not null default '[]'::jsonb;

alter table public.official_calendar_sources
  drop constraint if exists official_calendar_sources_suggested_dates_array_check;

alter table public.official_calendar_sources
  add constraint official_calendar_sources_suggested_dates_array_check
  check (jsonb_typeof(suggested_dates) = 'array');
