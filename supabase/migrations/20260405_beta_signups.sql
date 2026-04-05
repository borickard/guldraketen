-- Beta waitlist signups
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists beta_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  video_url  text,
  created_at timestamptz default now()
);

create unique index if not exists beta_signups_email_idx on beta_signups (lower(email));
