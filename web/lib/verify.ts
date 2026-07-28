import "server-only";
import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";
import { activityMessage } from "./sign-message";

export { activityMessage };

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

export async function verifyActivitySignature(p: {
  orgId: string;
  advocate: string;
  engagementTypeId: string;
  proofUrl?: string;
  ts: number;
  signature: string;
}): Promise<VerifyResult> {
  if (!p.signature) return { ok: false, reason: "Signature is required" };
  if (!Number.isFinite(p.ts)) return { ok: false, reason: "Signed-at timestamp is required" };

  const age = Math.abs(Date.now() - p.ts);
  if (age > SIGNATURE_WINDOW_MS) {
    // Bounds replay without needing a nonce store, which a stateless function has
    // nowhere to keep. Also catches a badly wrong device clock, which is worth
    // rejecting loudly rather than silently accepting an unbounded signature.
    return { ok: false, reason: "That signature has expired — please try again" };
  }

  const message = activityMessage(p);

  try {
    const valid = await publicClient.verifyMessage({
      address: p.advocate as `0x${string}`,
      message,
      signature: p.signature as `0x${string}`,
    });
    return valid ? { ok: true } : { ok: false, reason: "Signature does not match that account" };
  } catch (err) {
    // A malformed signature throws rather than returning false.
    const detail = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return { ok: false, reason: `Could not verify signature: ${detail}` };
  }
}
