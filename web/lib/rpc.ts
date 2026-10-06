/**
 * The one place the Fuji RPC endpoint is chosen, for the browser and the server.
 *
 * Every on-chain read, event watch and transaction used to go through thirdweb's shared
 * RPC, which is metered per thirdweb client id — so every visitor spent from one quota,
 * and when it ran out the whole app 429'd. Avalanche's own public endpoint limits per
 * caller instead, so traffic from many browsers doesn't pile onto a single budget.
 *
 *   NEXT_PUBLIC_FUJI_RPC_URL  — used by the browser (and the server if the next one is
 *                               unset). It ships in the page, so if it carries an API
 *                               key, restrict that key to your domain.
 *   FUJI_RPC_URL              — server only; use this when the key must stay private.
 */
export const PUBLIC_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

export const FUJI_RPC_URL: string =
  (typeof window === "undefined" ? process.env.FUJI_RPC_URL?.trim() : undefined) ||
  process.env.NEXT_PUBLIC_FUJI_RPC_URL?.trim() ||
  PUBLIC_FUJI_RPC;
