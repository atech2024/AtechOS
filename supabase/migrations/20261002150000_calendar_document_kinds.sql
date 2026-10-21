-- Distinguish school-year calendars from official exam-period schedules.
-- Existing entries remain school_calendar until discovery labels them otherwise.
alter table public.official_calendar_sources
  add column if not exists document_kind text not null default 'school_calendar';

alter table public.official_calendar_sources
  drop constraint if exists official_calendar_sources_document_kind_check;

alter table public.official_calendar_sources
  add constraint official_calendar_sources_document_kind_check
  check (document_kind in ('school_calendar','exam_calendar'));

alter table public.official_calendar_sources
  drop constraint if exists official_calendar_sources_source_check;

alter table public.official_calendar_sources
  add constraint official_calendar_sources_source_check
  check (source in ('MENFP','Haitian Government','HaitiLibre'));
