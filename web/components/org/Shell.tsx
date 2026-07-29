"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { useToast } from "@/components/toast";
import { BrandMark, Spinner } from "@/components/ui";
import { ORG_ID, addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";
import { shortAddress } from "@/lib/format";
import { useOrgAccess } from "@/lib/hooks";
import type { OrgAccess } from "@/lib/reads";

const NAV = [
  { href: "/org", label: "Approvals" },
  { href: "/org/overview", label: "Overview" },
  { href: "/org/liability", label: "Liability" },
  { href: "/org/clients", label: "Clients" },
  { href: "/org/settings", label: "Settings" },
];

export function OrgShell({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col overflow-x-clip px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/org" className="flex min-w-0 items-center gap-2">
            <BrandMark className="text-base sm:text-lg" />
            <span className="hidden text-sm text-mist-500 sm:inline">Business</span>
          </Link>

          <div className="flex items-center gap-3">
            {CONTRACT_ADDRESS ? (
              <a
                href={addressUrl(CONTRACT_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden text-xs text-mist-500 hover:text-crimson-300 md:block"
              >
                Contract {shortAddress(CONTRACT_ADDRESS)} ↗
              </a>
            ) : null}
            <SignedInAs />
          </div>
        </div>

        {account ? (
          <nav className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            <div className="flex w-max min-w-full items-center gap-1 rounded-full border border-ink-700 bg-ink-850/80 p-1 sm:w-auto sm:min-w-0 sm:flex-wrap">
              {NAV.map((item) => {
                const active =
                  item.href === "/org" ? pathname === "/org" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-crimson-500/15 text-crimson-300"
                        : "text-mist-500 hover:text-mist-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="min-w-0 flex-1">
        {account ? <WithOrgAccess address={account.address}>{children}</WithOrgAccess> : <OrgSignedOut />}
      </main>

      <footer className="mt-10 border-t border-ink-800 pt-5 text-xs leading-relaxed text-mist-500 sm:mt-12">
        Avalanche Fuji · every approval and every redemption below is a real on-chain
        transaction.
      </footer>
    </div>
  );
}

function SignedInAs() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { success } = useToast();

  if (!account) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-3 py-2">
      <span className="tabular text-xs text-mist-400">
        {shortAddress(account.address)}
      </span>
      <button
        type="button"
        onClick={() => {
          if (wallet) disconnect(wallet);
          success("Signed out");
        }}
        className="text-xs text-mist-500 underline underline-offset-4 hover:text-crimson-300"
      >
        Sign out
      </button>
    </div>
  );
}

function OrgSignedOut() {
  return (
    <div className="relative grid place-items-center py-10 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_40%,rgb(30_122_239/0.12),transparent_70%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0 rounded-md bg-ink-900 px-2.5 py-2 sm:px-3">
            <BrandMark className="text-sm sm:text-base" />
          </div>
          <Link
            href="/"
            className="shrink-0 text-xs text-mist-400 underline underline-offset-4 hover:text-mist-200 sm:text-sm"
          >
            Advocate portal →
          </Link>
        </div>
        <div className="card px-4 py-7 sm:px-8 sm:py-8">
          <p className="text-center text-sm text-mist-500">
            Log in to approve advocacy and manage liability
          </p>
          <h1 className="mt-3 text-center font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-4xl">
            Business portal.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-center text-sm text-mist-500">
            Review what your advocates did, approve the real ones, and watch reward liability
            from a budget that can never grow.
          </p>
          <div className="mt-8">
            <SignIn />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ access */

const OrgAccessContext = createContext<OrgAccess>({
  orgId: ORG_ID,
  orgName: "",
  isApprover: false,
  approver: "",
});

/**
 * Resolves what the connected account may do — from the chain, not an env var.
 *
 * Every social login mints its own smart account, so "signed in" and "authorised"
 * are different facts: the same person can hold one account that approves for
 * FitTribe and another that is a stranger to every org. Each org records its
 * approver on-chain; this walks them and serves whichever org the account
 * approves for, or the default org read-only.
 */
function WithOrgAccess({
  address,
  children,
}: {
  address: string;
  children: React.ReactNode;
}) {
  const access = useOrgAccess(address);

  if (access.loading && !access.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <OrgAccessContext.Provider
      value={access.data ?? { orgId: ORG_ID, orgName: "", isApprover: false, approver: "" }}
    >
      {children}
    </OrgAccessContext.Provider>
  );
}

/** The org this session is scoped to, and whether it may approve. */
export function useOrgAccessContext() {
  return useContext(OrgAccessContext);
}

/** True when this account is the resolved org's on-chain approver. */
export function useIsApprover() {
  return useOrgAccessContext().isApprover;
}
