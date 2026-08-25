import { NextResponse } from "next/server";

/**
 * Daraja C2B validation — called before a payment completes. We accept everything
 * (ResponseType "Completed" means Safaricom completes the sale regardless), so this
 * just acknowledges. Kept as its own endpoint so Daraja has a distinct URL to register.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
