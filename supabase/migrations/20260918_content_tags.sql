-- Content tagging for dashboard users: tag their own videos with campaigns,
-- formats, themes (and custom types), then filter/compare by tag.
-- Run in Supabase Studio → SQL Editor.

create table if not exists content_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  type       text not null,          -- 'Kampanj' | 'Format' | 'Tema' | custom
  color      text,                   -- optional chip color (hex)
  created_at timestamptz not null default now()
);
-- One tag name per type per user (case-insensitive).
create unique index if not exists content_tags_uni
  on content_tags (user_id, lower(name), lower(type));

-- Many-to-many: keyed on video_url so a tag survives re-scrapes (which upsert
-- on video_url) and applies regardless of which video table the row lives in.
create table if not exists video_tag_map (
  video_url  text not null,
  tag_id     uuid not null references content_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_url, tag_id)
);
create index if not exists video_tag_map_tag_idx on video_tag_map (tag_id);

-- App uses the service role (bypasses RLS); enable it so the anon REST role
-- can't read/write these tables.
alter table content_tags  enable row level security;
alter table video_tag_map enable row level security;
