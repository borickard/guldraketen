-- Enable RLS on tables created after the initial 20260527_enable_rls_public_tables.sql
-- migration. These were flagged by Supabase advisors as publicly accessible because
-- the anon REST role gets full CRUD until RLS is on. The app uses supabaseAdmin
-- (service role) exclusively — service role bypasses RLS, so enabling it without
-- policies does not break anything; it just locks out anonymous REST calls.

alter table public.category_suggestions enable row level security;
alter table public.category_visibility  enable row level security;
