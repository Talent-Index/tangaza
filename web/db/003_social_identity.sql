-- Social identity, so a post on X can be traced back to a wallet.
--
-- The problem this solves: an advocate posts about the business on X, then has to
-- remember to come back here and file it. That round trip is where most of them fall
-- off. If we know which X account belongs to which wallet, the post can find its own
-- way into the queue.
--
-- thirdweb already offers "x" as a sign-in option, but its Profile type carries only
-- `{ type, details: { id?, email?, phone?, address? } }` — no username. So the app
-- cannot learn anyone's handle from sign-in alone; linking has to be its own step.
--
-- Two deliberate limits, both about not becoming an engagement farm:
--
--   1. Ingestion only ever writes status='pending'. A human still approves. "A credit
--      only exists because an org approved a real activity" is the product's promise
--      and automatic discovery does not get to weaken it.
--
--   2. Mentions only — original posts about the business. Never reposts or likes.
--      X's platform manipulation policy prohibits compensating people for engagement
--      or amplification, and the account at risk is the business's own.
--
-- Idempotent: safe to run more than once.

/* ------------------------------------------------- the business's own X account */

create table if not exists org_x_accounts (
  org_id            bigint      primary key references orgs(id) on delete cascade,
  x_user_id         text        not null,
  -- Stored without the leading @. The handle is display only; x_user_id is identity,
  -- because people rename themselves and ids do not move.
  x_username        text        not null,
  access_token      text,                    -- encrypted at rest; null until OAuth lands
  refresh_token     text,
  token_expires_at  timestamptz,
  connected_by      text,                    -- approver address that authorised it
  connected_at      timestamptz not null default now(),
  unique (x_user_id)
);

/* --------------------------------------------------------------- where we got to */

create table if not exists x_ingestion_cursor (
  org_id              bigint      primary key references orgs(id) on delete cascade,
  since_id            text,                  -- newest X post id already ingested
  last_polled_at      timestamptz,
  last_success_at     timestamptz,
  consecutive_errors  smallint    not null default 0,
  last_error          text
);

/* ------------------------------------------------------ an advocate's X identity */

do $$ begin
  -- 'claimed'  — they typed a handle. Proves nothing; anyone can type @jack.
  -- 'verified' — they completed OAuth, or the business vouched for them by hand.
  -- Only 'verified' links are ever eligible for automatic ingestion.
  create type x_link_status as enum ('claimed', 'verified');
exception when duplicate_object then null; end $$;

create table if not exists advocate_x_links (
  org_id      bigint        not null,
  address     text          not null,
  x_user_id   text          not null,
  x_username  text          not null,
  status      x_link_status not null default 'claimed',
  linked_at   timestamptz   not null default now(),
  verified_at timestamptz,
  primary key (org_id, address),
  foreign key (org_id, address) references advocates(org_id, address) on delete cascade,
  -- One X account cannot be claimed by two wallets in the same business. This is the
  -- cheapest anti-farming control available and it costs nothing to enforce.
  unique (org_id, x_user_id)
);

/* ------------------------------------------------- where a submission came from */

do $$ begin
  create type submission_source as enum ('manual', 'x_auto');
exception when duplicate_object then null; end $$;

alter table submissions
  add column if not exists source         submission_source not null default 'manual',
  add column if not exists source_post_id text;

-- The dedupe guarantee. A cursor alone is not enough: polls overlap, retries happen,
-- and a since_id that fails to advance would re-queue everything it already saw.
-- A post mentioning two businesses legitimately produces one row for each — that is
-- two queues, not a duplicate, which is why org_id is part of the key.
create unique index if not exists submissions_source_post_dedupe_idx
  on submissions (org_id, source_post_id)
  where source_post_id is not null;

/* --------------------------------------------- which engagement absorbs a mention */

-- Reuses the engagement type a business already configured rather than inventing a
-- parallel config surface: an ingested mention inherits that type's label, icon,
-- chain_category and weight exactly as a hand-filed submission does. An org opts in by
-- flagging one type; nothing is polled for an org that has not.
alter table engagement_types
  add column if not exists auto_ingest_source text
    check (auto_ingest_source in ('x_mention'));

create unique index if not exists engagement_types_auto_ingest_idx
  on engagement_types (org_id, auto_ingest_source)
  where auto_ingest_source is not null;

/* ------------------------------------------------------------------------- views */

-- The business's contact list, with social identity folded in. This is the CRM row:
-- who they are, what they're worth, and how to find them.
create or replace view advocate_directory as
select
  s.org_id,
  s.advocate,
  coalesce(a.display_name, s.display_name)          as display_name,
  l.x_username,
  l.status                                          as x_link_status,
  s.approved_weight,
  s.approved_count,
  s.pending_count,
  s.rejected_count,
  s.last_submitted_at,
  s.last_approved_at,
  a.first_seen_at
from advocate_standings s
left join advocates       a on a.org_id = s.org_id and a.address = s.advocate
left join advocate_x_links l on l.org_id = s.org_id and l.address = s.advocate;
