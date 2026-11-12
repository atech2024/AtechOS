-- Use Supabase Postgres egress to check official calendar pages when Vercel
-- serverless egress cannot reach the government hosts.
create extension if not exists pg_net;
