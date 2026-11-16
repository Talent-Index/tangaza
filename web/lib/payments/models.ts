/** Statuses stored for a campaign deposit and an Ambassador payout. */
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "retrying"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PayoutProviderName = "autopay" | "qadi";

export interface DepositRow {
  id: string;
  orgId: string;
  campaignId: string;
  idempotencyKey: string;
  externalId: string | null;
  amountKes: number;
  amountUsdc: string | null;
  payerPhone: string;
  status: PaymentStatus;
  providerStatus: string | null;
  failureReason: string | null;
  /** True when no provider keys were set and the mock moved the balance. */
  simulated: boolean;
  createdAt: string;
}

export interface PayoutRow {
  id: string;
  orgId: string;
  campaignId: string;
  campaignTitle: string;
  advocate: string;
  rewardIndex: number;
  idempotencyKey: string;
  amountKes: number;
  phone: string;
  status: PaymentStatus;
  attempts: number;
  maxAttempts: number;
  autopayAttempts: number;
  qadiAttempts: number;
  autopayTerminal: boolean;
  reserved: boolean;
  provider: PayoutProviderName | null;
  externalId: string | null;
  providerStatus: string | null;
  lastError: string | null;
  /** True when no provider keys were set and the mock moved the balance. */
  simulated: boolean;
  createdAt: string;
}

export interface BalanceRow {
  campaignId: string;
  orgId: string;
  title: string;
  rewardKind: string | null;
  rewardAmount: number | null;
  fundedKes: number;
  reservedKes: number;
  availableKes: number;
}

export interface CashRewardContext {
  title: string;
  rewardKind: string | null;
  amountKes: number | null;
  threshold: number | null;
  repeats: boolean;
  approved: number;
  phone: string | null;
}

/**
 * Persistence for deposits, balances and payouts.
 * The Neon store and the in-memory store used by tests both implement this.
 */
export interface PaymentStore {
  getCashRewardContext(input: {
    orgId: string;
    campaignId: string;
    advocate: string;
  }): Promise<CashRewardContext | null>;
  insertDeposit(input: {
    orgId: string;
    campaignId: string;
    idempotencyKey: string;
    amountKes: number;
    payerPhone: string;
    simulated: boolean;
  }): Promise<DepositRow>;
  getDepositByKey(idempotencyKey: string): Promise<DepositRow | null>;
  getDepositByExternal(externalId: string): Promise<DepositRow | null>;
  attachDepositExternal(id: string, externalId: string): Promise<void>;
  /** Credits the campaign once. A second call for the same deposit does nothing. */
  creditDeposit(
    id: string,
    patch: { amountUsdc: string | null; providerStatus: string }
  ): Promise<boolean>;
  failDeposit(id: string, reason: string, providerStatus: string): Promise<void>;
  listBalances(orgId: string): Promise<BalanceRow[]>;
  listDeposits(orgId: string, campaignId?: string): Promise<DepositRow[]>;
  insertPayoutIfAbsent(input: {
    orgId: string;
    campaignId: string;
    campaignTitle: string;
    advocate: string;
    rewardIndex: number;
    idempotencyKey: string;
    amountKes: number;
    phone: string;
    simulated: boolean;
  }): Promise<PayoutRow>;
  getPayout(id: string): Promise<PayoutRow | null>;
  getPayoutByExternal(externalId: string): Promise<PayoutRow | null>;
  listPayoutsForAdvocate(advocate: string): Promise<PayoutRow[]>;
  listDispatchable(filter?: { campaignId?: string; advocate?: string }): Promise<PayoutRow[]>;
  reserve(campaignId: string, orgId: string, amountKes: number): Promise<boolean>;
  /** Increments attempt counters. Returns null when the payout is no longer sendable. */
  claimAttempt(id: string, provider: PayoutProviderName): Promise<PayoutRow | null>;
  patchPayout(
    id: string,
    patch: Partial<
      Pick<
        PayoutRow,
        | "status"
        | "phone"
        | "reserved"
        | "provider"
        | "externalId"
        | "providerStatus"
        | "lastError"
        | "autopayTerminal"
      >
    >
  ): Promise<PayoutRow>;
  /** Marks paid and moves the reserved amount out of the funded balance, once. */
  settlePaid(
    id: string,
    patch: { provider: PayoutProviderName; externalId: string; providerStatus: string }
  ): Promise<PayoutRow | null>;
  /** Gives the reserved amount back and marks the payout failed, once. */
  failAndRelease(id: string, reason: string, providerStatus?: string | null): Promise<PayoutRow | null>;
  /** A paid payout came back. Restores the campaign balance and does not pay it again. */
  reversePaid(id: string, reason: string): Promise<PayoutRow | null>;
  claimEvent(eventId: string, provider: string, eventType: string): Promise<boolean>;
}

export type ProviderCallResult =
  | {
      ok: true;
      externalId: string;
      state: "pending" | "paid";
      providerStatus: string;
      amountUsdc?: string | null;
    }
  | {
      ok: false;
      retryable: boolean;
      code: string;
      message: string;
      externalId?: string | null;
    };

export interface PayoutClient {
  name: PayoutProviderName;
  createPayout(input: {
    amountKes: number;
    phone: string;
    idempotencyKey: string;
    reference: string;
    description: string;
  }): Promise<ProviderCallResult>;
}

export interface DepositClient {
  startOnramp(input: {
    amountKes: number;
    payerPhone: string;
    idempotencyKey: string;
  }): Promise<ProviderCallResult & { amountUsdc?: string | null }>;
}

export interface ProviderBundle {
  availability: { autopay: boolean; qadi: boolean };
  /** True when neither provider key is set and every call stays inside the mock. */
  simulated: boolean;
  autopay: PayoutClient | null;
  qadiPayout: PayoutClient | null;
  qadiDeposit: DepositClient | null;
}
