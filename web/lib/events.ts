import { getContractEvents, prepareEvent } from "thirdweb";
import { eth_blockNumber, getRpcClient } from "thirdweb/rpc";
import { CHAIN } from "./chain";
import { client, contract } from "./client";

/**
 * Event indexing, jam-grade: poll `getContractEvents` in block windows and fold the
 * results in the browser. No external indexer, no backend job. Good enough for a
 * single pilot org; swap for a real indexer before you have thousands of advocates.
 */

const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "0");

// Public RPCs cap eth_getLogs ranges. 2000 keeps us under every provider's limit.
const WINDOW = 2000n;

// Safety net for an unset NEXT_PUBLIC_DEPLOY_BLOCK. Fuji is millions of blocks deep,
// so scanning from genesis in 2000-block windows means thousands of sequential RPC
// calls and a dashboard that never finishes loading. At ~2s per block this covers
// roughly the last 28 hours — enough for a jam deployment, and loud about it.
const MAX_LOOKBACK = 50_000n;

export const rewardEarnedEvent = prepareEvent({
  signature:
    "event RewardEarned(uint256 indexed orgId, address indexed advocate, uint256 indexed creditId, uint256 valueKES, uint256 issuedKES, uint256 timestamp)",
});

export const redeemedEvent = prepareEvent({
  signature:
    "event Redeemed(uint256 indexed orgId, address indexed advocate, uint256 indexed creditId, uint8 rewardType, uint256 valueKES, uint256 redeemedKES, uint256 timestamp)",
});

export const activityApprovedEvent = prepareEvent({
  signature:
    "event ActivityApproved(uint256 indexed orgId, address indexed advocate, uint8 activityType, bytes32 proofHash, uint256 advocateActivityCount, uint256 streak, uint256 timestamp)",
});

export const budgetExhaustedEvent = prepareEvent({
  signature:
    "event BudgetExhausted(uint256 indexed orgId, address indexed advocate, uint256 issuedKES, uint256 emissionCapKES)",
});

type PreparedEvent = ReturnType<typeof prepareEvent>;

/** Fetches events across the whole chain history in RPC-safe windows. */
export async function fetchEvents(events: PreparedEvent[]) {
  const rpc = getRpcClient({ client, chain: CHAIN });
  const latest = await eth_blockNumber(rpc);

  let start = DEPLOY_BLOCK;
  if (start === 0n) {
    start = latest > MAX_LOOKBACK ? latest - MAX_LOOKBACK : 0n;
    console.warn(
      `[tangaza] NEXT_PUBLIC_DEPLOY_BLOCK is unset — only scanning the last ${MAX_LOOKBACK} blocks (from ${start}). ` +
        `Set it from contracts/deployments.json or older rewards will be missing from the dashboards.`
    );
  }

  const out: Awaited<ReturnType<typeof getContractEvents>> = [];
  for (let from = start; from <= latest; from += WINDOW) {
    const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n;
    const batch = await getContractEvents({
      contract,
      events,
      fromBlock: from,
      toBlock: to,
    });
    out.push(...batch);
  }
  return out;
}

export interface LedgerPoint {
  timestamp: number;
  issuedKES: number;
  redeemedKES: number;
  outstandingKES: number;
  kind: "earned" | "redeemed";
}

export interface AdvocateRow {
  address: string;
  activities: number;
  creditsEarned: number;
  streak: number;
}

export interface OrgActivity {
  kind: "earned" | "redeemed" | "approved" | "exhausted";
  advocate: string;
  timestamp: number;
  valueKES?: number;
  creditId?: string;
}

export interface OrgLedger {
  points: LedgerPoint[];
  leaderboard: AdvocateRow[];
  recent: OrgActivity[];
  totalActivities: number;
  /** True once the org has hit its cap and an approval failed to mint. */
  exhausted: boolean;
}

/**
 * Folds the org's whole event history into everything the org dashboards need:
 * the liability curve, the leaderboard, and a recent-activity feed.
 */
export async function loadOrgLedger(orgId: bigint): Promise<OrgLedger> {
  const logs = await fetchEvents([
    rewardEarnedEvent,
    redeemedEvent,
    activityApprovedEvent,
    budgetExhaustedEvent,
  ]);

  const mine = logs.filter((l) => (l.args as { orgId?: bigint }).orgId === orgId);

  const points: LedgerPoint[] = [];
  const recent: OrgActivity[] = [];
  const byAdvocate = new Map<string, AdvocateRow>();

  let issued = 0;
  let redeemed = 0;
  let totalActivities = 0;
  let exhausted = false;

  const row = (address: string) => {
    const key = address.toLowerCase();
    let r = byAdvocate.get(key);
    if (!r) {
      r = { address: key, activities: 0, creditsEarned: 0, streak: 0 };
      byAdvocate.set(key, r);
    }
    return r;
  };

  // Chain order, so the running totals below are correct.
  const ordered = [...mine].sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? Number(a.logIndex) - Number(b.logIndex)
      : Number(a.blockNumber - b.blockNumber)
  );

  for (const log of ordered) {
    const args = log.args as Record<string, unknown>;
    const advocate = String(args.advocate ?? "");
    const ts = Number((args.timestamp as bigint | undefined) ?? 0n) * 1000;

    switch (log.eventName) {
      case "ActivityApproved": {
        totalActivities += 1;
        const r = row(advocate);
        r.activities = Number(args.advocateActivityCount as bigint);
        r.streak = Number(args.streak as bigint);
        recent.push({ kind: "approved", advocate, timestamp: ts });
        break;
      }
      case "RewardEarned": {
        const value = Number(args.valueKES as bigint);
        issued += value;
        row(advocate).creditsEarned += 1;
        points.push({
          timestamp: ts,
          issuedKES: issued,
          redeemedKES: redeemed,
          outstandingKES: issued - redeemed,
          kind: "earned",
        });
        recent.push({
          kind: "earned",
          advocate,
          timestamp: ts,
          valueKES: value,
          creditId: String(args.creditId as bigint),
        });
        break;
      }
      case "Redeemed": {
        const value = Number(args.valueKES as bigint);
        redeemed += value;
        points.push({
          timestamp: ts,
          issuedKES: issued,
          redeemedKES: redeemed,
          outstandingKES: issued - redeemed,
          kind: "redeemed",
        });
        recent.push({
          kind: "redeemed",
          advocate,
          timestamp: ts,
          valueKES: value,
          creditId: String(args.creditId as bigint),
        });
        break;
      }
      case "BudgetExhausted": {
        // This event carries no timestamp — it is a state flag, not a ledger entry.
        exhausted = true;
        recent.push({ kind: "exhausted", advocate, timestamp: 0 });
        break;
      }
    }
  }

  const leaderboard = [...byAdvocate.values()].sort(
    (a, b) => b.creditsEarned - a.creditsEarned || b.activities - a.activities
  );

  return {
    points,
    leaderboard,
    recent: recent.reverse().slice(0, 40),
    totalActivities,
    exhausted,
  };
}
