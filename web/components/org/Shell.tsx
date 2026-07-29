"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { BrandMark } from "@/components/ui";
import { ORG_APPROVER, addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";
import { shortAddress } from "@/lib/format";

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
        {account ? children : <OrgSignedOut />}
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

/** True when this account may approve. Blank env = open, for local development. */
export function useIsApprover() {
  const account = useActiveAccount();
  if (!account) return false;
  if (!ORG_APPROVER) return true;
  return account.address.toLowerCase() === ORG_APPROVER;
}
