import { avalancheFuji } from "thirdweb/chains";

/**
 * Ubu-Tangaza runs on Avalanche Fuji for the jam. Kept in one place so the chain is
 * never ambiguous — the UI, the explorer links and the smart-account config all
 * read from here.
 *
 * NEXT_PUBLIC_CHAIN exists so a wrong deployment is loud rather than silent. Fuji is
 * the only supported value; add the mapping deliberately if you ever move.
 */
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN ?? "fuji";

if (CHAIN_NAME !== "fuji") {
  console.warn(
    `[ubu-tangaza] NEXT_PUBLIC_CHAIN is "${CHAIN_NAME}" but only "fuji" is supported — using Fuji.`
  );
}

export const CHAIN = avalancheFuji;

export const EXPLORER = "https://testnet.snowtrace.io";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;

/** Reward model, mirrored from the contract constants. */
export const CREDIT_VALUE_KES = 500n;
export const MILESTONE_ACTIVITIES = 20n;

export const ORG_ID = BigInt(process.env.NEXT_PUBLIC_ORG_ID ?? "1");

/** Restricts /org when set. Blank means "any signed-in account" (dev convenience). */
export const ORG_APPROVER = (process.env.NEXT_PUBLIC_ORG_APPROVER ?? "").toLowerCase();
