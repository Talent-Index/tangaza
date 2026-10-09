import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  deleteCampaign,
  ensureReferralEngagementIds,
  getCampaignBySlug,
  getCampaignFunnel,
  goalColumnsAvailable,
  rewardColumnsAvailable,
  hasJoinedCampaign,
  joinCampaign,
  listAllActiveCampaigns,
  listAllCampaignsDiscover,
  listJoinedCampaigns,
  peekShareCode,
  listCampaigns,
  upsertCampaign,
} from "@/lib/store";
import { requireApprover } from "@/lib/verify";
import { ORG_ACTIONS } from "@/lib/org-action";
import { CURRENCY_CODES, PAYOUT_KIND_IDS, isGoalType, type GoalType } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Optional text field: undefined = leave alone, null/"" = clear, else trimmed and length-checked. */
function optText(v: unknown, max: number, name: string): string | null | undefined | Error {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return new Error(`${name} must be text`);
  const t = v.trim();
  if (t.length > max) return new Error(`${name} must be ${max} characters or fewer`);
  return t || null;
}

function validHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Campaigns — a business's shareable push, scoped to a stretch of time and a subset of
 * the engagements it already rewards.
 *
 *   GET  ?orgId=1        – everything this business is running
 *   GET  ?slug=…         – one campaign, for the shared link
 *   GET  ?slug=…&address – …and whether that person has joined
 *   GET  ?funnel=<campaignId>&orgId=1 – the campaign's share → join → submit → approve counts
 *   GET  ?capabilities=goals – { goalsAvailable } (are the goal columns usable?)
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

  if (params.get("capabilities") === "goals") {
    return NextResponse.json({
      goalsAvailable: await goalColumnsAvailable(),
      rewardsAvailable: await rewardColumnsAvailable(),
    });
  }

  const funnelId = params.get("funnel");
  if (funnelId) {
    if (!orgId || !UUID.test(funnelId)) {
      return NextResponse.json({ error: "funnel needs a campaign id and orgId" }, { status: 400 });
    }
    const funnel = await getCampaignFunnel(orgId, funnelId);
    if (!funnel) {
      return NextResponse.json({ error: "No such campaign for this org" }, { status: 404 });
    }
    return NextResponse.json({ funnel });
  }

  const joinedBy = params.get("joinedBy");
  if (joinedBy) {
    if (!isAddress(joinedBy)) {
      return NextResponse.json({ error: "joinedBy must be an address" }, { status: 400 });
    }
    const campaigns = await listJoinedCampaigns(joinedBy);
    return NextResponse.json({ campaigns });
  }

  if (params.get("discover") === "true") {
    const campaigns = await listAllCampaignsDiscover();
    return NextResponse.json({ campaigns });
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
  return NextResponse.json({
    campaigns,
    goalsAvailable: await goalColumnsAvailable(),
    rewardsAvailable: await rewardColumnsAvailable(),
  });
}

