"use client";

import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { LandingPage } from "@/components/landing/LandingPage";
import { ProgressRing } from "@/components/customer/ProgressRing";
import { Button, Card, ConfigWarning, EmptyState, Pill, SectionTitle, Spinner } from "@/components/ui";
import { MILESTONE_ACTIVITIES, ORG_ID, CREDIT_VALUE_KES } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { kesLabel, timeAgo } from "@/lib/format";
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

  return (
    <div className="animate-rise space-y-6">
      {mine.length === 0 ? (
        <section className="flex flex-col items-center pt-2 text-center">
          <ProgressRing done={0} total={Number(MILESTONE_ACTIVITIES)} />
          <p className="mt-5 max-w-xs text-sm text-mist-400">
            Every 20 approved activities earns {kesLabel(CREDIT_VALUE_KES)}, at any
            business here. Join a campaign below and start.
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
              <p className="tabular mt-1 text-2xl font-black">
                {kesLabel(available.reduce((sum, c) => sum + Number(c.valueKES), 0))}
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
            {pendingItems.map((item) => (
              <li key={item.id}>
                <Card className="flex items-center gap-3 py-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-700 text-lg">
                    {item.typeIcon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.typeLabel}
                    </p>
                    <p className="truncate text-xs text-mist-500">
                      {timeAgo(new Date(item.submittedAt).getTime())}
                    </p>
                  </div>
                  <Pill tone="warn">Pending</Pill>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pt-2 text-center text-[11px] leading-relaxed text-mist-500">
        Every reward comes from a business&rsquo;s own fixed budget, written once on
        Avalanche. No budget can ever be raised — not by them, not by us.
      </p>
    </div>
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
        <span className="tabular text-mist-300">{done} of {total}</span> toward your next{" "}
        {kesLabel(CREDIT_VALUE_KES)} reward
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
