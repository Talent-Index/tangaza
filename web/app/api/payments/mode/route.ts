import { NextResponse } from "next/server";
import { paymentsPublicStatus } from "@/lib/payments/config";
import { PaymentError } from "@/lib/payments/errors";

export const dynamic = "force-dynamic";

/** Whether the sandbox is in practice mode. Never returns key material. */
export async function GET() {
  try {
    return NextResponse.json(paymentsPublicStatus());
  } catch (err) {
    const message = err instanceof PaymentError ? err.message : "Could not read payment settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
