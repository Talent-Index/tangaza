import { rewardsEarned } from "../types";
import { PaymentError } from "./errors";
import {
  MAX_DEPOSIT_KES,
  MAX_PAYOUT_ATTEMPTS,
  MAX_PAYOUT_KES,
  chooseProvider,
  rewardIdempotencyKey,
  wholeShillings,
} from "./ledger";
import type {
  DepositClient,
  DepositRow,
  PaymentStore,
  PayoutClient,
  PayoutRow,
  ProviderBundle,
  ProviderCallResult,
} from "./models";
import { normalizeKenyanPhone } from "./phone";

const LOW_BALANCE = "This campaign does not have enough funded balance for this reward.";
const NEED_PHONE = "Add the M-Pesa number this reward should go to.";

function clientFor(bundle: ProviderBundle, name: "autopay" | "qadi"): PayoutClient {
  const client = name === "autopay" ? bundle.autopay : bundle.qadiPayout;
  if (!client) throw new PaymentError("That payout provider is not configured.", 503);
  return client;
}

async function refreshPhone(store: PaymentStore, payout: PayoutRow): Promise<PayoutRow> {
  const ctx = await store.getCashRewardContext({
    orgId: payout.orgId,
    campaignId: payout.campaignId,
    advocate: payout.advocate,
  });
  const phone = normalizeKenyanPhone(payout.phone) ?? normalizeKenyanPhone(ctx?.phone);
  if (!phone) return payout;
  if (phone === payout.phone) return payout;
  return store.patchPayout(payout.id, { phone });
}

/**
 * Sends one payout, retrying a limited number of times and falling back from Autopay
 * to Qadi only when Autopay did not accept the money. The reward row already exists,
 * so a second call cannot create a second payout.
 */
export async function dispatchPayout(
  store: PaymentStore,
  bundle: ProviderBundle,
  payoutId: string
): Promise<PayoutRow> {
  let payout = await store.getPayout(payoutId);
  if (!payout) throw new PaymentError("No such payout.", 404);
  if (payout.status === "paid") return payout;
  if (payout.status === "failed" && payout.attempts >= payout.maxAttempts) return payout;
  if (payout.externalId && (payout.status === "pending" || payout.status === "retrying")) return payout;

  payout = await refreshPhone(store, payout);
  if (!normalizeKenyanPhone(payout.phone)) {
    return store.patchPayout(payout.id, { status: "pending", lastError: NEED_PHONE });
  }
  if (payout.amountKes > MAX_PAYOUT_KES) {
    return (
      (await store.failAndRelease(
        payout.id,
        "This reward is above the sandbox payout limit of KES 150,000."
      )) ?? payout
    );
  }

  if (!payout.reserved) {
    const held = await store.reserve(payout.campaignId, payout.orgId, payout.amountKes);
    if (!held) return store.patchPayout(payout.id, { status: "pending", lastError: LOW_BALANCE });
    payout = await store.patchPayout(payout.id, { reserved: true, lastError: null });
  }

  const choice = chooseProvider(payout, bundle.availability);
  if (!choice) {
    return (
      (await store.failAndRelease(
        payout.id,
        payout.lastError ?? "Payout stopped after the retry limit."
      )) ?? payout
    );
  }

  const claimed = await store.claimAttempt(payout.id, choice);
  if (!claimed) return (await store.getPayout(payout.id)) ?? payout;

  const idempotencyKey = choice === "qadi" ? `${claimed.idempotencyKey}:qadi` : claimed.idempotencyKey;
  let result: ProviderCallResult;
  try {
    result = await clientFor(bundle, choice).createPayout({
      amountKes: claimed.amountKes,
      phone: claimed.phone,
      idempotencyKey,
      reference: claimed.id,
      description: "Cash reward for bringing a new customer",
    });
  } catch {
    result = { ok: false, retryable: true, code: "NETWORK", message: "The payment provider did not respond." };
  }

  if (result.ok && result.state === "paid" && result.externalId) {
    return (
      (await store.settlePaid(claimed.id, {
        provider: choice,
        externalId: result.externalId,
        providerStatus: result.providerStatus,
      })) ?? claimed
    );
  }
  if (result.ok && result.externalId) {
    return store.patchPayout(claimed.id, {
      status: "pending",
      provider: choice,
      externalId: result.externalId,
      providerStatus: result.providerStatus,
      lastError: null,
    });
  }

  const terminalForAutopay = choice === "autopay" && !result.ok && !result.retryable;
  await store.patchPayout(claimed.id, {
    status: "retrying",
    provider: choice,
    lastError: result.ok ? "The provider did not accept the payout." : result.message,
    autopayTerminal: claimed.autopayTerminal || terminalForAutopay,
    providerStatus: result.ok ? null : result.code,
  });
  return dispatchPayout(store, bundle, claimed.id);
}

