-- Flexible, off-chain reward model.
--
-- The on-chain contract stays the source of truth for identity, attestation, approved
-- activity counts and the capped KES liability. What a business *gives* — and in what
-- currency and form — is a trust-based promise it honours off-chain, so it lives here
-- and can be anything, not just the fixed KES credit.
--
-- Idempotent.

-- An editable display name. The on-chain name is immutable (set once at registerOrg and
-- there is no setter), so this is the name a business can change without a redeploy; the
-- UI shows this when present and falls back to the on-chain name.
alter table orgs add column if not exists display_name text;

-- Levels become the reward menu: each level a person reaches can unlock a concrete
-- reward of any amount, currency and form. All nullable so existing perk-only levels
-- keep working.
alter table reward_tiers add column if not exists amount        numeric;   -- e.g. 500, 10, 15
alter table reward_tiers add column if not exists currency      text;      -- KES, USD, EUR, …
alter table reward_tiers add column if not exists reward_kind   text;      -- cash, airtime, voucher, discount, product, …
