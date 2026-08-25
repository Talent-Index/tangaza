import { NextRequest, NextResponse } from "next/server";
import { listCampaignActivity } from "@/lib/store";

/**
 * Every activity logged under a campaign — the business's tracking feed.
 *
 *   GET ?campaignId=…   – newest-first list of what participants did (and its status)
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }
  const activity = await listCampaignActivity(campaignId);
  return NextResponse.json({ activity });
}