/** One row per earned cash reward. Existing rows are dispatched again, never duplicated. */
export async function requestCashRewards(
  store: PaymentStore,
  bundle: ProviderBundle,
  input: { orgId: string; campaignId: string; advocate: string }
): Promise<PayoutRow[]> {
  const ctx = await store.getCashRewardContext(input);
  if (!ctx || ctx.rewardKind !== "cash") return [];
  const amountKes = ctx.amountKes == null ? null : wholeShillings(ctx.amountKes);
  if (amountKes == null) return [];
  const earned = rewardsEarned(ctx.approved, ctx.threshold, ctx.repeats);
  const rows: PayoutRow[] = [];
  for (let index = 1; index <= earned; index += 1) {
    const created = await store.insertPayoutIfAbsent({
      orgId: input.orgId,
      campaignId: input.campaignId,
      campaignTitle: ctx.title,
      advocate: input.advocate,
      rewardIndex: index,
      idempotencyKey: rewardIdempotencyKey(input.campaignId, input.advocate, index),
      amountKes,
      phone: ctx.phone ?? "",
      simulated: bundle.simulated,
    });
    rows.push(await dispatchPayout(store, bundle, created.id));
  }
  return rows;
}

export async function resumeDispatchable(
  store: PaymentStore,
  bundle: ProviderBundle,
  filter?: { campaignId?: string; advocate?: string }
): Promise<void> {
  const waiting = await store.listDispatchable(filter);
  for (const payout of waiting) {
    await dispatchPayout(store, bundle, payout.id);
  }
}

export async function startDeposit(
  store: PaymentStore,
  depositClient: DepositClient,
  bundle: ProviderBundle,
  input: { orgId: string; campaignId: string; amountKes: number; payerPhone: string; idempotencyKey: string }
): Promise<DepositRow> {
  const amountKes = wholeShillings(input.amountKes);
  if (amountKes == null || amountKes > MAX_DEPOSIT_KES) {
    throw new PaymentError("Enter a whole amount from 1 to 1000000 shillings.");
  }
  const payerPhone = normalizeKenyanPhone(input.payerPhone);
  if (!payerPhone) throw new PaymentError("Enter the M-Pesa number that will approve the prompt.");
  if (!/^[A-Za-z0-9:._-]{8,120}$/.test(input.idempotencyKey)) {
    throw new PaymentError("idempotencyKey must be 8 to 120 letters, numbers, or :._-");
  }
  const balances = await store.listBalances(input.orgId);
  if (!balances.some((b) => b.campaignId === input.campaignId)) {
    throw new PaymentError("No such campaign for this business.", 404);
  }

  const existing = await store.getDepositByKey(input.idempotencyKey);
  if (existing) {
    if (existing.orgId !== input.orgId || existing.campaignId !== input.campaignId) {
      throw new PaymentError("That idempotency key was already used.", 409);
    }
    return existing;
  }

  let row = await store.insertDeposit({
    orgId: input.orgId,
    campaignId: input.campaignId,
    idempotencyKey: input.idempotencyKey,
    amountKes,
    payerPhone,
    simulated: bundle.simulated,
  });

  const result = await depositClient.startOnramp({
    amountKes,
    payerPhone,
    idempotencyKey: input.idempotencyKey,
  });
  if (!result.ok) {
    await store.failDeposit(row.id, result.message, result.code);
    return (await store.getDepositByKey(input.idempotencyKey)) ?? row;
  }
  if (result.externalId) await store.attachDepositExternal(row.id, result.externalId);
  if (result.state === "paid") {
    await store.creditDeposit(row.id, {
      amountUsdc: result.amountUsdc ?? null,
      providerStatus: result.providerStatus,
    });
    await resumeDispatchable(store, bundle, { campaignId: input.campaignId });
  }
  row = (await store.getDepositByKey(input.idempotencyKey)) ?? row;
  return row;
}

