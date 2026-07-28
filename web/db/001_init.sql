-- Ubu-Tangaza off-chain schema.
--
-- The chain is authoritative for rewards: TangazaRewards fixes ActivityType to three
-- values, CREDIT_VALUE_KES to 500 and MILESTONE_ACTIVITIES to 20, all `constant`. None
-- of that can be configured without redeploying.
--
-- So the configurable product lives here. A business defines whatever engagement types
-- it wants, and each one carries a `weight`: how many on-chain activities one approval
-- is worth. Approving a submission of weight 5 calls approveActivityBatch with 5
-- entries, so a referral can be worth more than a retweet while the contract's
-- 20-activities-per-KES-500 milestone and the emission cap keep governing the money.

create table if not exists orgs (
  id          bigint primary key,             -- the on-chain orgId
  name        text        not null,
  approver    text,                           -- lowercase smart-account address
  created_at  timestamptz not null default now()
);

-- What proof the advocate is asked for. Drives which input the submit form renders.
do $$ begin
  create type proof_kind as enum (
    'link',           -- any URL
    'x_link',         -- a post on X
    'social_link',    -- Instagram / TikTok / Facebook
    'screenshot',     -- uploaded image
    'referral_code',  -- the code the advocate gave out
    'none'            -- honour system; the org verifies offline
  );
exception when duplicate_object then null; end $$;

create table if not exists engagement_types (
  id              uuid        primary key default gen_random_uuid(),
  org_id          bigint      not null references orgs(id) on delete cascade,
  label           text        not null,
  blurb           text,
  icon            text        not null default '•',
  proof_kind      proof_kind  not null default 'link',

  -- Which of the contract's three ActivityType values this reports as. Keeps on-chain
  -- history meaningful when a business invents its own categories.
  chain_category  smallint    not null default 1
                  check (chain_category between 0 and 2),

  -- How many on-chain activities one approval counts for. This is the reward dial.
  weight          smallint    not null default 1 check (weight between 1 and 20),

  active          boolean     not null default true,
  sort_order      smallint    not null default 0,
  created_at      timestamptz not null default now(),

  unique (org_id, label)
);

create index if not exists engagement_types_org_idx
  on engagement_types (org_id, active, sort_order);

-- The CRM contact record. One row per person who has ever engaged with this business.
create table if not exists advocates (
  org_id          bigint      not null references orgs(id) on delete cascade,
  address         text        not null,       -- lowercase smart-account address
  display_name    text,
  phone           text,
  first_seen_at   timestamptz not null default now(),
  last_active_at  timestamptz not null default now(),
  primary key (org_id, address)
);

do $$ begin
  create type submission_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists submissions (
  id                  uuid              primary key default gen_random_uuid(),
  org_id              bigint            not null references orgs(id) on delete cascade,
  advocate            text              not null,
  advocate_label      text,
  engagement_type_id  uuid              references engagement_types(id) on delete set null,

  -- Denormalised so a submission still reads correctly after the org edits or
  -- deletes the engagement type it was filed under. History must not shift.
  type_label          text              not null,
  type_icon           text              not null default '•',
  chain_category      smallint          not null,
  weight              smallint          not null default 1,

  proof_url           text,
  note                text,
  status              submission_status not null default 'pending',
  tx_hash             text,
  rejection_reason    text,
  submitted_at        timestamptz       not null default now(),
  decided_at          timestamptz,
  decided_by          text
);

create index if not exists submissions_queue_idx
  on submissions (org_id, status, submitted_at desc);
create index if not exists submissions_advocate_idx
  on submissions (org_id, advocate, submitted_at desc);

-- Leaderboard. Approved weight is what the contract actually counted, so it is what
-- ranks people; pending is shown alongside so the org can see who is mid-flight.
create or replace view advocate_standings as
select
  s.org_id,
  s.advocate,
  coalesce(max(a.display_name), max(s.advocate_label))            as display_name,
  sum(s.weight) filter (where s.status = 'approved')::int         as approved_weight,
  count(*)      filter (where s.status = 'approved')::int         as approved_count,
  count(*)      filter (where s.status = 'pending')::int          as pending_count,
  count(*)      filter (where s.status = 'rejected')::int         as rejected_count,
  max(s.submitted_at)                                             as last_submitted_at,
  max(s.decided_at) filter (where s.status = 'approved')          as last_approved_at
from submissions s
left join advocates a on a.org_id = s.org_id and a.address = s.advocate
group by s.org_id, s.advocate;
