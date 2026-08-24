-- Per-activity reward goals, alongside the existing total-activity levels.
--
-- A reward_tier can now target a SPECIFIC engagement ("5 referrals → free T-shirt")
-- instead of a total weighted count. Both kinds coexist:
--   engagement_type_id IS NULL  → total-activity level (uses threshold_weight, as before)
--   engagement_type_id IS SET   → per-activity goal (uses target_count of that engagement)
--
-- Measurement for per-activity goals is the count of that advocate's APPROVED
-- submissions of that engagement (submissions.status = 'approved'), keyed off the
-- on-chain attestation. Idempotent.

alter table reward_tiers
  add column if not exists engagement_type_id uuid references engagement_types(id) on delete cascade,
  add column if not exists target_count       integer check (target_count is null or target_count > 0);

-- The total-activity ladder must ignore per-activity goals, or they'd distort
-- "which level am I at" on the weighted ladder. Restrict advocate_levels to total tiers.
create or replace view advocate_levels as
select
  s.org_id,
  s.advocate,
  s.approved_weight,
  earned.level        as current_level,
  earned.name         as current_level_name,
  earned.perk         as current_perk,
  nxt.level           as next_level,
  nxt.name            as next_level_name,
  nxt.perk            as next_perk,
  nxt.threshold_weight - s.approved_weight as weight_to_next
from advocate_standings s
left join lateral (
  select t.* from reward_tiers t
  where t.org_id = s.org_id and t.engagement_type_id is null
    and t.threshold_weight <= coalesce(s.approved_weight, 0)
  order by t.threshold_weight desc limit 1
) earned on true
left join lateral (
  select t.* from reward_tiers t
  where t.org_id = s.org_id and t.engagement_type_id is null
    and t.threshold_weight > coalesce(s.approved_weight, 0)
  order by t.threshold_weight asc limit 1
) nxt on true;
