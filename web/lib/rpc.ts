/**
 * The one place the chain is chosen and its RPC endpoint resolved, for the browser
 * and the server.
 *
 * NEXT_PUBLIC_CHAIN picks the network: "fuji" (default, dev/staging) or "mainnet"
 * (production). Any other value throws at module load — with two valid values, a
 * typo silently landing a mainnet deployment on Fuji is exactly the wrong-chain
 * failure this module exists to prevent.
 *
 * Every on-chain read, event watch and transaction used to go through thirdweb's shared
 * RPC, which is metered per thirdweb client id — so every visitor spent from one quota,
 * and when it ran out the whole app 429'd. Avalanche's own public endpoints limit per
 * caller instead, so traffic from many browsers doesn't pile onto a single budget.
 *
 * The RPC override env vars are chain-suffixed on purpose — both pairs can sit in the
 * same Vercel project and only NEXT_PUBLIC_CHAIN decides which is read, so a stale
 * value can never cross chains:
 *
 *   NEXT_PUBLIC_FUJI_RPC_URL / NEXT_PUBLIC_AVALANCHE_RPC_URL — used by the browser
 *       (and the server if the server-only one is unset). It ships in the page, so if
 *       it carries an API key, restrict that key to your domain.
 *   FUJI_RPC_URL / AVALANCHE_RPC_URL — server only; use this when the key must stay
 *       private.
 */
export type ChainName = "fuji" | "mainnet";

const RAW_CHAIN = process.env.NEXT_PUBLIC_CHAIN ?? "fuji";

if (RAW_CHAIN !== "fuji" && RAW_CHAIN !== "mainnet") {
  throw new Error(
    `[ubu-tangaza] NEXT_PUBLIC_CHAIN is "${RAW_CHAIN}" — expected "fuji" or "mainnet".`
  );
}

export const CHAIN_NAME: ChainName = RAW_CHAIN;
export const IS_MAINNET = CHAIN_NAME === "mainnet";

export const PUBLIC_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
export const PUBLIC_AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";

const onServer = typeof window === "undefined";

export const RPC_URL: string = IS_MAINNET
  ? (onServer ? process.env.AVALANCHE_RPC_URL?.trim() : undefined) ||
    process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim() ||
    PUBLIC_AVALANCHE_RPC
  : (onServer ? process.env.FUJI_RPC_URL?.trim() : undefined) ||
    process.env.NEXT_PUBLIC_FUJI_RPC_URL?.trim() ||
    PUBLIC_FUJI_RPC;
