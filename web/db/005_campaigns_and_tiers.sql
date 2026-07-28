-- Registration, the pledge, levels, and campaigns.
--
-- The shape of the product this adds up to:
--
--   a business applies and signs a pledge of what it will give back
--     -> the platform registers it on-chain with a capped budget
--     -> it defines levels people climb toward
--     -> it runs campaigns and shares the link
--     -> people join, take part, and sign for what they did
--
-- Registration is an application rather than a button because `registerOrg` is
-- `onlyOwner` on the contract. That is not an oversight to route around: registering
-- an org mints the right to issue reward liabilities, and handing that to anyone with
-- a wallet would make the emission cap meaningless as a guarantee. So a business
-- applies here, and the platform makes the on-chain call.
--
-- Idempotent.

/* --------------------------------------------------------------- registration */

do $$ begin
  create type application_status as enum (
    'draft',       -- being filled in
    'signed',      -- pledge signed by the business's wallet; awaiting the platform
    'registered',  -- registerOrg landed on-chain; org_id is set
    'rejected'
  );
exception when duplicate_object then null; end $$;

create table if not exists org_applications (
  id                uuid               primary key default gen_random_uuid(),
  name              text               not null,
  contact_email     text,
  contact_phone     text,

  -- The smart account that will click Approve. Becomes the org's on-chain approver,
  -- so getting it wrong means every approval reverts NotApprover.
  approver_address  text               not null,
  emission_cap_kes  bigint             not null check (emission_cap_kes > 0),

  -- What the business promises the community. Signed, because a pledge nobody put
  -- their name to is marketing; a pledge signed by the wallet that funds the budget
  -- is a commitment you can hold them to.
  pledge            text               not null,
  signature         text,
  signed_message    text,
  signed_at         timestamptz,

  status            application_status not null default 'draft',
  org_id            bigint             references orgs(id),
  registered_tx     text,
  rejection_reason  text,
  created_at        timestamptz        not null default now(),
  updated_at        timestamptz        not null default now()
);

create index if not exists org_applications_status_idx
  on org_applications (status, created_at desc);

/* ---------------------------------------------------------------- the perks */

-- Levels people climb. The contract knows one threshold — 20 activities mints a KES
-- 500 credit — and that is the money. These are the *recognition* on top: what the
-- house gives you for being a regular. Deliberately off-chain, because a business
-- changing its perks must never be able to touch the solvency rules.
create table if not exists reward_tiers (
  id               uuid        primary key default gen_random_uuid(),
  org_id           bigint      not null references orgs(id) on delete cascade,
  level            smallint    not null check (level > 0),
  name             text        not null,
  perk             text        not null,
  icon             text        not null default '★',
  -- Approved weight needed to reach this level. Same unit the leaderboard ranks by,
  -- so "you are 3 away" is a subtraction and not a translation.
  threshold_weight integer     not null check (threshold_weight >= 0),
  created_at       timestamptz not null default now(),
  unique (org_id, level),
  unique (org_id, threshold_weight)
);

create index if not exists reward_tiers_org_idx on reward_tiers (org_id, threshold_weight);

/* ------------------------------------------------------------------ campaigns */

create table if not exists campaigns (
  id          uuid        primary key default gen_random_uuid(),
  org_id      bigint      not null references orgs(id) on delete cascade,
  -- Shareable: /c/<slug>. Unique across the platform so a link is unambiguous.
  slug        text        not null unique,
  title       text        not null,
  blurb       text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists campaigns_org_idx on campaigns (org_id, active, starts_at desc);

-- Which engagements count toward a campaign. A campaign is a lens over the engagement
-- types a business already defined, not a second copy of them.
create table if not exists campaign_engagements (
  campaign_id        uuid not null references campaigns(id) on delete cascade,
  engagement_type_id uuid not null references engagement_types(id) on delete cascade,
  primary key (campaign_id, engagement_type_id)
);

create table if not exists campaign_participants (
  campaign_id uuid        not null references campaigns(id) on delete cascade,
  org_id      bigint      not null references orgs(id) on delete cascade,
  address     text        not null,
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, address)
);

create index if not exists campaign_participants_addr_idx
  on campaign_participants (org_id, address);

/* ------------------------------------------- submissions: campaign + signature */

alter table submissions
  add column if not exists campaign_id     uuid references campaigns(id) on delete set null,
  -- The advocate's wallet signature over what they are claiming. Turns a submission
  -- from "someone typed this" into "this account said it", which is what makes the
  -- queue worth trusting once anyone can POST to the API.
  add column if not exists signature       text,
  add column if not exists signed_message  text;

create index if not exists submissions_campaign_idx
  on submissions (campaign_id, status) where campaign_id is not null;

/* ---------------------------------------------------------------------- views */

-- Where each person stands against their business's levels: what they have reached,
-- and how much more weight the next one needs.
create or replace view advocate_levels as
select
  s.org_id,
  s.advocate,
  s.approved_weight,
  earned.level        as current_level,
  earned.name         as current_level_name,
  earned.perk         as current_perk,
  nxt.level           as next_level,
  nxt.name            as next_level_name,
  nxt.perk            as next_perk,
  nxt.threshold_weight - s.approved_weight as weight_to_next
from advocate_standings s
left join lateral (
  select t.* from reward_tiers t
  where t.org_id = s.org_id and t.threshold_weight <= coalesce(s.approved_weight, 0)
  order by t.threshold_weight desc limit 1
) earned on true
left join lateral (
  select t.* from reward_tiers t
  where t.org_id = s.org_id and t.threshold_weight > coalesce(s.approved_weight, 0)
  order by t.threshold_weight asc limit 1
) nxt on true;