export interface QadiWebhookEvent {
  eventType: string;
  eventId: string;
  orderId: string | null;
  idempotencyKey: string | null;
  orderType: string | null;
  status: string | null;
  fiatAmount: string | null;
  cryptoAmount: string | null;
  errorMessage: string | null;
}

export function parseQadiWebhook(eventTypeHeader: string | null, body: unknown): QadiWebhookEvent {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const data =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const eventType =
    eventTypeHeader ||
    (typeof root.type === "string" ? root.type : "") ||
    (typeof data.event === "string" ? data.event : "");
  const orderId = typeof data.id === "string" ? data.id : null;
  const idempotencyKey = typeof data.idempotencyKey === "string" ? data.idempotencyKey : null;
  const eventId = typeof root.id === "string" && root.id !== orderId ? root.id : `${eventType}:${orderId ?? idempotencyKey ?? "unknown"}`;
  return {
    eventType,
    eventId: `qadi:${eventId}`,
    orderId,
    idempotencyKey,
    orderType: typeof data.type === "string" ? data.type : null,
    status: typeof data.status === "string" ? data.status : null,
    fiatAmount: typeof data.fiatAmount === "string" ? data.fiatAmount : null,
    cryptoAmount: typeof data.cryptoAmount === "string" ? data.cryptoAmount : null,
    errorMessage: typeof data.errorMsg === "string" ? data.errorMsg : null,
  };
}

function depositFailed(eventType: string): boolean {
  return (
    eventType.endsWith("failed") ||
    eventType.endsWith("expired") ||
    eventType.endsWith("refunded") ||
    eventType === "fiat_order.failed" ||
    eventType === "fiat_order.expired" ||
    eventType === "fiat_order.refunded"
  );
}

function depositPaid(eventType: string, status: string | null): boolean {
  if (eventType === "fiat_order.fulfilled" || eventType === "deposit.received" || eventType === "deposit.aml_cleared") {
    return true;
  }
  return status === "fulfilled" || status === "validated" || status === "received";
}

async function findDeposit(store: PaymentStore, event: QadiWebhookEvent): Promise<DepositRow | null> {
  if (event.idempotencyKey) {
    const byKey = await store.getDepositByKey(event.idempotencyKey);
    if (byKey) return byKey;
  }
  if (event.orderId) return store.getDepositByExternal(event.orderId);
  return null;
}

