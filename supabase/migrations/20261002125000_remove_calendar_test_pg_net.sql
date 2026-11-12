-- The final calendar sync runs in a Supabase Edge Function. pg_net was only
-- enabled for connectivity diagnostics and has no application or cron users.
drop extension if exists pg_net;
