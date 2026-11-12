-- HaitiLibre is a secondary host for copies of MENFP documents. Keep that
-- provenance explicit so the UI never presents a mirror as a ministry origin.
alter table public.official_calendar_sources
  drop constraint if exists official_calendar_sources_source_check;
alter table public.official_calendar_sources
  add constraint official_calendar_sources_source_check
  check (source in ('MENFP','Haitian Government','HaitiLibre'));
