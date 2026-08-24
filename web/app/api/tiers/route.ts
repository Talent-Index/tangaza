import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  deleteRewardTier,
  getAdvocateLevel,
  listAdvocateActivityProgress,
  listRewardTiers,
  upsertRewardTier,
} from "@/lib/store";
import { requireApprover } from "@/lib/verify";
import { ORG_ACTIONS } from "@/lib/org-action";
import { CURRENCY_CODES, PAYOUT_KIND_IDS } from "@/lib/types";

/**
 * The levels a business offers, and where one person stands against them.
 *
 * The contract knows exactly one threshold — 20 approved activities mints a KES 500
 * credit — and that is the money, enforced on-chain against a cap that cannot be
 * raised. Levels are the recognition on top, and they live here precisely so a
 * business can change what it gives away without being able to touch the solvency
 * rules that decide what it owes.
 *
 *   GET    ?orgId=1                  – the ladder
 *   GET    ?orgId=1&address=0x…      – the ladder plus where that person is on it
 *   POST                            – create or update a level
 *   DELETE ?orgId=1&id=…            – remove a level
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const address = req.nextUrl.searchParams.get("address");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const tiers = await listRewardTiers(orgId);

  if (!address) return NextResponse.json({ tiers });
  if (!isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }

  const [standing, activityProgress] = await Promise.all([
    getAdvocateLevel(orgId, address),
    listAdvocateActivityProgress(orgId, address),
  ]);
  return NextResponse.json({ tiers, standing, activityProgress });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const {
    orgId, level, name, perk, icon, thresholdWeight,
    amount, currency, rewardKind, engagementTypeId, targetCount,
    address, ts, signature,
  } = body as {
    orgId?: string;
    level?: number;
    name?: string;
    perk?: string;
    icon?: string;
    thresholdWeight?: number;
    amount?: number | null;
    currency?: string | null;
    rewardKind?: string | null;
    engagementTypeId?: string | null;
    targetCount?: number | null;
    address?: string;
    ts?: number;
    signature?: string;
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  // A per-activity goal needs both the activity and how many times.
  if (engagementTypeId && !(Number.isInteger(targetCount) && (targetCount as number) > 0)) {
    return NextResponse.json(
      { error: "A per-activity goal needs a target count of 1 or more" },
      { status: 400 }
    );
  }
  if (amount != null && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)) {
    return NextResponse.json({ error: "amount must be zero or more" }, { status: 400 });
  }
  if (currency && !CURRENCY_CODES.includes(currency)) {
    return NextResponse.json({ error: `currency must be one of ${CURRENCY_CODES.join(", ")}` }, { status: 400 });
  }
  if (rewardKind && !PAYOUT_KIND_IDS.includes(rewardKind)) {
    return NextResponse.json({ error: `rewardKind must be one of ${PAYOUT_KIND_IDS.join(", ")}` }, { status: 400 });
  }

  const auth = await requireApprover({
    orgId: String(orgId),
    address: address ?? "",
    action: ORG_ACTIONS.tierSave,
    ts: Number(ts),
    signature: signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }
  if (!Number.isInteger(level) || (level as number) < 1) {
    return NextResponse.json({ error: "level must be a whole number from 1" }, { status: 400 });
  }
  if (!name?.trim() || !perk?.trim()) {
    return NextResponse.json({ error: "name and perk are required" }, { status: 400 });
  }
  if (!Number.isInteger(thresholdWeight) || (thresholdWeight as number) < 0) {
    return NextResponse.json(
      { error: "thresholdWeight must be a whole number of approved weight" },
      { status: 400 }
    );
  }

  try {
    const tier = await upsertRewardTier({
      orgId: String(orgId),
      level: level as number,
      name: name.trim().slice(0, 60),
      perk: perk.trim().slice(0, 280),
      icon: icon?.trim().slice(0, 8) || "★",
      thresholdWeight: thresholdWeight as number,
      amount: amount ?? null,
      currency: currency ?? null,
      rewardKind: rewardKind ?? null,
      engagementTypeId: engagementTypeId ?? null,
      targetCount: engagementTypeId ? targetCount ?? null : null,
    });
    return NextResponse.json({ tier }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Two levels at the same threshold would make "what have I reached" ambiguous.
    if (message.includes("reward_tiers_org_id_threshold_weight_key")) {
      return NextResponse.json(
        { error: "Another level already unlocks at that weight" },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const orgId = params.get("orgId");
  const id = params.get("id");
  if (!orgId || !id) {
    return NextResponse.json({ error: "orgId and id are required" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    address?: string;
    ts?: number;
    signature?: string;
  };
  const auth = await requireApprover({
    orgId,
    address: body.address ?? "",
    action: ORG_ACTIONS.tierDelete,
    ts: Number(body.ts),
    signature: body.signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const removed = await deleteRewardTier(orgId, id);
  if (!removed) {
    return NextResponse.json({ error: "No such level for this org" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
