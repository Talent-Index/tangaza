"use client";

import Link from "next/link";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/components/toast";
import { Card, EmptyState, ErrorNote, Pill, SectionTitle, Spinner } from "@/components/ui";
import { shortAddress } from "@/lib/format";
import { useRewardLedger, type CampaignRewardLedger, type RewardDue } from "@/lib/hooks";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";
import { describeCampaignReward, describeRewardRule } from "@/lib/types";

/**
 * Record that the business handed a reward over (delta 1) or take one back (-1).
 * Signed by the approver like every other business write.
 */
export function useGiveReward(orgId: bigint, onDone: () => void) {
  const account = useActiveAccount();
  const { success, error: toastError } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function give(campaignId: string, advocate: string, delta: 1 | -1) {
    const key = `${campaignId}:${advocate}`;
    setBusy(key);
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.rewardGive);
      const res = await fetch("/api/org/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: String(orgId), campaignId, advocate, delta, ...auth }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not record the reward");
      success(delta > 0 ? "Marked as rewarded" : "Reward taken back");
      onDone();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not record the reward");
    } finally {
      setBusy(null);
    }
  }

  return { give, busy, isBusy: (campaignId: string, advocate: string) => busy === `${campaignId}:${advocate}` };
}

const personName = (p: { displayName?: string; advocate: string }) =>
  p.displayName ?? shortAddress(p.advocate);