/** Create or update a campaign — the business side. POST stays the advocate's Join. */
export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const {
    id, orgId, title, blurb, coverUrl, endsAt, active, engagementTypeIds, address, ts, signature,
    goalType, goalTarget, goalLabel, offerName, offerUrl,
    kind, rewardKind, rewardAmount, rewardCurrency, rewardNote, rewardThreshold, rewardRepeats,
  } =
    body as {
      kind?: string;
      rewardKind?: string | null;
      rewardAmount?: number | null;
      rewardCurrency?: string | null;
      rewardNote?: string | null;
      rewardThreshold?: number | null;
      rewardRepeats?: boolean;
      id?: string;
      orgId?: string;
      title?: string;
      blurb?: string;
      coverUrl?: string | null;
      endsAt?: string | null;
      active?: boolean;
      engagementTypeIds?: string[];
      goalType?: GoalType | null;
      goalTarget?: number | null;
      goalLabel?: string | null;
      offerName?: string | null;
      offerUrl?: string | null;
      address?: string;
      ts?: number;
      signature?: string;
    };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Goal fields: undefined leaves the stored value alone, null clears it.
  if (goalType != null && !isGoalType(goalType)) {
    return NextResponse.json({ error: "goalType is not a known goal" }, { status: 400 });
  }
  if (goalTarget != null && (!Number.isInteger(goalTarget) || goalTarget < 1 || goalTarget > 1_000_000)) {
    return NextResponse.json({ error: "goalTarget must be a whole number from 1 to 1,000,000" }, { status: 400 });
  }
  const label = optText(goalLabel, 30, "goalLabel");
  const offer = optText(offerName, 80, "offerName");
  const url = optText(offerUrl, 300, "offerUrl");
  for (const v of [label, offer, url]) {
    if (v instanceof Error) return NextResponse.json({ error: v.message }, { status: 400 });
  }
  if (typeof url === "string" && !validHttpUrl(url)) {
    return NextResponse.json({ error: "offerUrl must be an http(s) link" }, { status: 400 });
  }

  // Reward fields: same undefined/null rule as the goal fields.
  if (kind !== undefined && kind !== "campaign" && kind !== "referral") {
    return NextResponse.json({ error: "kind must be campaign or referral" }, { status: 400 });
  }
  if (rewardKind != null && !PAYOUT_KIND_IDS.includes(rewardKind)) {
    return NextResponse.json({ error: "rewardKind is not a known reward" }, { status: 400 });
  }
  if (rewardAmount != null && (!Number.isFinite(rewardAmount) || rewardAmount < 0 || rewardAmount > 1e9)) {
    return NextResponse.json({ error: "rewardAmount must be a positive number" }, { status: 400 });
  }
  if (rewardCurrency != null && !CURRENCY_CODES.includes(rewardCurrency)) {
    return NextResponse.json({ error: "rewardCurrency is not supported" }, { status: 400 });
  }
  if (
    rewardThreshold != null &&
    (!Number.isInteger(rewardThreshold) || rewardThreshold < 1 || rewardThreshold > 10_000)
  ) {
    return NextResponse.json({ error: "rewardThreshold must be a whole number from 1 to 10,000" }, { status: 400 });
  }
  if (rewardRepeats !== undefined && typeof rewardRepeats !== "boolean") {
    return NextResponse.json({ error: "rewardRepeats must be true or false" }, { status: 400 });
  }
  const note = optText(rewardNote, 120, "rewardNote");
  if (note instanceof Error) return NextResponse.json({ error: note.message }, { status: 400 });

  const auth = await requireApprover({
    orgId: String(orgId),
    address: address ?? "",
    action: ORG_ACTIONS.campaignSave,
    ts: Number(ts),
    signature: signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    // A new referral with nothing picked counts referral-type actions, creating a
    // "Brought a friend" action for a business that has none yet.
    const counted =
      !id && kind === "referral" && !engagementTypeIds?.length
        ? await ensureReferralEngagementIds(String(orgId))
        : engagementTypeIds;
    const campaign = await upsertCampaign({
      id,
      orgId: String(orgId),
      title: title.trim().slice(0, 120),
      blurb: blurb?.trim().slice(0, 500),
      coverUrl: coverUrl?.trim().slice(0, 2048) || null,
      endsAt: endsAt || null,
      active,
      engagementTypeIds: counted,
      kind: kind as "campaign" | "referral" | undefined,
      rewardKind,
      rewardAmount,
      rewardCurrency,
      rewardNote: note as string | null | undefined,
      rewardThreshold,
      rewardRepeats,
      goalType,
      goalTarget,
      goalLabel: label as string | null | undefined,
      offerName: offer as string | null | undefined,
      offerUrl: url as string | null | undefined,
    });
    return NextResponse.json(
      { campaign, goalsAvailable: await goalColumnsAvailable() },
      { status: id ? 200 : 201 }
    );
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

/**
 * Delete a campaign — the business side. Scoped to its org so an id alone cannot
 * reach another business's push. Closing (active=false) hides a campaign but keeps
 * it; DELETE is the irreversible removal, offered in the UI behind a confirm.
 */
export async function DELETE(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const orgId = params.get("orgId");
  const id = params.get("id");
  if (!orgId || !id) {
    return NextResponse.json({ error: "orgId and id are required" }, { status: 400 });
  }

  // Auth in the body: an undeployed approver's ERC-6492 signature is too long for a URL.
  const body = (await req.json().catch(() => ({}))) as {
    address?: string;
    ts?: number;
    signature?: string;
  };
  const auth = await requireApprover({
    orgId,
    address: body.address ?? "",
    action: ORG_ACTIONS.campaignDelete,
    ts: Number(body.ts),
    signature: body.signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const removed = await deleteCampaign(orgId, id);
  if (!removed) {
    return NextResponse.json({ error: "No such campaign for this org" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
