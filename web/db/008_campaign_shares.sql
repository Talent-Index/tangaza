-- Attributed campaign share links.
--
-- A share used to be anonymous: Amina posts the campaign link, five people join, and
-- nobody can see she brought them. Each advocate — and the business itself — now gets
-- one personal link per campaign (/s/<code>). Clicks are counted in the redirect,
-- joins carry the sharer on the participant row. Word-of-mouth, measured: the
-- product's own thesis pointed at itself.
--
-- Idempotent.

create table if not exists campaign_shares (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid   not null references campaigns(id) on delete cascade,
  org_id       bigint not null references orgs(id) on delete cascade,
  sharer       text   not null,              -- lowercase wallet address
  code         text   not null unique,       -- the /s/<code> slug, short and opaque
  click_count  integer not null default 0,
  join_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (campaign_id, sharer)               -- one link per person per campaign
);

create index if not exists campaign_shares_campaign_idx
  on campaign_shares (campaign_id, join_count desc, click_count desc);

alter table campaign_participants
  add column if not exists referred_by text; -- sharer address; null = arrived direct
