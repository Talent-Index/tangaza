import { readContract } from "thirdweb";
import { contract } from "./client";

export interface OrgState {
  name: string;
  approver: string;
  emissionCapKES: bigint;
  issuedKES: bigint;
  redeemedKES: bigint;
  approvedActivities: bigint;
  active: boolean;
  exists: boolean;
}

/**
 * The contract packs these structs to save gas, so the widths vary: viem decodes
 * uint64 as bigint and uint32 as number. Every consumer wraps these in `Number()`
 * or a formatter, so the union is honest rather than a lie that happens to work.
 */
export interface AdvocateState {
  approvedActivities: bigint;
  streak: number;
  lastActivityDay: number;
  creditsEarned: number;
  creditsRedeemed: number;
}

export interface CreditState {
  id: bigint;
  orgId: number;
  holder: string;
  valueKES: number;
  earnedAt: bigint;
  redeemedAt: bigint;
  rewardType: number;
  redeemed: boolean;
}

export async function getOrg(orgId: bigint): Promise<OrgState> {
  const org = await readContract({ contract, method: "getOrg", params: [orgId] });
  return org as unknown as OrgState;
}

export async function getAdvocate(
  orgId: bigint,
  advocate: string
): Promise<AdvocateState> {
  const a = await readContract({
    contract,
    method: "getAdvocate",
    params: [orgId, advocate as `0x${string}`],
  });
  return a as unknown as AdvocateState;
}

export async function getOutstandingKES(orgId: bigint): Promise<bigint> {
  return (await readContract({
    contract,
    method: "outstandingLiabilityKES",
    params: [orgId],
  })) as bigint;
}

/** Every credit held by an address, newest first. */
export async function getCredits(holder: string): Promise<CreditState[]> {
  const ids = (await readContract({
    contract,
    method: "creditsOf",
    params: [holder as `0x${string}`],
  })) as readonly bigint[];

  const credits = await Promise.all(
    ids.map(async (id) => {
      const c = (await readContract({
        contract,
        method: "getCredit",
        params: [id],
      })) as unknown as Omit<CreditState, "id">;
      return { ...c, id };
    })
  );

  return credits.reverse();
}

export async function getCredit(id: bigint): Promise<CreditState> {
  const c = (await readContract({
    contract,
    method: "getCredit",
    params: [id],
  })) as unknown as Omit<CreditState, "id">;
  return { ...c, id };
}
