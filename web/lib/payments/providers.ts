import { assertSandboxReady, readPaymentsEnv } from "./config";
import { safeProviderMessage } from "./errors";
import { isRetryableFailure, kesToAutopayCents } from "./ledger";
import type { DepositClient, PayoutClient, ProviderBundle, ProviderCallResult } from "./models";

/**
 * HTTP clients for Qadi (money in, and the payout fallback) and Autopay (money out).
 * Sandbox phone numbers follow Autopay's published table so the mock and the real
 * sandbox fail the same way. Keys travel only in request headers and are never logged.
 */

const seen = new Map<string, ProviderCallResult>();
const calls: string[] = [];

export function resetProviderMocks(): void {
  seen.clear();
  calls.length = 0;
}

export function providerMockCalls(): readonly string[] {
  return calls;
}

function remember(key: string, result: ProviderCallResult): ProviderCallResult {
  const prior = seen.get(key);
  if (prior) return prior;
  calls.push(key);
  // Retryable failures are not cached: Autopay says to send the same key again.
  // A paid or terminal result is cached so the same key cannot pay twice.
  if (result.ok || !result.retryable) seen.set(key, result);
  return result;
}

/** Autopay sandbox table, plus a Qadi on-ramp failure on the same "bad" handset. */
export function sandboxPayoutResult(amountKes: number, phone: string, idempotencyKey: string): ProviderCallResult {
  const externalId = `po_mock_${idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(-24)}`;
  if (phone.endsWith("000002")) {
    return remember(idempotencyKey, {
      ok: false,
      retryable: false,
      code: "RECIPIENT_INVALID",
      message: "The recipient's account can't receive this payout.",
      externalId,
    });
  }
  if (phone.endsWith("000003")) {
    return remember(idempotencyKey, {
      ok: true,
      externalId,
      state: "pending",
      providerStatus: "in_review",
    });
  }
  if (amountKes === 133) {
    return remember(idempotencyKey, {
      ok: false,
      retryable: true,
      code: "METHOD_UNAVAILABLE",
      message: "The payout network did not answer. Nothing was paid.",
      externalId,
    });
  }
  return remember(idempotencyKey, {
    ok: true,
    externalId,
    state: phone.endsWith("000001") ? "paid" : "paid",
    providerStatus: "succeeded",
  });
}

export function mockAutopayClient(): PayoutClient {
  return {
    name: "autopay",
    async createPayout(input) {
      return sandboxPayoutResult(input.amountKes, input.phone, input.idempotencyKey);
    },
  };
}

export function mockQadiPayoutClient(): PayoutClient {
  return {
    name: "qadi",
    async createPayout(input) {
      const key = input.idempotencyKey;
      // 000002 is Autopay's "recipient invalid" handset. The fallback still pays it.
      // 000009 fails at both providers.
      if (input.phone.endsWith("000009")) {
        return remember(key, {
          ok: false,
          retryable: false,
          code: "RECIPIENT_INVALID",
          message: "Qadi could not pay this M-Pesa number.",
        });
      }
      return remember(key, {
        ok: true,
        externalId: `ord_mock_${key.replace(/[^a-zA-Z0-9]/g, "").slice(-24)}`,
        state: "paid",
        providerStatus: "fulfilled",
      });
    },
  };
}

export function mockQadiDepositClient(): DepositClient {
  return {
    async startOnramp(input) {
      if (input.payerPhone.endsWith("000002")) {
        return remember(input.idempotencyKey, {
          ok: false,
          retryable: false,
          code: "PAYER_CANCELLED",
          message: "The M-Pesa prompt was declined.",
        });
      }
      return remember(input.idempotencyKey, {
        ok: true,
        externalId: `ord_mock_${input.idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(-24)}`,
        state: "pending",
        providerStatus: "processing",
        amountUsdc: (input.amountKes / 130).toFixed(6),
      });
    },
  };
}

function dataOf(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const record = json as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return record;
}

