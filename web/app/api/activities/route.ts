import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { createActivity, decideActivity, listActivities } from "@/lib/store";
import { activityMessage, verifyActivitySignature } from "@/lib/verify";
import type { PendingStatus } from "@/lib/types";

/**
 * The bridge between "customer submits" and "org approves on-chain".
 *
 *   POST   – customer submits an activity + proof URL  -> status: pending
 *   GET    – org (or customer) lists the queue          ?orgId=1&status=pending
 *   PATCH  – mark approved/rejected AFTER the on-chain tx confirms
 *
 * Nothing here is authoritative about rewards. The chain is. This queue only
 * decides what the org sees in its approvals list.
 */

export const dynamic = "force-dynamic";

const VALID_STATUSES: PendingStatus[] = ["pending", "approved", "rejected"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const status = params.get("status") ?? undefined;

  if (status && !VALID_STATUSES.includes(status as PendingStatus)) {
    return NextResponse.json(
      { error: `status must be one of ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const activities = await listActivities({
    orgId: params.get("orgId") ?? undefined,
    advocate: params.get("advocate") ?? undefined,
    status: status as PendingStatus | undefined,
  });

  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { orgId, advocate, advocateLabel, engagementTypeId, proofUrl, note, ts, signature, campaignId } =
    body as {
      orgId?: string;
      advocate?: string;
      advocateLabel?: string;
      engagementTypeId?: string;
      proofUrl?: string;
      note?: string;
      ts?: number;
      signature?: string;
      campaignId?: string;
    };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!advocate || !isAddress(advocate)) {
    return NextResponse.json({ error: "advocate must be an address" }, { status: 400 });
  }
  if (!engagementTypeId || typeof engagementTypeId !== "string") {
    return NextResponse.json({ error: "engagementTypeId is required" }, { status: 400 });
  }

  // Proof is optional now: an engagement type can be proof_kind 'none', and a
  // referral code is not a URL. Only validate the shape when something was sent.
  if (proofUrl && /^https?:\/\//i.test(proofUrl)) {
    try {
      new URL(proofUrl);
    } catch {
      return NextResponse.json({ error: "proofUrl must be a valid URL" }, { status: 400 });
    }
  }

  /**
   * The advocate signs what they are claiming, and we check it here.
   *
   * This is what stops one person filing submissions under another's address, or a
   * stranger with curl stuffing the queue a business reads to decide who gets paid.
   * The signature covers org, account, engagement, proof and time, so none of them
   * can be swapped after it was signed.
   */
  const verdict = await verifyActivitySignature({
    orgId: String(orgId),
    advocate,
    engagementTypeId,
    proofUrl,
    ts: Number(ts),
    signature: signature ?? "",
  });

  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 401 });
  }

  const activity = await createActivity({
    orgId: String(orgId),
    advocate,
    advocateLabel: advocateLabel?.slice(0, 60),
    engagementTypeId,
    proofUrl: proofUrl?.slice(0, 500),
    note: note?.slice(0, 280),
    campaignId,
    signature,
    signedMessage: activityMessage({
      orgId: String(orgId),
      advocate,
      engagementTypeId,
      proofUrl,
      ts: Number(ts),
    }),
  });

  if (!activity) {
    return NextResponse.json(
      { error: "Unknown or inactive engagementTypeId for this org" },
      { status: 400 }
    );
  }

  return NextResponse.json({ activity }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { id, status, txHash, rejectionReason, decidedBy } = body as {
    id?: string;
    status?: string;
    txHash?: string;
    rejectionReason?: string;
    decidedBy?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }
  if (status === "approved" && !txHash) {
    // An approval without a tx hash means the chain write did not happen.
    return NextResponse.json(
      { error: "txHash is required when marking approved" },
      { status: 400 }
    );
  }

  const activity = await decideActivity({ id, status, txHash, rejectionReason, decidedBy });
  if (!activity) {
    // Either the id is unknown, or it was already decided — the update is guarded on
    // status = 'pending' so a retry cannot approve the same submission twice.
    return NextResponse.json({ error: `No pending activity ${id}` }, { status: 404 });
  }

  return NextResponse.json({ activity });
}