/** Applies one verified Qadi event. Replays are ignored. */
export async function applyQadiEvent(
  store: PaymentStore,
  bundle: ProviderBundle,
  event: QadiWebhookEvent
): Promise<{ duplicate: boolean }> {
  const fresh = await store.claimEvent(event.eventId, "qadi", event.eventType);
  if (!fresh) return { duplicate: true };

  const payout =
    (event.orderId ? await store.getPayoutByExternal(event.orderId) : null) ??
    null;
  const isPayout = event.orderType === "float_payout" || Boolean(payout);

  if (isPayout && payout) {
    if (depositPaid(event.eventType, event.status)) {
      if (payout.externalId) {
        await store.settlePaid(payout.id, {
          provider: "qadi",
          externalId: payout.externalId,
          providerStatus: event.status ?? "fulfilled",
        });
      }
    } else if (depositFailed(event.eventType)) {
      await store.patchPayout(payout.id, { autopayTerminal: payout.autopayTerminal });
      await dispatchPayout(store, bundle, payout.id);
    }
    return { duplicate: false };
  }

  const deposit = await findDeposit(store, event);
  if (!deposit) return { duplicate: false };
  if (depositPaid(event.eventType, event.status) && !depositFailed(event.eventType)) {
    const credited = await store.creditDeposit(deposit.id, {
      amountUsdc: event.cryptoAmount,
      providerStatus: event.status ?? event.eventType,
    });
    if (credited) await resumeDispatchable(store, bundle, { campaignId: deposit.campaignId });
  } else if (depositFailed(event.eventType)) {
    await store.failDeposit(deposit.id, event.errorMessage ?? "The M-Pesa payment did not complete.", event.status ?? event.eventType);
  }
  return { duplicate: false };
}

export interface AutopayWebhookEvent {
  eventId: string;
  eventType: string;
  payoutId: string | null;
  reference: string | null;
  status: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}

export function parseAutopayWebhook(body: unknown, headerEventId: string | null): AutopayWebhookEvent {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const data =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const object =
    data.object && typeof data.object === "object" ? (data.object as Record<string, unknown>) : data;
  const eventId = (typeof root.id === "string" && root.id) || headerEventId || "";
  return {
    eventId: eventId ? `autopay:${eventId}` : "",
    eventType: typeof root.type === "string" ? root.type : "",
    payoutId: typeof object.id === "string" ? object.id : null,
    reference: typeof object.reference === "string" ? object.reference : null,
    status: typeof object.status === "string" ? object.status : null,
    failureCode: typeof object.failure_code === "string" ? object.failure_code : null,
    failureMessage: typeof object.failure_message === "string" ? object.failure_message : null,
  };
}

async function findPayout(store: PaymentStore, event: AutopayWebhookEvent): Promise<PayoutRow | null> {
  if (event.payoutId) {
    const byExternal = await store.getPayoutByExternal(event.payoutId);
    if (byExternal) return byExternal;
  }
  if (event.reference) return store.getPayout(event.reference);
  return null;
}

/** Applies one verified Autopay event. A final paid status is never walked backwards, except by a reversal. */
export async function applyAutopayEvent(
  store: PaymentStore,
  bundle: ProviderBundle,
  event: AutopayWebhookEvent
): Promise<{ duplicate: boolean }> {
  if (!event.eventId) throw new PaymentError("Autopay event id is missing.", 400);
  const fresh = await store.claimEvent(event.eventId, "autopay", event.eventType);
  if (!fresh) return { duplicate: true };
  const payout = await findPayout(store, event);
  if (!payout) return { duplicate: false };

  if (event.eventType === "payout.succeeded" || event.status === "succeeded") {
    if (payout.externalId) {
      await store.settlePaid(payout.id, {
        provider: payout.provider ?? "autopay",
        externalId: payout.externalId,
        providerStatus: "succeeded",
      });
    }
    return { duplicate: false };
  }
  if (event.eventType === "payout.reversed" || event.status === "reversed") {
    await store.reversePaid(payout.id, "The payout was reversed and the shillings came back to the campaign.");
    return { duplicate: false };
  }
  if (event.eventType === "payout.failed" || event.status === "failed") {
    const code = event.failureCode ?? "PAYOUT_FAILED";
    const retryable = code === "METHOD_UNAVAILABLE";
    await store.patchPayout(payout.id, {
      externalId: null,
      status: "retrying",
      autopayTerminal: !retryable,
      lastError: event.failureMessage ?? "The payout failed.",
      providerStatus: code,
    });
    await dispatchPayout(store, bundle, payout.id);
    return { duplicate: false };
  }
  if (event.payoutId && !payout.externalId) {
    await store.patchPayout(payout.id, { externalId: event.payoutId, providerStatus: event.status });
  }
  return { duplicate: false };
}

export { MAX_PAYOUT_ATTEMPTS };
