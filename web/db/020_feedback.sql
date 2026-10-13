-- 020: public feedback, left from /feedback and shown on the homepage.
--
-- Anyone can leave it (no wallet, no account), so the shape is deliberately tiny:
-- an optional name and a short message. `hidden` exists so an abusive entry can be
-- taken off the homepage with one UPDATE without deleting the record.
-- The app also runs this on first use (lib/feedback-store.ts), so applying it by hand
-- is optional — it is here as the record of the schema.
create table if not exists feedback (
  id          uuid        primary key default gen_random_uuid(),
  name        text,
  message     text        not null,
  hidden      boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_visible_idx on feedback (hidden, created_at desc);
