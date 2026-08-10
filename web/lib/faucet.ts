import "server-only";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { isDbConfigured, sql } from "./db";

/**
 * The in-app faucet: new wallets get a little Fuji AVAX pushed to them, so nobody is
 * sent off to find a testnet faucet they have no idea how to use.
 *
 * A brand-new wallet holds nothing, so it cannot call anything — whatever funds it
 * must act first. That is why this is a server key making a plain transfer, not a
 * faucet contract the user calls. The abuse surface is bounded four ways: an address
 * is funded once ever (primary key on faucet_drips, claimed before the send), only
 * when its balance is actually below the gate (checked on-chain at request time),
 * behind a per-IP and a global daily cap. Worst case is somebody farming testnet
 * tokens out of a wallet we chose to keep small.
 *
 * FAUCET_PRIVATE_KEY is its own key with its own small balance — never the deployer,
 * never the org. Unset means the faucet is off and the UI falls back to Core faucet
 * instructions, so this file failing closed never blocks anyone who can self-serve.
 */

/** Mirrored from lib/funds.ts (MIN_ACTION_WEI) — that module is client-only. */
const GATE_WEI = 1_000_000_000_000_000n;

/** How much each new wallet receives. The gate needs 0.001, so 0.005 is 5× headroom. */
const DRIP_AVAX = process.env.FAUCET_DRIP_AVAX ?? "0.005";

/**
 * Sends per source IP per 24h. Households share IPs; sybils share them harder — but
 * so does everyone on one event WiFi, which is exactly when mass onboarding happens.
 * The default suits quiet days; set FAUCET_IP_DAILY_LIMIT high for an event.
 */
const IP_DAILY_LIMIT = Number(process.env.FAUCET_IP_DAILY_LIMIT) || 3;

/** Sends across everyone per 24h — the "wake up to an empty faucet" backstop. */
const GLOBAL_DAILY_LIMIT = Number(process.env.FAUCET_GLOBAL_DAILY_LIMIT) || 200;

const key = process.env.FAUCET_PRIVATE_KEY;

export const isFaucetConfigured = Boolean(key) && isDbConfigured;

const account = key
  ? privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`)
  : null;

const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() });
const walletClient = account
  ? createWalletClient({ account, chain: avalancheFuji, transport: http() })
  : null;

export type DripResult =
  | { ok: true; txHash: string; amountAvax: string }
  /**
   * unavailable — faucet off, dry, or the send failed: fall back to manual
   * instructions. already-funded / already-dripped — no drip is coming, but for this
   * address the manual route is also the honest answer.
   */
  | { ok: false; reason: "unavailable" | "already-funded" | "already-dripped" | "rate-limited" };

export async function dripTo(rawAddress: string, ip: string): Promise<DripResult> {
  if (!account || !walletClient || !isDbConfigured) return { ok: false, reason: "unavailable" };

  const address = rawAddress.toLowerCase();
  const dripWei = parseEther(DRIP_AVAX);

  // Cheap refusals first: the daily caps, then the chain reads.
  const [{ global_count, ip_count }] = (await sql`
    select
      count(*)::int as global_count,
      count(*) filter (where ip = ${ip})::int as ip_count
    from faucet_drips
    where created_at > now() - interval '24 hours'
  `) as { global_count: number; ip_count: number }[];
  if (global_count >= GLOBAL_DAILY_LIMIT || ip_count >= IP_DAILY_LIMIT) {
    return { ok: false, reason: "rate-limited" };
  }

  // Only wallets actually below the gate get topped up — the gate is the need.
  const balance = await publicClient.getBalance({ address: address as `0x${string}` });
  if (balance >= GATE_WEI) return { ok: false, reason: "already-funded" };

  // Claim the address before sending. Concurrent requests race here, on the insert,
  // and the loser walks away — never two transfers to one address.
  const claimed = await sql`
    insert into faucet_drips (address, ip, amount_wei)
    values (${address}, ${ip}, ${dripWei.toString()})
    on conflict (address) do nothing
    returning address
  `;
  if (claimed.length === 0) return { ok: false, reason: "already-dripped" };

  try {
    // Keep a drip's worth in reserve so the faucet's own gas never strands a claim.
    const reserve = await publicClient.getBalance({ address: account.address });
    if (reserve < dripWei * 2n) {
      console.warn(
        `[ubu-tangaza] faucet is nearly dry: ${reserve} wei left at ${account.address} — top it up`
      );
      await sql`delete from faucet_drips where address = ${address} and tx_hash is null`;
      return { ok: false, reason: "unavailable" };
    }

    const txHash = await walletClient.sendTransaction({
      to: address as `0x${string}`,
      value: dripWei,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    await sql`update faucet_drips set tx_hash = ${txHash} where address = ${address}`;
    return { ok: true, txHash, amountAvax: DRIP_AVAX };
  } catch (err) {
    // Release the claim so this address can try again — the send never happened
    // (or we never saw it land; if it did land, the balance check refuses a rerun).
    console.warn("[ubu-tangaza] faucet send failed:", err);
    await sql`delete from faucet_drips where address = ${address} and tx_hash is null`;
    return { ok: false, reason: "unavailable" };
  }
}
