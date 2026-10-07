"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useActiveAccount, useIsAutoConnecting } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { OrgMobileTabs } from "@/components/org/MobileTabs";
import {
  CountBadge,
  NavIcon,
  PRIMARY_NAV,
  REWARDS_NAV,
  TOOLS_NAV,
  isOrgNavActive,
} from "@/components/org/nav";
import { OrgProfileMenu } from "@/components/org/ProfileMenu";
import { ThemeToggle } from "@/components/theme";
import { useToast } from "@/components/toast";
import { BrandMark, Spinner } from "@/components/ui";
import { ORG_ID, addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";
import { kesLabel, shortAddress } from "@/lib/format";
import {
  useMyApplications,
  useOrgAccess,
  usePendingActivities,
  type ApplicationSummary,
} from "@/lib/hooks";
import type { OrgAccess } from "@/lib/reads";

export function OrgShell({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const isRestoring = useIsAutoConnecting();
  // Fed by the one queue poll that lives under WithOrgAccess, so the badge and the
  // Approvals page read the same list instead of polling twice.
  const [pendingCount, setPendingCount] = useState(0);

  // On phones the fixed bottom tab bar sits over the end of the page, so the page
  // reserves its height (h-14 plus the home-indicator inset) below the footer.
  return (
    <div
      className={`flex min-h-dvh flex-col overflow-x-clip ${
        account ? "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0" : ""
      }`}
    >
      <header className="border-b border-ink-700 bg-ink-850">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-6 md:pb-0 md:pt-3 lg:flex-nowrap lg:py-3">
          <Link href="/org/overview" className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <span className="text-lg font-bold tracking-tight">Ubu-Tangaza</span>
            <span className="hidden text-sm font-semibold uppercase tracking-[0.22em] text-crimson-500 sm:inline">
              Business
            </span>
          </Link>

          {account ? <DesktopNav pending={pendingCount} /> : null}

          <div className="flex shrink-0 items-center gap-2 py-1">
            <ThemeToggle />
            <OrgProfileMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {account ? (
          <WithOrgAccess address={account.address} onPendingCount={setPendingCount}>
            {children}
          </WithOrgAccess>
        ) : isRestoring ? (
          <div className="grid place-items-center py-24">
            <Spinner className="size-6" />
          </div>
        ) : (
          <OrgSignedOut />
        )}
      </main>

      <footer className="bg-[#111412] text-gray-300">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="text-lg font-bold tracking-tight text-white">Ubu-Tangaza</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-gray-400">
            A lightweight record of approved reward activity may be kept on Avalanche for
            transparency. Your business and advocates do not need to manage crypto wallets.
          </p>
        </div>
      </footer>

      {account ? <OrgMobileTabs pending={pendingCount} /> : null}
    </div>
  );
}

/**
 * Desktop navigation: the five everyday sections as tabs, and a "More" dropdown for the
 * budget and side tools. Phones get OrgMobileTabs instead, so this is hidden below md.
 */
function DesktopNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  // Open for one pathname only, so following a link closes the menu without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenFor(null);
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

  const tab = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-[13px] font-medium transition ${
      active
        ? "border-crimson-500 text-crimson-500"
        : "border-transparent text-mist-300 hover:text-mist-100"
    }`;
  const toolActive = TOOLS_NAV.some((i) => isOrgNavActive(pathname, i.href));

  return (
    <nav
      aria-label="Business sections"
      className="order-3 hidden w-full md:block lg:order-none lg:w-auto"
    >
      <div className="flex items-center gap-5">
        {[...PRIMARY_NAV, REWARDS_NAV].map((item) => {
          const active = isOrgNavActive(pathname, item.href);
          const isApprovals = item.href === "/org";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={tab(active)}
            >
              {item.label}
              {isApprovals ? (
                <>
                  <CountBadge count={pending} />
                  {pending > 0 ? <span className="sr-only">{pending} waiting</span> : null}
                </>
              ) : null}
            </Link>
          );
        })}

        <div ref={wrapRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpenFor(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="org-more-menu"
            className={tab(toolActive)}
          >
            More
            <svg viewBox="0 0 12 12" className={`size-3 transition ${open ? "rotate-180" : ""}`} aria-hidden>
              <path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open ? (
            <div
              id="org-more-menu"
              className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-ink-700 bg-ink-850 p-2 shadow-xl"
            >
              <p className="px-2 pb-1 pt-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
                Budget &amp; tools
              </p>
              {TOOLS_NAV.map((item) => {
                const active = isOrgNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm font-medium transition ${
                      active ? "text-crimson-500" : "text-mist-200 hover:bg-ink-800 hover:text-mist-100"
                    }`}
                  >
                    <NavIcon name={item.icon} className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

/** Dark rounded square with a teal dot — the business-side mark. */
function LogoMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#111412]" aria-hidden>
      <span className="size-3 rounded-full bg-teal-400" />
    </span>
  );
}

