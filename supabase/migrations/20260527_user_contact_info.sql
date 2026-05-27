-- Add self-service contact info fields to users.
-- Users edit these via /dashboard/installningar; admin doesn't need to touch them.

alter table users
  add column if not exists contact_name  text,
  add column if not exists contact_email text;
