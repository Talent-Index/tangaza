-- 023: MiniSend hosted checkout (billing Phase 3) — see lib/minisend.ts, lib/billing.ts.
--
-- A payment intent may carry one live MiniSend checkout session: the business is sent
-- to MiniSend's hosted page and pays by M-Pesa or USDC/USDT there; MiniSend's signed
-- `checkout.completed` webhook (app/api/billing/minisend) confirms the intent. The
-- reference code + unique KES amount stay as the manual fallback and the receipt line.
--
-- Sessions live 30 minutes on MiniSend's side while an intent lives 24h, so a session
-- is (re)created on demand by the approver-signed POST /api/billing and the stored
-- expiry tells the UI whether the link is still worth showing. `session_id` is unique
-- so a webhook can be attributed by session alone, and retries stay idempotent.
--
-- The app also applies this lazily on first use (lib/billing.ts). Idempotent.

alter table payment_intents add column if not exists minisend_session_id  text;
alter table payment_intents add column if not exists minisend_checkout_url text;
alter table payment_intents add column if not exists minisend_expires_at   timestamptz;

create unique index if not exists payment_intents_minisend_session_idx
  on payment_intents (minisend_session_id) where minisend_session_id is not null;
