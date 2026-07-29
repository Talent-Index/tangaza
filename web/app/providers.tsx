"use client";

import { AutoConnect, ThirdwebProvider } from "thirdweb/react";
import { AccountWarmup } from "@/components/AccountWarmup";
import { ToastProvider } from "@/components/toast";
import { accountAbstraction, client, coreWallet, wallets } from "@/lib/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      {/*
       * Restores the advocate's session on reload. <ConnectButton /> used to do this
       * itself; components/customer/SignIn.tsx drives the wallet directly now, so
       * without this a refresh would silently sign everybody out.
       *
       * The default timeout is 15s, which on a bad connection means the welcome screen
       * sits there while a session that was going to work anyway gets cancelled. 8s is
       * enough for the in-app wallet plus the smart-account lookup, and giving up early
       * only costs a tap on "Continue with Google" — the session itself survives.
       */}
      <AutoConnect
        client={client}
        wallets={[...wallets, coreWallet]}
        // Restores a Core session as the same wrapped smart account it signed in with;
        // the in-app wallet is already smart, so the wrapper skips it.
        accountAbstraction={accountAbstraction}
        timeout={8_000}
      />
      <AccountWarmup />
      <ToastProvider>{children}</ToastProvider>
    </ThirdwebProvider>
  );
}
