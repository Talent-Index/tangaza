import { NextRequest, NextResponse } from "next/server";
import { confirmPaymentIntent, listOpenIntents } from "@/lib/billing";
import { listUnmatched, resolveUnmatched } from "@/lib/billing-match";

/**
 * Concierge billing, gated by BILLING_ADMIN_SECRET (same pattern as /api/mpesa/setup):
 * until payments auto-match (Phase 2), a human checks the M-Pesa/ramp statement and
 * confirms the intent here, pasting the receipt or tx hash as the matched reference.
 *
 *   POST { action: "list",    secret }                       // open + expired checkouts
 *   POST { action: "confirm", secret, code, matchedRef? }    // grant the credits
 *
 * Expired intents are listed and confirmable on purpose — someone who paid late still
 * paid, and the amount history is right there to match against.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.BILLING_ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "BILLING_ADMIN_SECRET not set" }, { status: 503 });
  }

  let body: { action?: string; secret?: string; code?: string; matchedRef?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (body.secret !== secret) {
    return NextResponse.json({ error: "Wrong secret" }, { status: 401 });
  }

  if (body.action === "list") {
    // Open checkouts to confirm, plus payments the matchers couldn't attribute
    // (wrong amount, overpayment, stranger) — flagged, never guessed at.
    return NextResponse.json({
      intents: await listOpenIntents(),
      unmatched: await listUnmatched(),
    });
  }

  // Done with an unmatched payment: confirmed against an intent by hand, or refunded.
  if (body.action === "resolve") {
    if (!body.code?.trim()) {
      return NextResponse.json({ error: "code (the payment ref) is required" }, { status: 400 });
    }
    const done = await resolveUnmatched(body.code.trim());
    if (!done) return NextResponse.json({ error: "No unresolved payment with that ref" }, { status: 404 });
    return NextResponse.json({ resolved: body.code.trim() });
  }

  if (body.action === "confirm") {
    if (!body.code?.trim()) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }
    const result = await confirmPaymentIntent(body.code, body.matchedRef?.trim() || undefined);
    if (!result) {
      return NextResponse.json(
        { error: "No open intent with that code — already confirmed, or a typo" },
        { status: 404 }
      );
    }
    return NextResponse.json({ confirmed: result });
  }

  return NextResponse.json({ error: "action must be list, confirm or resolve" }, { status: 400 });
}
