import type { PayoutProviderName, PayoutRow } from "./models";

/**
 * A reward pays out at most three provider calls: Autopay twice, then Qadi once
 * when both are configured. A single provider gets all three attempts.
 * Autopay's own guidance is to retry network failures with the same idempotency key,
 * and to treat a failed payout as unpaid so a fallback can run only after that.
 */
export const MAX_PAYOUT_ATTEMPTS = 3;

/** Autopay per-transaction cap on the Starter sandbox plan, in whole shillings. */
export const MAX_PAYOUT_KES = 150_000;

export const MAX_DEPOSIT_KES = 1_000_000;

const RETRYABLE = new Set([
  "RATE_LIMITED",
  "IDEMPOTENCY_IN_PROGRESS",
  "CAPABILITY_PAUSED",
  "METHOD_UNAVAILABLE",
  "NETWORK",
  "PROVIDER_UNAVAILABLE",
]);

export function wholeShillings(amount: number): number | null {
  if (!Number.isFinite(amount)) return null;
  const kes = Math.round(amount);
  if (kes < 1) return null;
  return kes;
}

export function isRetryableFailure(code: string | undefined, httpStatus?: number): boolean {
  if (httpStatus === 429 || (httpStatus != null && httpStatus >= 500)) return true;
  return Boolean(code && RETRYABLE.has(code));
}

export function rewardIdempotencyKey(campaignId: string, advocate: string, rewardIndex: number): string {
  return `reward:${campaignId}:${advocate.toLowerCase()}:${rewardIndex}`;
}

export function payoutInFlight(payout: Pick<PayoutRow, "status" | "externalId">): boolean {
  return Boolean(payout.externalId) && (payout.status === "pending" || payout.status === "retrying");
}

/**
 * Which provider may be called next. Null means stop: the reward is in flight,
 * already exhausted its attempts, or no configured provider is left.
 */
export function chooseProvider(
  payout: Pick<
    PayoutRow,
    "attempts" | "maxAttempts" | "autopayAttempts" | "qadiAttempts" | "autopayTerminal" | "status" | "externalId"
  >,
  available: { autopay: boolean; qadi: boolean }
): PayoutProviderName | null {
  if (payoutInFlight(payout)) return null;
  if (payout.attempts >= payout.maxAttempts) return null;
  const autopayBudget = available.qadi ? Math.min(2, payout.maxAttempts) : payout.maxAttempts;
  if (available.autopay && !payout.autopayTerminal && payout.autopayAttempts < autopayBudget) {
    return "autopay";
  }
  const qadiBudget = available.autopay ? 1 : payout.maxAttempts;
  if (available.qadi && payout.qadiAttempts < qadiBudget) return "qadi";
  return null;
}

/** Autopay wants integer cents, and only whole shillings (a multiple of 100). */
export function kesToAutopayCents(amountKes: number): number {
  const kes = wholeShillings(amountKes);
  if (kes == null || kes > MAX_PAYOUT_KES) {
    throw new Error("Cash rewards pay between 1 and 150000 whole shillings.");
  }
  return kes * 100;
}
