"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { ThemeToggle } from "@/components/theme";
import { initialsFrom } from "@/lib/identity";
import { useCredentialEmail, useDisplayName } from "@/lib/hooks";

const NAV = [
  { href: "/", label: "Home", icon: "◎" },
  { href: "/campaigns", label: "Campaigns", icon: "◈" },
  { href: "/submit", label: "Submit", icon: "＋" },
  { href: "/rewards", label: "Rewards", icon: "★" },
];

// The desktop bar also carries account settings; on phones that lives behind the avatar.
const DESKTOP_NAV = [...NAV, { href: "/profile", label: "Settings", icon: "⚙" }];

function navActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Dark disc with a teal dot — the advocate-side mark. */
function LogoMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#111412]" aria-hidden>
      <span className="size-2.5 rounded-full bg-teal-400" />
    </span>
  );
}

/**
 * Advocate shell. Phone-first on small screens (bottom nav); on desktop a full-width
 * header carries the navigation so the layout stops looking like a phone preview in
 * the middle of the monitor.
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
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="border-b border-ink-700 bg-ink-850 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <span className="truncate text-base font-bold tracking-tight">ubu-tangaza</span>
          </Link>

          {account ? (
            <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
              {DESKTOP_NAV.map((item) => {
                const active = navActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`border-b-2 py-1 text-[13px] font-semibold transition ${
                      active
                        ? "border-crimson-500 text-crimson-500"
                        : "border-transparent text-mist-400 hover:text-mist-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle className="shrink-0" />
            {account ? (
              <Link
                href="/profile"
                aria-label={`Profile and settings for ${profileLabel}`}
                title={profileLabel}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-850 text-xs font-bold uppercase tracking-wide text-mist-100 transition hover:border-crimson-500/60"
              >
                {initials}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-clip px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-12 md:pt-10 lg:px-10">
        {children}
      </main>

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
                      ? "bg-crimson-500/15 text-crimson-500"
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
