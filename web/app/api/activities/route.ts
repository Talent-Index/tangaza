import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { createActivity, decideActivity, getActivity, listActivities } from "@/lib/store";
import { verifyApprovalReceipt, verifySubmissionReceipt } from "@/lib/verify";
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

  const { orgId, advocate, advocateLabel, engagementTypeId, proofUrl, note, submitTx, campaignId } =
    body as {
      orgId?: string;
      advocate?: string;
      advocateLabel?: string;
      engagementTypeId?: string;
      proofUrl?: string;
      note?: string;
      submitTx?: string;
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

  // The note is what the approver reads to know what actually happened — a bare
  // proof link tells them nothing. The submit form enforces this before the wallet
  // signs anything; here it only stops hand-rolled requests.
  const noteText = typeof note === "string" ? note.trim().slice(0, 280) : "";
  if (!noteText) {
    return NextResponse.json(
      { error: "note is required — describe what you did; the business approves from it" },
      { status: 400 }
    );
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
   * The submission has to already exist on-chain, written by the advocate's own
   * wallet. We verify the receipt rather than a signature: under ERC-4337 the
   * msg.sender inside submitActivity IS the advocate's smart account, which is
   * stronger proof of origin than anything the server could check off-chain. A
   * stranger with curl cannot file for someone else without that person's wallet
   * having sent the transaction.
   */
  if (!submitTx) {
    return NextResponse.json(
      { error: "submitTx is required — submissions are recorded on-chain first" },
      { status: 401 }
    );
  }

  const verdict = await verifySubmissionReceipt({
    txHash: submitTx,
    orgId: String(orgId),
    advocate,
    proofUrl,
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
    note: noteText,
    campaignId,
    submitTx,
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
  if (status === "approved") {
    if (!txHash) {
      // An approval without a tx hash means the chain write did not happen.
      return NextResponse.json(
        { error: "txHash is required when marking approved" },
        { status: 400 }
      );
    }

    /**
     * Go and look at the chain rather than believing the caller.
     *
     * This endpoint used to accept any string as a txHash, so anyone could mark any
     * submission approved and move the leaderboard. No session is needed to close
     * that: the contract already refuses approvals from anyone but the org's
     * registered approver, so an ActivityApproved log in this receipt *is* the
     * authorisation proof.
     *
     * Read the submission first — the proof hash has to be recomputed from what we
     * stored, not from anything the caller sent, or the check proves nothing.
     */
    const pending = await getActivity(id);
    if (!pending) {
      return NextResponse.json({ error: `No activity ${id}` }, { status: 404 });
    }

    const verdict = await verifyApprovalReceipt({
      txHash,
      orgId: pending.orgId,
      advocate: pending.advocate,
      proofUrl: pending.proofUrl,
    });

    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reason }, { status: 400 });
    }
  }

  const activity = await decideActivity({ id, status, txHash, rejectionReason, decidedBy });
  if (!activity) {
    // Either the id is unknown, or it was already decided — the update is guarded on
    // status = 'pending' so a retry cannot approve the same submission twice.
    return NextResponse.json({ error: `No pending activity ${id}` }, { status: 404 });
  }

  return NextResponse.json({ activity });
}
