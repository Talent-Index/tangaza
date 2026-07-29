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
  useAdvocate,
  useCampaigns,
  useCredits,
  useOrg,
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
  const org = useOrg();
  const advocate = useAdvocate(address);
  const credits = useCredits(address);
  const pending = usePendingActivities({
    orgId: String(ORG_ID),
    advocate: address,
    status: "pending",
  });

  if (!isConfigured) return <ConfigWarning />;

  if (advocate.loading && !advocate.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const total = Number(MILESTONE_ACTIVITIES);
  const approved = Number(advocate.data?.approvedActivities ?? 0n);
  const done = approved % total;
  const streak = Number(advocate.data?.streak ?? 0n);
  const available = (credits.data ?? []).filter((c) => !c.redeemed);
  const pendingItems = pending.data ?? [];

  return (
    <div className="animate-rise space-y-6">
      <section className="flex flex-col items-center">
        <p className="mb-4 text-sm text-mist-400">
          {org.data?.name ?? "Your community"}
        </p>
        <ProgressRing done={done} total={total} />

        <div className="mt-5 flex items-center gap-2">
          <Pill tone={streak > 1 ? "warn" : "neutral"}>
            🔥 {streak} day{streak === 1 ? "" : "s"} streak
          </Pill>
          <Pill>{approved} approved all-time</Pill>
        </div>
      </section>

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

      <LevelCard address={address} />

      <Button href="/submit" className="w-full">
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
            body="Submit a referral, a post, or an event you brought in. The Centre approves it and it counts."
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
        Rewards come from {org.data?.name ?? "the business"}&rsquo;s fixed budget of{" "}
        {org.data ? kesLabel(org.data.emissionCapKES) : "—"}. That budget can never be
        raised.
      </p>
    </div>
  );
}

function LevelCard({ address }: { address: string }) {
  const { data } = useTiers(address);
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
    <Card>
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
        <p className="tabular text-xs text-mist-500">{standing.approvedWeight} approved</p>
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
        <p className="mt-3 border-t border-ink-700 pt-3 text-xs text-mist-400">
          You have: {standing.currentPerk}
        </p>
      ) : null}
    </Card>
  );
}

function CampaignStrip() {
  const { data } = useCampaigns();
  const live = (data ?? []).filter((c) => c.active);
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
