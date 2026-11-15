"use client";

import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { useToast } from "@/components/toast";

/**
 * The business portal's sign-out. Disconnects the active wallet and confirms it,
 * the same action the Session card on Account & settings already uses.
 */
export function useOrgSignOut() {
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { success } = useToast();

  return function signOut() {
    if (wallet) disconnect(wallet);
    success("Signed out");
  };
}
