-- 015: the pilot business (org 1) was seeded with copy that spoke of "the Centre" as
-- though it were the platform. Its stored engagements, level perks and campaign blurbs
-- now speak of "the business". Scoped to org 1 and idempotent: only rows that still
-- say Centre are touched, and re-running finds nothing left to change.

create or replace function pg_temp.debrand(t text) returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(t, ''), 'blockchain centre kenya', 'the business', 'gi'),
             'blockch(a)?in centre', 'the business', 'gi'),
           'the centre', 'the business', 'gi')
$$;

update engagement_types
   set blurb = replace(pg_temp.debrand(blurb),
                       'a new member to the business', 'a new customer to the business')
 where org_id = 1 and blurb ~* 'centre';

update engagement_types set label = 'Share' where org_id = 1 and label = 'share';

update reward_tiers set perk = pg_temp.debrand(perk)
 where org_id = 1 and perk ~* 'centre';

update campaigns set title = pg_temp.debrand(title), blurb = pg_temp.debrand(blurb)
 where org_id = 1 and (title ~* 'centre' or blurb ~* 'centre');
