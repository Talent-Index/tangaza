import "server-only";
import { createPublicClient, http, isAddress, parseAbiItem } from "viem";
import { confirmPaymentIntent } from "./billing";
import { sql } from "./db";
import { getCheckoutSession, minisendEnabled, type CheckoutEvent } from "./minisend";
import { RPC_URL } from "./rpc";
import { VIEM_CHAIN } from "./viem-chain";

/**
 * Automatic payment matching — billing Phase 2 (M-Pesa, on-chain) and 3 (MiniSend).
 *
 * Attribution was designed for this moment: every open checkout owns a reference code
 * AND a unique amount, so an incoming payment can be matched with no memo at all.
 * Matching is deliberately strict — reference first, then EXACT amount; anything else
 * (wrong amount, overpayment, a stranger's transfer) is recorded as an unmatched
 * payment for a human to resolve in /admin/billing, never guessed at. Money that can't
 * be attributed with certainty must not quietly become somebody's credit.
 *
 * MiniSend is the one rail that attributes by construction: each hosted checkout is a
 * session we created for one intent, so its signed webhook matches by session id, and
 * the same strictness applies to the amount it reports.
 *
 * Both tables are created by db/022_billing_match.sql and lazily here, matching the
 * project's migrations-by-hand convention.
 */

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  ready ??= (async () => {
    await sql`
      create table if not exists unmatched_payments (
        id        serial primary key,
        source    text not null,
        ref       text unique not null,
        amount    numeric(18,6) not null,
        payer     text,
        note      text,
        resolved  boolean not null default false,
        seen_at   timestamptz not null default now()
      )`;
    await sql`
      create table if not exists billing_scan (
        id         int primary key default 1,
        last_block bigint not null default 0,
        updated_at timestamptz not null default now()
      )`;
  })().catch((err) => {
    ready = null; // let the next request retry
    throw err;
  });
  return ready;
}

async function recordUnmatched(p: {
  source: "mpesa" | "onchain" | "minisend";
  ref: string;
  amount: number;
  payer?: string;
  note?: string;
}): Promise<void> {
  await ensureTables();
  await sql`
    insert into unmatched_payments (source, ref, amount, payer, note)
    values (${p.source}, ${p.ref}, ${p.amount}, ${p.payer ?? null}, ${p.note ?? null})
    on conflict (ref) do nothing`;
}

/** Pending intents outrank expired ones: a recycled amount must never pay an old ghost. */
async function intentByExactKes(amount: number): Promise<string | null> {
  const rows = (await sql`
    select code from payment_intents
    where status in ('pending', 'expired') and amount_kes = ${amount}
    order by (status = 'pending') desc, created_at desc
    limit 1`) as Array<{ code: string }>;
  return rows[0]?.code ?? null;
}

/**
 * An M-Pesa payment to OUR shortcode (not a merchant's Till): reference code first —
 * people type them with spaces and in lowercase, so normalise hard — then exact amount,
 * the fallback for a forgotten code. M-Pesa C2B amounts are whole KES.
 */
