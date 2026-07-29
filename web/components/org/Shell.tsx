"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/org" className="flex items-center gap-2">
            <BrandMark />
            <span className="hidden text-sm text-mist-500 sm:inline">Business</span>
          </Link>

          {account ? (
            <nav className="flex flex-wrap items-center gap-1 rounded-full border border-ink-700 bg-ink-850/80 p-1">
              {NAV.map((item) => {
                const active =
                  item.href === "/org" ? pathname === "/org" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-crimson-500/15 text-crimson-300"
                        : "text-mist-500 hover:text-mist-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {CONTRACT_ADDRESS ? (
            <a
              href={addressUrl(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-mist-500 hover:text-crimson-300 sm:block"
            >
              Contract {shortAddress(CONTRACT_ADDRESS)} ↗
            </a>
          ) : null}
          <SignedInAs />
        </div>
      </header>

      <main className="flex-1">
        {account ? <WithOrgAccess address={account.address}>{children}</WithOrgAccess> : <OrgSignedOut />}
      </main>

      <footer className="mt-12 border-t border-ink-800 pt-5 text-xs text-mist-500">
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

  if (!account) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-3 py-2">
      <span className="tabular text-xs text-mist-400">
        {shortAddress(account.address)}
      </span>
      <button
        type="button"
        onClick={() => wallet && disconnect(wallet)}
        className="text-xs text-mist-500 underline underline-offset-4 hover:text-crimson-300"
      >
        Sign out
      </button>
    </div>
  );
}

function OrgSignedOut() {
  return (
    <div className="relative grid place-items-center py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_40%,rgb(30_122_239/0.12),transparent_70%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="rounded-md bg-ink-900 px-3 py-2">
            <BrandMark className="text-base" />
          </div>
          <Link
            href="/"
            className="text-sm text-mist-400 underline underline-offset-4 hover:text-mist-200"
          >
            Advocate portal →
          </Link>
        </div>
        <div className="card px-6 py-8 sm:px-8">
          <p className="text-center text-sm text-mist-500">
            Log in to approve advocacy and manage liability
          </p>
          <h1 className="mt-3 text-center font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
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
