import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent, getBillingStatus, payInstructions } from "@/lib/billing";
import { ORG_ACTIONS } from "@/lib/org-action";
import { requireApprover } from "@/lib/verify";

/**
 * Campaign-credit billing, business side.
 *
 *   GET  ?orgId=…  – billing status: free campaigns left, credits, the next price,
 *                    any open checkout and past receipts. Prices come only from here
 *                    (lib/billing.ts) — the UI never knows its own numbers.
 *   POST           – open a checkout (mint a payment intent), approver-signed like
 *                    every other org mutation. Returns the exact amount + reference.
 */

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId || !/^\d+$/.test(orgId)) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  try {
    const status = await getBillingStatus(orgId);
    return NextResponse.json({ billing: status, instructions: payInstructions() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load billing" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: { orgId?: string; address?: string; ts?: number; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const { orgId, address, ts, signature } = body;
  if (!orgId || !/^\d+$/.test(String(orgId))) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const auth = await requireApprover({
    orgId: String(orgId),
    address: address ?? "",
    action: ORG_ACTIONS.billingIntent,
    ts: Number(ts),
    signature: signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const intent = await createPaymentIntent(String(orgId));
    return NextResponse.json({ intent, instructions: payInstructions() }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not open a checkout" },
      { status: 400 }
    );
  }
}
