-- Academic reviewer is distinct from attendance supervisor.
-- Commit the enum addition before using it in later workflow migrations.
alter type public.school_role add value if not exists 'censeur';
