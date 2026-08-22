import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { deleteRewardTier, getAdvocateLevel, listRewardTiers, upsertRewardTier } from "@/lib/store";

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

  const standing = await getAdvocateLevel(orgId, address);
  return NextResponse.json({ tiers, standing });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { orgId, level, name, perk, icon, thresholdWeight } = body as {
    orgId?: string;
    level?: number;
    name?: string;
    perk?: string;
    icon?: string;
    thresholdWeight?: number;
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
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
  const orgId = req.nextUrl.searchParams.get("orgId");
  const id = req.nextUrl.searchParams.get("id");
  if (!orgId || !id) {
    return NextResponse.json({ error: "orgId and id are required" }, { status: 400 });
  }
  const removed = await deleteRewardTier(orgId, id);
  if (!removed) {
    return NextResponse.json({ error: "No such level for this org" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
