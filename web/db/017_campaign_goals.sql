-- Campaign goals: what a business wants to ACHIEVE with a campaign, and what it is pushing.
--
-- All optional. A campaign with none of these set behaves exactly as before.
-- Progress is never stored: it is the count of APPROVED submissions under the campaign
-- (submissions.campaign_id, status = 'approved'), computed on read. Tangaza does not
-- measure sales or revenue — goal_label names what is being counted ("sign-ups",
-- "bookings", "posts"); the deadline reuses campaigns.ends_at.
--
-- The app also applies this lazily on first use (lib/store.ts), so a missing manual
-- migration degrades to "no goals" rather than an error. Idempotent.

alter table campaigns
  add column if not exists goal_type   text,     -- launch | event | community | bookings | awareness | other
  add column if not exists goal_target integer,  -- how many approved actions the business is aiming for
  add column if not exists goal_label  text,     -- what is counted, e.g. 'sign-ups'
  add column if not exists offer_name  text,     -- the product / event / thing being pushed
  add column if not exists offer_url   text;     -- where people can see or get it
