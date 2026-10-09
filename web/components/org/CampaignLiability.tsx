"use client";

import Link from "next/link";
import { Card, EmptyState, ErrorNote, FlatStat, Spinner, StatRow } from "@/components/ui";
import { useRewardLedger, type CampaignRewardLedger } from "@/lib/hooks";
import { currencySymbol, describeCampaignReward, describeRewardRule } from "@/lib/types";

/** Money a count of rewards represents, when the reward has an amount in a currency. */
function valueOf(l: CampaignRewardLedger, count: number): { currency: string; amount: number } | null {
  const c = l.campaign;
  if (c.rewardAmount == null || c.rewardKind === "discount" || !count) return null;
  return { currency: c.rewardCurrency ?? "KES", amount: c.rewardAmount * count };
}

function sumByCurrency(items: Array<{ currency: string; amount: number } | null>) {
  const out = new Map<string, number>();
  for (const v of items) if (v) out.set(v.currency, (out.get(v.currency) ?? 0) + v.amount);
  return [...out.entries()];
}

const money = (currency: string, amount: number) =>
  `${currencySymbol(currency)}${amount.toLocaleString("en-GB")}`.trim();

/**
 * Liability as each campaign set it: what its reward is, how many people earned it,
 * what was handed over and what is still owed — with the money value where the reward
 * has one. Computed from approvals and the Rewards page, so it moves as you work.
 */
export function CampaignLiability({ orgId }: { orgId: bigint }) {
  const ledger = useRewardLedger(orgId);

  if (ledger.error) return <ErrorNote>{ledger.error}</ErrorNote>;
  if (!ledger.data) {
    return (
      <Card className="grid place-items-center py-12">
        <Spinner />
      </Card>
    );
  }

  const rows = ledger.data.ledger.filter((l) => l.campaign.rewardKind);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="📒"
        title="No campaign rewards to track yet"
        body="Give a campaign a reward in its Reward step and what you owe shows up here, campaign by campaign."
      />
    );
  }

  const owed = rows.reduce((n, l) => n + l.owed, 0);
  const given = rows.reduce((n, l) => n + l.given, 0);
  const owedValue = sumByCurrency(rows.map((l) => valueOf(l, l.owed)));
  const givenValue = sumByCurrency(rows.map((l) => valueOf(l, l.given)));
  const pending = rows.reduce((n, l) => n + l.campaign.pendingCount, 0);

  return (
    <div className="space-y-4">
      <StatRow cols={3}>
        <FlatStat
          label="Rewards owed"
          value={owed}
          hint={owedValue.length ? owedValue.map(([c, a]) => money(c, a)).join(" + ") : "Earned, not yet handed over"}
          tone={owed ? "crimson" : "default"}
        />
        <FlatStat
          label="Rewards given"
          value={given}
          hint={givenValue.length ? givenValue.map(([c, a]) => money(c, a)).join(" + ") : "Marked on the Rewards page"}
          tone="jade"
        />
        <FlatStat
          label="Waiting on you"
          value={pending}
          hint="Submissions to approve or reject"
        />
      </StatRow>

      <div className="overflow-x-auto rounded-xl border border-ink-700">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist-500">
            <tr className="border-b border-ink-700">
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Reward</th>
              <th className="px-3 py-3 text-right font-medium">Approved</th>
              <th className="px-3 py-3 text-right font-medium">Earned</th>
              <th className="px-3 py-3 text-right font-medium">Given</th>
              <th className="px-4 py-3 text-right font-medium">Owed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700">
            {rows.map((l) => {
              const v = valueOf(l, l.owed);
              return (
                <tr key={l.campaign.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{l.campaign.title}</span>
                    <span className="block text-xs text-mist-500">
                      {l.campaign.kind === "referral" ? "Referral · " : ""}
                      {l.campaign.active ? "Live" : "Closed"} · {l.people.length}{" "}
                      {l.people.length === 1 ? "person" : "people"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-mist-300">
                    {describeCampaignReward(l.campaign)}
                    <span className="block text-xs text-mist-500">
                      {describeRewardRule(l.campaign.rewardThreshold, l.campaign.rewardRepeats)}
                    </span>
                  </td>
                  <td className="tabular px-3 py-3 text-right">
                    {l.campaign.approvedCount}
                    {l.campaign.pendingCount ? (
                      <span className="block text-xs text-mist-500">+{l.campaign.pendingCount} waiting</span>
                    ) : null}
                  </td>
                  <td className="tabular px-3 py-3 text-right">{l.earned}</td>
                  <td className="tabular px-3 py-3 text-right text-jade-400">{l.given}</td>
                  <td className="tabular px-4 py-3 text-right font-semibold">
                    <span className={l.owed ? "text-crimson-400" : ""}>{l.owed}</span>
                    {v ? <span className="block text-xs font-normal text-mist-500">{money(v.currency, v.amount)}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {owed > 0 ? (
        <p className="text-xs text-mist-500">
          See who is owed, and mark rewards as handed over, on{" "}
          <Link href="/org/settings" className="text-crimson-400 hover:text-crimson-300">
            Rewards
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
