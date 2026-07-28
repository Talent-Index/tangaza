import { NextRequest, NextResponse } from "next/server";
import {
  deactivateEngagementType,
  listEngagementTypes,
  upsertEngagementType,
} from "@/lib/store";
import { PROOF_KINDS, type ProofKind } from "@/lib/types";

/**
 * The engagements a business has decided to reward.
 *
 *   GET    – the submit form and the org settings screen both read from here
 *   POST   – create or update one
 *   DELETE – deactivate (never hard delete: submissions reference it)
 *
 * The contract's ActivityType enum has three fixed values and cannot be extended
 * without a redeploy, so `chainCategory` maps whatever a business invents onto one of
 * them, and `weight` carries the differentiated reward: how many on-chain activities
 * one approval is worth.
 */

export const dynamic = "force-dynamic";

const VALID_PROOF_KINDS = PROOF_KINDS.map((p) => p.id) as readonly string[];

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const types = await listEngagementTypes(orgId, { includeInactive });
  return NextResponse.json({ types });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { id, orgId, label, blurb, icon, proofKind, chainCategory, weight, active, sortOrder } =
    body as {
      id?: string;
      orgId?: string;
      label?: string;
      blurb?: string;
      icon?: string;
      proofKind?: string;
      chainCategory?: number;
      weight?: number;
      active?: boolean;
      sortOrder?: number;
    };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!label || !label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (proofKind && !VALID_PROOF_KINDS.includes(proofKind)) {
    return NextResponse.json(
      { error: `proofKind must be one of ${VALID_PROOF_KINDS.join(", ")}` },
      { status: 400 }
    );
  }
  if (chainCategory !== undefined && ![0, 1, 2].includes(chainCategory)) {
    return NextResponse.json({ error: "chainCategory must be 0, 1 or 2" }, { status: 400 });
  }
  // Capped at 20 because that is MILESTONE_ACTIVITIES: one approval should never be
  // worth more than a whole credit, or the budget stops being legible to the org.
  if (weight !== undefined && (!Number.isInteger(weight) || weight < 1 || weight > 20)) {
    return NextResponse.json(
      { error: "weight must be a whole number between 1 and 20" },
      { status: 400 }
    );
  }

  try {
    const type = await upsertEngagementType({
      id,
      orgId: String(orgId),
      label: label.trim().slice(0, 60),
      blurb: blurb?.trim().slice(0, 140),
      icon: icon?.trim().slice(0, 8) || "•",
      proofKind: proofKind as ProofKind | undefined,
      chainCategory,
      weight,
      active,
      sortOrder,
    });
    return NextResponse.json({ type }, { status: id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("engagement_types_org_id_label_key")) {
      return NextResponse.json(
        { error: "You already have an engagement with that name" },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const id = req.nextUrl.searchParams.get("id");
  if (!orgId || !id) {
    return NextResponse.json({ error: "orgId and id are required" }, { status: 400 });
  }
  await deactivateEngagementType(orgId, id);
  return NextResponse.json({ ok: true });
}
