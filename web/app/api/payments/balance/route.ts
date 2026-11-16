import { NextRequest, NextResponse } from "next/server";
import { PaymentError } from "@/lib/payments/errors";
import { paymentsPublicStatus } from "@/lib/payments/config";
import { maskKenyanPhone } from "@/lib/payments/phone";
import { runPayments } from "@/lib/payments/runtime";
import type { DepositRow } from "@/lib/payments/models";

export const dynamic = "force-dynamic";

function presentDeposit(row: DepositRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    amountKes: row.amountKes,
    amountUsdc: row.amountUsdc,
    status: row.status,
    simulated: row.simulated,
    failureReason: row.failureReason,
    payerPhone: maskKenyanPhone(row.payerPhone),
    createdAt: row.createdAt,
  };
}

/** Funded balance for each campaign. Same visibility as the rest of the business portal reads. */
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const campaignId = req.nextUrl.searchParams.get("campaignId") ?? undefined;
  if (!orgId || !/^\d+$/.test(orgId)) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (campaignId && !/^[0-9a-f-]{36}$/i.test(campaignId)) {
    return NextResponse.json({ error: "campaignId must be an id" }, { status: 400 });
  }
  try {
    const body = await runPayments(async ({ store }) => {
      const [campaigns, deposits] = await Promise.all([
        store.listBalances(orgId),
        store.listDeposits(orgId, campaignId),
      ]);
      return {
        ...paymentsPublicStatus(),
        campaigns: campaignId ? campaigns.filter((c) => c.campaignId === campaignId) : campaigns,
        deposits: deposits.map(presentDeposit),
      };
    });
    return NextResponse.json(body);
  } catch (err) {
    const status = err instanceof PaymentError ? err.status : 500;
    const message = err instanceof PaymentError ? err.message : "Could not load the campaign balance.";
    return NextResponse.json({ error: message }, { status });
  }
}
