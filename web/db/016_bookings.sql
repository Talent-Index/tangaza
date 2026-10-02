-- 016: setup-session bookings from /book. One row per reserved slot; the unique
-- slot_start is what prevents two people booking the same time.
-- The app also runs this on first use (lib/bookings-store.ts), so applying it by hand
-- is optional — it is here as the record of the schema.
create table if not exists bookings (
  id          uuid        primary key default gen_random_uuid(),
  slot_start  timestamptz not null unique,
  name        text        not null,
  business    text        not null,
  contact     text        not null,
  email       text,
  notes       text,
  status      text        not null default 'requested',
  created_at  timestamptz not null default now()
);
create index if not exists bookings_contact_idx on bookings (lower(contact));
