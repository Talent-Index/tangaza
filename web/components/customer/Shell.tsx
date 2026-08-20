"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { ThemeToggle } from "@/components/theme";
import { BrandMark } from "@/components/ui";
import { initialsFrom } from "@/lib/identity";
import { useCredentialEmail, useDisplayName } from "@/lib/hooks";

const NAV = [
  { href: "/", label: "Home", icon: "◎" },
  { href: "/campaigns", label: "Campaigns", icon: "◈" },
  { href: "/submit", label: "Submit", icon: "＋" },
  { href: "/rewards", label: "Rewards", icon: "★" },
];

function navActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Advocate shell. Phone-first on small screens (bottom nav, narrow column); on
 * desktop it opens up to a wider canvas with a top nav so the layout stops looking
 * like a phone preview in the middle of the monitor.
 */
export function CustomerShell({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const pathname = usePathname();
  const name = useDisplayName(account?.address);
  const email = useCredentialEmail();
  const initials = initialsFrom(name, email);
  const profileLabel = email ?? name ?? "Your profile";

  // Bottom padding must clear the floating nav with room to spare on phones: the
  // submit button lives at the end of a long form, and a too-tight clearance leaves
  // it half-hidden behind the nav pill — "nothing to click". On md+ the nav is in
  // the header, so the large bottom pad goes away.
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-clip px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-5 md:max-w-5xl md:px-8 md:pb-12 lg:max-w-6xl lg:px-10">
      <header className="mb-5 flex min-w-0 items-center justify-between gap-2 sm:mb-6 sm:gap-3 md:mb-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6 lg:gap-8">
          <Link href="/" className="min-w-0 shrink">
            <BrandMark className="text-base sm:text-lg" />
          </Link>

          {account ? (
            <nav
              aria-label="Primary"
              className="hidden items-center gap-1 rounded-full border border-ink-700 bg-ink-850/80 p-1 md:flex"
            >
              {NAV.map((item) => {
                const active = navActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
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

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="shrink-0" />
          {account ? (
            <Link
              href="/profile"
              aria-label={`Profile and settings for ${profileLabel}`}
              title={profileLabel}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-ink-600 bg-gradient-to-br from-ink-700 to-ink-850 text-xs font-bold uppercase tracking-wide text-mist-100 shadow-sm transition hover:border-crimson-500/50 hover:from-crimson-500/20 hover:to-ink-850"
            >
              {initials}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="min-w-0 flex-1 overflow-x-clip">{children}</main>

      {account ? (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 md:hidden"
        >
          <div className="flex items-center justify-around rounded-full border border-ink-700 bg-ink-850/95 p-1.5 backdrop-blur">
            {NAV.map((item) => {
              const active = navActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[11px] font-medium transition ${
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