function errorCode(json: unknown, status: number): { code: string; message: string; retryable: boolean } {
  const record = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const code = typeof record.code === "string" ? record.code : status >= 500 ? "PROVIDER_UNAVAILABLE" : "VALIDATION_ERROR";
  const message =
    typeof record.error === "string"
      ? record.error
      : typeof record.message === "string"
        ? record.message
        : "The payment provider refused the request.";
  return { code, message: safeProviderMessage(new Error(message), "The payment provider refused the request."), retryable: isRetryableFailure(code, status) };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { message: "The payment provider returned a response that was not JSON." };
    }
  }
  return { status: res.status, json };
}

function mapPayoutStatus(status: string): "pending" | "paid" | "failed" {
  if (status === "succeeded" || status === "fulfilled" || status === "validated") return "paid";
  if (status === "failed" || status === "reversed" || status === "expired" || status === "refunded") return "failed";
  return "pending";
}

export function httpAutopayClient(apiKey: string, baseUrl: string): PayoutClient {
  return {
    name: "autopay",
    async createPayout(input) {
      try {
        const { status, json } = await postJson(
          `${baseUrl}/api/v1/payouts`,
          { authorization: `Bearer ${apiKey}`, "idempotency-key": input.idempotencyKey },
          {
            amount: kesToAutopayCents(input.amountKes),
            currency: "KES",
            source_token: "USDC",
            destination: { type: "mobile_money", phone: input.phone, network: "safaricom" },
            reference: input.reference.slice(0, 64),
            description: input.description.slice(0, 140),
            metadata: { reward_key: input.idempotencyKey },
          }
        );
        const data = dataOf(json);
        if (status >= 400 || data.status === "failed") {
          const err = errorCode(json, status);
          return { ok: false, retryable: err.retryable, code: err.code, message: err.message };
        }
        const id = typeof data.id === "string" ? data.id : "";
        const providerStatus = typeof data.status === "string" ? data.status : "pending";
        if (!id) {
          return { ok: false, retryable: true, code: "PROVIDER_UNAVAILABLE", message: "Autopay did not return a payout id." };
        }
        const state = mapPayoutStatus(providerStatus);
        if (state === "failed") {
          const code = typeof data.failure_code === "string" ? data.failure_code : "PAYOUT_FAILED";
          return {
            ok: false,
            retryable: isRetryableFailure(code),
            code,
            message: typeof data.failure_message === "string" ? data.failure_message : "The payout failed.",
            externalId: id,
          };
        }
        return { ok: true, externalId: id, state, providerStatus };
      } catch (err) {
        return { ok: false, retryable: true, code: "NETWORK", message: safeProviderMessage(err) };
      }
    },
  };
}

/**
 * Qadi on-ramp: quote, then execute. Sandbox `chain: avalanche` is Fuji, not C-Chain
 * mainnet. The destination is Qadi's managed wallet. This never sends to TangazaRewards.
 */
