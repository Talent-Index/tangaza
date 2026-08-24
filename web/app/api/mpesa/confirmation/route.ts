import { NextRequest, NextResponse } from "next/server";
import { recordMpesaPayment } from "@/lib/store";
import type { C2BConfirmation } from "@/lib/mpesa";

/**
 * Daraja C2B confirmation — Safaricom POSTs here after a customer pays the Till.
 *
 * Public and unauthenticated by design (there is no session; Safaricom is the caller).
 * We re-derive everything server-side and key on TransID so retries are idempotent, and
 * we ALWAYS return {ResultCode:0}: the sale already happened, so a callback error must
 * never look like a failed payment.
 */
export const dynamic = "force-dynamic";

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

export async function POST(req: NextRequest) {
  let body: C2BConfirmation;
  try {
    body = (await req.json()) as C2BConfirmation;
  } catch {
    return NextResponse.json(ACK);
  }

  try {
    if (body.TransID) {
      await recordMpesaPayment({
        transId: String(body.TransID),
        shortcode: String(body.BusinessShortCode ?? ""),
        amount: Number(body.TransAmount ?? 0),
        msisdn: body.MSISDN ? String(body.MSISDN) : undefined,
        firstName: body.FirstName ? String(body.FirstName) : undefined,
        billRef: body.BillRefNumber ? String(body.BillRefNumber) : undefined,
      });
    }
  } catch (err) {
    // Never fail the callback — Safaricom will retry, and the customer already paid.
    console.error("[mpesa/confirmation]", err);
  }

  return NextResponse.json(ACK);
}
