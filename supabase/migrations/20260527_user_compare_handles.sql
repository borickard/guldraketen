-- Adds compare_handles array to users for persisting the last comparison view on
-- /dashboard/jamforelse. Stores the handles of accounts the user has added to
-- their comparison (excluding their own handles, which are always present).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table users
  add column if not exists compare_handles text[] not null default '{}';
