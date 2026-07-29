import { getContractEvents, parseEventLogs, prepareEvent } from "thirdweb";
import { eth_blockNumber, eth_getTransactionReceipt, getRpcClient } from "thirdweb/rpc";
import { listContractTxHashes } from "./avacloud";
import { CHAIN } from "./chain";
import { client, contract } from "./client";

/**
 * Event indexing, jam-grade: poll `getContractEvents` in block windows and fold the
 * results in the browser. No external indexer, no backend job. Good enough for a
 * single pilot org; swap for a real indexer before you have thousands of advocates.
 */

const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "0");

// Public RPCs cap eth_getLogs ranges. Avalanche's rejects anything over 1000, and
// thirdweb falls back to exactly that RPC whenever Insight is unavailable — 2000 here
// meant every event reader broke the moment Insight blinked (and npm run verify, which
// always runs without an Origin header, broke every time). 900 works on both paths.
const WINDOW = 900n;

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

export const activitySubmittedEvent = prepareEvent({
  signature:
    "event ActivitySubmitted(uint256 indexed orgId, address indexed advocate, uint256 indexed submissionId, uint8 activityType, bytes32 proofHash, uint256 timestamp)",
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

/**
 * Fetches the contract's events — indexed path first, window scan as the fallback.
 *
 * The primary path asks AvaCloud's Data API for the contract's transaction list
 * (already indexed, one call) and reads those receipts: work proportional to what the
 * contract has actually done, immune to the RPC's 1000-block eth_getLogs cap, and not
 * dependent on thirdweb Insight being up. The window scan below survives as the
 * fallback so an AvaCloud outage costs speed, not data.
 */
export async function fetchEvents(events: PreparedEvent[]) {
  try {
    return await fetchEventsViaDataApi(events);
  } catch (err) {
    console.warn(
      "[ubu-tangaza] Data API unavailable, falling back to block scanning:",
      err instanceof Error ? err.message : err
    );
    return fetchEventsByScanning(events);
  }
}

async function fetchEventsViaDataApi(events: PreparedEvent[]) {
  const hashes = await listContractTxHashes(CHAIN.id);
  const rpc = getRpcClient({ client, chain: CHAIN });

  const out: Awaited<ReturnType<typeof getContractEvents>> = [];
  // Small batches: kind to the RPC, and ~an org's whole history is a dozen receipts.
  const BATCH = 8;
  for (let i = 0; i < hashes.length; i += BATCH) {
    const receipts = await Promise.all(
      hashes.slice(i, i + BATCH).map((hash) =>
        eth_getTransactionReceipt(rpc, { hash: hash as `0x${string}` })
      )
    );
    for (const receipt of receipts) {
      const parsed = parseEventLogs({ logs: receipt.logs, events });
      out.push(...(parsed as typeof out));
    }
  }
  return out;
}

async function fetchEventsByScanning(events: PreparedEvent[]) {
  const rpc = getRpcClient({ client, chain: CHAIN });
  const latest = await eth_blockNumber(rpc);

  let start = DEPLOY_BLOCK;
  if (start === 0n) {
    start = latest > MAX_LOOKBACK ? latest - MAX_LOOKBACK : 0n;
    console.warn(
      `[ubu-tangaza] NEXT_PUBLIC_DEPLOY_BLOCK is unset — only scanning the last ${MAX_LOOKBACK} blocks (from ${start}). ` +
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

export interface AdvocateHistoryEntry {
  kind: "submitted" | "approved" | "earned" | "redeemed";
  txHash: string;
  timestamp: number;
  valueKES?: number;
  creditId?: string;
}

/**
 * One wallet's whole on-chain story, newest first: what they recorded themselves,
 * what the org approved, the credits that minted, and the credits they burned.
 *
 * This exists so an advocate can point a wallet — ours, or Core, or anything holding
 * the same account — at their history and see every entry as a real transaction. The
 * chain is the record; this just reads it back.
 */
export async function loadAdvocateHistory(
  advocate: string,
  orgId: bigint
): Promise<AdvocateHistoryEntry[]> {
  const logs = await fetchEvents([
    activitySubmittedEvent,
    activityApprovedEvent,
    rewardEarnedEvent,
    redeemedEvent,
  ]);

  const me = advocate.toLowerCase();
  const out: AdvocateHistoryEntry[] = [];

  for (const log of logs) {
    const args = log.args as Record<string, unknown>;
    if (String(args.advocate ?? "").toLowerCase() !== me) continue;
    if ((args.orgId as bigint) !== orgId) continue;

    const base = {
      txHash: log.transactionHash,
      timestamp: Number((args.timestamp as bigint | undefined) ?? 0n) * 1000,
    };

    switch (log.eventName) {
      case "ActivitySubmitted":
        out.push({ kind: "submitted", ...base });
        break;
      case "ActivityApproved":
        out.push({ kind: "approved", ...base });
        break;
      case "RewardEarned":
        out.push({
          kind: "earned",
          ...base,
          valueKES: Number(args.valueKES as bigint),
          creditId: String(args.creditId as bigint),
        });
        break;
      case "Redeemed":
        out.push({
          kind: "redeemed",
          ...base,
          valueKES: Number(args.valueKES as bigint),
          creditId: String(args.creditId as bigint),
        });
        break;
    }
  }

  return out.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
}
