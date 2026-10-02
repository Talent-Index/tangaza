"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CustomerShell } from "@/components/customer/Shell";
import { LandingPage } from "@/components/landing/LandingPage";
import { SessionRestoreScreen } from "@/components/customer/SessionRestore";
import { Icon } from "@/components/icons";
import { ConfigWarning, Spinner, TxReceipt } from "@/components/ui";
import { MILESTONE_ACTIVITIES } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { firstNameFrom } from "@/lib/greeting";
import { useDisplayName, useMyCommunities, usePendingActivities } from "@/lib/hooks";
import { useAdvocateSession } from "@/lib/session";
import type { PendingActivity } from "@/lib/types";

export default function Page() {
  const { account, isRestoring } = useAdvocateSession();

  if (isRestoring) return <SessionRestoreScreen />;
  if (!account) return <LandingPage />;

  return (
    <CustomerShell>
      <Home address={account.address} />
    </CustomerShell>
  );
}

const MONO = "font-mono text-[11px] uppercase tracking-[0.22em]";
// Square hairline panels in the dark look; rounded paper cards in the light look.
const PANEL = "border border-ink-700 bg-ink-850 light:rounded-xl light:shadow-sm";

/* ------------------------------------------------------------- next reward data */

interface NextReward {
  orgId: string;
  org: string;
  done: number;
  total: number;
  remaining: number;
  /** What the person is working towards, e.g. "Champion". */
  name: string;
  perk?: string;
}

interface TierResponse {
  tiers: Array<{ name: string; thresholdWeight: number }>;
  standing?: {
    approvedWeight: number;
    nextLevelName?: string;
    nextPerk?: string;
    weightToNext?: number;
  };
}

/**
 * How far each business is from the next thing it gives. Uses the business's own
 * level ladder when it has one; otherwise falls back to the contract's milestone
 * (every 20 approved activities), which every business has.
 */
