import "server-only";
import { isDbConfigured } from "../db";
import { assertSandboxReady } from "./config";
import { dbPaymentStore, ensurePaymentsSchema } from "./db-store";
import { PaymentError } from "./errors";
import type { PaymentStore, ProviderBundle } from "./models";
import { loadProviders } from "./providers";

export interface PaymentContext {
  store: PaymentStore;
  providers: ProviderBundle;
}

/** Sandbox guard, schema, then the store. Live mode never reaches a provider. */
export async function runPayments<T>(fn: (ctx: PaymentContext) => Promise<T>): Promise<T> {
  assertSandboxReady();
  if (!isDbConfigured) {
    throw new PaymentError("Database is not configured.", 503);
  }
  await ensurePaymentsSchema();
  return fn({ store: dbPaymentStore(), providers: loadProviders() });
}
