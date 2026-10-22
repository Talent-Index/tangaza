import "server-only";
import { sql } from "./db";

/**
 * Campaign credits and payment intents — see db/021_billing.sql for the model.
 *
 * Everything money-shaped lives here and only here: prices are resolved server-side
 * (the UI shows what this module returns, never its own numbers), the paywall is one
 * atomic UPDATE, and a payment is matched to a business by a short reference code AND
 * a unique KES amount, so a ramp that drops the memo still attributes cleanly.
 */

export const FREE_CAMPAIGNS = 2;

/** KES is what the business pays; USD is what we aim to net after ramp fee + spread. */
const PRICE_THIRD = { usd: 3, kes: 430 };
const PRICE_LATER = { usd: 5, kes: 700 };

/** How many unique-amount slots share one base price: KES 430, 431, … 459. */
const OFFSET_RANGE = 30;
const INTENT_TTL_MS = 24 * 60 * 60 * 1000;

/** No 0/O, 1/I/l — a reference someone types from a WhatsApp message must survive it. */
const SAFE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Price of a business's nth campaign; null = covered by the free tier. */
export function priceForCampaign(nth: number): { usd: number; kes: number } | null {
  if (nth <= FREE_CAMPAIGNS) return null;
  return nth === FREE_CAMPAIGNS + 1 ? PRICE_THIRD : PRICE_LATER;
}

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  ready ??= (async () => {
    await sql`
      create table if not exists org_billing (
        org_id            bigint primary key,
        code              text unique not null,
        campaigns_created int  not null default 0,
        campaign_credits  int  not null default 0,
        created_at        timestamptz not null default now()
      )`;
    await sql`
      create table if not exists payment_intents (
        id            serial primary key,
        code          text unique not null,
        org_id        bigint not null,
        credits       int  not null,
        amount_kes    int  not null,
        unique_amount numeric(12,6),
        status        text not null default 'pending',
        matched_ref   text,
        expires_at    timestamptz not null,
        created_at    timestamptz not null default now()
      )`;
    await sql`create index if not exists payment_intents_org_idx on payment_intents (org_id, status)`;
    // Unique while pending: the amount is the fingerprint, so no two open checkouts
    // may share one; confirming/expiring a row leaves the index and recycles the slot.
    await sql`create unique index if not exists payment_intents_pending_amount_idx
              on payment_intents (amount_kes) where status = 'pending'`;
  })().catch((err) => {
    ready = null; // let the next request retry
    throw err;
  });
  return ready;
}

interface BillingRow {
  org_id: string;
  code: string;
  campaigns_created: number;
  campaign_credits: number;
}

