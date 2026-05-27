-- Enable Row Level Security on every public-schema table.
--
-- WHY: Supabase advisor flags tables in `public` without RLS as a critical
-- security issue — the anon REST role has full CRUD access until RLS is on.
-- This app talks to Supabase exclusively via `supabaseAdmin` (service-role key,
-- server-side only). The service role bypasses RLS, so enabling RLS without
-- policies does NOT break any code path. It simply locks out anyone hitting
-- the REST API with the anon key.
--
-- If client-side Supabase access is ever added later, add explicit policies
-- for the specific operations needed.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table accounts            enable row level security;
alter table app_settings        enable row level security;
alter table beta_signups        enable row level security;
alter table calculator_tests    enable row level security;
alter table dashboard_videos    enable row level security;
alter table feedback            enable row level security;
alter table follower_history    enable row level security;
alter table follower_snapshots  enable row level security;
alter table nominations         enable row level security;
alter table profile_scans       enable row level security;
alter table scrape_runs         enable row level security;
alter table user_handles        enable row level security;
alter table users               enable row level security;
alter table videos              enable row level security;

-- Sanity check after running — every row should show rowsecurity = true:
-- select schemaname, tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--  order by tablename;