export async function matchBillingMpesa(p: {
  transId: string;
  amount: number;
  billRef?: string;
  msisdn?: string;
}): Promise<boolean> {
  await ensureTables();

  const typed = (p.billRef ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (typed) {
    const confirmed = await confirmPaymentIntent(typed, p.transId);
    if (confirmed) return true;
  }

  if (Number.isInteger(p.amount) && p.amount > 0) {
    const code = await intentByExactKes(p.amount);
    if (code) {
      const confirmed = await confirmPaymentIntent(code, p.transId);
      if (confirmed) return true;
    }
  }

  await recordUnmatched({
    source: "mpesa",
    ref: p.transId,
    amount: p.amount,
    payer: p.msisdn,
    note: p.billRef ? `typed ref: ${p.billRef}` : undefined,
  });
  return false;
}

/* ------------------------------------------------------------ on-chain watcher */

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/**
 * getLogs window per request and chunks per run. Avalanche's PUBLIC mainnet RPC rejects
 * any range over 100 blocks (measured 2026-11-05; Fuji's allowed 1000), and lib/rpc.ts
 * defaults to that endpoint — so 100 is the only window that works everywhere. 40 chunks
 * = 4,000 blocks per run, comfortably more than an hour of C-Chain blocks, so the hourly
 * cron keeps up; a provider RPC (AVALANCHE_RPC_URL) just makes each run cheaper.
 */
const CHUNK_BLOCKS = 100n;
const MAX_CHUNKS = 40;
/** First run starts this far behind the tip instead of reading all of history. */
const FIRST_RUN_LOOKBACK = 5000n;

/** The token is assumed 6-decimals (USDC) — unique_amount is stored to 6dp to match. */
function watcherEnv(): { receive: `0x${string}`; token: `0x${string}` } | null {
  const receive = process.env.BILLING_RECEIVE_ADDRESS?.trim();
  const token = process.env.BILLING_TOKEN_ADDRESS?.trim();
  if (!receive || !token || !isAddress(receive) || !isAddress(token)) return null;
  return { receive: receive as `0x${string}`, token: token as `0x${string}` };
}

async function intentByTokenUnits(units: bigint): Promise<string | null> {
  // unique_amount is NUMERIC(12,6); value is the raw 6-decimal integer. Comparing
  // round(unique_amount * 1e6) to it is exact — no float ever touches the money.
  const rows = (await sql`
    select code from payment_intents
    where status in ('pending', 'expired')
      and unique_amount is not null
      and round(unique_amount * 1000000) = ${units.toString()}::numeric
    order by (status = 'pending') desc, created_at desc
    limit 1`) as Array<{ code: string }>;
  return rows[0]?.code ?? null;
}

// One scan at a time per instance, and not more than every 30s — the "I've paid"
// button may be pressed with enthusiasm.
let scanning: Promise<ScanResult> | null = null;
let lastScanAt = 0;

export interface ScanResult {
  enabled: boolean;
  scannedTo?: string;
  matched: number;
  unmatched: number;
}

export function runOnchainMatch(force = false): Promise<ScanResult> {
  if (scanning) return scanning;
  if (!force && Date.now() - lastScanAt < 30_000) {
    return Promise.resolve({ enabled: watcherEnv() !== null, matched: 0, unmatched: 0 });
  }
  scanning = scan().finally(() => {
    scanning = null;
    lastScanAt = Date.now();
  });
  return scanning;
}

async function scan(): Promise<ScanResult> {
  const env = watcherEnv();
  if (!env) return { enabled: false, matched: 0, unmatched: 0 };
  await ensureTables();

  const client = createPublicClient({ chain: VIEM_CHAIN, transport: http(RPC_URL) });
  const tip = await client.getBlockNumber();

  const rows = (await sql`
    insert into billing_scan (id, last_block) values (1, 0)
    on conflict (id) do nothing returning last_block`) as Array<{ last_block: string }>;
  const stored =
    rows[0]?.last_block ??
    ((await sql`select last_block from billing_scan where id = 1`) as Array<{ last_block: string }>)[0]
      ?.last_block ??
    "0";
  let from = BigInt(stored) + 1n;
  if (from <= 1n) from = tip > FIRST_RUN_LOOKBACK ? tip - FIRST_RUN_LOOKBACK : 0n;

  let matched = 0;
  let unmatched = 0;
  for (let chunk = 0; chunk < MAX_CHUNKS && from <= tip; chunk++) {
    const to = from + CHUNK_BLOCKS - 1n > tip ? tip : from + CHUNK_BLOCKS - 1n;
    const logs = await client.getLogs({
      address: env.token,
      event: TRANSFER,
      args: { to: env.receive },
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const units = log.args.value ?? 0n;
      const ref = `${log.transactionHash}:${log.logIndex}`;
      const code = await intentByTokenUnits(units);
      const confirmed = code ? await confirmPaymentIntent(code, log.transactionHash ?? ref) : null;
      if (confirmed) {
        matched++;
      } else {
        unmatched++;
        await recordUnmatched({
          source: "onchain",
          ref,
          amount: Number(units) / 1e6,
          payer: log.args.from,
        });
      }
    }
    await sql`update billing_scan set last_block = ${to.toString()}, updated_at = now() where id = 1`;
    from = to + 1n;
  }

  return { enabled: true, scannedTo: (from - 1n).toString(), matched, unmatched };
}

/* ------------------------------------------------------------------ MiniSend */

/**
 * A `checkout.completed` webhook (already signature-verified by the route). Matched by
 * OUR session id first; the echoed external_id is only a fallback for an intent whose
 * session write was lost. A short payment — MiniSend's own `amount_matched: false`,
 * or received < expected — is never credited: it lands in unmatched_payments with
 * the session as the ref, which also keeps webhook retries idempotent.
 */
export async function matchBillingMinisend(e: CheckoutEvent): Promise<boolean> {
  await ensureTables();
  const expected = e.amount_expected_usdc ?? e.amount_usdc ?? null;
  const received = e.amount_received_usdc ?? e.amount_usdc ?? null;
  const short =
    e.amount_matched === false ||
    (expected !== null && received !== null && received + 1e-9 < expected);
  // What the receipt line shows: the M-Pesa payout code when settling to KES, else the tx.
  const ref = e.receipt || e.deposit_tx_hash || e.session_id;

  const bySession = (await sql`
    select code, status from payment_intents where minisend_session_id = ${e.session_id} limit 1`) as Array<{
    code: string;
    status: string;
  }>;
  let hit = bySession[0] ?? null;
  if (!hit && e.external_id) {
    const byCode = (await sql`
      select code, status from payment_intents
      where upper(code) = ${e.external_id.trim().toUpperCase()} limit 1`) as typeof bySession;
    hit = byCode[0] ?? null;
  }

  if (hit && !short) {
    if (hit.status === "confirmed") return true; // a redelivery — already granted
    const confirmed = await confirmPaymentIntent(hit.code, ref);
    if (confirmed) return true;
  }

  await recordUnmatched({
    source: "minisend",
    ref: `minisend:${e.session_id}`,
    amount: received ?? 0,
    payer: e.deposit_chain,
    note: [
      hit ? `intent ${hit.code}` : `no intent for session (external_id: ${e.external_id ?? "none"})`,
      short ? `short: received ${received} of ${expected} USDC` : null,
    ]
      .filter(Boolean)
      .join("; "),
  });
  return false;
}

/**
 * "Check again" for the MiniSend rail: ask MiniSend's public status endpoint about the
 * business's recent sessions, in case the webhook never arrived. `completed` on that
 * endpoint means paid in full and settled, so it confirms directly.
 */
export async function recheckMinisendIntent(orgId: string): Promise<boolean> {
  if (!minisendEnabled()) return false;
  const rows = (await sql`
    select code, minisend_session_id from payment_intents
    where org_id = ${orgId} and status in ('pending', 'expired')
      and minisend_session_id is not null
    order by created_at desc limit 3`) as Array<{ code: string; minisend_session_id: string }>;
  for (const r of rows) {
    const s = await getCheckoutSession(r.minisend_session_id).catch(() => null);
    if (s?.status !== "completed") continue;
    const confirmed = await confirmPaymentIntent(r.code, s.settlementReceipt ?? s.sessionId);
    if (confirmed) return true;
  }
  return false;
}

/* ------------------------------------------------------------ admin helpers */

export interface UnmatchedView {
  ref: string;
  source: string;
  amount: number;
  payer: string | null;
  note: string | null;
  seenAt: string;
}

export async function listUnmatched(): Promise<UnmatchedView[]> {
  await ensureTables();
  const rows = (await sql`
    select * from unmatched_payments where resolved = false
    order by seen_at desc limit 50`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    ref: String(r.ref),
    source: String(r.source),
    amount: Number(r.amount),
    payer: (r.payer as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    seenAt: new Date(r.seen_at as string).toISOString(),
  }));
}

/** Done with it — either manually confirmed against an intent, or refunded off-platform. */
export async function resolveUnmatched(ref: string): Promise<boolean> {
  await ensureTables();
  const rows = (await sql`
    update unmatched_payments set resolved = true
    where ref = ${ref} and resolved = false returning id`) as unknown[];
  return rows.length > 0;
}
