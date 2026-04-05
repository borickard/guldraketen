-- Scrape run logging
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists scrape_runs (
  id           uuid primary key default gen_random_uuid(),
  run_id       text,
  triggered_by text not null default 'unknown',
  days_back    integer,
  handles      integer,
  status       text not null default 'started',
  error        text,
  upserted     integer,
  skipped      integer,
  followers    integer,
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);