/** The Rewards page: everyone who has earned a campaign reward, grouped by campaign. */
export function RewardsDue({ orgId, isApprover }: { orgId: bigint; isApprover: boolean }) {
  const ledger = useRewardLedger(orgId);
  const { give, isBusy } = useGiveReward(orgId, ledger.refresh);
  const [showAll, setShowAll] = useState(false);

  if (ledger.error) return <ErrorNote>{ledger.error}</ErrorNote>;
  if (!ledger.data) {
    return (
      <Card className="grid place-items-center py-12">
        <Spinner />
      </Card>
    );
  }

  if (!ledger.data.rewardsAvailable) {
    return (
      <ErrorNote>
        Rewards aren&rsquo;t available on this setup yet — the database needs
        db/019_business_profile_and_campaign_rewards.sql.
      </ErrorNote>
    );
  }

  const withReward = ledger.data.ledger.filter((l) => l.campaign.rewardKind);
  const noReward = ledger.data.ledger.filter((l) => !l.campaign.rewardKind && l.campaign.active);
  const owedTotal = withReward.reduce((n, l) => n + l.owed, 0);

  if (withReward.length === 0) {
    return (
      <EmptyState
        icon="🎁"
        title="No campaign has a reward yet"
        body="Set what people earn in a campaign's Reward step. Everyone who earns it shows up here, ready to be rewarded."
      />
    );
  }

  const visible = showAll ? withReward : withReward.filter((l) => l.people.length > 0 || l.campaign.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={owedTotal > 0 ? "warn" : "good"}>
          {owedTotal > 0
            ? `${owedTotal} reward${owedTotal === 1 ? "" : "s"} to hand over`
            : "Everyone who earned a reward has it"}
        </Pill>
        {withReward.length !== visible.length || showAll ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="min-h-8 text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300"
          >
            {showAll ? "Hide closed campaigns with no one" : "Show every campaign"}
          </button>
        ) : null}
      </div>

      {visible.map((l) => (
        <CampaignRewards
          key={l.campaign.id}
          ledger={l}
          isApprover={isApprover}
          isBusy={isBusy}
          onGive={give}
        />
      ))}

      {noReward.length > 0 ? (
        <p className="text-xs text-mist-500">
          {noReward.length} live campaign{noReward.length === 1 ? " has" : "s have"} no reward
          set ({noReward.map((l) => l.campaign.title).join(", ")}).{" "}
          <Link href="/org/campaigns" className="text-crimson-400 hover:text-crimson-300">
            Add one in Campaigns
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function CampaignRewards({
  ledger: { campaign: c, people, earned, given, owed },
  isApprover,
  isBusy,
  onGive,
}: {
  ledger: CampaignRewardLedger;
  isApprover: boolean;
  isBusy: (campaignId: string, advocate: string) => boolean;
  onGive: (campaignId: string, advocate: string, delta: 1 | -1) => void;
}) {
  const deserving = people.filter((p) => p.owed > 0);
  const rewarded = people.filter((p) => p.owed === 0 && p.given > 0);
  const onTheWay = people.filter((p) => p.earned === 0 && (p.approved > 0 || p.pending > 0));

  return (
    <section>
      <SectionTitle
        action={
          <span className="text-xs text-mist-500">
            {earned} earned · {given} given · <span className={owed ? "text-amber-glow" : ""}>{owed} owed</span>
          </span>
        }
      >
        {c.title}
        {c.kind === "referral" ? " · referral" : ""}
      </SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm text-mist-400">
          <span className="text-mist-100">{describeCampaignReward(c)}</span>{" "}
          {describeRewardRule(c.rewardThreshold, c.rewardRepeats)}
          {c.active ? "" : " · closed"}
        </p>

        {deserving.length === 0 && rewarded.length === 0 && onTheWay.length === 0 ? (
          <p className="text-sm text-mist-500">Nobody has taken part yet.</p>
        ) : null}

        {deserving.length > 0 ? (
          <PeopleList title="Deserves a reward">
            {deserving.map((p) => (
              <PersonRow key={p.advocate} person={p}>
                <span className="text-xs text-mist-500">
                  {p.approved} approved{p.owed > 1 ? ` · owed ×${p.owed}` : ""}
                </span>
                {isApprover ? (
                  <button
                    type="button"
                    disabled={isBusy(c.id, p.advocate)}
                    onClick={() => onGive(c.id, p.advocate, 1)}
                    className="min-h-9 rounded-full bg-crimson-500 px-3.5 text-xs font-semibold text-white transition hover:bg-crimson-400 disabled:opacity-50"
                  >
                    {isBusy(c.id, p.advocate) ? "Saving…" : "Mark rewarded"}
                  </button>
                ) : null}
              </PersonRow>
            ))}
          </PeopleList>
        ) : null}

        {rewarded.length > 0 ? (
          <PeopleList title="Rewarded">
            {rewarded.map((p) => (
              <PersonRow key={p.advocate} person={p}>
                <span className="text-xs text-jade-400">
                  ✓ {p.given > 1 ? `×${p.given}` : "given"}
                  {p.lastGivenAt ? ` · ${new Date(p.lastGivenAt).toLocaleDateString()}` : ""}
                </span>
                {isApprover ? (
                  <button
                    type="button"
                    disabled={isBusy(c.id, p.advocate)}
                    onClick={() => onGive(c.id, p.advocate, -1)}
                    className="min-h-9 px-2 text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300 disabled:opacity-50"
                  >
                    Undo
                  </button>
                ) : null}
              </PersonRow>
            ))}
          </PeopleList>
        ) : null}

        {onTheWay.length > 0 ? (
          <PeopleList title="On the way">
            {onTheWay.map((p) => (
              <PersonRow key={p.advocate} person={p}>
                <span className="text-xs text-mist-500">
                  {p.approved} approved
                  {p.pending ? ` · ${p.pending} waiting` : ""}
                  {p.toNext ? ` · ${p.toNext} to go` : ""}
                </span>
              </PersonRow>
            ))}
          </PeopleList>
        ) : null}
      </Card>
    </section>
  );
}

function PeopleList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
        {title}
      </p>
      <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{children}</ul>
    </div>
  );
}

function PersonRow({ person, children }: { person: RewardDue; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
      <span className="min-w-0 truncate text-sm font-medium">{personName(person)}</span>
      <span className="flex shrink-0 items-center gap-3">{children}</span>
    </li>
  );
}
