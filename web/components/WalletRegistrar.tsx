"use client";

import { useEffect, useRef } from "react";
import {
  useActiveAccount,
  useActiveWallet,
  useAdminWallet,
  useProfiles,
} from "thirdweb/react";
import { ORG_ID } from "@/lib/chain";
import { client } from "@/lib/client";
import { credentialNameFromProfiles } from "@/lib/identity";

/**
 * Writes "this wallet connected" to the database the moment an account connects,
 * and seeds a display name from the login credentials when the person has never
 * set one. Without that seed the shell can show "Dan" (from email) while the
 * business queue falls back to a wallet nickname like "Wafula".
 *
 * Fire-and-forget: a lost row here must never interfere with the session itself.
 */
export function WalletRegistrar() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const admin = useAdminWallet();
  const { data: profiles } = useProfiles({ client });
  const recorded = useRef(new Set<string>());
  const nameSeeded = useRef(new Set<string>());

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

  useEffect(() => {
    if (!account || profiles === undefined) return;
    const address = account.address;
    if (nameSeeded.current.has(address)) return;

    const credential = credentialNameFromProfiles(profiles);
    if (!credential) {
      // Profiles loaded; this login has nothing useful (typical for X-only).
      nameSeeded.current.add(address);
      return;
    }

    nameSeeded.current.add(address);

    void (async () => {
      try {
        const res = await fetch(
          `/api/me?orgId=${ORG_ID}&address=${address}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          nameSeeded.current.delete(address);
          return;
        }
        const json = (await res.json()) as {
          profile?: { displayName?: string };
        };
        if (json.profile?.displayName) return;

        const put = await fetch("/api/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: String(ORG_ID),
            address,
            displayName: credential,
          }),
        });
        if (!put.ok) nameSeeded.current.delete(address);
      } catch {
        nameSeeded.current.delete(address);
      }
    })();
  }, [account, profiles]);

  return null;
}
