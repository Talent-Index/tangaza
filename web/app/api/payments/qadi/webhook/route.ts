import { NextRequest, NextResponse } from "next/server";
import { readPaymentsEnv } from "@/lib/payments/config";
import { PaymentError } from "@/lib/payments/errors";
import { verifyQadiSignature } from "@/lib/payments/signature";
import { applyQadiEvent, parseQadiWebhook } from "@/lib/payments/service";
import { runPayments } from "@/lib/payments/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Qadi deposit (and fallback payout) events. Signature is checked on the raw body. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const env = readPaymentsEnv();
  const verdict = verifyQadiSignature({
    secret: env.qadiWebhookSecret,
    timestamp: req.headers.get("x-qadi-timestamp"),
    signature: req.headers.get("x-qadi-signature"),
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
      applyQadiEvent(store, providers, parseQadiWebhook(req.headers.get("x-qadi-event"), body))
    );
    return NextResponse.json({ received: true, duplicate: result.duplicate });
  } catch (err) {
    const status = err instanceof PaymentError ? err.status : 500;
    const message = err instanceof PaymentError ? err.message : "Could not record the Qadi event.";
    return NextResponse.json({ error: message }, { status });
  }
}
