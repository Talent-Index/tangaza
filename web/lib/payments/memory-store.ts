import { randomUUID } from "node:crypto";
import { MAX_PAYOUT_ATTEMPTS } from "./ledger";
import type {
  BalanceRow,
  CashRewardContext,
  DepositRow,
  PaymentStore,
  PayoutProviderName,
  PayoutRow,
} from "./models";

interface CampaignSeed {
  id: string;
  orgId: string;
  title: string;
  rewardKind: string | null;
  rewardAmount: number | null;
  rewardThreshold: number | null;
  rewardRepeats: boolean;
  approved: Map<string, number>;
  phones: Map<string, string>;
}

interface Funding {
  orgId: string;
  fundedKes: number;
  reservedKes: number;
}

/**
 * In-memory stand-in for Postgres. Tests drive the same service the routes use.
 * Single-threaded, matching one serverless invocation at a time.
 */
export function createMemoryStore(): PaymentStore & {
  seedCampaign(row: {
    id: string;
    orgId: string;
    title: string;
    rewardKind?: string | null;
    rewardAmount?: number | null;
    rewardThreshold?: number | null;
    rewardRepeats?: boolean;
  }): void;
  setApproved(campaignId: string, advocate: string, approved: number): void;
  setPhone(campaignId: string, advocate: string, phone: string): void;
} {
  const campaigns = new Map<string, CampaignSeed>();
  const deposits = new Map<string, DepositRow>();
  const payouts = new Map<string, PayoutRow>();
  const funding = new Map<string, Funding>();
  const events = new Set<string>();

  function campaign(id: string): CampaignSeed {
    const row = campaigns.get(id);
    if (!row) throw new Error("No such campaign");
    return row;
  }

  function balanceOf(id: string, orgId: string): Funding {
    let row = funding.get(id);
    if (!row) {
      row = { orgId, fundedKes: 0, reservedKes: 0 };
      funding.set(id, row);
    }
    return row;
  }

  const store: PaymentStore = {
    async getCashRewardContext(input) {
      const row = campaigns.get(input.campaignId);
      if (!row || row.orgId !== input.orgId) return null;
      const advocate = input.advocate.toLowerCase();
      return {
        title: row.title,
        rewardKind: row.rewardKind,
        amountKes: row.rewardAmount,
        threshold: row.rewardThreshold,
        repeats: row.rewardRepeats,
        approved: row.approved.get(advocate) ?? 0,
        phone: row.phones.get(advocate) ?? null,
      };
    },
    async insertDeposit(input) {
      const existing = [...deposits.values()].find((d) => d.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
      const row: DepositRow = {
        id: randomUUID(),
        orgId: input.orgId,
        campaignId: input.campaignId,
        idempotencyKey: input.idempotencyKey,
        externalId: null,
        amountKes: input.amountKes,
        amountUsdc: null,
        payerPhone: input.payerPhone,
        status: "pending",
        providerStatus: null,
        failureReason: null,
        simulated: input.simulated,
        createdAt: new Date().toISOString(),
      };
      deposits.set(row.id, row);
      return row;
    },
    async getDepositByKey(idempotencyKey) {
      return [...deposits.values()].find((d) => d.idempotencyKey === idempotencyKey) ?? null;
    },
    async getDepositByExternal(externalId) {
      return [...deposits.values()].find((d) => d.externalId === externalId) ?? null;
    },
    async attachDepositExternal(id, externalId) {
      const row = deposits.get(id);
      if (row) row.externalId = externalId;
    },
    async creditDeposit(id, patch) {
      const row = deposits.get(id);
      if (!row || row.status === "paid") return false;
      row.status = "paid";
      row.amountUsdc = patch.amountUsdc;
      row.providerStatus = patch.providerStatus;
      const pot = balanceOf(row.campaignId, row.orgId);
      pot.fundedKes += row.amountKes;
      return true;
    },
    async failDeposit(id, reason, providerStatus) {
      const row = deposits.get(id);
      if (!row || row.status === "paid") return;
      row.status = "failed";
      row.failureReason = reason;
      row.providerStatus = providerStatus;
    },
    async listBalances(orgId) {
      return [...campaigns.values()]
        .filter((c) => c.orgId === orgId)
        .map((c) => {
          const pot = funding.get(c.id) ?? { fundedKes: 0, reservedKes: 0, orgId };
          return {
            campaignId: c.id,
            orgId: c.orgId,
            title: c.title,
            rewardKind: c.rewardKind,
            rewardAmount: c.rewardAmount,
            fundedKes: pot.fundedKes,
            reservedKes: pot.reservedKes,
            availableKes: pot.fundedKes - pot.reservedKes,
          } satisfies BalanceRow;
        });
    },
    async listDeposits(orgId, campaignId) {
      return [...deposits.values()].filter(
        (d) => d.orgId === orgId && (!campaignId || d.campaignId === campaignId)
      );
    },
    async insertPayoutIfAbsent(input) {
      const existing = [...payouts.values()].find((p) => p.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
      const row: PayoutRow = {
        id: randomUUID(),
        orgId: input.orgId,
        campaignId: input.campaignId,
        campaignTitle: input.campaignTitle,
        advocate: input.advocate.toLowerCase(),
        rewardIndex: input.rewardIndex,
        idempotencyKey: input.idempotencyKey,
        amountKes: input.amountKes,
        phone: input.phone,
        status: "pending",
        attempts: 0,
        maxAttempts: MAX_PAYOUT_ATTEMPTS,
        autopayAttempts: 0,
        qadiAttempts: 0,
        autopayTerminal: false,
        reserved: false,
        provider: null,
        externalId: null,
        providerStatus: null,
        lastError: null,
        simulated: input.simulated,
        createdAt: new Date().toISOString(),
      };
      payouts.set(row.id, row);
      return row;
    },
    async getPayout(id) {
      return payouts.get(id) ?? null;
    },
    async getPayoutByExternal(externalId) {
      return [...payouts.values()].find((p) => p.externalId === externalId) ?? null;
    },
    async listPayoutsForAdvocate(advocate) {
      const addr = advocate.toLowerCase();
      return [...payouts.values()].filter((p) => p.advocate === addr);
    },
    async listDispatchable(filter) {
      return [...payouts.values()].filter((p) => {
        if (p.status !== "pending" && p.status !== "retrying") return false;
        if (p.externalId) return false;
        if (p.attempts >= p.maxAttempts) return false;
        if (filter?.campaignId && p.campaignId !== filter.campaignId) return false;
        if (filter?.advocate && p.advocate !== filter.advocate.toLowerCase()) return false;
        return true;
      });
    },
    async reserve(campaignId, orgId, amountKes) {
      const pot = balanceOf(campaignId, orgId);
      if (pot.fundedKes - pot.reservedKes < amountKes) return false;
      pot.reservedKes += amountKes;
      return true;
    },
    async claimAttempt(id, provider: PayoutProviderName) {
      const row = payouts.get(id);
      if (!row) return null;
      if (row.externalId) return null;
      if (row.attempts >= row.maxAttempts) return null;
      if (row.status !== "pending" && row.status !== "retrying") return null;
      row.attempts += 1;
      if (provider === "autopay") row.autopayAttempts += 1;
      else row.qadiAttempts += 1;
      row.provider = provider;
      return row;
    },
    async patchPayout(id, patch) {
      const row = payouts.get(id);
      if (!row) throw new Error("No such payout");
      Object.assign(row, patch);
      return row;
    },
    async settlePaid(id, patch) {
      const row = payouts.get(id);
      if (!row || row.status === "paid") return row ?? null;
      const wasReserved = row.reserved;
      row.status = "paid";
      row.reserved = false;
      row.provider = patch.provider;
      row.externalId = patch.externalId;
      row.providerStatus = patch.providerStatus;
      row.lastError = null;
      if (wasReserved) {
        const pot = balanceOf(row.campaignId, row.orgId);
        pot.fundedKes -= row.amountKes;
        pot.reservedKes -= row.amountKes;
      }
      return row;
    },
    async failAndRelease(id, reason, providerStatus) {
      const row = payouts.get(id);
      if (!row || row.status === "paid" || row.status === "failed") return row ?? null;
      if (row.reserved) {
        const pot = balanceOf(row.campaignId, row.orgId);
        pot.reservedKes -= row.amountKes;
        row.reserved = false;
      }
      row.status = "failed";
      row.attempts = row.maxAttempts;
      row.lastError = reason;
      if (providerStatus) row.providerStatus = providerStatus;
      return row;
    },
    async reversePaid(id, reason) {
      const row = payouts.get(id);
      if (!row || row.status !== "paid") return row ?? null;
      row.status = "failed";
      row.attempts = row.maxAttempts;
      row.lastError = reason;
      row.providerStatus = "reversed";
      const pot = balanceOf(row.campaignId, row.orgId);
      pot.fundedKes += row.amountKes;
      return row;
    },
    async claimEvent(eventId) {
      if (events.has(eventId)) return false;
      events.add(eventId);
      return true;
    },
  };

  return Object.assign(store, {
    seedCampaign(row: {
      id: string;
      orgId: string;
      title: string;
      rewardKind?: string | null;
      rewardAmount?: number | null;
      rewardThreshold?: number | null;
      rewardRepeats?: boolean;
    }) {
      campaigns.set(row.id, {
        id: row.id,
        orgId: row.orgId,
        title: row.title,
        rewardKind: row.rewardKind ?? null,
        rewardAmount: row.rewardAmount ?? null,
        rewardThreshold: row.rewardThreshold ?? null,
        rewardRepeats: row.rewardRepeats ?? false,
        approved: new Map(),
        phones: new Map(),
      });
    },
    setApproved(campaignId: string, advocate: string, approved: number) {
      campaign(campaignId).approved.set(advocate.toLowerCase(), approved);
    },
    setPhone(campaignId: string, advocate: string, phone: string) {
      campaign(campaignId).phones.set(advocate.toLowerCase(), phone);
    },
  });
}
