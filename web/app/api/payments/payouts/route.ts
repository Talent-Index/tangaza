import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { paymentsPublicStatus } from "@/lib/payments/config";
import { PaymentError } from "@/lib/payments/errors";
import { maskKenyanPhone } from "@/lib/payments/phone";
import { runPayments } from "@/lib/payments/runtime";
import type { PayoutRow } from "@/lib/payments/models";

export const dynamic = "force-dynamic";

function present(row: PayoutRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaignTitle,
    rewardIndex: row.rewardIndex,
    amountKes: row.amountKes,
    status: row.status,
    provider: row.provider,
    simulated: row.simulated,
    lastError: row.lastError,
    phone: maskKenyanPhone(row.phone),
    createdAt: row.createdAt,
  };
}

/** Cash rewards for one Ambassador, with the payout status. The phone is masked. */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  try {
    const payouts = await runPayments(({ store }) => store.listPayoutsForAdvocate(address));
    return NextResponse.json({ ...paymentsPublicStatus(), payouts: payouts.map(present) });
  } catch (err) {
    const status = err instanceof PaymentError ? err.status : 500;
    const message = err instanceof PaymentError ? err.message : "Could not load rewards.";
    return NextResponse.json({ error: message }, { status });
  }
}
