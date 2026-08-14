-- One row per address the in-app faucet has ever topped up.
--
-- The primary key is the whole policy: an address gets funded once, ever. The row is
-- inserted *before* the AVAX is sent (tx_hash null while in flight), so two
-- concurrent requests for the same address race on the insert, not on the transfer —
-- the loser sees a conflict and no second drip goes out. A send that fails deletes
-- its claim so the address can try again.
--
-- ip is kept only to rate-limit; it is never shown anywhere.
--
-- Idempotent, like every file here.

create table if not exists faucet_drips (
  address     text        primary key,     -- lowercase; the account that was topped up
  ip          text,                        -- request origin, for the per-IP daily cap
  amount_wei  text        not null,        -- what was sent, in wei (text: bigint-safe)
  tx_hash     text,                        -- null while the send is in flight
  created_at  timestamptz not null default now()
);

create index if not exists faucet_drips_ip_idx on faucet_drips (ip, created_at);
