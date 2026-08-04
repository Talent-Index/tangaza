import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getOrCreateShareLink, listCampaignShares } from "@/lib/store";

/**
 * Personal share links for a campaign.
 *
 *   POST {slug, address} – mint (or return) this person's link for the campaign
 *   GET  ?campaignId=    – who is spreading it, best first (the business view)
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { slug, address } = body as { slug?: string; address?: string };
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }

  const link = await getOrCreateShareLink(slug, address);
  if (!link) return NextResponse.json({ error: `No campaign "${slug}"` }, { status: 404 });

  return NextResponse.json({
    ...link,
    url: `${req.nextUrl.origin}/s/${link.code}`,
  });
}

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }
  return NextResponse.json({ sharers: await listCampaignShares(campaignId) });
}
