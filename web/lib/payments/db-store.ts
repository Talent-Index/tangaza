import "server-only";
import { sql } from "../db";
import { MAX_PAYOUT_ATTEMPTS } from "./ledger";
import type {
  BalanceRow,
  CashRewardContext,
  DepositRow,
  PaymentStatus,
  PaymentStore,
  PayoutProviderName,
  PayoutRow,
} from "./models";

/**
 * Postgres backing for the payment service. Statements match
 * db/024_campaign_funding_and_payouts.sql and are safe to run more than once.
 * Money moves in a single statement so a replay cannot credit or settle twice.
 */

let ready: Promise<void> | null = null;

export function ensurePaymentsSchema(): Promise<void> {
  ready ??= applySchema().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

async function applySchema(): Promise<void> {
  await sql`create table if not exists campaign_funding (
    campaign_id   uuid primary key references campaigns(id) on delete cascade,
    org_id        bigint not null references orgs(id) on delete cascade,
    funded_kes    numeric(14,2) not null default 0,
    reserved_kes  numeric(14,2) not null default 0,
    updated_at    timestamptz not null default now(),
    constraint campaign_funding_nonneg check (
      funded_kes >= 0 and reserved_kes >= 0 and funded_kes >= reserved_kes
    )
  )`;
  await sql`create table if not exists campaign_deposits (
    id uuid primary key default gen_random_uuid(),
    org_id bigint not null references orgs(id) on delete cascade,
    campaign_id uuid not null references campaigns(id) on delete cascade,
    provider text not null default 'qadi',
    external_id text,
    idempotency_key text not null unique,
    amount_kes numeric(14,2) not null,
    amount_usdc numeric(18,6),
    payer_phone text not null,
    status text not null default 'pending',
    provider_status text,
    failure_reason text,
    simulated boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    paid_at timestamptz,
    constraint campaign_deposits_status check (status in ('pending', 'paid', 'failed', 'retrying'))
  )`;
  await sql`create unique index if not exists campaign_deposits_external_idx
    on campaign_deposits (provider, external_id) where external_id is not null`;
  await sql`create index if not exists campaign_deposits_org_idx
    on campaign_deposits (org_id, created_at desc)`;
  await sql`create table if not exists ambassador_payouts (
    id uuid primary key default gen_random_uuid(),
    org_id bigint not null references orgs(id) on delete cascade,
    campaign_id uuid not null references campaigns(id) on delete cascade,
    campaign_title text not null default '',
    advocate text not null,
    reward_index integer not null check (reward_index >= 1),
    idempotency_key text not null unique,
    amount_kes numeric(14,2) not null,
    phone text not null default '',
    status text not null default 'pending',
    attempts integer not null default 0,
    max_attempts integer not null default 3,
    autopay_attempts integer not null default 0,
    qadi_attempts integer not null default 0,
    autopay_terminal boolean not null default false,
    reserved boolean not null default false,
    provider text,
    external_id text,
    provider_status text,
    last_error text,
    simulated boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    paid_at timestamptz,
    unique (campaign_id, advocate, reward_index),
    constraint ambassador_payouts_status check (status in ('pending', 'paid', 'failed', 'retrying')),
    constraint ambassador_payouts_provider check (provider is null or provider in ('autopay', 'qadi'))
  )`;
  await sql`create index if not exists ambassador_payouts_advocate_idx
    on ambassador_payouts (advocate, created_at desc)`;
  await sql`create index if not exists ambassador_payouts_campaign_idx
    on ambassador_payouts (campaign_id, status)`;
  await sql`create table if not exists payment_webhook_events (
    id text primary key,
    provider text not null,
    event_type text not null,
    received_at timestamptz not null default now()
  )`;
  await sql`alter table campaign_deposits add column if not exists simulated boolean not null default false`;
  await sql`alter table ambassador_payouts add column if not exists simulated boolean not null default false`;
}

const num = (value: unknown) => Number(value ?? 0);
const str = (value: unknown) => (value == null ? null : String(value));
const statusOf = (value: unknown): PaymentStatus => {
  const status = String(value);
  if (status === "paid" || status === "failed" || status === "retrying" || status === "pending") return status;
  return "pending";
};

function depositFrom(r: Record<string, unknown>): DepositRow {
  return {
    id: String(r.id),
    orgId: String(r.org_id),
    campaignId: String(r.campaign_id),
    idempotencyKey: String(r.idempotency_key),
    externalId: str(r.external_id),
    amountKes: num(r.amount_kes),
    amountUsdc: str(r.amount_usdc),
    payerPhone: String(r.payer_phone),
    status: statusOf(r.status),
    providerStatus: str(r.provider_status),
    failureReason: str(r.failure_reason),
    simulated: Boolean(r.simulated),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

function payoutFrom(r: Record<string, unknown>): PayoutRow {
  const provider = r.provider == null ? null : (String(r.provider) as PayoutProviderName);
  return {
    id: String(r.id),
    orgId: String(r.org_id),
    campaignId: String(r.campaign_id),
    campaignTitle: String(r.campaign_title ?? ""),
    advocate: String(r.advocate),
    rewardIndex: num(r.reward_index),
    idempotencyKey: String(r.idempotency_key),
    amountKes: num(r.amount_kes),
    phone: String(r.phone ?? ""),
    status: statusOf(r.status),
    attempts: num(r.attempts),
    maxAttempts: num(r.max_attempts) || MAX_PAYOUT_ATTEMPTS,
    autopayAttempts: num(r.autopay_attempts),
    qadiAttempts: num(r.qadi_attempts),
    autopayTerminal: Boolean(r.autopay_terminal),
    reserved: Boolean(r.reserved),
    provider: provider === "autopay" || provider === "qadi" ? provider : null,
    externalId: str(r.external_id),
    providerStatus: str(r.provider_status),
    lastError: str(r.last_error),
    simulated: Boolean(r.simulated),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

type Row = Record<string, unknown>;

export function dbPaymentStore(): PaymentStore {
  return {
    async getCashRewardContext(input) {
      const advocate = input.advocate.toLowerCase();
      const rows = (await sql`
        select c.title, c.reward_kind, c.reward_amount, c.reward_threshold, c.reward_repeats,
          (select count(*)::int from submissions s
            where s.campaign_id = c.id and s.advocate = ${advocate} and s.status = 'approved') as approved,
          (select a.phone from advocates a
            where a.address = ${advocate} and a.phone is not null and a.phone <> ''
            order by case when a.org_id = c.org_id then 0 else 1 end, a.last_active_at desc
            limit 1) as phone
        from campaigns c
        where c.id = ${input.campaignId}::uuid and c.org_id = ${input.orgId}`) as Row[];
      const r = rows[0];
      if (!r) return null;
      return {
        title: String(r.title),
        rewardKind: str(r.reward_kind),
        amountKes: r.reward_amount == null ? null : num(r.reward_amount),
        threshold: r.reward_threshold == null ? null : num(r.reward_threshold),
        repeats: Boolean(r.reward_repeats),
        approved: num(r.approved),
        phone: str(r.phone),
      };
    },

    async insertDeposit(input) {
      const inserted = (await sql`
        insert into campaign_deposits
          (org_id, campaign_id, idempotency_key, amount_kes, payer_phone, simulated)
        values (${input.orgId}, ${input.campaignId}::uuid, ${input.idempotencyKey},
                ${input.amountKes}, ${input.payerPhone}, ${input.simulated})
        on conflict (idempotency_key) do nothing
        returning *`) as Row[];
      if (inserted[0]) return depositFrom(inserted[0]);
      const existing = await this.getDepositByKey(input.idempotencyKey);
      if (!existing) throw new Error("Could not store the deposit");
      return existing;
    },

    async getDepositByKey(idempotencyKey) {
      const rows = (await sql`select * from campaign_deposits where idempotency_key = ${idempotencyKey}`) as Row[];
      return rows[0] ? depositFrom(rows[0]) : null;
    },

    async getDepositByExternal(externalId) {
      const rows = (await sql`
        select * from campaign_deposits where external_id = ${externalId} and provider = 'qadi' limit 1`) as Row[];
      return rows[0] ? depositFrom(rows[0]) : null;
    },

    async attachDepositExternal(id, externalId) {
      await sql`update campaign_deposits
        set external_id = ${externalId}, updated_at = now()
        where id = ${id}::uuid and external_id is null`;
    },

    async creditDeposit(id, patch) {
      const rows = (await sql`
        with paid as (
          update campaign_deposits
          set status = 'paid',
              amount_usdc = ${patch.amountUsdc},
              provider_status = ${patch.providerStatus},
              paid_at = now(),
              updated_at = now()
          where id = ${id}::uuid and status <> 'paid'
          returning campaign_id, org_id, amount_kes
        )
        insert into campaign_funding (campaign_id, org_id, funded_kes)
        select campaign_id, org_id, amount_kes from paid
        on conflict (campaign_id) do update
          set funded_kes = campaign_funding.funded_kes + excluded.funded_kes,
              updated_at = now()
        returning campaign_id`) as Row[];
      return rows.length > 0;
    },

    async failDeposit(id, reason, providerStatus) {
      await sql`update campaign_deposits
        set status = 'failed', failure_reason = ${reason}, provider_status = ${providerStatus}, updated_at = now()
        where id = ${id}::uuid and status <> 'paid'`;
    },

    async listBalances(orgId) {
      const rows = (await sql`
        select c.id, c.org_id, c.title, c.reward_kind, c.reward_amount,
          coalesce(f.funded_kes, 0) as funded_kes,
          coalesce(f.reserved_kes, 0) as reserved_kes
        from campaigns c
        left join campaign_funding f on f.campaign_id = c.id
        where c.org_id = ${orgId}
        order by c.created_at desc`) as Row[];
      return rows.map((r) => {
        const fundedKes = num(r.funded_kes);
        const reservedKes = num(r.reserved_kes);
        return {
          campaignId: String(r.id),
          orgId: String(r.org_id),
          title: String(r.title),
          rewardKind: str(r.reward_kind),
          rewardAmount: r.reward_amount == null ? null : num(r.reward_amount),
          fundedKes,
          reservedKes,
          availableKes: fundedKes - reservedKes,
        } satisfies BalanceRow;
      });
    },

    async listDeposits(orgId, campaignId) {
      const rows = (await sql`
        select * from campaign_deposits
        where org_id = ${orgId}
          and (${campaignId ?? null}::uuid is null or campaign_id = ${campaignId ?? null}::uuid)
        order by created_at desc
        limit 50`) as Row[];
      return rows.map(depositFrom);
    },

    async insertPayoutIfAbsent(input) {
      const advocate = input.advocate.toLowerCase();
      const inserted = (await sql`
        insert into ambassador_payouts
          (org_id, campaign_id, campaign_title, advocate, reward_index, idempotency_key,
           amount_kes, phone, max_attempts, simulated)
        values (${input.orgId}, ${input.campaignId}::uuid, ${input.campaignTitle}, ${advocate},
                ${input.rewardIndex}, ${input.idempotencyKey}, ${input.amountKes}, ${input.phone},
                ${MAX_PAYOUT_ATTEMPTS}, ${input.simulated})
        on conflict (idempotency_key) do nothing
        returning *`) as Row[];
      if (inserted[0]) return payoutFrom(inserted[0]);
      const rows = (await sql`
        select * from ambassador_payouts where idempotency_key = ${input.idempotencyKey}`) as Row[];
      if (!rows[0]) throw new Error("Could not store the payout");
      return payoutFrom(rows[0]);
    },

    async getPayout(id) {
      const rows = (await sql`select * from ambassador_payouts where id = ${id}::uuid`) as Row[];
      return rows[0] ? payoutFrom(rows[0]) : null;
    },

    async getPayoutByExternal(externalId) {
      const rows = (await sql`
        select * from ambassador_payouts where external_id = ${externalId} limit 1`) as Row[];
      return rows[0] ? payoutFrom(rows[0]) : null;
    },

    async listPayoutsForAdvocate(advocate) {
      const rows = (await sql`
        select * from ambassador_payouts
        where advocate = ${advocate.toLowerCase()}
        order by created_at desc
        limit 100`) as Row[];
      return rows.map(payoutFrom);
    },

    async listDispatchable(filter) {
      const rows = (await sql`
        select * from ambassador_payouts
        where status in ('pending', 'retrying')
          and external_id is null
          and attempts < max_attempts
          and (${filter?.campaignId ?? null}::uuid is null or campaign_id = ${filter?.campaignId ?? null}::uuid)
          and (${filter?.advocate ?? null}::text is null or advocate = ${filter?.advocate?.toLowerCase() ?? null})
        order by created_at
        limit 20`) as Row[];
      return rows.map(payoutFrom);
    },

    async reserve(campaignId, orgId, amountKes) {
      await sql`insert into campaign_funding (campaign_id, org_id)
        values (${campaignId}::uuid, ${orgId})
        on conflict (campaign_id) do nothing`;
      const rows = (await sql`
        update campaign_funding
        set reserved_kes = reserved_kes + ${amountKes}, updated_at = now()
        where campaign_id = ${campaignId}::uuid
          and funded_kes - reserved_kes >= ${amountKes}
        returning campaign_id`) as Row[];
      return rows.length > 0;
    },

    async claimAttempt(id, provider) {
      const rows = (await sql`
        update ambassador_payouts
        set attempts = attempts + 1,
            autopay_attempts = autopay_attempts + case when ${provider} = 'autopay' then 1 else 0 end,
            qadi_attempts = qadi_attempts + case when ${provider} = 'qadi' then 1 else 0 end,
            provider = ${provider},
            updated_at = now()
        where id = ${id}::uuid
          and attempts < max_attempts
          and status in ('pending', 'retrying')
          and external_id is null
        returning *`) as Row[];
      return rows[0] ? payoutFrom(rows[0]) : null;
    },

    async patchPayout(id, patch) {
      const rows = (await sql`
        update ambassador_payouts set
          status = case when ${patch.status !== undefined}::boolean then ${patch.status ?? null} else status end,
          phone = case when ${patch.phone !== undefined}::boolean then ${patch.phone ?? ""} else phone end,
          reserved = case when ${patch.reserved !== undefined}::boolean then ${patch.reserved ?? false} else reserved end,
          provider = case when ${patch.provider !== undefined}::boolean then ${patch.provider ?? null} else provider end,
          external_id = case when ${patch.externalId !== undefined}::boolean then ${patch.externalId ?? null} else external_id end,
          provider_status = case when ${patch.providerStatus !== undefined}::boolean then ${patch.providerStatus ?? null} else provider_status end,
          last_error = case when ${patch.lastError !== undefined}::boolean then ${patch.lastError ?? null} else last_error end,
          autopay_terminal = case when ${patch.autopayTerminal !== undefined}::boolean then ${patch.autopayTerminal ?? false} else autopay_terminal end,
          updated_at = now()
        where id = ${id}::uuid
        returning *`) as Row[];
      if (!rows[0]) throw new Error("No such payout");
      return payoutFrom(rows[0]);
    },

    async settlePaid(id, patch) {
      await sql`
        with paid as (
          update ambassador_payouts
          set status = 'paid',
              reserved = false,
              provider = ${patch.provider},
              external_id = ${patch.externalId},
              provider_status = ${patch.providerStatus},
              last_error = null,
              paid_at = now(),
              updated_at = now()
          where id = ${id}::uuid and status <> 'paid' and reserved = true
          returning campaign_id, amount_kes
        )
        update campaign_funding f
        set funded_kes = f.funded_kes - paid.amount_kes,
            reserved_kes = f.reserved_kes - paid.amount_kes,
            updated_at = now()
        from paid
        where f.campaign_id = paid.campaign_id`;
      return this.getPayout(id);
    },

    async failAndRelease(id, reason, providerStatus) {
      await sql`
        with rel as (
          update ambassador_payouts
          set status = 'failed',
              attempts = max_attempts,
              reserved = false,
              last_error = ${reason},
              provider_status = coalesce(${providerStatus ?? null}, provider_status),
              updated_at = now()
          where id = ${id}::uuid and status <> 'paid' and status <> 'failed' and reserved = true
          returning campaign_id, amount_kes
        )
        update campaign_funding f
        set reserved_kes = f.reserved_kes - rel.amount_kes, updated_at = now()
        from rel
        where f.campaign_id = rel.campaign_id`;
      await sql`
        update ambassador_payouts
        set status = 'failed', attempts = max_attempts, last_error = ${reason},
            provider_status = coalesce(${providerStatus ?? null}, provider_status),
            updated_at = now()
        where id = ${id}::uuid and status <> 'paid' and status <> 'failed'`;
      return this.getPayout(id);
    },

    async reversePaid(id, reason) {
      await sql`
        with rev as (
          update ambassador_payouts
          set status = 'failed',
              attempts = max_attempts,
              last_error = ${reason},
              provider_status = 'reversed',
              updated_at = now()
          where id = ${id}::uuid and status = 'paid'
          returning campaign_id, amount_kes
        )
        update campaign_funding f
        set funded_kes = f.funded_kes + rev.amount_kes, updated_at = now()
        from rev
        where f.campaign_id = rev.campaign_id`;
      return this.getPayout(id);
    },

    async claimEvent(eventId, provider, eventType) {
      const rows = (await sql`
        insert into payment_webhook_events (id, provider, event_type)
        values (${eventId}, ${provider}, ${eventType})
        on conflict (id) do nothing
        returning id`) as Row[];
      return rows.length > 0;
    },
  };
}
