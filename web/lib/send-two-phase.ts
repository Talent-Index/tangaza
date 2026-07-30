"use client";

import { useCallback, useState } from "react";
import { sendAndConfirmTransaction, type PreparedTransaction } from "thirdweb";
import type { Abi } from "thirdweb/utils";
import { useActiveAccount, useAdminWallet } from "thirdweb/react";
import {
  bundleUserOp,
  createAndSignUserOp,
  predictSmartAccountAddress,
  waitForUserOpReceipt,
} from "thirdweb/wallets/smart";
import { CHAIN } from "./chain";
import { client } from "./client";

/**
 * A send that can tell the truth about where it is.
 *
 * For a smart account, `account.sendTransaction` is one opaque await: prepare the
 * userOp, ask the admin wallet to sign it, hand it to the bundler, wait for it to
 * mine. The UI on top of that had two choices, both wrong — claim "Recording on
 * Avalanche…" while the wallet prompt was still open, or say "sign this" long after
 * the user had signed.
 *
 * The SDK exports the pipeline's pieces, so run them ourselves and report the one
 * boundary that matters:
 *
 *   signing     — nothing has left the browser. The op is being prepared and the
 *                 wallet is being asked. Abandoning here costs nothing.
 *   confirming  — the signed op is with the bundler. It is out of the user's hands
 *                 and will be a real transaction; now "recording on Avalanche" is
 *                 a fact rather than a promise.
 *
 * The risk in rebuilding the pipeline is config drift: if the factory or salt here
 * ever disagreed with what the wallet connected with, the op would send from a
 * different smart account than the one on screen. So before trusting our config we
 * predict the address it produces and compare it with the account actually connected.
 * Any mismatch falls back to the wallet's own `sendTransaction` — one phase, labelled
 * honestly as combined — rather than sending as somebody else.
 */

export type SendPhase =
  | "idle"
  /** Preparing the op and waiting on the wallet. Nothing sent yet. */
  | "signing"
  /** Signed and with the bundler; waiting for Avalanche to mine it. */
  | "confirming"
  /** Fallback single-phase send where the boundary can't be observed. */
  | "sending";

/** What both flows need back: the mined transaction hash. */
export interface TwoPhaseReceipt {
  transactionHash: `0x${string}`;
}

export function useTwoPhaseSend() {
  const account = useActiveAccount();
  const adminWallet = useAdminWallet();
  const [phase, setPhase] = useState<SendPhase>("idle");

  const send = useCallback(
    async (tx: PreparedTransaction<Abi>): Promise<TwoPhaseReceipt> => {
      if (!account) throw new Error("No active account");
      const adminAccount = adminWallet?.getAccount();

      try {
        // Same options the wallet connected with (lib/client.ts): default factory,
        // no salt override, sponsored gas. The prediction below is what proves it.
        const smartWalletOptions = { chain: CHAIN, sponsorGas: true };

        const usable =
          adminAccount &&
          adminAccount.address.toLowerCase() !== account.address.toLowerCase() &&
          (
            await predictSmartAccountAddress({
              client,
              chain: CHAIN,
              adminAddress: adminAccount.address,
            })
          ).toLowerCase() === account.address.toLowerCase();

        if (!usable) {
          // Unknown wiring — an EOA connection, or an account this config does not
          // reproduce. Send the safe way and label the phase as the blend it is.
          setPhase("sending");
          const receipt = await sendAndConfirmTransaction({ account, transaction: tx });
          return { transactionHash: receipt.transactionHash };
        }

        setPhase("signing");
        const signedOp = await createAndSignUserOp({
          client,
          adminAccount,
          smartWalletOptions,
          // The SDK types this list with the default (empty) ABI generic; a typed
          // prepared call is the same shape at runtime.
          transactions: [tx as PreparedTransaction],
        });

        // The signature exists; from here the op leaves the browser.
        setPhase("confirming");
        const userOpHash = await bundleUserOp({
          options: { chain: CHAIN, client },
          userOp: signedOp,
        });
        const receipt = await waitForUserOpReceipt({
          chain: CHAIN,
          client,
          userOpHash,
        });
        return { transactionHash: receipt.transactionHash };
      } finally {
        setPhase("idle");
      }
    },
    [account, adminWallet]
  );

  return {
    send,
    phase,
    /** True while the wallet prompt may be open. */
    signing: phase === "signing",
    /** True once the op is out of the user's hands but not yet mined. */
    confirming: phase === "confirming",
    isPending: phase !== "idle",
  };
}
