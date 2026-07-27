"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { ORG_APPROVER, addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";
import { shortAddress } from "@/lib/format";

const NAV = [
  { href: "/org", label: "Approvals" },
  { href: "/org/overview", label: "Overview" },
  { href: "/org/liability", label: "Liability" },
];

export function OrgShell({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/org" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-crimson-500 text-sm font-black text-white">
              T
            </span>
            <span className="text-lg font-bold tracking-tight">
              Tangaza <span className="text-mist-500">for business</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/org" ? pathname === "/org" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-ink-800 text-mist-100"
                      : "text-mist-500 hover:text-mist-300"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
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

/**
 * The header's account corner. Unlike the advocate surface, the org *does* get to see
 * its address — it signs the approvals, and it needs a way to sign out of a shared
 * laptop. That's the whole of what <ConnectButton />'s details panel was doing here.
 */
function SignedInAs() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  if (!account) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
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
    <div className="grid place-items-center py-32 text-center">
      <h1 className="text-3xl font-black">Approve advocacy. Control the bill.</h1>
      <p className="mt-3 max-w-md text-mist-400">
        Sign in to review what your advocates did, approve the real ones, and watch your
        reward liability from a budget that can never grow.
      </p>
      <div className="mt-8 w-full max-w-xs">
        <SignIn />
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
