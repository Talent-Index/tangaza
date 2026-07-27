"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useDisplayName } from "@/lib/hooks";

const NAV = [
  { href: "/", label: "Home", icon: "◎" },
  { href: "/submit", label: "Submit", icon: "＋" },
  { href: "/rewards", label: "Rewards", icon: "★" },
];

/**
 * Phone-shaped shell for the advocate. Deliberately contains no crypto vocabulary:
 * no wallet address on screen, no network name, no gas. The account is just "you".
 */
export function CustomerShell({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const pathname = usePathname();
  const name = useDisplayName(account?.address);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-crimson-500 text-sm font-black text-white">
            T
          </span>
          <span className="text-lg font-bold tracking-tight">Tangaza</span>
        </Link>

        {account ? (
          <div className="flex items-center gap-2">
            <span className="max-w-36 truncate text-sm text-mist-400">{name}</span>
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-800 text-xs font-semibold uppercase text-mist-300">
              {name.slice(0, 1)}
            </span>
          </div>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      {account ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-5 pb-5">
          <div className="flex items-center justify-around rounded-2xl border border-ink-700 bg-ink-850/95 p-1.5 backdrop-blur">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition ${
                    active
                      ? "bg-crimson-500/15 text-crimson-300"
                      : "text-mist-500 hover:text-mist-300"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
