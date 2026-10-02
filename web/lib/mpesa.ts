import "server-only";

/**
 * Safaricom Daraja — C2B (customer-to-business) for the referral pilot.
 *
 * We only *read* payments: a friend pays the merchant's Till normally, and Daraja
 * posts a confirmation to us. We never move or hold funds, so this is attribution,
 * not money transmission — the VASP-sensitive payout stays trust-based/off-chain.
 *
 * All secrets are server-only env vars (see .env.example). Blank config = pilot off;
 * the callback endpoints still accept and store payments, they just can't be registered
 * or simulated without credentials.
 */

const ENV = (process.env.MPESA_ENV ?? "sandbox").toLowerCase();
const BASE =
  ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY?.trim();
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET?.trim();
/** The pilot Till/shortcode this deployment registers + simulates against. */
export const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE?.trim() ?? "";
/** Public base URL Daraja will call back on, e.g. https://ubutangaza.biz */
const CALLBACK_BASE = process.env.MPESA_CALLBACK_BASE_URL?.trim();

export const mpesaConfigured = Boolean(CONSUMER_KEY && CONSUMER_SECRET);

/** The C2B confirmation body Daraja POSTs. Field names are Daraja's, not ours. */
export interface C2BConfirmation {
  TransID?: string;
  TransAmount?: string | number;
  BusinessShortCode?: string;
  BillRefNumber?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  TransTime?: string;
}

async function accessToken(): Promise<string> {
  if (!mpesaConfigured) throw new Error("M-Pesa is not configured on this deployment");
  const basic = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Daraja auth returned no token");
  return json.access_token;
}

/**
 * Register this deployment's C2B validation + confirmation URLs with Daraja. One-time
 * setup per shortcode; ResponseType "Completed" means Safaricom completes the payment
 * even if our validation URL is unreachable, so a callback outage never blocks a sale.
 */
export async function registerC2BUrls(): Promise<{ ok: boolean; detail: string }> {
  if (!CALLBACK_BASE) throw new Error("Set MPESA_CALLBACK_BASE_URL first");
  if (!MPESA_SHORTCODE) throw new Error("Set MPESA_SHORTCODE first");
  const token = await accessToken();
  const res = await fetch(`${BASE}/mpesa/c2b/v1/registerurl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: MPESA_SHORTCODE,
      ResponseType: "Completed",
      ConfirmationURL: `${CALLBACK_BASE}/api/mpesa/confirmation`,
      ValidationURL: `${CALLBACK_BASE}/api/mpesa/validation`,
    }),
  });
  const detail = await res.text().catch(() => "");
  return { ok: res.ok, detail: detail.slice(0, 500) };
}

/**
 * Simulate a customer Till payment (sandbox only). Lets you drive the whole loop end
 * to end without a phone: pass the referrer's share code as billRef.
 */
export async function simulateC2B(p: {
  amount: number;
  msisdn: string;
  billRef: string;
}): Promise<{ ok: boolean; detail: string }> {
  if (ENV === "production") throw new Error("Simulate is sandbox-only");
  if (!MPESA_SHORTCODE) throw new Error("Set MPESA_SHORTCODE first");
  const token = await accessToken();
  const res = await fetch(`${BASE}/mpesa/c2b/v1/simulate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: MPESA_SHORTCODE,
      CommandID: "CustomerPayBillOnline",
      Amount: p.amount,
      Msisdn: p.msisdn,
      BillRefNumber: p.billRef,
    }),
  });
  const detail = await res.text().catch(() => "");
  return { ok: res.ok, detail: detail.slice(0, 500) };
}
