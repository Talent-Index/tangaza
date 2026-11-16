import { PaymentError } from "./errors";

/**
 * Sandbox is the only mode this release will run.
 * Live keys and the live Qadi host are refused even if someone sets them in Vercel.
 * Nothing here logs or returns the key values.
 */

const LIVE_QADI_HOST = /(^|\.)api\.qadi\.io$/i;

export interface PaymentsPublicStatus {
  mode: "sandbox" | "blocked";
  livePaymentsEnabled: false;
  /** Keys are missing, or live mode was requested and refused. */
  testMode: boolean;
  /** Both provider keys are absent, so calls stay on the in-process mock. */
  simulated: boolean;
  qadiConfigured: boolean;
  autopayConfigured: boolean;
}

export function readPaymentsEnv() {
  const modeRaw = (process.env.PAYMENTS_MODE ?? "").trim().toLowerCase();
  const qadiKey = (process.env.QADI_API_KEY ?? "").trim();
  const autopayKey = (process.env.AUTOPAY_API_KEY ?? "").trim();
  const qadiBase = (process.env.QADI_BASE_URL ?? "").trim().replace(/\/$/, "");
  const autopayBase = (process.env.AUTOPAY_BASE_URL ?? "").trim().replace(/\/$/, "");
  const qadiWebhookSecret = (process.env.QADI_WEBHOOK_SECRET ?? "").trim();
  const autopayWebhookSecret = (process.env.AUTOPAY_WEBHOOK_SECRET ?? "").trim();
  return {
    modeRaw: modeRaw || "sandbox",
    qadiKey,
    autopayKey,
    qadiBase: qadiBase || "https://sandboxapi.qadi.io",
    autopayBase: autopayBase || "https://api.autopayke.com",
    qadiWebhookSecret,
    autopayWebhookSecret,
  };
}

export function paymentsPublicStatus(): PaymentsPublicStatus {
  const env = readPaymentsEnv();
  const blocked = env.modeRaw !== "sandbox";
  const qadiConfigured = Boolean(env.qadiKey);
  const autopayConfigured = Boolean(env.autopayKey);
  return {
    mode: blocked ? "blocked" : "sandbox",
    livePaymentsEnabled: false,
    testMode: blocked || !qadiConfigured || !autopayConfigured,
    simulated: !blocked && !qadiConfigured && !autopayConfigured,
    qadiConfigured,
    autopayConfigured,
  };
}

/** Throws when the process is not allowed to talk to a provider. */
export function assertSandboxReady(): void {
  const env = readPaymentsEnv();
  if (env.modeRaw !== "sandbox") {
    throw new PaymentError(
      "Live payments are not enabled. Leave PAYMENTS_MODE unset or set it to sandbox.",
      403
    );
  }
  if (env.qadiKey.startsWith("sk_live_") || env.autopayKey.startsWith("apk_live_")) {
    throw new PaymentError("Live provider keys are refused. Use sandbox keys only.", 403);
  }
  let host = "";
  try {
    host = new URL(env.qadiBase).hostname;
  } catch {
    throw new PaymentError("QADI_BASE_URL is not a valid URL.", 500);
  }
  if (LIVE_QADI_HOST.test(host)) {
    throw new PaymentError("QADI_BASE_URL must be the sandbox host, not the live API.", 403);
  }
}

export function assertWebhookSecret(secret: string, which: "Qadi" | "Autopay"): void {
  if (!secret) {
    throw new PaymentError(`${which} webhook secret is not configured.`, 401);
  }
}
