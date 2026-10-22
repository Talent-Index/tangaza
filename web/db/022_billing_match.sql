-- 022: automatic payment matching (billing Phase 2) — see lib/billing-match.ts.
--
-- Two matchers feed confirmPaymentIntent:
--   M-Pesa — payments to OUR shortcode (BILLING_MPESA_SHORTCODE) arriving on the
--   existing Daraja C2B webhook are matched by reference code, then by exact amount.
--   On-chain — a watcher scans ERC-20 transfers to BILLING_RECEIVE_ADDRESS and matches
--   the 6-decimal token value against payment_intents.unique_amount.
--
-- A payment that matches nothing (wrong amount, overpayment, stranger) is NEVER
-- guessed at: it lands here for a human to resolve in /admin/billing. `ref` is unique
-- so webhook retries and rescans stay idempotent.

create table if not exists unmatched_payments (
  id        serial primary key,
  source    text not null,              -- 'mpesa' | 'onchain'
  ref       text unique not null,       -- M-Pesa TransID, or txhash:logindex
  amount    numeric(18,6) not null,     -- KES for mpesa; token units (USDC) for onchain
  payer     text,                       -- MSISDN / sender address, for the statement hunt
  note      text,                       -- e.g. the bill ref they typed
  resolved  boolean not null default false,
  seen_at   timestamptz not null default now()
);

-- Where the on-chain watcher left off, so every scan resumes instead of re-reading
-- history. One row; block 0 means "never ran" and the watcher starts near the tip.
create table if not exists billing_scan (
  id         int primary key default 1,
  last_block bigint not null default 0,
  updated_at timestamptz not null default now()
);
