import "server-only";
import { requestCashRewards, resumeDispatchable } from "./service";
import { runPayments } from "./runtime";

/**
 * Called after a business approves a new customer. Cash rewards are requested here.
 * A missing database or a low balance must not undo the approval that already landed.
 */
export async function settleApprovedCashReward(input: {
  orgId: string;
  campaignId: string;
  advocate: string;
}): Promise<void> {
  await runPayments(({ store, providers }) => requestCashRewards(store, providers, input));
}

/** An Ambassador saved an M-Pesa number. Try rewards that were waiting on it. */
export async function resumeAmbassadorPayouts(advocate: string): Promise<void> {
  await runPayments(({ store, providers }) => resumeDispatchable(store, providers, { advocate }));
}
