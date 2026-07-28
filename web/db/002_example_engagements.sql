-- Two worked examples of a business configuring Ubu-Tangaza for itself, with real
-- submissions against them. Optional — the app runs fine without this file.
--
--   Example 1  Social proof.   A shout-out on X, and a WhatsApp status screenshot.
--                              Different proof kinds, different weights.
--   Example 2  Referrals.      Who you brought, and the link that proves it. Weighted
--                              heaviest, because a person through the door is worth
--                              more to the house than a post.
--
-- `weight` is the reward dial: how many on-chain activities one approval counts for.
-- 20 approved activities mint one KES 500 credit, which the advocate redeems as a
-- voucher — the deal from the house. So a referral at weight 5 is a quarter of a deal,
-- and a WhatsApp status at weight 1 is a twentieth.
--
-- Idempotent: safe to run more than once.

begin;

insert into orgs (id, name) values (1, 'Blockchain Centre Kenya')
  on conflict (id) do nothing;

/* ---------------------------------------------------------- example 1: social proof */

insert into engagement_types (org_id, label, blurb, icon, proof_kind, chain_category, weight, sort_order)
values
  (1, 'Shout-out on X',
      'Post about us on X and tag us. Drop the link to your post.',
      '𝕏', 'x_link', 1, 2, 10),
  (1, 'WhatsApp status',
      'Put us on your WhatsApp status for 24h, then send the screenshot.',
      '💬', 'screenshot', 1, 1, 11)
on conflict (org_id, label) do update
  set blurb = excluded.blurb, icon = excluded.icon, proof_kind = excluded.proof_kind,
      chain_category = excluded.chain_category, weight = excluded.weight,
      sort_order = excluded.sort_order, active = true;

/* ------------------------------------------------------------- example 2: referrals */

insert into engagement_types (org_id, label, blurb, icon, proof_kind, chain_category, weight, sort_order)
values
  (1, 'Walk-in referral',
      'Bring someone through the door. Give us their name and your referral link.',
      '🤝', 'referral_code', 0, 5, 12)
on conflict (org_id, label) do update
  set blurb = excluded.blurb, icon = excluded.icon, proof_kind = excluded.proof_kind,
      chain_category = excluded.chain_category, weight = excluded.weight,
      sort_order = excluded.sort_order, active = true;

/* ------------------------------------------------------------------------- the people */

insert into advocates (org_id, address, display_name, first_seen_at, last_active_at) values
  (1, '0xa1c4f3b28e5d7096b1e4c8a2f5d90371c6b4e820', 'Amina Wanjiru', now() - interval '21 days', now() - interval '2 hours'),
  (1, '0xb27e91d5a4c08f3762be5197d0ac48e3f19b6c5d', 'Brian Otieno',  now() - interval '18 days', now() - interval '1 day'),
  (1, '0xc93a05f7e2b164d8095c3e7a1fb2064d8a37e915', 'Njeri Kamau',   now() - interval '15 days', now() - interval '5 hours'),
  (1, '0xd48b7c16309ea2f5b8d4071e93ca5f82061d7b34', 'Kevin Mwangi',  now() - interval '11 days', now() - interval '3 days'),
  (1, '0xe5f2038a91c74b6de0173f5a2cb8940e7d61a2f8', 'Faith Chebet',  now() - interval '9 days',  now() - interval '30 minutes'),
  (1, '0xf6019d4b823e5a7c0946b2f18de035a7c94b8e13', 'Samuel Mutua',  now() - interval '4 days',  now() - interval '20 minutes')
on conflict (org_id, address) do update set display_name = excluded.display_name;

/* -------------------------------------------------------------------- what they did */

insert into submissions
  (org_id, advocate, advocate_label, engagement_type_id, type_label, type_icon,
   chain_category, weight, proof_url, note, status, tx_hash, submitted_at, decided_at)
select
  1, v.advocate, v.label, et.id, et.label, et.icon,
  et.chain_category, et.weight, v.proof, v.note, v.status::submission_status,
  v.tx, now() - v.age, case when v.status = 'pending' then null else now() - v.age + interval '3 hours' end
