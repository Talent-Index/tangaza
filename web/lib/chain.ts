import { defineChain } from "thirdweb";
import { avalanche, avalancheFuji } from "thirdweb/chains";
import { IS_MAINNET, RPC_URL } from "./rpc";

/**
 * Kept in one place so the chain is never ambiguous — the UI, the explorer links and
 * the wallet config all read from here. NEXT_PUBLIC_CHAIN (parsed and validated in
 * lib/rpc.ts) picks Fuji (dev/staging) or Avalanche C-Chain mainnet (production);
 * an unknown value throws there, so a wrong deployment is loud rather than silent.
 */

/**
 * The selected chain, reading and writing through our own RPC endpoint (lib/rpc.ts)
 * instead of thirdweb's shared, per-client-id metered one.
 */
export const CHAIN = defineChain({ ...(IS_MAINNET ? avalanche : avalancheFuji), rpc: RPC_URL });

export const EXPLORER = IS_MAINNET
  ? "https://snowtrace.io"
  : "https://testnet.snowtrace.io";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;

/** Reward model, mirrored from the contract constants. */
export const CREDIT_VALUE_KES = 500n;
export const MILESTONE_ACTIVITIES = 20n;

export const ORG_ID = BigInt(process.env.NEXT_PUBLIC_ORG_ID ?? "1");

/** Restricts /org when set. Blank means "any signed-in account" (dev convenience). */
export const ORG_APPROVER = (process.env.NEXT_PUBLIC_ORG_APPROVER ?? "").toLowerCase();
