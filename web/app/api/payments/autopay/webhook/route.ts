import { NextRequest, NextResponse } from "next/server";
import { readPaymentsEnv } from "@/lib/payments/config";
import { PaymentError } from "@/lib/payments/errors";
import { verifyAutopaySignature } from "@/lib/payments/signature";
import { applyAutopayEvent, parseAutopayWebhook } from "@/lib/payments/service";
import { runPayments } from "@/lib/payments/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Autopay payout events. Signature is checked on the raw body before any status change. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const env = readPaymentsEnv();
  const verdict = verifyAutopaySignature({
    secret: env.autopayWebhookSecret,
    header: req.headers.get("autopayke-signature"),
    rawBody: raw,
  });
  if (!verdict.ok) return NextResponse.json({ error: verdict.reason }, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  try {
    const result = await runPayments(({ store, providers }) =>
      applyAutopayEvent(
        store,
        providers,
        parseAutopayWebhook(body, req.headers.get("autopayke-event-id"))
      )
    );
    return NextResponse.json({ received: true, duplicate: result.duplicate });
  } catch (err) {
    const status = err instanceof PaymentError ? err.status : 500;
    const message = err instanceof PaymentError ? err.message : "Could not record the Autopay event.";
    return NextResponse.json({ error: message }, { status });
  }
}
