import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { createActivity, decideActivity, listActivities } from "@/lib/store";
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

  const activities = listActivities({
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

  const { orgId, advocate, advocateLabel, activityType, proofUrl, note } = body as {
    orgId?: string;
    advocate?: string;
    advocateLabel?: string;
    activityType?: number;
    proofUrl?: string;
    note?: string;
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!advocate || !isAddress(advocate)) {
    return NextResponse.json({ error: "advocate must be an address" }, { status: 400 });
  }
  if (typeof activityType !== "number" || activityType < 0 || activityType > 2) {
    return NextResponse.json({ error: "activityType must be 0, 1 or 2" }, { status: 400 });
  }
  if (!proofUrl || typeof proofUrl !== "string") {
    return NextResponse.json({ error: "proofUrl is required" }, { status: 400 });
  }

  try {
    new URL(proofUrl);
  } catch {
    return NextResponse.json({ error: "proofUrl must be a valid URL" }, { status: 400 });
  }

  const activity = createActivity({
    orgId: String(orgId),
    advocate,
    advocateLabel: advocateLabel?.slice(0, 60),
    activityType,
    proofUrl,
    note: note?.slice(0, 280),
  });

  return NextResponse.json({ activity }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { id, status, txHash, rejectionReason } = body as {
    id?: string;
    status?: string;
    txHash?: string;
    rejectionReason?: string;
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

  const activity = decideActivity({ id, status, txHash, rejectionReason });
  if (!activity) {
    return NextResponse.json({ error: `No activity ${id}` }, { status: 404 });
  }

  return NextResponse.json({ activity });
}
