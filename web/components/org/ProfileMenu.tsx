"use client";

import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { useCredentialEmail, useDisplayName, useOrgAccess } from "@/lib/hooks";
import { initialsFrom } from "@/lib/identity";

/** Avatar in the header — opens the full account page, not a dropdown. */
export function OrgProfileMenu() {
  const account = useActiveAccount();
  const access = useOrgAccess(account?.address);
  const name = useDisplayName(account?.address);
  const email = useCredentialEmail();

  if (!account) return null;

  // Initials from the person's name or login email — never from the wallet
  // address, which produced things like "F6" for 0xf6… accounts.
  const initials = initialsFrom(name, email);
  const orgName = access.data?.orgName;

  return (
    <Link
      href="/org/account"
      aria-label={orgName ? `Account settings for ${orgName}` : "Account and settings"}
      title="Account & settings"
      className="grid size-9 shrink-0 place-items-center rounded-full border border-ink-600 bg-gradient-to-br from-ink-700 to-ink-850 text-xs font-bold uppercase tracking-wide text-mist-100 shadow-sm transition hover:border-crimson-500/50 hover:from-crimson-500/20 hover:to-ink-850"
    >
      {initials}
    </Link>
  );
}