function OrgSignedOut() {
  return (
    <div className="relative grid place-items-center py-10 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_40%,rgb(194_85_31/0.12),transparent_70%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0 rounded-md bg-ink-900 px-2.5 py-2 sm:px-3">
            <BrandMark className="text-sm sm:text-base" />
          </div>
          <Link
            href="/auth"
            className="shrink-0 text-xs text-mist-400 underline underline-offset-4 hover:text-mist-200 sm:text-sm"
          >
            Advocate portal →
          </Link>
        </div>
        <div className="card px-4 py-7 sm:px-8 sm:py-8">
          <p className="text-center text-sm text-mist-500">
            Log in to approve advocacy and manage liability
          </p>
          <h1 className="mt-3 text-center font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-4xl">
            Business portal.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-center text-sm text-mist-500">
            Review what your advocates did, approve the real ones, and watch reward liability
            from a budget that can never grow.
          </p>
          <div className="mt-8">
            <SignIn />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ access */

/** OrgAccess plus the business's editable display name, already folded into `orgName`. */
export type OrgAccessView = OrgAccess & { refreshOrgName: () => void };

const OrgAccessContext = createContext<OrgAccessView>({
  orgId: ORG_ID,
  orgName: "",
  isApprover: false,
  approver: "",
  kind: "visitor",
  refreshOrgName: () => {},
});

/**
 * The business's editable display name (orgs.display_name). The on-chain name is
 * immutable, so this is the one a business can change — and every org page must show
 * the same one, or renaming on Overview contradicts Account & settings.
 */
function useOrgDisplayName(orgId: bigint | undefined) {
  const [name, setName] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (orgId === undefined) return;
    let cancelled = false;
    fetch(`/api/org?orgId=${orgId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { displayName?: string | null } | null) => {
        if (!cancelled) setName(j?.displayName?.trim() || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId, nonce]);

  return { name, refresh };
}

/**
 * Resolves what the connected account may do — from the chain, not an env var.
 *
 * Every social login mints its own smart account, so "signed in" and "authorised"
 * are different facts: the same person can hold one account that approves for
 * FitTribe and another that is a stranger to every org. Each org records its
 * approver on-chain; this walks them and serves whichever org the account
 * approves for, or the default org read-only.
 */
function WithOrgAccess({
  address,
  onPendingCount,
  children,
}: {
  address: string;
  onPendingCount: (n: number) => void;
  children: React.ReactNode;
}) {
  const access = useOrgAccess(address);
  const mine = useMyApplications(address);
  const display = useOrgDisplayName(
    access.data?.kind === "approver" ? access.data.orgId : undefined
  );

  if (access.loading && !access.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  /**
   * This account runs no business on this contract.
   *
   * It used to be handed the default org's dashboard read-only, which meant a business
   * that had just signed its pledge saw somebody else's name, somebody else's
   * advocates, and no explanation. Say what is actually true instead — and wait for the
   * application lookup before deciding, so a pending registration is never mislabelled
   * as "you have no business here".
   */
  if (access.data && access.data.kind === "visitor") {
    if (mine.loading && !mine.data) {
      return (
        <div className="grid place-items-center py-24">
          <Spinner className="size-6" />
        </div>
      );
    }
    return <NoBusinessYet address={address} applications={mine.data ?? []} />;
  }

  /*
   * Resolution failed (typically the public RPC rate-limiting the org walk) and we
   * have nothing cached. This used to fall through to the default org's dashboard,
   * which showed whoever was signed in the pilot business's campaigns and queue.
   * Privacy beats convenience: say we couldn't verify them, and let them retry.
   */
  if (!access.data) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-24 text-center">
        <p className="text-sm font-semibold text-mist-100">Couldn&rsquo;t verify your business</p>
        <p className="text-sm text-mist-500">
          {access.error ?? "The network didn't answer in time."} Nothing is shown until we can
          confirm which business this account approves for.
        </p>
        <button
          type="button"
          onClick={access.refresh}
          className="inline-flex min-h-10 items-center rounded-full bg-crimson-500 px-5 text-sm font-semibold text-white transition hover:bg-crimson-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <OrgAccessContext.Provider
      value={{
        ...access.data,
        orgName: display.name ?? access.data.orgName,
        refreshOrgName: display.refresh,
      }}
    >
      <PendingQueueProvider orgId={access.data.orgId} onCount={onPendingCount}>
        {children}
      </PendingQueueProvider>
    </OrgAccessContext.Provider>
  );
}

/**
 * What a wallet with no on-chain business sees.
 *
 * Three genuinely different situations, and conflating them is what made this confusing:
 * they never applied, they applied and it is still being registered, or their
 * application says registered but the contract disagrees — which is what happens when a
 * pledge was registered against an older deployment.
 */
function NoBusinessYet({
  address,
  applications,
}: {
  address: string;
  applications: ApplicationSummary[];
}) {
  const pending = applications.find((a) => a.status === "signed");
  const registered = applications.find((a) => a.status === "registered");

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="card px-6 py-8 text-center">
        {pending ? (
          <>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-500/15 text-2xl">
              ⏳
            </div>
            <h1 className="text-xl font-bold">{pending.name} is being registered</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-mist-500">
              Your pledge is signed and on file with a {kesLabel(pending.emissionCapKes)}{" "}
              budget. The platform writes the registration on Avalanche — once it lands,
              this page becomes your approvals queue. It refreshes itself.
            </p>
          </>
        ) : registered ? (
          <>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-crimson-500/15 text-2xl">
              ⚠️
            </div>
            <h1 className="text-xl font-bold">{registered.name} isn&rsquo;t on this contract</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-mist-500">
              Your application says registered
              {registered.orgId ? ` as org #${registered.orgId}` : ""}, but the contract
              this app points at has no org with your wallet as approver. That happens
              when the org was registered against an earlier deployment. It needs
              registering again on{" "}
              <code className="tabular text-mist-300">{shortAddress(CONTRACT_ADDRESS)}</code>.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-ink-700 text-2xl">
              🏪
            </div>
            <h1 className="text-xl font-bold">No business on this wallet</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-mist-500">
              Nothing on Avalanche names{" "}
              <code className="tabular text-mist-300">{shortAddress(address)}</code> as an
              approver. Register your business and its budget is written once, on-chain,
              with this wallet holding approval rights.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-block rounded-full bg-crimson-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-crimson-400"
            >
              Register your business →
            </Link>
          </>
        )}
        <p className="mt-6 text-xs text-mist-500">
          Signed in as <code className="tabular">{shortAddress(address)}</code>. Every
          login mints its own account, so if you pledged with a different one, sign out
          and back in with that.
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- pending queue */

type PendingQueue = ReturnType<typeof usePendingActivities>;

const PendingQueueContext = createContext<PendingQueue | null>(null);

/**
 * The one poll of this business's pending submissions. The nav badge counts it and the
 * Approvals page renders it, so a decision made on the page updates the badge on the
 * same refresh rather than waiting for a second loop to come round.
 */
function PendingQueueProvider({
  orgId,
  onCount,
  children,
}: {
  orgId: bigint;
  onCount: (n: number) => void;
  children: React.ReactNode;
}) {
  const queue = usePendingActivities({ orgId: String(orgId), status: "pending" });
  const count = queue.data?.length ?? 0;

  useEffect(() => {
    onCount(count);
  }, [count, onCount]);
  useEffect(() => () => onCount(0), [onCount]);

  return <PendingQueueContext.Provider value={queue}>{children}</PendingQueueContext.Provider>;
}

/** This business's pending submissions — the same data the nav badge counts. */
export function useOrgPendingQueue(): PendingQueue {
  const queue = useContext(PendingQueueContext);
  if (!queue) throw new Error("useOrgPendingQueue must be used inside OrgShell");
  return queue;
}

/** The org this session is scoped to, and whether it may approve. */
export function useOrgAccessContext() {
  return useContext(OrgAccessContext);
}

/** True when this account is the resolved org's on-chain approver. */
export function useIsApprover() {
  return useOrgAccessContext().isApprover;
}
