"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useCredentialEmail, useDisplayName, useOrgAccess } from "@/lib/hooks";
import { initialsFrom } from "@/lib/identity";
import { useOrgSignOut } from "@/lib/org-sign-out";

/** Avatar in the header. Opens a small menu for account settings and sign-out. */
export function OrgProfileMenu() {
  const account = useActiveAccount();
  const access = useOrgAccess(account?.address);
  const name = useDisplayName(account?.address);
  const email = useCredentialEmail();
  const signOut = useOrgSignOut();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (!account) return null;

  // Initials from the person's name or login email — never from the wallet
  // address, which produced things like "F6" for 0xf6… accounts.
  const initials = initialsFrom(name, email);
  const orgName = access.data?.orgName;

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;
    e.preventDefault();
    const list = Array.from(items);
    const current = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? (current + 1) % list.length
        : (current - 1 + list.length) % list.length;
    list[next]?.focus();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="org-profile-menu"
        aria-label={orgName ? `Account menu for ${orgName}` : "Account menu"}
        title="Account menu"
        className="grid size-9 shrink-0 place-items-center rounded-full border border-ink-600 bg-gradient-to-br from-ink-700 to-ink-850 text-xs font-bold uppercase tracking-wide text-mist-100 shadow-sm transition hover:border-crimson-500/50 hover:from-crimson-500/20 hover:to-ink-850"
      >
        {initials}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id="org-profile-menu"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-ink-700 bg-ink-850 p-2 shadow-xl"
        >
          <Link
            href="/org/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-mist-100 transition hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Account &amp; settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-danger-text transition hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
