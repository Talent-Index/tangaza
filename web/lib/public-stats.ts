import "server-only";
import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";
import { FUJI_RPC_URL } from "./rpc";
import { TANGAZA_ABI } from "./abi";
import { sql } from "./db";
import { listAllActiveCampaigns, listRewardTiers } from "./store";
import { formatReward } from "./types";

const RPC_URL = FUJI_RPC_URL;
const client = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });

export interface ChainTotals {
  businesses: number;
  approved: number;
  capKes: number;
  issuedKes: number;
  redeemedKes: number;
}

export interface Pilot {
  id: string;
  slug: string;
  title: string;
  orgName: string;
  blurb?: string;
  coverUrl?: string;
  /** What taking part earns, one line per level the business offers, cheapest first. */
  rewards: string[];
  participants: number;
  approved: number;
}

export interface PublicStats {
  awaiting: number | null;
  chain: ChainTotals | null;
  contract: string;
  pilots: Pilot[];
}

/** Everything the public site shows as "live", in one cacheable call. */
export async function getPublicStats(): Promise<PublicStats> {
  const contract = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "") as `0x${string}`;

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
      return [] as Pilot[];
    }),
  ]);

  return { awaiting, chain, contract, pilots };
}

async function readChain(contract: `0x${string}`): Promise<ChainTotals | null> {
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
  const totals: ChainTotals = { businesses: count, approved: 0, capKes: 0, issuedKes: 0, redeemedKes: 0 };
  for (const o of orgs as Array<Record<string, unknown>>) {
    totals.approved += Number(o.approvedActivities ?? 0);
    totals.capKes += Number(o.emissionCapKES ?? 0);
    totals.issuedKes += Number(o.issuedKES ?? 0);
    totals.redeemedKes += Number(o.redeemedKES ?? 0);
  }
  return totals;
}

async function readPilots(): Promise<Pilot[]> {
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
