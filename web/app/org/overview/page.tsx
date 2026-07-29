"use client";

import Link from "next/link";
import { OrgShell } from "@/components/org/Shell";
import { BudgetMeter } from "@/components/org/Meter";
import {
  Card,
  ConfigWarning,
  EmptyState,
  ErrorNote,
  Pill,
  SectionTitle,
  Spinner,
  Stat,
} from "@/components/ui";
import { CREDIT_VALUE_KES, MILESTONE_ACTIVITIES } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { advocateName, kes, kesLabel, shortAddress, timeAgo } from "@/lib/format";
import { useAdvocateLabels, useOrg, useOrgLedger } from "@/lib/hooks";

/* ------------------------------------------------------------------ screen 7 */

export default function OrgOverviewPage() {
  return (
    <OrgShell>
      <Overview />
    </OrgShell>
  );
}

function Overview() {
  const org = useOrg();
  const ledger = useOrgLedger();
  const labels = useAdvocateLabels();

  // Real name if they ever submitted through the app; pseudonym otherwise.
  const nameOf = (address: string) =>
    labels.get(address.toLowerCase()) ?? advocateName(address);

  if (!isConfigured) return <ConfigWarning />;
  if (org.error) return <ErrorNote>{org.error}</ErrorNote>;

  if (!org.data) {
    return (
      <div className="grid place-items-center py-32">
        <Spinner className="size-6" />
      </div>
    );
  }

  const cap = Number(org.data.emissionCapKES);
  const issued = Number(org.data.issuedKES);
  const redeemed = Number(org.data.redeemedKES);
  const outstanding = issued - redeemed;
  const activities = Number(org.data.approvedActivities);
  const advocates = ledger.data?.leaderboard.length ?? 0;

  const costPerActivity = activities > 0 ? issued / activities : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">{org.data.name}</h1>
          <p className="mt-1 text-sm text-mist-500">
            Every {String(MILESTONE_ACTIVITIES)} approved activities costs you{" "}
            {kesLabel(CREDIT_VALUE_KES)}.
          </p>
        </div>
        <Pill tone={org.data.active ? "good" : "warn"}>
          {org.data.active ? "Accepting approvals" : "Paused"}
        </Pill>
      </div>

      {/* KPI row — headline numbers, not a grouped bar chart. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Approved activities"
          value={kes(activities)}
          hint={`${advocates} advocate${advocates === 1 ? "" : "s"} taking part`}
        />
        <Stat
          label="Committed"
          value={kesLabel(issued)}
          hint={`of a ${kesLabel(cap)} cap`}
          tone="crimson"
        />
        <Stat
          label="Outstanding"
          value={kesLabel(outstanding)}
          hint="Owed but not yet claimed"
        />
        <Stat
          label="Cost per activity"
          value={kesLabel(Math.round(costPerActivity))}
          hint="Committed ÷ approved activities"
          tone="jade"
        />
      </section>

      <section>
        <SectionTitle
          action={
            <Link
              href="/org/liability"
              className="text-xs text-crimson-300 hover:text-crimson-400"
            >
              Liability detail →
            </Link>
          }
        >
          Reward budget
        </SectionTitle>
        <Card>
          <BudgetMeter issued={issued} cap={cap} redeemed={redeemed} />
          <p className="mt-4 border-t border-ink-700 pt-4 text-xs leading-relaxed text-mist-500">
            This cap was set once, when {org.data.name} registered. The contract has no
            function that can raise it — once {kesLabel(cap)} is committed, approvals still
            record advocacy but stop minting rewards.
          </p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionTitle>Top advocates</SectionTitle>
          {ledger.loading && !ledger.data ? (
            <Card className="grid place-items-center py-16">
              <Spinner className="size-6" />
            </Card>
          ) : ledger.error ? (
            <ErrorNote>{ledger.error}</ErrorNote>
          ) : (ledger.data?.leaderboard.length ?? 0) === 0 ? (
            <EmptyState
              icon="🏆"
              title="No advocates yet"
              body="Approve your first activity and your leaderboard starts filling up."
            />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">
                  Advocates ranked by rewards earned, then activities approved
                </caption>
                <thead>
                  <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-[0.12em] text-mist-500">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Advocate
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Activities
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Streak
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Earned
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {ledger.data!.leaderboard.map((row, i) => (
                    <tr
                      key={row.address}
                      className="border-b border-ink-800 last:border-0"
                    >
                      <th scope="row" className="px-5 py-3 text-left font-medium">
                        <span className="flex items-center gap-3">
                          <span className="grid size-7 place-items-center rounded-full bg-ink-700 text-[11px] text-mist-400">
                            {i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{nameOf(row.address)}</span>
                            <span className="block text-[11px] text-mist-500">
                              {shortAddress(row.address)}
                            </span>
                          </span>
                        </span>
                      </th>
                      <td className="px-5 py-3 text-right">{row.activities}</td>
                      <td className="px-5 py-3 text-right">{row.streak}</td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {kesLabel(row.creditsEarned * Number(CREDIT_VALUE_KES))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div>
          <SectionTitle>Recent on-chain activity</SectionTitle>
          {ledger.data && ledger.data.recent.length > 0 ? (
            <Card className="max-h-[26rem] space-y-3 overflow-y-auto">
              {ledger.data.recent.map((event, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-crimson-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium">{nameOf(event.advocate)}</span>{" "}
                      <span className="text-mist-500">
                        {event.kind === "approved"
                          ? "had an activity approved"
                          : event.kind === "earned"
                            ? `earned ${kesLabel(event.valueKES ?? 0)}`
                            : event.kind === "redeemed"
                              ? `claimed ${kesLabel(event.valueKES ?? 0)}`
                              : "hit the budget cap"}
                      </span>
                    </p>
                    <p className="text-[11px] text-mist-500">{timeAgo(event.timestamp)}</p>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyState icon="⛓" title="Nothing on-chain yet" body="Approvals appear here as they confirm." />
          )}
        </div>
      </section>
    </div>
  );
}
