"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ACCOUNT_NAV,
  CountBadge,
  NavIcon,
  PRIMARY_NAV,
  REWARDS_NAV,
  TOOLS_NAV,
  isOrgNavActive,
  type OrgNavItem,
} from "@/components/org/nav";

/**
 * Phone navigation: a fixed bottom bar with the four weekly destinations and a "More"
 * sheet for everything set-and-forget. Hidden from md up, where the header carries it.
 */
export function OrgMobileTabs({ pending }: { pending: number }) {
  const pathname = usePathname();
  // The sheet is open for one pathname only, so navigating (a link inside it, or the
  // browser's back button) closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const moreOpen = openFor === pathname;
  const moreRef = useRef<HTMLButtonElement>(null);

  const moreActive = [REWARDS_NAV, ...TOOLS_NAV, ACCOUNT_NAV].some((i) =>
    isOrgNavActive(pathname, i.href)
  );

  function close() {
    setOpenFor(null);
    moreRef.current?.focus();
  }

  return (
    <>
      <nav
        aria-label="Business sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-850/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden light:shadow-[0_-2px_12px_rgb(0_0_0/0.06)]"
      >
        <ul className="mx-auto grid h-14 max-w-md grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active = isOrgNavActive(pathname, item.href);
            const isApprovals = item.href === "/org";
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    isApprovals && pending > 0 ? `${item.label}, ${pending} waiting` : undefined
                  }
                  className={tabClass(active)}
                >
                  <span className="relative">
                    <NavIcon name={item.icon} />
                    {isApprovals ? (
                      <CountBadge count={pending} className="absolute -right-3 -top-2" />
                    ) : null}
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              ref={moreRef}
              type="button"
              onClick={() => setOpenFor(pathname)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={moreActive ? "page" : undefined}
              className={`${tabClass(moreActive)} w-full`}
            >
              <NavIcon name="more" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? <MoreSheet pathname={pathname} onClose={close} /> : null}
    </>
  );
}

const tabClass = (active: boolean) =>
  `flex h-14 min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition ${
    active ? "text-crimson-500" : "text-mist-500 hover:text-mist-200"
  }`;

/** The bottom sheet behind "More". Modal: Escape and the backdrop close it, Tab stays inside. */
function MoreSheet({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    // Stop the page scrolling underneath the sheet.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Keep focus inside the sheet: wrap at both ends.
    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>("a[href], button");
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-40 md:hidden" onKeyDown={onKeyDown}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-more-title"
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-ink-700 bg-ink-850 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="org-more-title" className="text-base font-bold">
            More
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-11 place-items-center rounded-full text-mist-400 hover:text-mist-100"
          >
            <NavIcon name="close" />
          </button>
        </div>

        <ul>
          <SheetLink item={REWARDS_NAV} pathname={pathname} />
        </ul>

        <p className="mt-3 px-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
          Budget &amp; tools
        </p>
        <ul>
          {TOOLS_NAV.map((item) => (
            <SheetLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>

        <div className="mt-2 border-t border-ink-700 pt-2">
          <ul>
            <SheetLink item={ACCOUNT_NAV} pathname={pathname} />
          </ul>
        </div>
      </div>
    </div>
  );
}

function SheetLink({ item, pathname }: { item: OrgNavItem; pathname: string }) {
  const active = isOrgNavActive(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-12 items-center gap-3 rounded-lg px-2 text-[15px] font-medium transition ${
          active ? "text-crimson-500" : "text-mist-200 hover:text-mist-100"
        }`}
      >
        <NavIcon name={item.icon} className="size-5 shrink-0" />
        <span className="min-w-0 truncate">{item.label}</span>
      </Link>
    </li>
  );
}
