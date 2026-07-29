"use client";

import { useEffect, useRef } from "react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { eth_getCode, getRpcClient } from "thirdweb/rpc";
import { CHAIN } from "@/lib/chain";
import { client } from "@/lib/client";

/**
 * Deploys the advocate's smart account in the background, at sign-in.
 *
 * Under ERC-4337 an account contract doesn't exist until its first transaction, so
 * whatever the user does first carries the deployment with it. We watched that op
 * outlive the SDK's 120-second wait and then lock the account behind AA25 retries —
 * on the one action we most need to feel instant, submitting an activity.
 *
 * So pay the cost when nobody is watching instead: the moment an account connects,
 * check if it has code, and if not, send a sponsored no-op (a zero-value call to
 * itself). By the time the user has read the home screen and typed a proof URL, the
 * account exists and every real transaction after that is a light, fast op.
 *
 * Fire-and-forget on purpose. If this times out client-side the op usually still
 * mines; if it fails outright, the submit flow's own recovery handles first-tx
 * deployment exactly as before. This is an optimisation, never a gate.
 */
export function AccountWarmup() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    if (!account) return;
    // Only smart accounts have anything to deploy. A plain EOA (Core) has no code by
    // nature, and a warmup tx from it would just spend the user's own gas on nothing.
    if (wallet && wallet.id !== "inApp" && wallet.id !== "smart") return;
    const address = account.address;
    if (attempted.current.has(address)) return;
    attempted.current.add(address);

    (async () => {
      try {
        const rpc = getRpcClient({ client, chain: CHAIN });
        const code = await eth_getCode(rpc, {
          address: address as `0x${string}`,
          blockTag: "latest",
        });
        if (code && code !== "0x") return; // already deployed — nothing to warm

        await account.sendTransaction({
          to: address as `0x${string}`,
          value: 0n,
          data: "0x",
          chainId: CHAIN.id,
        });
      } catch {
        // Best-effort by design; see the note above.
      }
    })();
  }, [account, wallet]);

  return null;
}
