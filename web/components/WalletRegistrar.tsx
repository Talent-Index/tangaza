"use client";

import { useEffect, useRef } from "react";
import { useActiveAccount, useActiveWallet, useAdminWallet } from "thirdweb/react";

/**
 * Writes "this wallet connected" to the database the moment an account connects.
 *
 * Reacts to a connection and renders nothing. Records the acting address plus the
 * wallet that signs for it, so the platform knows who has shown up — not just who got
 * as far as submitting.
 *
 * Fire-and-forget: a lost row here must never interfere with the session itself.
 */
export function WalletRegistrar() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const admin = useAdminWallet();
  const recorded = useRef(new Set<string>());

  useEffect(() => {
    if (!account) return;
    const address = account.address;
    if (recorded.current.has(address)) return;
    recorded.current.add(address);

    void fetch("/api/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        adminAddress: admin?.getAccount()?.address,
        // The admin wallet's id is the informative one: for a wrapped connection the
        // active wallet is just "smart", which says nothing about what the person uses.
        walletId: admin?.id ?? wallet?.id,
      }),
    }).catch(() => {
      // Best-effort by design.
    });
  }, [account, wallet, admin]);

  return null;
}
