-- Optional hero image for a campaign — shown on the public page and business detail view.
alter table campaigns add column if not exists cover_url text;
