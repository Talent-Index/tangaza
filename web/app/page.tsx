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
  // No status filter: one poll returns every submission, newest first, in all three states.
  const activity = usePendingActivities({ advocate: address });

  const [showAll, setShowAll] = useState(false);

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
  const all = activity.data ?? [];
  const pendingItems = all.filter((a) => a.status === "pending");
  const approvedTotal = mine.reduce((sum, c) => sum + c.approved, 0);
  const next = rewards[0];
  const submitHref = mine.length === 1 ? `/submit?org=${mine[0].orgId}` : "/submit";

  const orgNames = new Map(mine.map((c) => [String(c.orgId), c.name] as const));
  // Waiting ones first — they are the ones with something left to happen — then the
  // decided ones, newest first (the API already returns newest first).
  const rows = [
    ...all.filter((a) => a.status === "pending"),
    ...all.filter((a) => a.status !== "pending"),
  ];
  const visibleRows = showAll ? rows : rows.slice(0, VISIBLE_ACTIVITY);
  const loadingRows = activity.loading && !activity.data;

  const sub = next
    ? `You are ${next.remaining} approved action${next.remaining === 1 ? "" : "s"} from ${next.name}.`
    : "Submit proof, then check back here to see whether the business approved it.";

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
                {next.remaining} more approved action{next.remaining === 1 ? "" : "s"} to go
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

      <section aria-labelledby="your-activity">
        <h2 id="your-activity" className="mb-3 text-lg font-bold">
          Your activity
        </h2>
        {loadingRows ? (
          <div className={`${PANEL} grid place-items-center py-10`}>
            <Spinner />
          </div>
        ) : activity.error && !activity.data ? (
          <div className={`${PANEL} p-5 text-sm text-mist-400`}>
            Couldn&rsquo;t load your activity right now. It will retry on its own.
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
            <ul className="space-y-3">
              {visibleRows.map((it) => (
                <ActivityCard key={it.id} it={it} org={orgNames.get(it.orgId)} />
              ))}
            </ul>
            {rows.length > VISIBLE_ACTIVITY ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-mist-300 underline underline-offset-4 hover:text-mist-100"
              >
                {showAll ? "Show fewer" : `Show all ${rows.length}`}
              </button>
            ) : null}
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

/* ------------------------------------------------------------ activity tracking */

/** Past this many, the rest sit behind "Show all" so a long history doesn't bury the page. */
const VISIBLE_ACTIVITY = 6;

/**
 * One submission and where it stands: Submitted, then either Approved (with the on-chain
 * record when there is one) or Not approved with the business's own reason.
 */
function ActivityCard({ it, org }: { it: PendingActivity; org?: string }) {
  const approved = it.status === "approved";
  const rejected = it.status === "rejected";
  const decidedAt = it.decidedAt ? new Date(it.decidedAt).getTime() : 0;

  return (
    <li className={`${PANEL} min-w-0 p-4`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg" aria-hidden>
          {it.typeIcon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {it.typeLabel}
            {it.weight > 1 ? <span className="text-mist-400"> · +{it.weight}</span> : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-mist-500">
            {org ? `${org} · ` : ""}Sent {timeAgo(new Date(it.submittedAt).getTime())}
          </p>
        </div>
      </div>

      <ol
        aria-label="Progress"
        className="mt-3 flex items-center gap-2 text-xs font-medium"
      >
        <li className="flex items-center gap-1.5 text-mist-200">
          <span className="size-2 rounded-full bg-jade-400" aria-hidden /> Submitted
        </li>
        <li aria-hidden className="h-px w-8 bg-ink-600" />
        <li
          className={`flex items-center gap-1.5 ${
            approved ? "text-jade-400" : rejected ? "text-crimson-300" : "text-mist-500"
          }`}
          aria-current={approved || rejected ? "step" : undefined}
        >
          <span
            className={`size-2 rounded-full ${
              approved ? "bg-jade-400" : rejected ? "bg-crimson-500" : "border border-ink-500"
            }`}
            aria-hidden
          />
          {rejected ? "Not approved" : "Approved"}
        </li>
      </ol>

      {approved ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-jade-400">
            Approved{decidedAt ? ` ${timeAgo(decidedAt)}` : ""}.
          </p>
          {it.txHash ? <TxReceipt hash={it.txHash} label="Approved on Avalanche" /> : null}
        </div>
      ) : rejected ? (
        <div className="mt-3 space-y-2">
          <p className="break-words rounded-lg border border-crimson-500/30 bg-crimson-500/10 px-3 py-2 text-sm text-crimson-300">
            Not approved: {it.rejectionReason?.trim() || "no reason was given"}
          </p>
          <p className="text-xs text-mist-500">
            You can send it again with clearer proof — your other actions still count.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-glow">
          Waiting for {org ?? "the business"} to review.
        </p>
      )}

      {it.note || /^https?:\/\//i.test(it.proofUrl) || it.submitTx ? (
        <div className="mt-3 space-y-1.5 border-t border-ink-700 pt-3 text-xs text-mist-400">
          {it.note ? <p className="break-words">&ldquo;{it.note}&rdquo;</p> : null}
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
          {it.submitTx ? (
            <TxReceipt hash={it.submitTx} label="Your submission, recorded on Avalanche" />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
