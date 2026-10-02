-- Retail-SME referral pilot: verify a referred purchase from an M-Pesa Till payment.
--
-- Loop: a referrer shares their /s/<CODE> link. A friend pays the merchant's Till and
-- types the referrer's CODE as the M-Pesa account/reference. Safaricom Daraja posts a
-- C2B confirmation to /api/mpesa/confirmation; we match BusinessShortCode -> merchant,
-- BillRefNumber -> referral code -> referrer, and record a VERIFIED referred purchase.
-- Payout stays trust-based/off-chain (merchant honours it), so no VASP custody here.
--
-- Idempotent.

-- One-screen SME config: the merchant's Till and what a referred sale earns the referrer.
alter table orgs
  add column if not exists till_shortcode          text,
  add column if not exists referral_reward_amount   numeric,
  add column if not exists referral_reward_currency  text,
  add column if not exists referral_reward_kind      text;

-- Every C2B confirmation, keyed on Daraja's TransID so retried callbacks are no-ops.
create table if not exists mpesa_payments (
  id             uuid        primary key default gen_random_uuid(),
  trans_id       text        not null unique,          -- Daraja TransID (idempotency key)
  shortcode      text        not null,                 -- BusinessShortCode (the Till)
  org_id         bigint      references orgs(id) on delete set null,  -- resolved merchant
  amount         numeric     not null default 0,
  msisdn         text,                                 -- payer phone (masked in UI)
  first_name     text,
  bill_ref       text,                                 -- raw account/reference typed
  referral_code  text,                                 -- resolved uppercased code, if valid
  referrer       text,                                 -- referrer wallet (lowercase), if matched
  verified       boolean     not null default false,   -- true = matched to a referral
  created_at     timestamptz not null default now()
);

create index if not exists mpesa_payments_org_idx
  on mpesa_payments (org_id, verified, created_at desc);
create index if not exists mpesa_payments_referrer_idx
  on mpesa_payments (org_id, referrer) where referrer is not null;
