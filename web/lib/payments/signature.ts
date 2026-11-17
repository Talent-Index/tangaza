import { createHmac, timingSafeEqual } from "node:crypto";

/** Qadi and Autopay both reject deliveries older than five minutes. */
export const WEBHOOK_MAX_SKEW_SEC = 5 * 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function freshTimestamp(timestamp: string, nowSec: number): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= WEBHOOK_MAX_SKEW_SEC;
}

export function qadiSignatureHex(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * Qadi signs `{X-Qadi-Timestamp}.{raw body}` with HMAC-SHA256 and sends `sha256=<hex>`.
 * Compare the hex against the raw body bytes, not a re-serialised JSON object.
 */
export function verifyQadiSignature(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.secret) return { ok: false, reason: "Webhook secret is not configured" };
  if (!input.timestamp || !input.signature) return { ok: false, reason: "Missing signature" };
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (!freshTimestamp(input.timestamp, nowSec)) return { ok: false, reason: "Timestamp is outside the allowed window" };
  const expected = qadiSignatureHex(input.secret, input.timestamp, input.rawBody);
  const got = input.signature.trim().replace(/^sha256=/i, "");
  if (!safeEqual(expected, got)) return { ok: false, reason: "Signature does not match" };
  return { ok: true };
}

export function autopaySignatureHex(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/** Header shape: `t=<unix>,v1=<hex>` over `${t}.${rawBody}`. */
export function verifyAutopaySignature(input: {
  secret: string;
  header: string | null;
  rawBody: string;
  nowSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.secret) return { ok: false, reason: "Webhook secret is not configured" };
  if (!input.header) return { ok: false, reason: "Missing signature" };
  const parts = new Map<string, string>();
  for (const piece of input.header.split(",")) {
    const eq = piece.indexOf("=");
    if (eq === -1) continue;
    parts.set(piece.slice(0, eq).trim(), piece.slice(eq + 1).trim());
  }
  const timestamp = parts.get("t") ?? "";
  const v1 = parts.get("v1") ?? "";
  if (!timestamp || !v1) return { ok: false, reason: "Missing signature" };
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (!freshTimestamp(timestamp, nowSec)) return { ok: false, reason: "Timestamp is outside the allowed window" };
  const expected = autopaySignatureHex(input.secret, timestamp, input.rawBody);
  if (!safeEqual(expected, v1)) return { ok: false, reason: "Signature does not match" };
  return { ok: true };
}
