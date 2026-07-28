-- Example levels and a campaign for the pilot org. Optional; pairs with 002.
--
-- The thresholds are set against the contract's own arithmetic. 20 approved activities
-- mints one KES 500 credit, so:
--
--   Regular    weight  5  — a quarter of the way to a credit
--   Champion   weight 20  — one credit's worth of turning up
--   Circle     weight 60  — three
--
-- The credit is the money and the contract enforces it. These are the recognition on
-- top: what the house gives you for being a regular, which is the part a business
-- actually wants to control.
--
-- Idempotent.

insert into reward_tiers (org_id, level, name, perk, icon, threshold_weight) values
  (1, 1, 'Regular',          '10% off anything at the Centre café, any day you come in.', '🥉',  5),
  (1, 2, 'Champion',         'A free seat at any paid workshop, plus first refusal on limited events.', '🥈', 20),
  (1, 3, 'Founder''s Circle', 'Named on the wall, on the guest list for every event, and a standing invite to the Friday build nights.', '🥇', 60)
on conflict (org_id, level) do update
  set name = excluded.name, perk = excluded.perk, icon = excluded.icon,
      threshold_weight = excluded.threshold_weight;

/* -------------------------------------------------------------------- campaign */

insert into campaigns (org_id, slug, title, blurb, starts_at, ends_at, active)
values (
  1,
  'nights-of-code',
  'Nights of Code',
  'We ran an overnight game jam and 155 builders showed up. Tell people what you built and what the room was like — every post counts toward your level.',
  now() - interval '5 days',
  now() + interval '16 days',
  true
)
on conflict (slug) do update
  set title = excluded.title, blurb = excluded.blurb,
      ends_at = excluded.ends_at, active = excluded.active;

-- A campaign is a lens over engagements the business already defined, not a second
-- copy of them. This one counts the three social ones and ignores walk-in referrals.
insert into campaign_engagements (campaign_id, engagement_type_id)
select c.id, e.id
from campaigns c
join engagement_types e on e.org_id = c.org_id
where c.slug = 'nights-of-code'
  and e.label in ('Shout-out on X', 'Instagram Reel', 'WhatsApp status')
on conflict do nothing;
