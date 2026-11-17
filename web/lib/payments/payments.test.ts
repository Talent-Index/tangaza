import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { assertSandboxReady, paymentsPublicStatus } from "./config";
import { safeProviderMessage } from "./errors";
import { MAX_PAYOUT_ATTEMPTS, chooseProvider } from "./ledger";
import { createMemoryStore } from "./memory-store";
import {
  mockAutopayClient,
  mockQadiDepositClient,
  mockQadiPayoutClient,
  providerMockCalls,
  resetProviderMocks,
} from "./providers";
import { autopaySignatureHex, qadiSignatureHex, verifyAutopaySignature, verifyQadiSignature } from "./signature";
import { applyAutopayEvent, applyQadiEvent, parseQadiWebhook, requestCashRewards, startDeposit } from "./service";
import type { ProviderBundle } from "./models";

const CAMPAIGN = "11111111-1111-4111-8111-111111111111";
const ORG = "1";
const AMBASSADOR = "0xabc0000000000000000000000000000000000001";
const SECRET = "whsec_test_only";

function bundle(flags: { autopay?: boolean; qadi?: boolean } = {}): ProviderBundle {
  const autopay = flags.autopay !== false;
  const qadi = flags.qadi !== false;
  return {
    simulated: true,
    availability: { autopay, qadi },
    autopay: autopay ? mockAutopayClient() : null,
    qadiPayout: qadi ? mockQadiPayoutClient() : null,
    qadiDeposit: qadi ? mockQadiDepositClient() : null,
  };
}

function seed() {
  const store = createMemoryStore();
  store.seedCampaign({
    id: CAMPAIGN,
    orgId: ORG,
    title: "Saturday market",
    rewardKind: "cash",
    rewardAmount: 500,
    rewardThreshold: 1,
    rewardRepeats: true,
  });
  store.setApproved(CAMPAIGN, AMBASSADOR, 1);
  store.setPhone(CAMPAIGN, AMBASSADOR, "+254700000001");
  return store;
}

async function fund(store: ReturnType<typeof seed>, amountKes: number, key: string) {
  const providers = bundle();
  const row = await startDeposit(store, providers.qadiDeposit!, providers, {
    orgId: ORG,
    campaignId: CAMPAIGN,
    amountKes,
    payerPhone: "0712345678",
    idempotencyKey: key,
  });
  await applyQadiEvent(store, providers, {
    eventType: "fiat_order.fulfilled",
    eventId: `qadi:fiat_order.fulfilled:${row.externalId}`,
    orderId: row.externalId,
    idempotencyKey: key,
    orderType: "onramp",
    status: "fulfilled",
    fiatAmount: amountKes.toFixed(2),
    cryptoAmount: "3.800000",
    errorMessage: null,
  });
  return row;
}

const envSnapshot = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetProviderMocks();
});

describe("signatures", () => {
  const body = '{"id":"evt_1"}';
  const now = 1_700_000_000;

  it("accepts a Qadi signature over the raw body and rejects a stale or altered one", () => {
    const signature = `sha256=${qadiSignatureHex(SECRET, String(now), body)}`;
    assert.deepEqual(
      verifyQadiSignature({ secret: SECRET, timestamp: String(now), signature, rawBody: body, nowSec: now }),
      { ok: true }
    );
    assert.equal(
      verifyQadiSignature({
        secret: SECRET,
        timestamp: String(now - 301),
        signature,
        rawBody: body,
        nowSec: now,
      }).ok,
      false
    );
    assert.equal(
      verifyQadiSignature({
        secret: SECRET,
        timestamp: String(now),
        signature,
        rawBody: body + " ",
        nowSec: now,
      }).ok,
      false
    );
  });

  it("accepts an Autopay t,v1 header", () => {
    const v1 = autopaySignatureHex(SECRET, String(now), body);
    assert.equal(
      verifyAutopaySignature({ secret: SECRET, header: `t=${now},v1=${v1}`, rawBody: body, nowSec: now }).ok,
      true
    );
    assert.equal(
      verifyAutopaySignature({ secret: SECRET, header: `t=${now},v1=${"0".repeat(64)}`, rawBody: body, nowSec: now }).ok,
      false
    );
  });
});

