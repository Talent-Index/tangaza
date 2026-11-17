import { NextRequest, NextResponse } from "next/server";
import { paymentsPublicStatus } from "@/lib/payments/config";
import { PaymentError } from "@/lib/payments/errors";
import { maskKenyanPhone } from "@/lib/payments/phone";
import { ORG_ACTIONS } from "@/lib/org-action";
import { startDeposit } from "@/lib/payments/service";
import { runPayments } from "@/lib/payments/runtime";
import { requireApprover } from "@/lib/verify";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Starts a Qadi M-Pesa prompt that funds one campaign's reward balance.
 * Sandbox only. The same idempotency key returns the original deposit.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  const payerPhone = typeof body.payerPhone === "string" ? body.payerPhone : "";
  const amountKes = typeof body.amountKes === "number" ? body.amountKes : Number(body.amountKes);

  if (!/^\d+$/.test(orgId) || !UUID.test(campaignId)) {
    return NextResponse.json({ error: "orgId and campaignId are required" }, { status: 400 });
  }

  const auth = await requireApprover({
    orgId,
    address: typeof body.address === "string" ? body.address : "",
    action: ORG_ACTIONS.campaignFund,
    ts: Number(body.ts),
    signature: typeof body.signature === "string" ? body.signature : "",
  });
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  try {
    const deposit = await runPayments(async ({ store, providers }) => {
      if (!providers.qadiDeposit) {
        throw new PaymentError(
          "Qadi is not configured. Add QADI_API_KEY to send an M-Pesa prompt. Live payments stay off.",
          503
        );
      }
      return startDeposit(store, providers.qadiDeposit, providers, {
        orgId,
        campaignId,
        amountKes,
        payerPhone,
        idempotencyKey,
      });
    });
    const status = paymentsPublicStatus();
    return NextResponse.json({
      testMode: status.testMode,
      simulated: deposit.simulated,
      message: deposit.simulated
        ? "Test mode. No M-Pesa prompt was sent. A practice payment is waiting for a test webhook."
        : deposit.status === "failed"
          ? deposit.failureReason ?? "The M-Pesa prompt was not sent."
          : "Check the phone for the M-Pesa prompt. The balance updates when Qadi confirms it.",
      deposit: {
        id: deposit.id,
        campaignId: deposit.campaignId,
        amountKes: deposit.amountKes,
        status: deposit.status,
        simulated: deposit.simulated,
        failureReason: deposit.failureReason,
        payerPhone: maskKenyanPhone(deposit.payerPhone),
      },
    });
  } catch (err) {
    const status = err instanceof PaymentError ? err.status : 500;
    const message = err instanceof PaymentError ? err.message : "Could not start the M-Pesa prompt.";
    return NextResponse.json({ error: message }, { status });
  }
}
