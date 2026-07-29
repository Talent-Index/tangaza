import { getContractEvents } from "thirdweb";
import { eth_blockNumber, getRpcClient } from "thirdweb/rpc";
import { CHAIN } from "./chain";
import { client, contract } from "./client";
import { activitySubmittedEvent } from "./events";

/**
 * Finds an ActivitySubmitted the advocate already managed to get on-chain.
 *
 * Why this exists: the first transaction a smart account ever sends also deploys the
 * account, and that heavier userOp regularly outlives the SDK's hardcoded 120s wait —
 * the client shows "timeout" while the op quietly mines a minute later. Retrying then
 * fails with AA25 ("another deployment operation for this sender is already being
 * processed") until the bundler clears. So before sending anything, and again after a
 * timeout, we simply look at the chain: if the submission with this exact proof hash
 * is already there, use it instead of sending a duplicate.
 *
 * Windows of ≤900 blocks because the public Fuji RPC rejects ranges over 1000, and
 * this must work on the RPC fallback path, not just via Insight.
 */
const WINDOW = 900n;
const LOOKBACK_WINDOWS = 2; // ~1 hour of Fuji blocks — a stuck op resolves well within it

export async function findSubmissionOnChain(p: {
  orgId: bigint;
  advocate: string;
  proofHash: `0x${string}`;
}): Promise<string | null> {
  const rpc = getRpcClient({ client, chain: CHAIN });
  const tip = await eth_blockNumber(rpc);
  const advocate = p.advocate.toLowerCase();

  for (let i = 0; i < LOOKBACK_WINDOWS; i++) {
    const toBlock = tip - WINDOW * BigInt(i);
    const fromBlock = toBlock - WINDOW + 1n;
    const events = await getContractEvents({
      contract,
      events: [activitySubmittedEvent],
      fromBlock: fromBlock > 0n ? fromBlock : 0n,
      toBlock,
    });

    // Newest first, so a retry picks up the latest matching record.
    for (const e of [...events].reverse()) {
      const args = e.args as {
        orgId: bigint;
        advocate: string;
        proofHash: `0x${string}`;
      };
      if (
        args.orgId === p.orgId &&
        args.advocate.toLowerCase() === advocate &&
        args.proofHash === p.proofHash
      ) {
        return e.transactionHash;
      }
    }
  }
  return null;
}

/** Keep looking for a while — the op that "timed out" usually mines shortly after. */
export async function awaitSubmissionOnChain(
  p: { orgId: bigint; advocate: string; proofHash: `0x${string}` },
  timeoutMs = 90_000,
  intervalMs = 5_000
): Promise<string | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const tx = await findSubmissionOnChain(p);
    if (tx) return tx;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
