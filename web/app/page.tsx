"use client";

import Link from "next/link";
import { CustomerShell } from "@/components/customer/Shell";
import { LandingPage } from "@/components/landing/LandingPage";
import { SessionRestoreScreen } from "@/components/customer/SessionRestore";
import { ConfigWarning, Pill, Spinner, TxReceipt } from "@/components/ui";
import { isConfigured } from "@/lib/client";
import { firstNameFrom } from "@/lib/greeting";
import { timeAgo } from "@/lib/format";
import {
  useAllCampaigns,
  useCredits,
  useDisplayName,
  useMyCommunities,
  usePendingActivities,
} from "@/lib/hooks";
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

const KICKER = "font-mono text-[11px] font-semibold uppercase tracking-[0.22em]";

function Home({ address }: { address: string }) {
  const displayName = useDisplayName(address);
  // The chain, not the app, decides whose businesses count here.
  const communities = useMyCommunities(address);
  const credits = useCredits(address);
  const pending = usePendingActivities({ advocate: address, status: "pending" });
  const campaigns = useAllCampaigns();

  if (!isConfigured) return <ConfigWarning />;

  if (communities.loading && !communities.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const mine = communities.data ?? [];
  const ready = (credits.data ?? []).filter((c) => !c.redeemed).length;
  const pendingItems = pending.data ?? [];
  const liveCampaigns = campaigns.data ?? [];
  const approvedTotal = mine.reduce((sum, c) => sum + c.approved, 0);

  const orgNames = new Map(mine.map((c) => [String(c.orgId), c.name] as const));
  const campaignTitles = new Map(
    liveCampaigns.map((c) => [c.id, { title: c.title, org: c.orgName }] as const)
  );

  const first = firstNameFrom(displayName);
  const submitHref = mine.length === 1 ? `/submit?org=${mine[0].orgId}` : "/submit";

  return (
    <div className="animate-rise space-y-10 md:space-y-12">
      {/* Intro + primary action */}
      <section className="grid gap-8 md:grid-cols-[1.25fr_1fr] md:items-stretch">
        <div>
          <p className={`${KICKER} text-crimson-500`}>Advocate portal</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Hi, {first}</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-mist-400 sm:text-lg">
            Choose a campaign, submit genuine proof, then check back once the business has
            reviewed it.
          </p>
        </div>
        <div className="border-ink-700 md:border-l md:pl-8">
          <p className={`${KICKER} text-mist-500`}>Advocate actions</p>
          <p className="mt-4 text-sm leading-relaxed text-mist-400">
            Choose a campaign and keep every activity clear, genuine, and ready for review.
          </p>
          <Link
            href={submitHref}
            className="mt-5 inline-flex items-center gap-2 bg-crimson-500 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-crimson-400"
          >
            <span aria-hidden>↗</span> Submit an activity
          </Link>
        </div>
      </section>

      {/* Summary */}
      <section className="grid divide-y divide-ink-700 border-y border-ink-700 bg-ink-850/60 md:grid-cols-3 md:divide-x md:divide-y-0">
        <Tile
          label="Awaiting approval"
          value={pendingItems.length}
          empty="No activity waiting right now."
          filled={`${pendingItems.length === 1 ? "Submission is" : "Submissions are"} with the business.`}
        />
        <Tile
          label="Approved activity"
          value={approvedTotal}
          empty="Approved activity will appear here."
          filled={`Across ${mine.length} business${mine.length === 1 ? "" : "es"}.`}
        />
        <Tile
          label="Rewards"
          value={ready}
          empty="Eligible rewards will appear here."
          filled={`Ready to claim.`}
          href={ready > 0 ? "/rewards" : undefined}
        />
      </section>

      {/* Two columns */}
      <section className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div>
          <ColumnHead title="Awaiting approval" action="Submit proof" href={submitHref} />
          {pending.loading && !pending.data ? (
            <div className="grid place-items-center border border-ink-700 bg-ink-850 py-12">
              <Spinner />
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="border border-ink-700 bg-ink-850 p-7 shadow-sm sm:p-9">
              <span className="text-2xl text-crimson-500" aria-hidden>
                ☑
              </span>
              <p className="mt-6 text-xl font-bold">Nothing to review yet</p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-mist-400 sm:text-base">
                New here? Find a campaign, complete a genuine action, then send clear proof
                for the business to review.
              </p>
              <Link
                href="/campaigns"
                className="mt-6 inline-block border-b border-mist-100 pb-0.5 text-sm font-semibold hover:text-crimson-500"
              >
                Find a campaign →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {pendingItems.map((item) => {
                const campaign = item.campaignId ? campaignTitles.get(item.campaignId) : undefined;
                return (
                  <PendingRow
                    key={item.id}
                    item={item}
                    orgName={orgNames.get(item.orgId) ?? campaign?.org}
                    campaignTitle={campaign?.title}
                  />
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <ColumnHead title="Happening now" action="See all" href="/campaigns" />
          {liveCampaigns.length === 0 ? (
            <div className="border border-ink-700 bg-ink-850 p-6 text-sm text-mist-500">
              No campaigns are live right now. Check back soon.
            </div>
          ) : (
            <ul className="space-y-4">
              {liveCampaigns.slice(0, 3).map((c) => (
                <li key={c.id} className="border border-ink-700 bg-ink-850 p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`${KICKER} min-w-0 truncate text-mist-400`}>{c.orgName}</p>
                    <span className="shrink-0 rounded-full bg-ink-700/70 px-3 py-1 text-xs font-semibold text-mist-300">
                      Available
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-bold leading-snug">{c.title}</p>
                  {c.blurb ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-mist-400">{c.blurb}</p>
                  ) : null}
                  <Link
                    href={`/c/${c.slug}`}
                    className="mt-4 inline-block border-b border-mist-100 pb-0.5 text-sm font-semibold hover:text-crimson-500"
                  >
                    View campaign
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Full-width primary action */}
      <Link
        href={submitHref}
        className="flex items-center justify-center gap-3 bg-crimson-500 px-6 py-5 text-base font-bold text-white transition hover:bg-crimson-400"
      >
        <span aria-hidden>➤</span> Submit an activity
      </Link>
    </div>
  );
}

function Tile({
  label,
  value,
  empty,
  filled,
  href,
}: {
  label: string;
  value: number;
  empty: string;
  filled: string;
  href?: string;
}) {
  const body = (
    <div className="p-6 sm:p-8">
      <p className={`${KICKER} text-mist-400`}>{label}</p>
      <p className="tabular mt-5 text-3xl font-black">{value > 0 ? value : "—"}</p>
      <p className="mt-3 text-sm text-mist-400">{value > 0 ? filled : empty}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:bg-ink-800/60">
      {body}
    </Link>
  ) : (
    body
  );
}

function ColumnHead({ title, action, href }: { title: string; action: string; href: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-ink-700 pb-3">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <Link
        href={href}
        className="border-b border-mist-100 pb-0.5 text-sm font-semibold hover:text-crimson-500"
      >
        {action}
      </Link>
    </div>
  );
}

/**
 * One pending submission, expandable to its full story.
 *
 * The closed row is a glance — what and how long ago. Opening it answers the
 * questions someone actually has while they wait: which business is this with, what
 * proof did I hand them, which campaign carried it, and where is my transaction on
 * Avalanche. A native <details> keeps it keyboard- and screen-reader-friendly with no
 * state to manage.
 */
function PendingRow({
  item,
  orgName,
  campaignTitle,
}: {
  item: PendingActivity;
  orgName?: string;
  campaignTitle?: string;
}) {
  const proofIsLink = /^https?:\/\//i.test(item.proofUrl);

  return (
    <li>
      <details className="group rounded-none border border-ink-700 bg-ink-850 transition open:border-ink-600">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 [&::-webkit-details-marker]:hidden">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-700 text-lg">
            {item.typeIcon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.typeLabel}</p>
            <p className="truncate text-xs text-mist-500">
              {orgName ? `${orgName} · ` : ""}
              {timeAgo(new Date(item.submittedAt).getTime())}
            </p>
          </div>
          <Pill tone="warn">Pending</Pill>
          <span
            aria-hidden
            className="shrink-0 text-mist-500 transition-transform group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>

        <div className="space-y-3 border-t border-ink-700/60 px-4 py-4 text-sm">
          <dl className="space-y-2">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-xs uppercase tracking-[0.12em] text-mist-500">
                With
              </dt>
              <dd className="min-w-0 text-mist-300">
                {orgName ?? `Business #${item.orgId}`}
              </dd>
            </div>
            {campaignTitle ? (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-xs uppercase tracking-[0.12em] text-mist-500">
                  Campaign
                </dt>
                <dd className="min-w-0 text-mist-300">📣 {campaignTitle}</dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-xs uppercase tracking-[0.12em] text-mist-500">
                Worth
              </dt>
              <dd className="text-mist-300">
                +{item.weight} {item.weight === 1 ? "activity" : "activities"} when approved
              </dd>
            </div>
            {item.proofUrl ? (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-xs uppercase tracking-[0.12em] text-mist-500">
                  Proof
                </dt>
                <dd className="min-w-0 flex-1">
                  {proofIsLink ? (
                    <a
                      href={item.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-crimson-300 underline underline-offset-4 hover:text-crimson-400"
                    >
                      {item.proofUrl}
                    </a>
                  ) : (
                    <span className="break-words text-mist-300">{item.proofUrl}</span>
                  )}
                </dd>
              </div>
            ) : null}
            {item.note ? (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-xs uppercase tracking-[0.12em] text-mist-500">
                  Note
                </dt>
                <dd className="min-w-0 break-words text-mist-300">{item.note}</dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-xs uppercase tracking-[0.12em] text-mist-500">
                Sent
              </dt>
              <dd className="text-mist-300">
                {new Date(item.submittedAt).toLocaleString()}
              </dd>
            </div>
          </dl>

          {item.submitTx ? (
            <TxReceipt hash={item.submitTx} label="Your wallet recorded this on Avalanche" />
          ) : null}
        </div>
      </details>
    </li>
  );
}

