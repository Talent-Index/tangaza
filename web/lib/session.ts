"use client";

import { useActiveAccount, useIsAutoConnecting } from "thirdweb/react";

/**
 * Advocate session while thirdweb AutoConnect restores a saved wallet.
 * Without waiting, pages flash the signed-out UI (landing) on every refresh.
 */
export function useAdvocateSession() {
  const account = useActiveAccount();
  const isRestoring = useIsAutoConnecting();
  return {
    account,
    isRestoring,
    isReady: !isRestoring,
    isSignedIn: !!account,
  };
}
