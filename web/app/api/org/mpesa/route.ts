import { NextRequest, NextResponse } from "next/server";
import {
  countMpesaReferrals,
  getOrgMpesaConfig,
  listReferredPurchases,
  setOrgMpesaConfig,
} from "@/lib/store";
import { requireApprover } from "@/lib/verify";
import { ORG_ACTIONS } from "@/lib/org-action";
import { CURRENCY_CODES, PAYOUT_KIND_IDS } from "@/lib/types";

/**
 * The referral pilot's one-screen config + dashboard for a merchant.
 *
 *   GET   ?orgId=1   – { config, count:{verified,total}, purchases } for the pilot page
 *   PATCH            – set Till + referral reward (approver-signed)
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const [config, count, purchases] = await Promise.all([
    getOrgMpesaConfig(orgId),
    countMpesaReferrals(orgId),
    listReferredPurchases(orgId),
  ]);
  // This GET is public (like the other org dashboards); never expose the payer's phone.
  const safe = purchases.map((p) => ({
    id: p.id,
    amount: p.amount,
    referrer: p.referrer,
    createdAt: p.createdAt,
  }));
  return NextResponse.json({ config, count, purchases: safe });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { orgId, tillShortcode, rewardAmount, rewardCurrency, rewardKind, address, ts, signature } =
    body as {
      orgId?: string;
      tillShortcode?: string;
      rewardAmount?: number | null;
      rewardCurrency?: string;
      rewardKind?: string;
      address?: string;
      ts?: number;
      signature?: string;
    };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (rewardAmount != null && (!Number.isFinite(rewardAmount) || rewardAmount < 0)) {
    return NextResponse.json({ error: "reward amount must be zero or more" }, { status: 400 });
  }
  if (rewardCurrency && !CURRENCY_CODES.includes(rewardCurrency)) {
    return NextResponse.json({ error: "unknown currency" }, { status: 400 });
  }
  if (rewardKind && !PAYOUT_KIND_IDS.includes(rewardKind)) {
    return NextResponse.json({ error: "unknown reward type" }, { status: 400 });
  }

  const auth = await requireApprover({
    orgId: String(orgId),
    address: address ?? "",
    action: ORG_ACTIONS.mpesaConfig,
    ts: Number(ts),
    signature: signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  await setOrgMpesaConfig(String(orgId), {
    tillShortcode: tillShortcode?.trim().slice(0, 20) || undefined,
    rewardAmount: rewardAmount ?? undefined,
    rewardCurrency: rewardCurrency || undefined,
    rewardKind: rewardKind || undefined,
  });
  return NextResponse.json({ ok: true });
}
