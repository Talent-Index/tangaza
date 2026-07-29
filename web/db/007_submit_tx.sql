-- The advocate's own on-chain submission transaction.
--
-- Submitting is no longer a signed message: the advocate's smart account calls
-- submitActivity on the contract (gas sponsored), and this column records that tx.
-- The server verified its ActivitySubmitted log — orgId, advocate and proof hash all
-- matching — before the row was allowed to exist. The old signature/signed_message
-- columns stay for rows created under the previous scheme.
--
-- Idempotent.

alter table submissions
  add column if not exists submit_tx text;