function useNextRewards(address: string, mine: Array<{ orgId: bigint; name: string; approved: number }>) {
  const [tiers, setTiers] = useState<Record<string, TierResponse>>({});
  const key = mine.map((c) => `${c.orgId}:${c.approved}`).join(",");

  useEffect(() => {
    if (mine.length === 0) return;
    let cancelled = false;
    Promise.all(
      mine.map((c) =>
        fetch(`/api/tiers?orgId=${c.orgId}&address=${address}`, { cache: "no-store" })
          .then((r) => (r.ok ? (r.json() as Promise<TierResponse>) : null))
          .catch(() => null)
      )
    ).then((all) => {
      if (cancelled) return;
      const next: Record<string, TierResponse> = {};
      mine.forEach((c, i) => {
        if (all[i]) next[String(c.orgId)] = all[i]!;
      });
      setTiers(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, key]);

  return useMemo<NextReward[]>(() => {
    const milestone = Number(MILESTONE_ACTIVITIES);
    return mine
      .map((c) => {
        const t = tiers[String(c.orgId)];
        const s = t?.standing;
        if (s?.nextLevelName && s.weightToNext != null) {
          const ceiling =
            t.tiers.find((x) => x.name === s.nextLevelName)?.thresholdWeight ??
            s.approvedWeight + s.weightToNext;
          return {
            orgId: String(c.orgId),
            org: c.name,
            done: s.approvedWeight,
            total: ceiling,
            remaining: s.weightToNext,
            name: s.nextLevelName,
            perk: s.nextPerk,
          };
        }
        const done = c.approved % milestone;
        return {
          orgId: String(c.orgId),
          org: c.name,
          done,
          total: milestone,
          remaining: milestone - done,
          name: "your next reward",
        };
      })
      .sort((a, b) => a.remaining - b.remaining);
  }, [mine, tiers]);
}

/* ------------------------------------------------------------------------ home */

function Home({ address }: { address: string }) {
  const displayName = useDisplayName(address);
  const communities = useMyCommunities(address);
  const pending = usePendingActivities({ advocate: address, status: "pending" });
  const approved = usePendingActivities({ advocate: address, status: "approved" });

  const mine = useMemo(() => communities.data ?? [], [communities.data]);
  const rewards = useNextRewards(address, mine);

  if (!isConfigured) return <ConfigWarning />;

  if (communities.loading && !communities.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const first = firstNameFrom(displayName);
  const pendingItems = pending.data ?? [];
  const approvedItems = approved.data ?? [];
  const approvedTotal = mine.reduce((sum, c) => sum + c.approved, 0);
  const next = rewards[0];
  const submitHref = mine.length === 1 ? `/submit?org=${mine[0].orgId}` : "/submit";

  const orgNames = new Map(mine.map((c) => [String(c.orgId), c.name] as const));
  const rows = [
    ...group(pendingItems, "pending", orgNames),
    ...group(approvedItems, "approved", orgNames).slice(0, 5),
  ];
  const loadingRows = (pending.loading && !pending.data) || (approved.loading && !approved.data);

  const sub = next
    ? `You are ${next.remaining} approval${next.remaining === 1 ? "" : "s"} from ${next.name}.`
    : "Submit proof, then check back once the business approves.";

  return (
    <div className="animate-rise mx-auto max-w-3xl space-y-8">
      <header>
        <p className={`${MONO} text-crimson-500 light:hidden`}>Advocate portal</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl light:mt-0">Hi, {first}</h1>
        <p className="mt-3 text-base text-mist-400">{sub}</p>
      </header>

      {/* Progress: a bar in the dark look, a ring in the light one. */}
      {next ? (
        <>
          <div className={`${PANEL} p-5 light:hidden`}>
            <div className="flex items-baseline justify-between gap-4">
              <p className={`${MONO} truncate text-mist-400`}>Next reward · {next.org}</p>
              <p className="tabular font-mono text-sm">
                {next.done} / {next.total}
              </p>
            </div>
            <div className="mt-4 h-2 bg-ink-700">
              <div className="h-full bg-crimson-500 transition-all" style={{ width: `${pct(next)}%` }} />
            </div>
            {next.perk ? <p className="mt-3 text-sm text-mist-400">{next.perk}</p> : null}
          </div>
          <div className={`${PANEL} hidden items-center gap-5 p-5 light:flex`}>
            <Ring done={next.done} total={next.total} />
            <div className="min-w-0">
              <p className="font-bold">
                of {next.total} to {next.name}
              </p>
              <p className="mt-0.5 truncate text-sm text-mist-400">{next.org}</p>
              <p className="mt-1.5 text-xs text-mist-500">
                {next.remaining} more approval{next.remaining === 1 ? "" : "s"} to go
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className={`${PANEL} p-5`}>
          <div className="flex items-baseline justify-between gap-4">
            <p className={`${MONO} text-mist-400`}>Next reward</p>
            <p className="tabular font-mono text-sm">0 / {Number(MILESTONE_ACTIVITIES)}</p>
          </div>
          <div className="mt-4 h-2 bg-ink-700" />
          <p className="mt-3 text-sm text-mist-400">
            Join a campaign and get your first approval to start earning.
          </p>
        </div>
      )}

      {/* Dark: the two numbers that matter. */}
      <div className="grid grid-cols-2 gap-3 light:hidden">
        <Tile label="Awaiting" value={pendingItems.length} />
        <Tile label="Approved" value={approvedTotal} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold light:hidden">Awaiting approval</h2>
        {loadingRows ? (
          <div className={`${PANEL} grid place-items-center py-10`}>
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div className={`${PANEL} p-6`}>
            <Icon name="clipboard" className="size-6 text-crimson-500" />
            <p className="mt-4 text-lg font-bold">Nothing to review yet</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-mist-400">
              New here? Find a campaign, complete a genuine action, then send clear proof for the
              business to review.
            </p>
            <Link
              href="/campaigns"
              className="mt-5 inline-block border-b border-mist-100 pb-0.5 text-sm font-semibold hover:text-crimson-500"
            >
              Find a campaign →
            </Link>
          </div>
        ) : (
          <>
            {/* Dark: hairline rows */}
            <ul className="divide-y divide-ink-700 border border-ink-700 bg-ink-850 light:hidden">
              {rows.map((g) => (
                <GroupRow key={g.key} g={g} variant="row" />
              ))}
            </ul>
            {/* Light: a receipt with a dashed total */}
            <div className={`${PANEL} hidden p-5 font-mono text-sm light:block`}>
              <ul className="space-y-2.5">
                {rows.map((g) => (
                  <GroupRow key={g.key} g={g} variant="receipt" />
                ))}
              </ul>
              <div className="my-3 border-t border-dashed border-ink-600" />
              <div className="flex justify-between">
                <span>Approved total</span>
                <span className="tabular">{approvedTotal}</span>
              </div>
            </div>
          </>
        )}
      </section>

      <Link
        href={submitHref}
        className="flex items-center justify-center gap-3 bg-crimson-500 px-6 py-4 text-base font-bold text-white transition hover:bg-crimson-400 light:rounded-lg"
      >
        <Icon name="send" /> Submit an activity
      </Link>
    </div>
  );
}

const pct = (n: NextReward) => (n.total > 0 ? Math.min(100, (n.done / n.total) * 100) : 0);

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-ink-700 bg-ink-850 p-5">
      <p className={`${MONO} text-mist-400`}>{label}</p>
      <p className="tabular mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" className="stroke-ink-700" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="butt"
          strokeDasharray={`${frac * c} ${c}`}
          className="stroke-crimson-500 transition-all"
        />
      </svg>
      <span className="tabular absolute inset-0 grid place-items-center text-xl font-black">{done}</span>
    </div>
  );
}

/* ----------------------------------------------------------- merged activity rows */

interface Group {
  key: string;
  label: string;
  org?: string;
  status: "pending" | "approved";
  items: PendingActivity[];
}

/** One row per (business, kind of activity, status) — "Bring a friend ×2", not two rows. */
function group(
  items: PendingActivity[],
  status: Group["status"],
  orgNames: Map<string, string>
): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const key = `${status}|${it.orgId}|${it.typeLabel}`;
    const g = map.get(key) ?? { key, label: it.typeLabel, org: orgNames.get(it.orgId), status, items: [] };
    g.items.push(it);
    map.set(key, g);
  }
  return [...map.values()];
}