describe("sandbox safety", () => {
  it("defaults to sandbox and refuses live mode and live keys", () => {
    delete process.env.PAYMENTS_MODE;
    delete process.env.QADI_API_KEY;
    delete process.env.AUTOPAY_API_KEY;
    assert.equal(paymentsPublicStatus().mode, "sandbox");
    assert.equal(paymentsPublicStatus().livePaymentsEnabled, false);
    assert.equal(paymentsPublicStatus().simulated, true);
    assert.doesNotThrow(() => assertSandboxReady());

    process.env.PAYMENTS_MODE = "live";
    assert.throws(() => assertSandboxReady(), /not enabled/);
    process.env.PAYMENTS_MODE = "sandbox";
    process.env.QADI_API_KEY = "sk_live_secretvalue";
    assert.throws(() => assertSandboxReady(), /Live provider keys/);
    process.env.QADI_API_KEY = "sk_test_secretvalue";
    process.env.QADI_BASE_URL = "https://api.qadi.io";
    assert.throws(() => assertSandboxReady(), /sandbox host/);
  });

  it("strips secrets out of provider errors", () => {
    const message = safeProviderMessage(new Error("rejected sk_test_secretvalue"));
    assert.equal(message.includes("secretvalue"), false);
    assert.equal(message.includes("sk_test_"), false);
  });
});

