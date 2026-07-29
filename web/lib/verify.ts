import "server-only";
import { createPublicClient, http, parseAbiItem, parseEventLogs } from "viem";
import { avalancheFuji } from "viem/chains";
import { CONTRACT_ADDRESS } from "./client";
import { proofHashOf } from "./proof";

/**
 * Proving that the account named in a request actually sent it.
 *
 * Without this, POST /api/activities takes anyone's word for who they are: you could
 * file submissions under someone else's address, or stuff the leaderboard, with curl.
 * The contract still gates real minting, so no money moves — but the queue a business
 * reads to decide who gets paid should not be open to strangers.
 *
 * Advocates hold ERC-4337 smart accounts, so `account.address` is a contract, not an
 * EOA. A signature from one cannot be ecrecover'd — it has to be checked by calling
 * ERC-1271 on the account, or ERC-6492 if the account has not been deployed yet
 * (which is the common case, since deployment is deferred to the first transaction).
 *
 * viem's *public client action* `verifyMessage` handles both. Note this is not the
 * same function as the bare `verifyMessage` exported from "viem", which is EOA-only
 * and would reject every smart account it ever saw. They share a name.
 *
 * Deliberately uses the public Avalanche RPC rather than thirdweb: a thirdweb client
 * id is domain-restricted and a serverless function sends no Origin header, so it
 * would need a secret key this path does not otherwise require.
 */
const RPC_URL = process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(RPC_URL),
});

/** How stale a signature may be. Long enough for a slow phone, short enough to matter. */
export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * The generic form: does this account vouch for this exact text, recently?
 *
 * Both the activity signature and the business pledge reduce to this. Smart accounts
 * are the reason it cannot be a one-liner — see the note at the top of the file.
 */
export async function verifySignedText(p: {
  address: string;
  message: string;
  signature: string;
  ts: number;
}): Promise<VerifyResult> {
  if (!p.signature) return { ok: false, reason: "Signature is required" };
  if (!Number.isFinite(p.ts)) return { ok: false, reason: "Signed-at timestamp is required" };
  if (Math.abs(Date.now() - p.ts) > SIGNATURE_WINDOW_MS) {
    return { ok: false, reason: "That signature has expired — please try again" };
  }

  try {
    const valid = await publicClient.verifyMessage({
      address: p.address as `0x${string}`,
      message: p.message,
      signature: p.signature as `0x${string}`,
    });
    return valid ? { ok: true } : { ok: false, reason: "Signature does not match that account" };
  } catch (err) {
    const detail = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return { ok: false, reason: `Could not verify signature: ${detail}` };
  }
}

/* ------------------------------------------------------------- approval receipts */

const ACTIVITY_APPROVED = parseAbiItem(
  "event ActivityApproved(uint256 indexed orgId, address indexed advocate, uint8 activityType, bytes32 proofHash, uint256 advocateActivityCount, uint256 streak, uint256 timestamp)"
);

/**
 * Checks that an approval actually happened, rather than trusting the caller's word.
 *
 * PATCH used to accept any string as a txHash, so anyone could mark any submission
 * approved and move the leaderboard. There is no need for a session to fix that: the
 * contract already refuses approvals from anyone but the org's registered approver, so
 * the presence of an ActivityApproved log *is* the authorisation proof. We just have to
 * go and look.
 *
 * Matching on proofHash is what stops one genuine approval being replayed to close out
 * a different submission — the hash commits to that submission's own proof.
 */
export async function verifyApprovalReceipt(p: {
  txHash: string;
  orgId: string;
  advocate: string;
  proofUrl: string;
}): Promise<VerifyResult> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(p.txHash)) {
    return { ok: false, reason: "That is not a transaction hash" };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: p.txHash as `0x${string}` });
  } catch {
    // Also the "invented hash" case: no such transaction on this chain.
    return { ok: false, reason: "No such transaction on Avalanche Fuji" };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: "That transaction reverted" };
  }

  const logs = parseEventLogs({
    abi: [ACTIVITY_APPROVED],
    logs: receipt.logs,
  }).filter((l) => l.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase());

  if (logs.length === 0) {
    return { ok: false, reason: "That transaction approved nothing" };
  }

  // Computed exactly as the org surface computes it before sending the transaction.
  const expected = proofHashOf(p.proofUrl);
  const advocate = p.advocate.toLowerCase();

  const match = logs.some(
    (l) =>
      String(l.args.orgId) === String(p.orgId) &&
      l.args.advocate?.toLowerCase() === advocate &&
      l.args.proofHash === expected
  );

  if (!match) {
    return {
      ok: false,
      reason: "That approval was for a different submission",
    };
  }

  return { ok: true };
}

/* ----------------------------------------------------------- submission receipts */

const ACTIVITY_SUBMITTED = parseAbiItem(
  "event ActivitySubmitted(uint256 indexed orgId, address indexed advocate, uint256 indexed submissionId, uint8 activityType, bytes32 proofHash, uint256 timestamp)"
);

/**
 * Checks that the advocate really wrote this submission on-chain from their own wallet.
 *
 * This replaced the signed-message check: instead of verifying an ERC-1271 signature,
 * the server reads the transaction the advocate's smart account sent. `msg.sender`
 * inside submitActivity IS the advocate under ERC-4337, so a matching
 * ActivitySubmitted log is proof of origin the chain itself enforced.
 *
 * One tx could in principle back two POST bodies with the same proof — accepted: the
 * org's manual approval is the gate on anything that pays, and duplicate queue rows
 * with identical proof are visible to the reviewer.
 */
export async function verifySubmissionReceipt(p: {
  txHash: string;
  orgId: string;
  advocate: string;
  proofUrl?: string;
}): Promise<VerifyResult> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(p.txHash)) {
    return { ok: false, reason: "That is not a transaction hash" };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: p.txHash as `0x${string}` });
  } catch {
    return { ok: false, reason: "No such transaction on Avalanche Fuji" };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: "That transaction reverted" };
  }

  const logs = parseEventLogs({
    abi: [ACTIVITY_SUBMITTED],
    logs: receipt.logs,
  }).filter((l) => l.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase());

  if (logs.length === 0) {
    return { ok: false, reason: "That transaction recorded no submission" };
  }

  const expected = proofHashOf(p.proofUrl);
  const advocate = p.advocate.toLowerCase();

  const match = logs.some(
    (l) =>
      String(l.args.orgId) === String(p.orgId) &&
      l.args.advocate?.toLowerCase() === advocate &&
      l.args.proofHash === expected
  );

  return match
    ? { ok: true }
    : { ok: false, reason: "That transaction was for a different submission" };
}
