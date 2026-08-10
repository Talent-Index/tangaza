"use client";

import { AutoConnect, ThirdwebProvider } from "thirdweb/react";
import { WalletRegistrar } from "@/components/WalletRegistrar";
import { ThemeProvider } from "@/components/theme";
import { ToastProvider } from "@/components/toast";
import { client, externalWallets, wallets } from "@/lib/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
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
      {/*
       * No accountAbstraction: a restored session must reproduce the same kind of
       * connection sign-in makes, and browser wallets now connect as themselves.
       */}
      <AutoConnect
        client={client}
        wallets={[...wallets, ...externalWallets]}
        timeout={8_000}
      />
      {/*
       * No AccountWarmup any more: every connection is an EOA now, and an EOA never
       * has code to deploy — a warmup would just spend the user's gas on a no-op
       * every session. It only made sense when smart accounts existed to pre-deploy.
       */}
      <WalletRegistrar />
      <ToastProvider>{children}</ToastProvider>
    </ThirdwebProvider>
    </ThemeProvider>
  );
}
