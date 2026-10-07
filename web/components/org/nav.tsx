/**
 * The business portal's navigation, defined once so the desktop top bar and the phone
 * bottom bar can never disagree about what exists or what counts as "active".
 */

export interface OrgNavItem {
  href: string;
  label: string;
  icon: IconKey;
}

/** The four things a business does every week. Approvals carries the pending badge. */
export const PRIMARY_NAV: OrgNavItem[] = [
  { href: "/org/overview", label: "Overview", icon: "overview" },
  { href: "/org/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/org", label: "Approvals", icon: "approvals" },
  { href: "/org/clients", label: "Clients", icon: "clients" },
];

/** Set-and-forget configuration. On desktop it sits in the bar; on phones behind "More". */
export const REWARDS_NAV: OrgNavItem = { href: "/org/settings", label: "Rewards", icon: "rewards" };

/** Budget and side tools — the "Budget & tools" group. */
export const TOOLS_NAV: OrgNavItem[] = [
  { href: "/org/liability", label: "Liability", icon: "liability" },
  { href: "/org/pilot", label: "Referral pilot", icon: "pilot" },
];

/** Reached from the avatar on desktop, so it only joins the phone "More" sheet. */
export const ACCOUNT_NAV: OrgNavItem = { href: "/org/account", label: "Account", icon: "account" };

/** "/org" is the Approvals queue and must not light up for every /org/* page. */
export function isOrgNavActive(pathname: string, href: string) {
  return href === "/org" ? pathname === "/org" : pathname === href || pathname.startsWith(`${href}/`);
}

/** "9" stays "9"; a long queue stops at "99+" so the badge never outgrows its pill. */
export function badgeText(count: number) {
  return count > 99 ? "99+" : String(count);
}

/** The pill itself. Hidden at zero — an empty queue shouldn't draw the eye. */
export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`tabular inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson-500 px-1 text-[11px] font-bold leading-none text-white ${className}`}
    >
      {badgeText(count)}
    </span>
  );
}

/* ------------------------------------------------------------------- icons */

const ICONS = {
  overview: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  campaigns: ["M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z", "M15.5 8.5a5 5 0 0 1 0 7", "M18.5 6a9 9 0 0 1 0 12"],
  approvals: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "m8.5 12 2.5 2.5 4.5-5"],
  clients: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  rewards: ["M20 12v10H4V12", "M2 7h20v5H2z", "M12 22V7", "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z", "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"],
  liability: ["M12 2v20", "M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  pilot: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z", "M4 22v-7"],
  account: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  close: ["M18 6 6 18", "M6 6l12 12"],
} as const;

export type IconKey = keyof typeof ICONS;

export function NavIcon({ name, className = "size-5" }: { name: IconKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
