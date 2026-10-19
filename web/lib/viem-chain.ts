import { avalanche, avalancheFuji } from "viem/chains";
import { IS_MAINNET } from "./rpc";

/**
 * The viem flavour of lib/chain.ts's CHAIN, for server modules built on viem
 * (registrar, verify, public-stats, faucet). No thirdweb import, so it is safe
 * anywhere. Pair it with RPC_URL from lib/rpc.ts.
 */
export const VIEM_CHAIN = IS_MAINNET ? avalanche : avalancheFuji;
