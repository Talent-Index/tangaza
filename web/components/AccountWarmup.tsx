"use client";

import { useEffect, useRef } from "react";
import { useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";
import { CHAIN } from "@/lib/chain";
import { accountHasCode, trackWarmup } from "@/lib/warmup";

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
 *
 * It is registered with `trackWarmup` so real transactions can *join* it rather than
 * race it. Racing is what produced "Account deployment is taking too long (over 1
 * minute)" on the one action we most need to work — see web/lib/warmup.ts.
 */
export function AccountWarmup() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const admin = useAdminWallet();
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    if (!account) return;
    // Only smart accounts have anything to deploy.
    if (wallet && wallet.id !== "inApp" && wallet.id !== "smart") return;

    /**
     * Only warm an account whose admin signs silently.
     *
     * Every smart-account send is a signed userOp, and signUserOp goes to the admin
     * account — so warming a Core or MetaMask user meant their extension popped a
     * signature request, at sign-in, for a no-op they never asked for. The first thing
     * they were asked to authorise was something they hadn't done.
     *
     * The in-app wallet holds an embedded key and signs without a prompt, so it can
     * still be warmed. A browser wallet gets no background transaction at all: its
     * first signature is the one it asked for, and that op carries the deployment with
     * the recovery in lib/warmup.ts and the AA10 branches behind it.
     */
    if (admin && admin.id !== "inApp") return;
    const address = account.address;
    if (attempted.current.has(address)) return;
    attempted.current.add(address);

    (async () => {
      try {
        // A hit here also records the account as deployed, so nothing later waits on us.
        if (await accountHasCode(address)) return;

        // Registered before it is awaited: the window that matters is the one where a
        // user presses Send while this op is still out, and that starts now.
        await trackWarmup(
          address,
          account.sendTransaction({
            to: address as `0x${string}`,
            value: 0n,
            data: "0x",
            chainId: CHAIN.id,
          })
        );
      } catch {
        // Best-effort by design; see the note above.
      }
    })();
  }, [account, wallet, admin]);

  return null;
}
