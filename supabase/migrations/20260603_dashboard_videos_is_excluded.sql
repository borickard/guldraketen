-- Allow dashboard users to exclude individual videos from their statistics
-- (uploaded by mistake, testing, etc.) without deleting them.
-- The video card stays in the grid (dimmed) but hero numbers and aggregations
-- skip excluded rows.

alter table dashboard_videos
  add column if not exists is_excluded boolean not null default false;