export function httpQadiDepositClient(apiKey: string, baseUrl: string): DepositClient {
  return {
    async startOnramp(input) {
      const headers = { "x-api-key": apiKey };
      try {
        const quote = await postJson(`${baseUrl}/v1/fiat-orders/onramp/quote`, headers, {
          amount: input.amountKes.toFixed(2),
          amountIn: "fiat",
          token: "USDC",
          chain: "avalanche",
          fiatCurrency: "KES",
          destType: "managed_wallet",
          payerPhone: input.payerPhone,
        });
        if (quote.status >= 400) {
          const err = errorCode(quote.json, quote.status);
          return { ok: false, retryable: err.retryable, code: err.code, message: err.message };
        }
        const quoteId = dataOf(quote.json).quoteId;
        if (typeof quoteId !== "string" || !quoteId) {
          return { ok: false, retryable: true, code: "PROVIDER_UNAVAILABLE", message: "Qadi did not return a quote." };
        }
        const executed = await postJson(`${baseUrl}/v1/fiat-orders/onramp/execute`, headers, {
          quoteId,
          idempotencyKey: input.idempotencyKey,
        });
        if (executed.status >= 400) {
          const err = errorCode(executed.json, executed.status);
          return { ok: false, retryable: err.retryable, code: err.code, message: err.message };
        }
        const data = dataOf(executed.json);
        const id = typeof data.id === "string" ? data.id : "";
        if (!id) {
          return { ok: false, retryable: true, code: "PROVIDER_UNAVAILABLE", message: "Qadi did not return an order id." };
        }
        const providerStatus = typeof data.status === "string" ? data.status : "processing";
        const state = mapPayoutStatus(providerStatus);
        const amountUsdc = typeof data.cryptoAmount === "string" ? data.cryptoAmount : null;
        if (state === "failed") {
          return {
            ok: false,
            retryable: false,
            code: "PAYER_CANCELLED",
            message: typeof data.errorMsg === "string" ? data.errorMsg : "The M-Pesa prompt was not completed.",
            externalId: id,
          };
        }
        return { ok: true, externalId: id, state: state === "paid" ? "paid" : "pending", providerStatus, amountUsdc };
      } catch (err) {
        return { ok: false, retryable: true, code: "NETWORK", message: safeProviderMessage(err) };
      }
    },
  };
}

/** Qadi float payout: KES already held with Qadi, sent to an M-Pesa number. Fallback only. */
export function httpQadiPayoutClient(apiKey: string, baseUrl: string): PayoutClient {
  return {
    name: "qadi",
    async createPayout(input) {
      try {
        const { status, json } = await postJson(
          `${baseUrl}/v1/fiat-orders/float-payout`,
          { "x-api-key": apiKey },
          {
            amount: input.amountKes.toFixed(2),
            fiatCurrency: "KES",
            recipient: {
              institution: "mpesa",
              accountIdentifier: input.phone,
              accountName: "Ambassador",
            },
            idempotencyKey: input.idempotencyKey,
          }
        );
        const data = dataOf(json);
        if (status >= 400) {
          const err = errorCode(json, status);
          return { ok: false, retryable: err.retryable, code: err.code, message: err.message };
        }
        const id = typeof data.id === "string" ? data.id : "";
        const providerStatus = typeof data.status === "string" ? data.status : "processing";
        if (!id) {
          return { ok: false, retryable: true, code: "PROVIDER_UNAVAILABLE", message: "Qadi did not return a payout id." };
        }
        const state = mapPayoutStatus(providerStatus);
        if (state === "failed") {
          return {
            ok: false,
            retryable: false,
            code: "PAYOUT_FAILED",
            message: typeof data.errorMsg === "string" ? data.errorMsg : "Qadi could not pay this number.",
            externalId: id,
          };
        }
        return { ok: true, externalId: id, state: state === "paid" ? "paid" : "pending", providerStatus };
      } catch (err) {
        return { ok: false, retryable: true, code: "NETWORK", message: safeProviderMessage(err) };
      }
    },
  };
}

/**
 * Real clients only when that provider's sandbox key is set.
 * When both keys are missing, the mock runs the whole flow and no network call is made.
 * A single configured provider is never paired with a mock that could mark money as paid.
 */
export function loadProviders(): ProviderBundle {
  assertSandboxReady();
  const env = readPaymentsEnv();
  const simulated = !env.qadiKey && !env.autopayKey;
  return {
    simulated,
    availability: {
      autopay: Boolean(env.autopayKey) || simulated,
      qadi: Boolean(env.qadiKey) || simulated,
    },
    autopay: env.autopayKey
      ? httpAutopayClient(env.autopayKey, env.autopayBase)
      : simulated
        ? mockAutopayClient()
        : null,
    qadiPayout: env.qadiKey
      ? httpQadiPayoutClient(env.qadiKey, env.qadiBase)
      : simulated
        ? mockQadiPayoutClient()
        : null,
    qadiDeposit: env.qadiKey
      ? httpQadiDepositClient(env.qadiKey, env.qadiBase)
      : simulated
        ? mockQadiDepositClient()
        : null,
  };
}
