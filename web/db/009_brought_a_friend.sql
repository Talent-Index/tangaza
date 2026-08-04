-- "Brought a friend" — the engagement the founder asked for by name, available in
-- campaign creation and on the submit form for the pilot org. Idempotent.

insert into engagement_types (org_id, label, blurb, icon, proof_kind, chain_category, weight, sort_order)
values (1, 'Brought a friend',
        'You brought someone new along. Give their name and your referral code.',
        '🤝', 'referral_code', 0, 3, 14)
on conflict (org_id, label) do update
  set blurb = excluded.blurb, icon = excluded.icon, proof_kind = excluded.proof_kind,
      chain_category = excluded.chain_category, weight = excluded.weight,
      sort_order = excluded.sort_order, active = true;
