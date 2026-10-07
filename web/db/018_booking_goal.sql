-- 018: what the business wants to achieve, picked on /book (a short label such as
-- "Launch a product"). Optional.
-- The app also runs this on first use (lib/bookings-store.ts), so applying it by hand
-- is optional — it is here as the record of the schema.
alter table bookings add column if not exists goal text;
