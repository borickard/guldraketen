-- Add an admin-controlled "hidden" flag on videos.
-- Independent of is_contest — a video can be hidden without being flagged as a
-- competition (e.g. spam, off-topic) and still keep that distinction in admin.
-- Public ranking queries (topplistan, HoF, share pages, category insights,
-- konto/[handle]) exclude both is_contest-flagged-not-approved AND is_hidden.

alter table videos
  add column if not exists is_hidden boolean not null default false;

create index if not exists videos_is_hidden_idx
  on videos(is_hidden) where is_hidden = true;