function GroupRow({ g, variant }: { g: Group; variant: "row" | "receipt" }) {
  const tone = g.status === "pending" ? "text-amber-glow" : "text-jade-400";

  if (variant === "receipt") {
    return (
      <li className="flex justify-between gap-4">
        <span className="min-w-0 truncate">
          {g.label}
          {g.items.length > 1 ? ` x${g.items.length}` : ""}
        </span>
        <span className={tone}>{g.status}</span>
      </li>
    );
  }

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 truncate">
            {g.label}
            {g.items.length > 1 ? <span className="text-mist-400"> ×{g.items.length}</span> : null}
            {g.org ? <span className="text-mist-500"> · {g.org}</span> : null}
          </span>
          <span className={`shrink-0 font-mono text-xs ${tone}`}>{g.status}</span>
        </summary>
        <ul className="space-y-3 border-t border-ink-700 bg-ink-900 px-4 py-4 text-xs text-mist-400">
          {g.items.map((it) => (
            <li key={it.id} className="space-y-1.5">
              <p>
                Sent {timeAgo(new Date(it.submittedAt).getTime())}
                {it.note ? ` · ${it.note}` : ""}
              </p>
              {/^https?:\/\//i.test(it.proofUrl) ? (
                <a
                  href={it.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-crimson-400 underline underline-offset-4"
                >
                  {it.proofUrl}
                </a>
              ) : null}
              {it.submitTx ? <TxReceipt hash={it.submitTx} label="Your submission, recorded on Avalanche" /> : null}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
