-- Every wallet that has ever connected to the app, recorded at connect time.
--
-- The submissions table only knows about people who got as far as submitting; this
-- knows about everyone who signed in, which is what "connect your wallet, then you can
-- add an activity" implies. One row per acting address — for a smart account that is
-- the account address, with the signing wallet behind it kept alongside, so "which
-- extension was this person actually using" stays answerable.
--
-- Idempotent, like every file here.

create table if not exists wallets (
  address        text        primary key,     -- lowercase; the address the app acts as
  admin_address  text,                        -- lowercase; the wallet that signs for it
  wallet_id      text,                        -- 'inApp' | 'app.core.extension' | 'io.metamask' | …
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  connect_count  integer     not null default 1
);

create index if not exists wallets_admin_idx on wallets (admin_address);
