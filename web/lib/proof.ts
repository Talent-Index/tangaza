import { keccak256, toHex } from "viem";

/**
 * The fingerprint of a submission's proof, as recorded on-chain.
 *
 * Three places compute this and they must agree byte-for-byte: the submit page (inside
 * the advocate's submitActivity transaction), the org page (inside approveActivityBatch),
 * and the server (verifying both receipts). One function, no copies.
 *
 * The proof itself — a URL, a referral code — stays off-chain; the chain holds only
 * this hash, so an approval is provably about one specific piece of evidence without
 * that evidence being published.
 */
export const proofHashOf = (proofUrl?: string): `0x${string}` =>
  keccak256(toHex(proofUrl ?? ""));
