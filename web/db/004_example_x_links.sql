-- Example X handles for the seeded advocates, so the client directory shows social
-- identity out of the box. Optional, and only meaningful alongside 002.
--
-- These are the same handles that appear in the proof URLs in 002 — Amina's shout-out
-- is at x.com/amina_wanjiru/status/…, so amina_wanjiru is who she is here.
--
-- Everything lands as 'claimed', never 'verified': nobody proved anything, they were
-- typed in. Only OAuth (or a business vouching by hand) should ever produce 'verified',
-- because that status is what makes a link eligible for automatic ingestion.
--
-- Idempotent.

insert into advocate_x_links (org_id, address, x_user_id, x_username, status)
values
  (1, '0xa1c4f3b28e5d7096b1e4c8a2f5d90371c6b4e820', 'manual:amina_wanjiru',   'amina_wanjiru',   'claimed'),
  (1, '0xb27e91d5a4c08f3762be5197d0ac48e3f19b6c5d', 'manual:brian_otieno_ke', 'brian_otieno_ke', 'claimed'),
  (1, '0xe5f2038a91c74b6de0173f5a2cb8940e7d61a2f8', 'manual:faithchebet',     'faithchebet',     'claimed')
on conflict (org_id, address) do update
  set x_user_id  = excluded.x_user_id,
      x_username = excluded.x_username,
      status     = excluded.status;

-- Point the business's X-shaped engagement at automatic ingestion. Nothing polls yet —
-- this is the opt-in switch the cron will read once OAuth exists, and it costs nothing
-- until then.
update engagement_types
   set auto_ingest_source = 'x_mention'
 where org_id = 1 and label = 'Shout-out on X';
