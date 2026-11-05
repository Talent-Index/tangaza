import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * MiniSend merchant API — the hosted checkout a business pays on (M-Pesa or USDC/USDT)
 * for a campaign credit. https://docs.minisend.xyz
 *
 * This module is only the HTTP + signature layer; attribution and credit-granting live
 * in lib/billing-match.ts like every other rail. Off until MINISEND_API_KEY is set, so
 * the manual "pay this exact amount" flow keeps working unchanged without it.
 *
 *   MINISEND_API_KEY        — `ms_live_…` from merchant.minisend.xyz → API Keys. Server
 *                             only: it can open sessions in our name.
 *   MINISEND_WEBHOOK_SECRET — Dashboard → Webhooks, shown once. Signs every delivery.
 *
 * There is no sandbox: MiniSend's own docs say to test with a real $1 session.
 */

const API = "https://merchant.minisend.xyz/api/merchant";

/** How far a webhook's timestamp may drift from our clock before it's a replay. */
const SIGNATURE_TOLERANCE_S = 300;

export function minisendEnabled(): boolean {
  return Boolean(process.env.MINISEND_API_KEY?.trim());
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string;
}

/**
 * Open a hosted checkout. `amount` is USDC with at most two decimals (their API rejects
 * more), `externalId` echoes back on every webhook, `redirectUrl` must be https.
 */
export async function createCheckoutSession(p: {
  amountUsd: number;
  externalId: string;
  description: string;
  redirectUrl?: string;
}): Promise<CheckoutSession> {
  const key = process.env.MINISEND_API_KEY?.trim();
  if (!key) throw new Error("MINISEND_API_KEY is not set");

  const res = await fetch(`${API}/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(p.amountUsd * 100) / 100,
      description: p.description,
      external_id: p.externalId,
      ...(p.redirectUrl ? { redirect_url: p.redirectUrl } : {}),
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    session_id?: string;
    checkout_url?: string;
    expires_at?: string;
    error?: string;
    message?: string;
  };
  if (res.status !== 201 || !json.session_id || !json.checkout_url || !json.expires_at) {
    throw new Error(`MiniSend checkout failed (${res.status}): ${json.error ?? json.message ?? "no body"}`);
  }
  return { sessionId: json.session_id, checkoutUrl: json.checkout_url, expiresAt: json.expires_at };
}

export type SessionStatus =
  | "pending"
  | "deposit_received"
  | "settling"
  | "completed"
  | "failed"
  | "expired";

export interface SessionView {
  sessionId: string;
  status: SessionStatus;
  amountUsdc: number;
  /** Payout receipt (an M-Pesa code for KES settlement) — present once completed. */
  settlementReceipt: string | null;
  completedAt: string | null;
}

/** Public, unauthenticated by MiniSend's design — the "check again" fallback to a webhook. */
export async function getCheckoutSession(sessionId: string): Promise<SessionView | null> {
  const res = await fetch(`${API}/checkout/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MiniSend status failed (${res.status})`);
  const j = (await res.json()) as {
    session_id: string;
    status: SessionStatus;
    amount_usdc: number;
    settlement_receipt?: string | null;
    completed_at?: string | null;
  };
  return {
    sessionId: j.session_id,
    status: j.status,
    amountUsdc: Number(j.amount_usdc),
    settlementReceipt: j.settlement_receipt ?? null,
    completedAt: j.completed_at ?? null,
  };
}

/* ------------------------------------------------------------------- webhooks */

/** The fields we act on; MiniSend sends more (see docs.minisend.xyz/webhooks/events). */
export interface CheckoutEvent {
  event: string;
  session_id: string;
  external_id?: string;
  amount_usdc?: number;
  amount_expected_usdc?: number;
  amount_received_usdc?: number;
  amount_matched?: boolean;
  /** Payout receipt for fiat settlement (M-Pesa code), tx id for USDC settlement. */
  receipt?: string;
  deposit_tx_hash?: string;
  deposit_chain?: string;
  status?: string;
}

function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

function sameHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length > 0 && ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Verify a delivery against the RAW body — re-serialised JSON would not match.
 * Prefers the timestamped V2 header (`t=<unix>,v1=<hmac of "t.body">`, which defeats
 * replays) and falls back to V1 (hmac of the body alone) for the product lines that
 * only send that. Returns null when verified, else the reason.
 */
export function verifyWebhook(
  rawBody: string,
  headers: { v2: string | null; v1: string | null },
  now = Date.now()
): string | null {
  const secret = process.env.MINISEND_WEBHOOK_SECRET?.trim();
  if (!secret) return "MINISEND_WEBHOOK_SECRET not set";

  if (headers.v2) {
    const parts = Object.fromEntries(
      headers.v2.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string])
    );
    const t = Number(parts.t);
    if (!Number.isFinite(t)) return "malformed V2 signature";
    if (Math.abs(now / 1000 - t) > SIGNATURE_TOLERANCE_S) return "stale signature";
    return sameHex(parts.v1 ?? "", hmacHex(secret, `${parts.t}.${rawBody}`)) ? null : "bad V2 signature";
  }
  if (headers.v1) {
    return sameHex(headers.v1, hmacHex(secret, rawBody)) ? null : "bad V1 signature";
  }
  return "no signature header";
}
