import { NextRequest, NextResponse } from "next/server";
import { matchBillingMinisend } from "@/lib/billing-match";
import { verifyWebhook, type CheckoutEvent } from "@/lib/minisend";

/**
 * MiniSend webhook — register this URL under Dashboard → Webhooks:
 *   https://www.ubutangaza.biz/api/billing/minisend
 *
 * Every delivery is HMAC-signed with MINISEND_WEBHOOK_SECRET over the RAW body, so the
 * body is read as text and verified before it is parsed. A bad signature is a 401 and
 * nothing else happens; MiniSend retries 4xx/5xx on a backoff, which is exactly what we
 * want for a transient DB error (5xx) and harmless for a forgery (401).
 *
 * Only `checkout.completed` grants anything, and only through the strict matcher in
 * lib/billing-match.ts. Everything else (pending, expired, settlement.*) is acknowledged
 * and ignored — the intent's own lifecycle already covers those states.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const reason = verifyWebhook(raw, {
    v2: req.headers.get("x-minisend-signature-v2"),
    v1: req.headers.get("x-minisend-signature"),
  });
  if (reason) {
    return NextResponse.json({ error: reason }, { status: reason.includes("not set") ? 503 : 401 });
  }

  let body: CheckoutEvent;
  try {
    body = JSON.parse(raw) as CheckoutEvent;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!body.event || !body.session_id) {
    return NextResponse.json({ error: "event and session_id are required" }, { status: 400 });
  }

  try {
    if (body.event === "checkout.completed") {
      const matched = await matchBillingMinisend(body);
      return NextResponse.json({ ok: true, matched });
    }
    return NextResponse.json({ ok: true, ignored: body.event });
  } catch (err) {
    // 5xx on purpose: MiniSend retries, and the payment is real either way.
    console.error("[billing/minisend]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not process" },
      { status: 500 }
    );
  }
}