/** 'Mama Njeri's Salon' → 'MAMA'; the stable, readable half of every reference. */
function businessSlug(name: string | null): string {
  const letters = (name ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  return letters.slice(0, 4) || "BIZ";
}

/**
 * The billing row, created on first touch. Creation is where grandfathering happens:
 * campaigns that existed before billing shipped set the counter, and a business
 * already past its free campaigns gets one credit on the house — a paywall must never
 * reach back and freeze work that was free when it was done.
 */
async function getOrCreateBilling(orgId: string): Promise<BillingRow> {
  await ensureTables();
  const found = (await sql`
    select org_id, code, campaigns_created, campaign_credits
    from org_billing where org_id = ${orgId}`) as BillingRow[];
  if (found[0]) return found[0];

  const orgRows = (await sql`select name, display_name from orgs where id = ${orgId}`) as Array<{
    name: string | null;
    display_name: string | null;
  }>;
  const name = orgRows[0]?.display_name ?? orgRows[0]?.name ?? null;
  const existing = (await sql`
    select count(*)::int as n from campaigns where org_id = ${orgId}`) as Array<{ n: number }>;
  const created = existing[0]?.n ?? 0;
  const freeCredit = created >= FREE_CAMPAIGNS ? 1 : 0;

  // Two tries: the readable code, then the readable code made unique by the orgId.
  // `on conflict do nothing` (no target) swallows BOTH unique constraints: an org_id
  // conflict means a concurrent request won (the re-select finds it); a code conflict
  // means another business owns those letters (the next iteration suffixes them).
  for (const code of [`UT-${businessSlug(name)}`, `UT-${businessSlug(name)}${orgId}`]) {
    const rows = (await sql`
      insert into org_billing (org_id, code, campaigns_created, campaign_credits)
      values (${orgId}, ${code}, ${created}, ${freeCredit})
      on conflict do nothing
      returning org_id, code, campaigns_created, campaign_credits`) as BillingRow[];
    if (rows[0]) return rows[0];
    // org_id conflict means a concurrent request won — read theirs.
    const again = (await sql`
      select org_id, code, campaigns_created, campaign_credits
      from org_billing where org_id = ${orgId}`) as BillingRow[];
    if (again[0]) return again[0];
    // Otherwise the CODE collided with another business — retry with the suffixed one.
  }
  throw new Error("Could not allocate a business code");
}

export interface IntentView {
  code: string;
  credits: number;
  amountKes: number;
  status: string;
  matchedRef: string | null;
  expiresAt: string;
  createdAt: string;
}

function intentView(r: Record<string, unknown>): IntentView {
  return {
    code: String(r.code),
    credits: Number(r.credits),
    amountKes: Number(r.amount_kes),
    status: String(r.status),
    matchedRef: (r.matched_ref as string | null) ?? null,
    expiresAt: new Date(r.expires_at as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export interface BillingStatus {
  businessCode: string;
  campaignsCreated: number;
  credits: number;
  freeRemaining: number;
  /** Price of the NEXT campaign if it is a paid one; null while still free. */
  nextPriceKes: number | null;
  nextPriceUsd: number | null;
  /** True when creating the next campaign needs a payment first. */
  paymentRequired: boolean;
  pendingIntent: IntentView | null;
  /** Confirmed payments, newest first — the business's receipts. */
  receipts: IntentView[];
}

export async function getBillingStatus(orgId: string): Promise<BillingStatus> {
  const row = await getOrCreateBilling(orgId);
  // Lazy expiry: anything past its window frees its unique amount for recycling.
  await sql`update payment_intents set status = 'expired'
            where status = 'pending' and expires_at < now() and org_id = ${orgId}`;
  const intents = (await sql`
    select * from payment_intents where org_id = ${orgId}
    order by created_at desc limit 10`) as Array<Record<string, unknown>>;

  const nth = row.campaigns_created + 1;
  const price = priceForCampaign(nth);
  return {
    businessCode: row.code,
    campaignsCreated: row.campaigns_created,
    credits: row.campaign_credits,
    freeRemaining: Math.max(0, FREE_CAMPAIGNS - row.campaigns_created),
    nextPriceKes: price?.kes ?? null,
    nextPriceUsd: price?.usd ?? null,
    paymentRequired: price !== null && row.campaign_credits <= 0,
    pendingIntent: intents.filter((i) => i.status === "pending").map(intentView)[0] ?? null,
    receipts: intents.filter((i) => i.status === "confirmed").map(intentView),
  };
}

/**
 * Charge for creating a campaign: one atomic UPDATE so two simultaneous creates can't
 * both ride one credit. Free campaigns just count; paid ones also burn a credit.
 * Returns ok:false (with the status for the 402 body) when a payment is needed first.
 */
export async function chargeForCampaign(
  orgId: string
): Promise<{ ok: true; usedCredit: boolean } | { ok: false; status: BillingStatus }> {
  const before = await getOrCreateBilling(orgId);
  const rows = (await sql`
    update org_billing set
      campaigns_created = campaigns_created + 1,
      campaign_credits  = campaign_credits -
        (case when campaigns_created >= ${FREE_CAMPAIGNS} then 1 else 0 end)
    where org_id = ${orgId}
      and (campaigns_created < ${FREE_CAMPAIGNS} or campaign_credits > 0)
    returning campaigns_created`) as Array<{ campaigns_created: number }>;
  if (rows.length === 0) return { ok: false, status: await getBillingStatus(orgId) };
  return { ok: true, usedCredit: before.campaigns_created >= FREE_CAMPAIGNS };
}

/** Undo a charge when the campaign insert itself failed — the business paid for nothing. */
export async function refundCampaignCharge(orgId: string, usedCredit: boolean): Promise<void> {
  await sql`
    update org_billing set
      campaigns_created = greatest(campaigns_created - 1, 0),
      campaign_credits  = campaign_credits + ${usedCredit ? 1 : 0}
    where org_id = ${orgId}`;
}

const randFrom = (s: string) => s[Math.floor(Math.random() * s.length)];

/**
 * A checkout: one pending intent per business at a time (asking twice returns the same
 * one), priced for the business's next paid campaign, with a KES amount no other
 * pending intent shares. Expired intents free their amount slot; late payments against
 * them are still honoured by the confirm path.
 */
export async function createPaymentIntent(orgId: string): Promise<IntentView> {
  const status = await getBillingStatus(orgId);
  if (status.pendingIntent) return status.pendingIntent;
  if (status.nextPriceKes === null) {
    throw new Error("The next campaign is free — nothing to pay for");
  }

  const base = status.nextPriceKes;
  // USD with a random micro-offset, for the future on-chain watcher (Phase 2/4).
  const uniqueUsd = (status.nextPriceUsd ?? 0) + (1 + Math.floor(Math.random() * 998)) / 1e6;
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();

  // Each attempt re-picks both the amount and the reference; the bare `on conflict do
  // nothing` means a clash on EITHER unique constraint (amount while pending, or code)
  // just rolls the dice again instead of throwing.
  for (let attempt = 0; attempt < 8; attempt++) {
    const taken = (await sql`
      select amount_kes from payment_intents
      where status = 'pending' and amount_kes >= ${base} and amount_kes < ${base + OFFSET_RANGE}`) as Array<{
      amount_kes: number;
    }>;
    const used = new Set(taken.map((t) => Number(t.amount_kes)));
    const free: number[] = [];
    for (let o = 0; o < OFFSET_RANGE; o++) if (!used.has(base + o)) free.push(o);
    if (free.length === 0) throw new Error("Checkout is busy — try again in a few minutes");
    const amountKes = base + free[Math.floor(Math.random() * free.length)];

    const suffix = [0, 1, 2].map(() => randFrom(SAFE_ALPHABET)).join("");
    const code = `${status.businessCode}-${suffix}`;
    const rows = (await sql`
      insert into payment_intents (code, org_id, credits, amount_kes, unique_amount, expires_at)
      values (${code}, ${orgId}, 1, ${amountKes}, ${uniqueUsd.toFixed(6)}, ${expiresAt})
      on conflict do nothing
      returning *`) as Array<Record<string, unknown>>;
    if (rows[0]) return intentView(rows[0]);
  }
  throw new Error("Could not allocate a payment reference — try again");
}

/**
 * Confirm a payment against its reference (case-insensitive) and grant the credits.
 * Expired intents confirm too — someone who paid late still paid. Idempotent: a
 * second confirm of the same code changes nothing.
 */
export async function confirmPaymentIntent(
  code: string,
  matchedRef?: string
): Promise<{ orgId: string; credits: number; amountKes: number } | null> {
  await ensureTables();
  const rows = (await sql`
    update payment_intents set status = 'confirmed', matched_ref = ${matchedRef ?? null}
    where upper(code) = ${code.trim().toUpperCase()} and status in ('pending', 'expired')
    returning org_id, credits, amount_kes`) as Array<{
    org_id: string;
    credits: number;
    amount_kes: number;
  }>;
  if (!rows[0]) return null;
  await sql`update org_billing set campaign_credits = campaign_credits + ${rows[0].credits}
            where org_id = ${rows[0].org_id}`;
  return {
    orgId: String(rows[0].org_id),
    credits: Number(rows[0].credits),
    amountKes: Number(rows[0].amount_kes),
  };
}

/** Open checkouts across every business — the concierge's worklist. */
export async function listOpenIntents(): Promise<
  Array<IntentView & { orgId: string; businessCode: string }>
> {
  await ensureTables();
  await sql`update payment_intents set status = 'expired'
            where status = 'pending' and expires_at < now()`;
  const rows = (await sql`
    select p.*, b.code as business_code from payment_intents p
    left join org_billing b on b.org_id = p.org_id
    where p.status in ('pending', 'expired')
    order by p.created_at desc limit 50`) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    ...intentView(r),
    orgId: String(r.org_id),
    businessCode: (r.business_code as string | null) ?? "?",
  }));
}

/** Where to send the money — env-configured once the Phase 0 ramp test picks a rail. */
export function payInstructions(): string | null {
  return process.env.BILLING_PAY_INSTRUCTIONS?.trim() || null;
}
