-- Public category suggestions submitted via /kategorier/[slug] pages.
-- Reviewers (Rickard) read these manually in Supabase studio and act on them
-- by adding the suggested account through the admin UI.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists category_suggestions (
  id                  uuid primary key default gen_random_uuid(),
  handle              text not null,
  display_name        text not null,
  suggested_category  text not null,
  email               text,
  motivation          text,
  created_at          timestamptz default now()
);

create unique index if not exists category_suggestions_handle_category_idx
  on category_suggestions (lower(handle), suggested_category);
