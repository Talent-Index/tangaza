import { NextRequest, NextResponse } from "next/server";
import { getOrgCampaignOverview } from "@/lib/store";

/**
 * The business's campaign roster: every campaign, exactly who joined each (and who
 * brought them), plus the org-wide count of distinct people — one person in three
 * campaigns is one person.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  return NextResponse.json(await getOrgCampaignOverview(orgId));
}