from (values
  -- example 1 — X
  ('0xa1c4f3b28e5d7096b1e4c8a2f5d90371c6b4e820','Amina Wanjiru','Shout-out on X',
   'https://x.com/amina_wanjiru/status/1948820117335552041',
   'Thread on why she stopped paying gas fees. 41 reposts.',
   'approved','0x7c2e9a4f18b3d05e6a91c4f7b2d8035e1a6b9c4f2e8d70351a94c6b8e2f0d573', interval '12 days'),
  ('0xb27e91d5a4c08f3762be5197d0ac48e3f19b6c5d','Brian Otieno','Shout-out on X',
   'https://x.com/brian_otieno_ke/status/1950113847290011392',
   'Quote-tweeted the Fuji workshop announcement.',
   'approved','0x3f8b1d6c95e2a7043b8f1e5d92c604a7f3e81b5d0c96a2e47f8b3d015c9a6e240', interval '8 days'),
  ('0xe5f2038a91c74b6de0173f5a2cb8940e7d61a2f8','Faith Chebet','Shout-out on X',
   'https://x.com/faithchebet/status/1952004918273645057',
   'Posted her first smart-account transaction. Tagged us.',
   'pending', null, interval '30 minutes'),

  -- example 1 — WhatsApp screenshots
  ('0xa1c4f3b28e5d7096b1e4c8a2f5d90371c6b4e820','Amina Wanjiru','WhatsApp status',
   'https://res.cloudinary.com/ubu-tangaza/image/upload/proof/wa_amina_0719.jpg',
   'Status up 24h — Saturday clinic flyer.',
   'approved','0x9d4a7e2b60f3c815a94e7d20b6c3f851092a4e7d6b1f83c05e29d4a760b3f81c5', interval '6 days'),
  ('0xc93a05f7e2b164d8095c3e7a1fb2064d8a37e915','Njeri Kamau','WhatsApp status',
   'https://res.cloudinary.com/ubu-tangaza/image/upload/proof/wa_njeri_0722.jpg',
   'Shared to 3 chamas she runs.',
   'approved','0x1e6b93d0a475c82f6e0b17d493a25c806f1d3b95e7a02c46d8f139b5e04a7c62', interval '5 days'),
  ('0xf6019d4b823e5a7c0946b2f18de035a7c94b8e13','Samuel Mutua','WhatsApp status',
   'https://res.cloudinary.com/ubu-tangaza/image/upload/proof/wa_samuel_0727.jpg',
   'Screenshot is cropped — asked him to resend the full status.',
   'pending', null, interval '20 minutes'),

  -- example 2 — referrals
  ('0xc93a05f7e2b164d8095c3e7a1fb2064d8a37e915','Njeri Kamau','Walk-in referral',
   'https://ubu-tangaza.vercel.app/r/NJERI-K',
   'Brought Mercy Adhiambo. Signed up at the Thursday session.',
   'approved','0x5a0c8f2e91b47d36a805c1f9e2d740b83c6a1e59f0d28b47c3e916a0d5f82b41', interval '10 days'),
  ('0xb27e91d5a4c08f3762be5197d0ac48e3f19b6c5d','Brian Otieno','Walk-in referral',
   'https://ubu-tangaza.vercel.app/r/BRIAN-O',
   'Brought Peter Kariuki and his business partner.',
   'approved','0x8b3e05a7f1c94d260e8a3b7f5d10c942e6b8a04f7d3c15e920b6a8f34d07c1e5', interval '7 days'),
  ('0xd48b7c16309ea2f5b8d4071e93ca5f82061d7b34','Kevin Mwangi','Walk-in referral',
   'https://ubu-tangaza.vercel.app/r/KEVIN-M',
   'Brought Susan Njoki — she opened an account the same day.',
   'approved','0x2c7f14b8e903a56d1f7b04c8e2a935d071c4b6e8a0f52d39b7c1e08a4f6d2b93', interval '3 days'),
  ('0xe5f2038a91c74b6de0173f5a2cb8940e7d61a2f8','Faith Chebet','Walk-in referral',
   'https://ubu-tangaza.vercel.app/r/FAITH-C',
   'Brought her cousin Dennis Barasa. Waiting on the front desk to confirm.',
   'pending', null, interval '2 hours'),
  ('0xa1c4f3b28e5d7096b1e4c8a2f5d90371c6b4e820','Amina Wanjiru','Walk-in referral',
   'https://ubu-tangaza.vercel.app/r/AMINA-W',
   'Named three people but none have shown up yet.',
   'rejected', null, interval '9 days')
) as v(advocate, label, type_label, proof, note, status, tx, age)
join engagement_types et on et.org_id = 1 and et.label = v.type_label
where not exists (
  select 1 from submissions s
  where s.org_id = 1 and s.advocate = v.advocate and s.proof_url = v.proof
);

commit;
