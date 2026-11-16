-- Campaign reward funding (Qadi M-Pesa on-ramp) and Ambassador cash payouts (Autopay,
-- with Qadi as the fallback). Sandbox only: the app refuses live keys.
--
-- funded_kes is shillings still held for this campaign, including amounts reserved
-- for a payout that has not finished. available = funded_kes - reserved_kes.
-- A paid payout reduces both. A failed payout releases only the reservation.
-- idempotency_key is one per earned reward, so the same reward cannot be paid twice.
--
-- Idempotent. The app also applies this on first use (lib/payments/db-store.ts).

create table if not exists campaign_funding (
  campaign_id   uuid primary key references campaigns(id) on delete cascade,
  org_id        bigint not null references orgs(id) on delete cascade,
  funded_kes    numeric(14,2) not null default 0,
  reserved_kes  numeric(14,2) not null default 0,
  updated_at    timestamptz not null default now(),
  constraint campaign_funding_nonneg check (
    funded_kes >= 0 and reserved_kes >= 0 and funded_kes >= reserved_kes
  )
);

create table if not exists campaign_deposits (
  id               uuid primary key default gen_random_uuid(),
  org_id           bigint not null references orgs(id) on delete cascade,
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  provider         text not null default 'qadi',
  external_id      text,
  idempotency_key  text not null unique,
  amount_kes       numeric(14,2) not null,
  amount_usdc      numeric(18,6),
  payer_phone      text not null,
  status           text not null default 'pending',
  provider_status  text,
  failure_reason   text,
  simulated        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  paid_at          timestamptz,
  constraint campaign_deposits_status check (status in ('pending', 'paid', 'failed', 'retrying'))
);

create unique index if not exists campaign_deposits_external_idx
  on campaign_deposits (provider, external_id) where external_id is not null;

create index if not exists campaign_deposits_org_idx
  on campaign_deposits (org_id, created_at desc);

create table if not exists ambassador_payouts (
  id                uuid primary key default gen_random_uuid(),
  org_id            bigint not null references orgs(id) on delete cascade,
  campaign_id       uuid not null references campaigns(id) on delete cascade,
  campaign_title    text not null default '',
  advocate          text not null,
  reward_index      integer not null check (reward_index >= 1),
  idempotency_key   text not null unique,
  amount_kes        numeric(14,2) not null,
  phone             text not null default '',
  status            text not null default 'pending',
  attempts          integer not null default 0,
  max_attempts      integer not null default 3,
  autopay_attempts  integer not null default 0,
  qadi_attempts     integer not null default 0,
  autopay_terminal  boolean not null default false,
  reserved          boolean not null default false,
  provider          text,
  external_id       text,
  provider_status   text,
  last_error        text,
  simulated         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  paid_at           timestamptz,
  unique (campaign_id, advocate, reward_index),
  constraint ambassador_payouts_status check (status in ('pending', 'paid', 'failed', 'retrying')),
  constraint ambassador_payouts_provider check (provider is null or provider in ('autopay', 'qadi'))
);

create index if not exists ambassador_payouts_advocate_idx
  on ambassador_payouts (advocate, created_at desc);

create index if not exists ambassador_payouts_campaign_idx
  on ambassador_payouts (campaign_id, status);

create table if not exists payment_webhook_events (
  id          text primary key,
  provider    text not null,
  event_type  text not null,
  received_at timestamptz not null default now()
);