describe("campaign funding and payouts", () => {
  it("credits a deposit once and will not pay more than the funded balance", async () => {
    const store = seed();
    const providers = bundle();
    await fund(store, 500, "deposit-once-01");
    await applyQadiEvent(store, providers, {
      eventType: "fiat_order.fulfilled",
      eventId: "qadi:fiat_order.fulfilled:replay",
      orderId: (await store.listDeposits(ORG))[0].externalId,
      idempotencyKey: "deposit-once-01",
      orderType: "onramp",
      status: "fulfilled",
      fiatAmount: "500.00",
      cryptoAmount: "3.800000",
      errorMessage: null,
    });
    const [balance] = await store.listBalances(ORG);
    assert.equal(balance.fundedKes, 500);

    store.setApproved(CAMPAIGN, AMBASSADOR, 2);
    const payouts = await requestCashRewards(store, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      advocate: AMBASSADOR,
    });
    assert.equal(payouts.length, 2);
    assert.equal(payouts.filter((p) => p.status === "paid").length, 1);
    const waiting = payouts.find((p) => p.status !== "paid");
    assert.equal(waiting?.lastError, "This campaign does not have enough funded balance for this reward.");
    const after = (await store.listBalances(ORG))[0];
    assert.equal(after.fundedKes, 0);
    assert.equal(after.availableKes, 0);
  });

  it("pays each reward at most once", async () => {
    const store = seed();
    const providers = bundle();
    await fund(store, 1000, "deposit-idem-01");
    resetProviderMocks();
    const first = await requestCashRewards(store, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      advocate: AMBASSADOR,
    });
    const second = await requestCashRewards(store, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      advocate: AMBASSADOR,
    });
    assert.equal(first[0].id, second[0].id);
    assert.equal(first[0].status, "paid");
    assert.equal(providerMockCalls().length, 1);
    assert.equal((await store.listPayoutsForAdvocate(AMBASSADOR)).length, 1);
  });

  it("retries a retryable failure a limited number of times, then stops", async () => {
    const store = seed();
    store.setPhone(CAMPAIGN, AMBASSADOR, "+254711111111");
    const providers = bundle({ qadi: false });
    await fund(store, 133, "deposit-retry-01");
    store.seedCampaign({
      id: CAMPAIGN,
      orgId: ORG,
      title: "Saturday market",
      rewardKind: "cash",
      rewardAmount: 133,
      rewardThreshold: 1,
      rewardRepeats: false,
    });
    store.setApproved(CAMPAIGN, AMBASSADOR, 1);
    store.setPhone(CAMPAIGN, AMBASSADOR, "+254711111111");
    resetProviderMocks();
    const [payout] = await requestCashRewards(store, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      advocate: AMBASSADOR,
    });
    assert.equal(payout.status, "failed");
    assert.equal(payout.attempts, MAX_PAYOUT_ATTEMPTS);
    assert.equal(providerMockCalls().length, MAX_PAYOUT_ATTEMPTS);
    const balance = (await store.listBalances(ORG))[0];
    assert.equal(balance.fundedKes, 133);
    assert.equal(balance.reservedKes, 0);
  });

  it("falls back to Qadi after Autopay refuses the number, still once", async () => {
    const store = seed();
    store.setPhone(CAMPAIGN, AMBASSADOR, "+254700000002");
    const providers = bundle();
    await fund(store, 500, "deposit-fallback-01");
    resetProviderMocks();
    const [payout] = await requestCashRewards(store, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      advocate: AMBASSADOR,
    });
    assert.equal(payout.status, "paid");
    assert.equal(payout.provider, "qadi");
    assert.equal(payout.autopayAttempts, 1);
    assert.equal(payout.qadiAttempts, 1);
    assert.equal(providerMockCalls().length, 2);
  });

  it("keeps a held payout pending and restores a reversal without paying again", async () => {
    const store = seed();
    const providers = bundle();
    await fund(store, 1000, "deposit-reverse-01");
    store.setPhone(CAMPAIGN, AMBASSADOR, "+254700000004");
    const [payout] = await requestCashRewards(store, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      advocate: AMBASSADOR,
    });
    assert.equal(payout.status, "paid");
    await applyAutopayEvent(store, providers, {
      eventId: "autopay:evt_reverse",
      eventType: "payout.reversed",
      payoutId: payout.externalId,
      reference: payout.id,
      status: "reversed",
      failureCode: null,
      failureMessage: null,
    });
    const reversed = await store.getPayout(payout.id);
    assert.equal(reversed?.status, "failed");
    assert.equal((await store.listBalances(ORG))[0].fundedKes, 1000);
    const again = await requestCashRewards(store, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      advocate: AMBASSADOR,
    });
    assert.equal(again[0].status, "failed");
    assert.equal((await store.listPayoutsForAdvocate(AMBASSADOR)).length, 1);
  });

  it("ignores a replayed deposit webhook", async () => {
    const store = seed();
    const providers = bundle();
    const row = await startDeposit(store, providers.qadiDeposit!, providers, {
      orgId: ORG,
      campaignId: CAMPAIGN,
      amountKes: 800,
      payerPhone: "+254712345678",
      idempotencyKey: "deposit-replay-01",
    });
    const event = parseQadiWebhook("fiat_order.fulfilled", {
      id: "evt_same",
      type: "fiat_order.fulfilled",
      data: {
        id: row.externalId,
        type: "onramp",
        status: "fulfilled",
        fiatAmount: "800.00",
        cryptoAmount: "6.000000",
        idempotencyKey: "deposit-replay-01",
      },
    });
    assert.equal((await applyQadiEvent(store, providers, event)).duplicate, false);
    assert.equal((await applyQadiEvent(store, providers, event)).duplicate, true);
    assert.equal((await store.listBalances(ORG))[0].fundedKes, 800);
  });
});

describe("provider choice", () => {
  const base = {
    attempts: 0,
    maxAttempts: 3,
    autopayAttempts: 0,
    qadiAttempts: 0,
    autopayTerminal: false,
    status: "pending" as const,
    externalId: null,
  };

  it("uses Autopay first and Qadi only after Autopay is finished", () => {
    const both = { autopay: true, qadi: true };
    assert.equal(chooseProvider(base, both), "autopay");
    assert.equal(chooseProvider({ ...base, autopayAttempts: 2, attempts: 2 }, both), "qadi");
    assert.equal(chooseProvider({ ...base, autopayTerminal: true, attempts: 1, autopayAttempts: 1 }, both), "qadi");
    assert.equal(
      chooseProvider({ ...base, externalId: "po_1", status: "pending" }, both),
      null
    );
  });
});
