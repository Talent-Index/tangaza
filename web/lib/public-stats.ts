import "server-only";
import { createPublicClient, http } from "viem";
import { VIEM_CHAIN } from "./viem-chain";
import { RPC_URL } from "./rpc";
import { TANGAZA_ABI } from "./abi";
import { sql } from "./db";
import { listAllActiveCampaigns, listRewardTiers } from "./store";
import { formatReward } from "./types";
import type { PublicChainTotals, PublicPilot, PublicStats } from "./public-display";

export type ChainTotals = PublicChainTotals;
export type Pilot = PublicPilot;
export type { PublicStats };

const client = createPublicClient({ chain: VIEM_CHAIN, transport: http(RPC_URL) });

let memo: { at: number; value: PublicStats } | null = null;
const MEMO_MS = 60_000;

/** Everything the public site shows as "live", in one cacheable call. */
export async function getPublicStats(): Promise<PublicStats> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  const value = await loadPublicStats();
  if (value.chain || value.pilotsKnown) memo = { at: Date.now(), value };
  return value;
}

async function loadPublicStats(): Promise<PublicStats> {
  const contract = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "") as `0x${string}`;
  let pilotsKnown = true;

  const [chain, awaiting, pilots] = await Promise.all([
    readChain(contract).catch((e) => {
      console.error("[stats:chain]", e);
      return null;
    }),
    sql`select count(*)::int as n from submissions where status = 'pending'`
      .then((r) => Number((r as Array<{ n: number }>)[0]?.n ?? 0))
      .catch(() => null),
    readPilots().catch((e) => {
      console.error("[stats:pilots]", e);
      pilotsKnown = false;
      return [] as PublicPilot[];
    }),
  ]);

  return { awaiting, chain, contract, pilots, pilotsKnown };
}

async function readChain(contract: `0x${string}`): Promise<PublicChainTotals | null> {
  if (!contract) return null;
  const count = Number(
    await client.readContract({ address: contract, abi: TANGAZA_ABI, functionName: "orgCount" })
  );
  const orgs = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      client.readContract({
        address: contract,
        abi: TANGAZA_ABI,
        functionName: "getOrg",
        args: [BigInt(i + 1)],
      })
    )
  );
  const totals: PublicChainTotals = { businesses: count, approved: 0, capKes: 0, issuedKes: 0, redeemedKes: 0 };
  for (const o of orgs as Array<Record<string, unknown>>) {
    totals.approved += Number(o.approvedActivities ?? 0);
    totals.capKes += Number(o.emissionCapKES ?? 0);
    totals.issuedKes += Number(o.issuedKES ?? 0);
    totals.redeemedKes += Number(o.redeemedKES ?? 0);
  }
  return totals;
}

async function readPilots(): Promise<PublicPilot[]> {
  const [campaigns, counts] = await Promise.all([
    listAllActiveCampaigns(),
    sql`select campaign_id, count(*)::int as n from submissions
        where status = 'approved' and campaign_id is not null group by campaign_id`,
  ]);
  const approved = new Map(
    (counts as Array<{ campaign_id: string; n: number }>).map((r) => [r.campaign_id, Number(r.n)])
  );
  // Rewards belong to the business, so read each ladder once however many campaigns it runs.
  const orgIds = [...new Set(campaigns.map((c) => c.orgId))];
  const ladders = new Map(
    await Promise.all(
      orgIds.map(async (id) => {
        const tiers = await listRewardTiers(id).catch(() => []);
        const lines = tiers.map((t) =>
          t.amount != null || t.rewardKind
            ? formatReward({ amount: t.amount, currency: t.currency, rewardKind: t.rewardKind })
            : t.perk || t.name
        );
        return [id, lines] as const;
      })
    )
  );
  return campaigns.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    orgName: c.orgName,
    blurb: c.blurb,
    coverUrl: c.coverUrl,
    rewards: ladders.get(c.orgId) ?? [],
    participants: c.participantCount,
    approved: approved.get(c.id) ?? 0,
  }));
}
