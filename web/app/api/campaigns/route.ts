import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  getCampaignBySlug,
  hasJoinedCampaign,
  joinCampaign,
  listAllActiveCampaigns,
  peekShareCode,
  listCampaigns,
  upsertCampaign,
} from "@/lib/store";

/**
 * Campaigns — a business's shareable push, scoped to a stretch of time and a subset of
 * the engagements it already rewards.
 *
 *   GET  ?orgId=1        – everything this business is running
 *   GET  ?slug=…         – one campaign, for the shared link
 *   GET  ?slug=…&address – …and whether that person has joined
 *   POST                 – join
 *
 * Joining scopes what you see; it never changes what you earn. Weight and approval
 * work identically whether or not anybody pressed Join, which keeps a campaign from
 * quietly becoming a second reward system with its own rules.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const slug = params.get("slug");
  const orgId = params.get("orgId");
  const address = params.get("address");

  if (slug) {
    const campaign = await getCampaignBySlug(slug);
    if (!campaign) {
      return NextResponse.json({ error: `No campaign "${slug}"` }, { status: 404 });
    }
    const joined =
      address && isAddress(address) ? await hasJoinedCampaign(campaign.id, address) : false;
    return NextResponse.json({ campaign, joined });
  }

  if (params.get("all") === "true") {
    // The discovery feed: every live campaign from every registered business, so an
    // advocate's "Happening now" is not pinned to whichever org the app shipped with.
    const campaigns = await listAllActiveCampaigns();
    return NextResponse.json({ campaigns });
  }

  if (!orgId) {
    return NextResponse.json({ error: "orgId or slug is required" }, { status: 400 });
  }
  const campaigns = await listCampaigns(orgId);
  return NextResponse.json({ campaigns });
}

/** Create or update a campaign — the business side. POST stays the advocate's Join. */
export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { id, orgId, title, blurb, endsAt, active, engagementTypeIds } = body as {
    id?: string;
    orgId?: string;
    title?: string;
    blurb?: string;
    endsAt?: string | null;
    active?: boolean;
    engagementTypeIds?: string[];
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const campaign = await upsertCampaign({
      id,
      orgId: String(orgId),
      title: title.trim().slice(0, 120),
      blurb: blurb?.trim().slice(0, 500),
      endsAt: endsAt || null,
      active,
      engagementTypeIds,
    });
    return NextResponse.json({ campaign }, { status: id ? 200 : 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save campaign" },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { slug, address, via } = body as { slug?: string; address?: string; via?: string };

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }

  const campaign = await getCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ error: `No campaign "${slug}"` }, { status: 404 });
  }
  if (!campaign.active) {
    return NextResponse.json({ error: "That campaign has closed" }, { status: 409 });
  }

  // An unknown or absent code is never an error — attribution is a bonus, not a gate.
  const referredBy = via ? (await peekShareCode(via).catch(() => undefined))?.sharer : undefined;
  const joinedNow = await joinCampaign(campaign.id, campaign.orgId, address, referredBy);

  // Re-read: the copy above was fetched before the insert, so its participant count
  // is one short of the truth the caller just created.
  const updated = (await getCampaignBySlug(slug)) ?? campaign;
  return NextResponse.json({ campaign: updated, joined: true, joinedNow });
}
