import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getRewardLedger, recordRewardGiven, rewardColumnsAvailable } from "@/lib/store";
import { requireApprover } from "@/lib/verify";
import { ORG_ACTIONS } from "@/lib/org-action";

/**
 * Who deserves a reward, campaign by campaign — the business's Rewards page and the
 * per-campaign half of Liability.
 *
 *   GET  ?orgId=1  – { ledger, rewardsAvailable }
 *   POST           – record rewards handed over (approver-signed):
 *                    { orgId, campaignId, advocate, delta: 1 | -1, address, ts, signature }
 *
 * Earned is computed from approved submissions; only what was handed over is stored.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId || !/^\d+$/.test(orgId)) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const [ledger, rewardsAvailable] = await Promise.all([
    getRewardLedger(orgId),
    rewardColumnsAvailable(),
  ]);
  return NextResponse.json({ ledger, rewardsAvailable });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { orgId, campaignId, advocate, delta, address, ts, signature } = body as {
    orgId?: string;
    campaignId?: string;
    advocate?: string;
    delta?: number;
    address?: string;
    ts?: number;
    signature?: string;
  };

  if (!orgId || !campaignId || !UUID.test(campaignId)) {
    return NextResponse.json({ error: "orgId and campaignId are required" }, { status: 400 });
  }
  if (!advocate || !isAddress(advocate)) {
    return NextResponse.json({ error: "advocate must be an address" }, { status: 400 });
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta must be 1 or -1" }, { status: 400 });
  }

  const auth = await requireApprover({
    orgId: String(orgId),
    address: address ?? "",
    action: ORG_ACTIONS.rewardGive,
    ts: Number(ts),
    signature: signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const result = await recordRewardGiven({
      orgId: String(orgId),
      campaignId,
      advocate,
      delta,
      by: address as string,
    });
    if (!result) {
      return NextResponse.json({ error: "No such campaign for this org" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not record the reward" },
      { status: 400 }
    );
  }
}
