"use client";

import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { useOrgAccess } from "@/lib/hooks";

/** Avatar in the header — opens the full account page, not a dropdown. */
export function OrgProfileMenu() {
  const account = useActiveAccount();
  const access = useOrgAccess(account?.address);

  if (!account) return null;

  const initials = account.address.replace(/^0x/i, "").slice(0, 2).toUpperCase();
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
