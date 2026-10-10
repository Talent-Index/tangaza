import { NextRequest, NextResponse } from "next/server";
import { getReferralBoards } from "@/lib/store";

/**
 * The Referrals page: each referral a business created and who did what under it —
 * link clicks, friends who joined, approved referrals and the rewards they earned.
 *
 *   GET ?orgId=1 – { referrals }
 *
 * Creating a referral goes through PUT /api/campaigns with kind "referral".
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId || !/^\d+$/.test(orgId)) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  return NextResponse.json({ referrals: await getReferralBoards(orgId) });
}
