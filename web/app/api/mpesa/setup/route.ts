import { NextRequest, NextResponse } from "next/server";
import { registerC2BUrls, simulateC2B, mpesaConfigured } from "@/lib/mpesa";

/**
 * One-time / sandbox tooling for the pilot, gated by MPESA_ADMIN_SECRET so it isn't
 * open to the world:
 *
 *   POST { action: "register", secret }
 *   POST { action: "simulate", secret, amount, msisdn, billRef }   // sandbox only
 *
 * "register" wires this deployment's C2B validation + confirmation URLs to the Till.
 * "simulate" drives the whole loop without a phone — pass a referrer's share code as
 * billRef and watch it land as a verified referred purchase.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.MPESA_ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "MPESA_ADMIN_SECRET not set" }, { status: 503 });
  }
  if (!mpesaConfigured) {
    return NextResponse.json({ error: "M-Pesa credentials not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (body.secret !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (body.action === "register") {
      const result = await registerC2BUrls();
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }
    if (body.action === "simulate") {
      const result = await simulateC2B({
        amount: Number(body.amount ?? 1),
        msisdn: String(body.msisdn ?? "254708374149"),
        billRef: String(body.billRef ?? ""),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }
    return NextResponse.json({ error: "action must be register or simulate" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "M-Pesa call failed" },
      { status: 500 }
    );
  }
}
