"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { BrandMark } from "@/components/ui";
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

  // Bottom padding must clear the floating nav with room to spare: the submit button
  // lives at the end of a long form, and a too-tight clearance leaves it half-hidden
  // behind the nav pill on short viewports — "nothing to click".
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-5">
      <header className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
        <Link href="/" className="min-w-0 shrink">
          <BrandMark className="text-base sm:text-lg" />
        </Link>

        {account ? (
          <Link
            href="/profile"
            aria-label="Your profile"
            className="flex min-w-0 items-center gap-2 rounded-full transition hover:opacity-80"
          >
            <span className="max-w-28 truncate text-sm text-mist-400 sm:max-w-36">
              {name}
            </span>
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-800 text-xs font-semibold uppercase text-mist-300">
              {name.replace(/^@/, "").slice(0, 1)}
            </span>
          </Link>
        ) : null}
      </header>

      <main className="min-w-0 flex-1">{children}</main>

      {account ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="flex items-center justify-around rounded-full border border-ink-700 bg-ink-850/95 p-1.5 backdrop-blur">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[11px] font-medium transition ${
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
