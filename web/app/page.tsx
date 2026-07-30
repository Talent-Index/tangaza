"use client";

import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { LandingPage } from "@/components/landing/LandingPage";
import { ProgressRing } from "@/components/customer/ProgressRing";
import { Button, Card, ConfigWarning, EmptyState, Pill, SectionTitle, Spinner, TxReceipt } from "@/components/ui";
import { MILESTONE_ACTIVITIES, ORG_ID } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import type { PendingActivity } from "@/lib/types";
import {
  useAllCampaigns,
  useCredits,
  useMyCommunities,
  usePendingActivities,
  useTiers,
} from "@/lib/hooks";

export default function Page() {
  const account = useActiveAccount();
  if (!account) return <LandingPage />;
  return (
    <CustomerShell>
      <Home address={account.address} />
    </CustomerShell>
  );
}

function Home({ address }: { address: string }) {
  // One card per business the advocate has real standing with — the chain, not the
  // app, decides whose names appear here. Org 1 was only ever sample data.
  const communities = useMyCommunities(address);
  const credits = useCredits(address);
  // Everything waiting, across every business.
  const pending = usePendingActivities({ advocate: address, status: "pending" });
  // Names for the expanded view: which business a pending item is with, and which
  // campaign carried it there. Campaigns are already fetched for the strip below.
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
  const available = (credits.data ?? []).filter((c) => !c.redeemed);
  const pendingItems = pending.data ?? [];

  const orgNames = new Map(mine.map((c) => [String(c.orgId), c.name] as const));
  const campaignTitles = new Map(
    (campaigns.data ?? []).map((c) => [c.id, { title: c.title, org: c.orgName }] as const)
  );

  return (
    <div className="animate-rise space-y-6">
      {mine.length === 0 ? (
        <section className="flex flex-col items-center pt-2 text-center">
          <ProgressRing done={0} total={Number(MILESTONE_ACTIVITIES)} />
          <p className="mt-5 max-w-xs text-sm text-mist-400">
            Every journey we move together, we grow together. Join our campaigns and
            get good deals from our partners.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {mine.map((c) => (
            <CommunityCard key={String(c.orgId)} community={c} address={address} />
          ))}
        </section>
      )}

      {available.length > 0 ? (
        <Card className="animate-pop border-crimson-500/40 bg-crimson-500/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-crimson-300">
                {available.length} reward{available.length === 1 ? "" : "s"} ready
              </p>
              <p className="mt-1 text-lg font-black">
                Redeem for in-house offers, discounts or vouchers
              </p>
            </div>
            <Button href="/rewards">Claim</Button>
          </div>
        </Card>
      ) : null}

      <Button
        href={mine.length === 1 ? `/submit?org=${mine[0].orgId}` : "/submit"}
        className="w-full"
      >
        Submit an activity
      </Button>

      <CampaignStrip />

      <section>
        <SectionTitle>Waiting for approval</SectionTitle>
        {pending.loading ? (
          <Card className="grid place-items-center py-8">
            <Spinner />
          </Card>
        ) : pendingItems.length === 0 ? (
          <EmptyState
            icon="📮"
            title="Nothing pending"
            body="Submit a referral, a post, or an event you brought in. The business approves it and it counts."
          />
        ) : (
          <ul className="space-y-2">
            {pendingItems.map((item) => {
              const campaign = item.campaignId
                ? campaignTitles.get(item.campaignId)
                : undefined;
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
      </section>

      <p className="pt-2 text-center text-[11px] leading-relaxed text-mist-500">
        Every activity for a business does not go unrewarded — share what you do,
        and get to have what we have.
      </p>
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
      <details className="group rounded-2xl border border-ink-700 bg-ink-850 transition open:border-ink-600">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
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

/**
 * One business relationship: progress toward the next credit there, streak, and the
 * level ladder if that business runs one. The name is data — whichever orgs the chain
 * says this advocate has standing with.
 */
function CommunityCard({
  community,
  address,
}: {
  community: { orgId: bigint; name: string; approved: number; streak: number };
  address: string;
}) {
  const total = Number(MILESTONE_ACTIVITIES);
  const done = community.approved % total;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{community.name}</p>
        <div className="flex items-center gap-2">
          {community.streak > 0 ? (
            <Pill tone={community.streak > 1 ? "warn" : "neutral"}>
              🔥 {community.streak}d
            </Pill>
          ) : null}
          <Pill>{community.approved} approved</Pill>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-crimson-500 transition-all"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-mist-500">
        <span className="tabular text-mist-300">{done} of {total}</span> toward your next
        reward from the house
      </p>

      <LevelCard address={address} orgId={community.orgId} />

      <div className="mt-3 border-t border-ink-700 pt-3">
        <Link
          href={`/submit?org=${community.orgId}`}
          className="text-xs text-crimson-300 underline underline-offset-4 hover:text-crimson-200"
        >
          Submit an activity here →
        </Link>
      </div>
    </Card>
  );
}

function LevelCard({ address, orgId }: { address: string; orgId: bigint }) {
  const { data } = useTiers(address, orgId);
  const standing = data?.standing;
  const tiers = data?.tiers ?? [];

  if (tiers.length === 0 || !standing) return null;

  const current = standing.currentLevelName;
  const next = standing.nextLevelName;
  const toGo = standing.weightToNext ?? 0;

  const floor = tiers.find((t) => t.name === current)?.thresholdWeight ?? 0;
  const ceiling = tiers.find((t) => t.name === next)?.thresholdWeight ?? floor;
  const span = Math.max(1, ceiling - floor);
  const pct = next
    ? Math.min(100, Math.max(0, ((standing.approvedWeight - floor) / span) * 100))
    : 100;

  return (
    <div className="mt-3 border-t border-ink-700 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">
          {current ? (
            <>
              {tiers.find((t) => t.name === current)?.icon} {current}
            </>
          ) : (
            <span className="text-mist-400">Not yet a member</span>
          )}
        </p>
      </div>

      {next ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-crimson-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-mist-500">
            <span className="text-mist-300">{toGo} more</span> to {next}
            {standing.nextPerk ? ` — ${standing.nextPerk}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-mist-500">
          Top level. {standing.currentPerk}
        </p>
      )}

      {standing.currentPerk && next ? (
        <p className="mt-2 text-xs text-mist-400">You have: {standing.currentPerk}</p>
      ) : null}
    </div>
  );
}

/** What every business on the platform is pushing right now. */
function CampaignStrip() {
  const { data } = useAllCampaigns();
  const live = data ?? [];
  if (live.length === 0) return null;

  return (
    <section>
      <SectionTitle>Happening now</SectionTitle>
      <ul className="space-y-2">
        {live.map((c) => (
          <li key={c.id}>
            <Link
              href={`/c/${c.slug}`}
              className="block rounded-xl border border-ink-700 bg-ink-850 p-4 transition hover:border-crimson-500/50"
            >
              <p className="text-xs text-mist-500">{c.orgName}</p>
              <p className="text-sm font-semibold">{c.title}</p>
              {c.blurb ? (
                <p className="mt-1 line-clamp-2 text-xs text-mist-500">{c.blurb}</p>
              ) : null}
              <p className="mt-2 text-[11px] text-mist-500">
                {c.participantCount} taking part →
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
