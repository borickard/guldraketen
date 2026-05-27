-- Rename "Fordon" → "Fordon & transport" in existing data,
-- and add a category visibility overlay so the admin can hide a category from
-- the public /kategorier list without deleting historical assignments.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

update accounts
   set category = 'Fordon & transport'
 where category = 'Fordon';

create table if not exists category_visibility (
  name       text primary key,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Hide the removed category from the public list. The column on accounts
-- stays as-is so the admin can still see and re-categorize affected rows.
insert into category_visibility (name, is_visible)
values ('Politik & intresseorganisationer', false)
on conflict (name) do nothing;
