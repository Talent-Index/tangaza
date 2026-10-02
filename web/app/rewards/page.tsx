"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import {
  Button,
  Card,
  ConfigWarning,
  EmptyState,
  ErrorNote,
  Pill,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import { CREDIT_VALUE_KES, MILESTONE_ACTIVITIES } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { formatDate, kesLabel } from "@/lib/format";
import {
  useCredits,
  useEngagementTypes,
  useJoinedCampaigns,
  useMyCommunities,
  useTiers,
  type CampaignWithOrg,
  type RewardTier,
} from "@/lib/hooks";
import type { CreditState } from "@/lib/reads";
import { formatReward, rewardLabel } from "@/lib/types";

/* ------------------------------------------------------------------ screen 4 */

export default function RewardsPage() {
  const account = useActiveAccount();

  return (
    <CustomerShell>
      {account ? (
        <Rewards address={account.address} />
      ) : (
        <div className="pt-16 text-center">
          <p className="mb-6 text-mist-400">Sign in to see your rewards.</p>
          <SignIn />
        </div>
      )}
    </CustomerShell>
  );
}

interface Business {
  orgId: bigint;
  name: string;
  approved: number;
  campaigns: CampaignWithOrg[];
}

/**
 * Rewards are whatever each business decided to give — an amount in its currency, a
 * voucher, a discount, a product — reached by doing specific things a set number of
 * times. So this page is one ladder per business the person has standing with, and
 * the on-chain KES credit is the guarantee underneath, not the headline.
 */
