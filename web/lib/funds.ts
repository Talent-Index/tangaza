"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveAccount, useAdminWallet } from "thirdweb/react";
import { eth_getBalance, getRpcClient } from "thirdweb/rpc";
import { CHAIN } from "./chain";
import { client } from "./client";

/**
 * Skin in the game: acting here requires holding a little testnet AVAX.
 *
 * Gas stays sponsored — the paymaster pays for the transactions themselves — so this
 * is a gate, not a fee. Requiring a faucet visit before submitting or approving keeps
 * drive-by spam out of the queue and means everyone on stage has touched the network
 * they're writing to.
 *
 * What counts: the balance of the account the app acts as (the smart account, whose
 * address the UI shows) plus, for browser-wallet users, the wallet that signs behind
 * it. A Core or MetaMask user who topped up their own wallet at the faucet passes
 * without ever hearing the words "smart account"; a Google user funds the one address
 * the app shows them. The two are summed because the requirement is "you hold AVAX",
 * not "you hold AVAX in the slot we picked".
 */

/** 0.005 AVAX, in wei. */
export const MIN_ACTION_WEI = 5_000_000_000_000_000n;
export const MIN_ACTION_AVAX = "0.005";

export interface FundsEntry {
  label: string;
  address: string;
  wei: bigint;
}

export interface FundsGate {
  /** True once the balances add up to the requirement. */
  ok: boolean;
  /** Still on the first read — don't flash the warning before knowing. */
  loading: boolean;
  totalWei: bigint;
  entries: FundsEntry[];
  refresh: () => void;
}

export function formatAvax(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = ((wei % 10n ** 18n) * 10_000n) / 10n ** 18n;
  return `${whole}.${frac.toString().padStart(4, "0")}`;
}

export function useFundsGate(): FundsGate {
  const account = useActiveAccount();
  const adminWallet = useAdminWallet();

  const adminAccount = adminWallet?.getAccount();
  // The embedded in-app key is invisible to its owner; telling a Google user to fund
  // it would be gibberish. Only a real extension wallet is worth checking or showing.
  const adminAddress =
    adminWallet && adminWallet.id !== "inApp" && adminAccount
      ? adminAccount.address
      : undefined;

  const [balances, setBalances] = useState<Map<string, bigint>>(new Map());
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const addresses = useMemo(() => {
    const list: FundsEntry[] = [];
    if (account) list.push({ label: "Your account", address: account.address, wei: 0n });
    if (adminAddress && adminAddress.toLowerCase() !== account?.address.toLowerCase()) {
      list.push({ label: "Your wallet", address: adminAddress, wei: 0n });
    }
    return list;
  }, [account, adminAddress]);

  useEffect(() => {
    if (addresses.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const rpc = getRpcClient({ client, chain: CHAIN });

    const read = async () => {
      try {
        const next = new Map<string, bigint>();
        for (const entry of addresses) {
          next.set(
            entry.address.toLowerCase(),
            await eth_getBalance(rpc, {
              address: entry.address as `0x${string}`,
              blockTag: "latest",
            })
          );
        }
        if (!cancelled) setBalances(next);
      } catch {
        // Transient RPC failure: keep the previous answer rather than flapping the gate.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void read();
    // Faucet drips land within a block or two; polling means the gate lifts itself
    // while the user is still looking at the instructions.
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void read();
    }, 6_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.map((a) => a.address).join(","), nonce]);

  const entries = addresses.map((e) => ({
    ...e,
    wei: balances.get(e.address.toLowerCase()) ?? 0n,
  }));
  const totalWei = entries.reduce((sum, e) => sum + e.wei, 0n);

  return { ok: totalWei >= MIN_ACTION_WEI, loading, totalWei, entries, refresh };
}
