import { NextRequest, NextResponse } from "next/server";
import { listStandings } from "@/lib/store";

/**
 * The client leaderboard, ranked by approved weight — the number of on-chain activities
 * a person's approvals actually counted for, not the raw submission count. Someone who
 * brought three events outranks someone who posted ten times, if that is how the
 * business weighted it.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

  const standings = await listStandings(orgId, limit);
  return NextResponse.json({ standings });
}