function Rewards({ address }: { address: string }) {
  const communities = useMyCommunities(address);
  const joined = useJoinedCampaigns(address);
  const credits = useCredits(address);

  // Every business this person has standing with: approved activity on-chain, or a
  // campaign they joined and haven't had anything approved for yet.
  const businesses = useMemo<Business[]>(() => {
    const byOrg = new Map<string, Business>();
    for (const c of communities.data ?? []) {
      byOrg.set(String(c.orgId), { orgId: c.orgId, name: c.name, approved: c.approved, campaigns: [] });
    }
    for (const c of joined.data ?? []) {
      const key = String(c.orgId);
      const b = byOrg.get(key) ?? { orgId: BigInt(c.orgId), name: c.orgName, approved: 0, campaigns: [] };
      b.campaigns.push(c);
      byOrg.set(key, b);
    }
    return [...byOrg.values()];
  }, [communities.data, joined.data]);

  if (!isConfigured) return <ConfigWarning />;

  const loading =
    (communities.loading && !communities.data) || (joined.loading && !joined.data);
  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const error = communities.error ?? joined.error;
  if (error && businesses.length === 0) return <ErrorNote>{error}</ErrorNote>;

  return (
    <div className="animate-rise space-y-8">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">Your rewards</h1>
        <p className="mt-1 text-sm text-mist-500">
          Each business sets its own rewards. Every activity they approve moves you along
          their ladder — unlocked rewards are honoured by the business directly.
        </p>
      </div>

      {businesses.length === 0 ? (
        <EmptyState
          icon="🎁"
          title="No rewards yet"
          body="Join a campaign and submit what you did for that business. Once they approve it, your progress shows up here."
          action={<Button href="/campaigns">Find a campaign</Button>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {businesses.map((b) => (
            <BusinessRewards key={String(b.orgId)} business={b} address={address} />
          ))}
        </div>
      )}

      <OnChainCredits
        credits={credits.data ?? []}
        loading={credits.loading && !credits.data}
        error={credits.error}
      />
    </div>
  );
}

/** One business's ladder and where this person stands on each rung. */
function BusinessRewards({ business, address }: { business: Business; address: string }) {
  const tiers = useTiers(address, business.orgId);
  const types = useEngagementTypes(business.orgId);

  const ladder = tiers.data?.tiers ?? [];
  const standing = tiers.data?.standing;
  const progress = tiers.data?.activityProgress ?? {};
  const typeLabel = (id?: string) => types.data?.find((t) => t.id === id)?.label ?? "activity";

  const live = business.campaigns.filter((c) => c.active);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-bold">{business.name}</p>
          {live.length > 0 ? (
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-mist-500">
              {live.map((c) => (
                <Link
                  key={c.id}
                  href={`/c/${c.slug}`}
                  className="underline underline-offset-4 hover:text-mist-300"
                >
                  {c.title}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
        <Pill>{business.approved} approved</Pill>
      </div>

      {tiers.loading && !tiers.data ? (
        <div className="grid place-items-center py-6">
          <Spinner className="size-5" />
        </div>
      ) : tiers.error ? (
        <ErrorNote>{tiers.error}</ErrorNote>
      ) : ladder.length === 0 ? (
        <p className="text-sm text-mist-500">
          {business.name} hasn&rsquo;t set up its rewards yet. Everything they approve still
          counts on Avalanche, so nothing you do is lost.
        </p>
      ) : (
        <ul className="space-y-3">
          {ladder.map((t) => (
            <TierRow
              key={t.id}
              tier={t}
              have={
                t.engagementTypeId
                  ? (progress[t.engagementTypeId] ?? 0)
                  : (standing?.approvedWeight ?? 0)
              }
              goalLabel={
                t.engagementTypeId
                  ? `${t.targetCount ?? 0} × ${typeLabel(t.engagementTypeId)}`
                  : `${t.thresholdWeight} approved activities`
              }
            />
          ))}
        </ul>
      )}

      <div className="border-t border-ink-700 pt-3">
        <Link
          href={`/submit?org=${business.orgId}`}
          className="text-xs text-crimson-300 underline underline-offset-4 hover:text-crimson-200"
        >
          Submit an activity for {business.name} →
        </Link>
      </div>
    </Card>
  );
}

function TierRow({
  tier,
  have,
  goalLabel,
}: {
  tier: RewardTier;
  have: number;
  goalLabel: string;
}) {
  const goal = tier.engagementTypeId ? (tier.targetCount ?? 0) : tier.thresholdWeight;
  const unlocked = have >= goal;
  const pct = goal === 0 ? 100 : Math.min(100, (have / goal) * 100);
  const reward =
    tier.amount != null || tier.rewardKind
      ? formatReward({ amount: tier.amount, currency: tier.currency, rewardKind: tier.rewardKind })
      : null;

  return (
    <li
      className={`rounded-xl border p-3 ${
        unlocked ? "border-jade-500/40 bg-jade-500/5" : "border-ink-700 bg-ink-850/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
          {tier.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">{tier.name}</p>
            {reward ? (
              <span className="rounded-full bg-jade-500/15 px-2 py-0.5 text-xs font-semibold text-jade-400">
                {reward}
              </span>
            ) : null}
          </div>
          {tier.perk ? (
            <p className="mt-0.5 break-words text-xs text-mist-400">{tier.perk}</p>
          ) : null}
          <p className="mt-1 text-xs text-mist-500">After {goalLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          {unlocked ? (
            <Pill tone="good">Unlocked</Pill>
          ) : (
            <p className="tabular text-xs text-mist-400">
              <span className="font-semibold text-mist-200">{goal - have}</span> to go
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full transition-all ${unlocked ? "bg-jade-500" : "bg-crimson-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="tabular mt-1.5 text-[11px] text-mist-500">
        {Math.min(have, goal)} of {goal}
      </p>
    </li>
  );
}

/**
 * The platform guarantee: every MILESTONE_ACTIVITIES approved activities mints a KES
 * credit on-chain, whatever the business's own ladder says. Shown after the ladders
 * because it is the floor, not the offer.
 */
function OnChainCredits({
  credits,
  loading,
  error,
}: {
  credits: CreditState[];
  loading: boolean;
  error: string | null;
}) {
  const available = credits.filter((c) => !c.redeemed);
  const claimed = credits.filter((c) => c.redeemed);
  const availableValue = available.reduce((sum, c) => sum + Number(c.valueKES), 0);

  return (
    <section>
      <SectionTitle>On-chain credits</SectionTitle>
      <p className="mb-3 text-xs text-mist-500">
        Every {String(MILESTONE_ACTIVITIES)} approved activities mints a{" "}
        {kesLabel(CREDIT_VALUE_KES)} credit on Avalanche — the guarantee underneath whatever
        each business offers.
      </p>

      {loading ? (
        <div className="grid place-items-center py-8">
          <Spinner className="size-5" />
        </div>
      ) : error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : credits.length === 0 ? (
        <Card className="py-4 text-sm text-mist-500">No credits minted yet.</Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {available.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
                Ready to claim · {kesLabel(availableValue)}
              </p>
              <ul className="space-y-3">
                {available.map((credit) => (
                  <li key={String(credit.id)}>
                    <Link href={`/rewards/${credit.id}`} className="block">
                      <Card className="flex items-center gap-4 border-crimson-500/30 transition hover:border-crimson-500/70">
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-crimson-500/15 text-xl">
                          🎁
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="tabular text-lg font-bold">{kesLabel(credit.valueKES)}</p>
                          <p className="text-xs text-mist-500">
                            Earned {formatDate(Number(credit.earnedAt) * 1000)}
                          </p>
                        </div>
                        <span className="text-crimson-300" aria-hidden>
                          →
                        </span>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {claimed.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
                Already claimed
              </p>
              <ul className="space-y-2">
                {claimed.map((credit) => (
                  <li key={String(credit.id)}>
                    <Card className="flex items-center gap-4 py-4 opacity-70">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-700 text-base">
                        ✓
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="tabular text-sm font-semibold">
                          {kesLabel(credit.valueKES)} {rewardLabel(credit.rewardType)}
                        </p>
                        <p className="text-xs text-mist-500">
                          Claimed {formatDate(Number(credit.redeemedAt) * 1000)}
                        </p>
                      </div>
                      <Pill tone="good">Delivered</Pill>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
