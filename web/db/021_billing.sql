-- 021: campaign credits and payment intents — the first revenue mechanics.
--
-- Pricing: a business's first 2 campaigns are free; campaign 3 costs ~$3 (KES 430),
-- every one after ~$5 (KES 700). Payments buy CREDITS, consumed on campaign creation.
-- The paywall is `campaigns_created < 2 OR campaign_credits > 0`, enforced in
-- /api/campaigns PUT via lib/billing.ts. Prices live server-side only (lib/billing.ts).
--
-- Payment attribution is by PAYMENT INTENT: each checkout mints a short reference code
-- (`UT-<biz>-<3 safe chars>`, no 0/O/1/I/l) and a unique KES amount — the base price
-- plus a per-intent offset of 0–29 reserved for 24h and recycled after expiry — so a
-- bare M-Pesa/ramp payment can be matched even when no memo survives the rail.
-- `unique_amount` carries the USD-stablecoin equivalent with a random micro-offset
-- (6 dp) for the future on-chain watcher; unused until then.
--
-- `campaigns_created` is a counter, not a count of live rows: deleting a campaign must
-- not refund a free slot. Grandfathering happens when a business's billing row is first
-- created (lib/billing.ts): existing campaigns set the counter, and a business already
-- past its free campaigns gets one credit on the house — never a retroactive paywall.
--
-- The app also applies this lazily on first use (lib/billing.ts), so applying it by
-- hand is optional — it is here as the record of the schema. Idempotent.

create table if not exists org_billing (
  org_id            bigint primary key,
  code              text unique not null,          -- stable business code, e.g. 'UT-MUYU'
  campaigns_created int  not null default 0,
  campaign_credits  int  not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists payment_intents (
  id            serial primary key,
  code          text unique not null,              -- 'UT-MUYU-7Q2', stored uppercase
  org_id        bigint not null,
  credits       int  not null,
  amount_kes    int  not null,                     -- base price + unique offset 0–29
  unique_amount numeric(12,6),                     -- USD with micro-offset, for later on-chain matching
  status        text not null default 'pending',   -- pending | confirmed | expired
  matched_ref   text,                              -- M-Pesa receipt or tx hash, once confirmed
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists payment_intents_org_idx on payment_intents (org_id, status);
-- UNIQUE while pending: the amount is the fingerprint, so no two open checkouts may
-- share one. Confirmed/expired rows leave the index, which is what recycles the slot.
create unique index if not exists payment_intents_pending_amount_idx
  on payment_intents (amount_kes) where status = 'pending';
