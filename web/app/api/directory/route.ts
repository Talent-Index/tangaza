import { NextRequest, NextResponse } from "next/server";
import { listDirectory } from "@/lib/store";

/**
 * The business's client list — every person who has ever engaged, what they're worth,
 * and how to reach them. Ranked by approved weight, so it reads as a leaderboard for
 * the advocate and a pipeline for the business.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;

  const directory = await listDirectory(orgId, limit);
  return NextResponse.json({ directory });
}
