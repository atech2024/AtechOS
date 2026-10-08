create table if not exists private.manual_cleanup_archive (
  cleanup_key text not null,
  school_id uuid not null,
  table_name text not null,
  row_count integer not null check (row_count >= 0),
  rows jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (cleanup_key, table_name)
);

alter table private.manual_cleanup_archive enable row level security;
revoke all on private.manual_cleanup_archive from public, anon, authenticated;

comment on table private.manual_cleanup_archive is
  'Restricted snapshots used to preserve explicitly authorized cleanup data for reversible manual test-data cleanup.';
