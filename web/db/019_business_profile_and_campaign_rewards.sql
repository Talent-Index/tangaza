-- Business profile, per-campaign rewards, referrals, and who has been rewarded.
--
-- 1. Registration asks for how to reach the business: online or physical, an address
--    (street or web link), a phone number and optional social handles. Kept on the
--    application (what was submitted) and copied to orgs on registration.
-- 2. A campaign says what it gives: the reward's form (cash, airtime, merch, discount…),
--    amount and currency, and how many approved actions one person needs to earn it.
--    "Who deserves a reward" and per-campaign liability are computed from this and the
--    approved submissions under the campaign; nothing about progress is stored.
-- 3. A referral is a campaign with kind = 'referral', created from the Referrals page.
-- 4. campaign_rewards records how many rewards a business has handed to each person,
--    so owed = earned - given.
--
-- The app also applies this lazily on first use (lib/store.ts). Idempotent.

alter table org_applications
  add column if not exists location_type    text,   -- online | physical | both
  add column if not exists address          text,   -- street address or web link
  add column if not exists social_x         text,
  add column if not exists social_tiktok    text,
  add column if not exists social_instagram text;

alter table orgs
  add column if not exists contact_email    text,
  add column if not exists contact_phone    text,
  add column if not exists location_type    text,
  add column if not exists address          text,
  add column if not exists social_x         text,
  add column if not exists social_tiktok    text,
  add column if not exists social_instagram text;

alter table campaigns
  add column if not exists kind             text not null default 'campaign',  -- campaign | referral
  add column if not exists reward_kind      text,     -- cash | airtime | merch | discount | …
  add column if not exists reward_amount    numeric,
  add column if not exists reward_currency  text,
  add column if not exists reward_note      text,     -- "a branded T-shirt", "500 KSh airtime"
  add column if not exists reward_threshold integer,  -- approved actions per person to earn one
  add column if not exists reward_repeats   boolean not null default false;  -- earn again every threshold

create table if not exists campaign_rewards (
  campaign_id  uuid        not null references campaigns(id) on delete cascade,
  org_id       bigint      not null references orgs(id) on delete cascade,
  advocate     text        not null,          -- lowercase wallet address
  given_count  integer     not null default 0 check (given_count >= 0),
  last_given_at timestamptz,
  last_given_by text,
  primary key (campaign_id, advocate)
);

create index if not exists campaign_rewards_org_idx on campaign_rewards (org_id);
