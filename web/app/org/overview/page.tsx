"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { OrgShell, useIsApprover, useOrgAccessContext } from "@/components/org/Shell";
import { BudgetMeter } from "@/components/org/Meter";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  ConfigWarning,
  EmptyState,
  ErrorNote,
  FlatStat,
  Pill,
  SectionTitle,
  Spinner,
  StatRow,
} from "@/components/ui";
import { CREDIT_VALUE_KES } from "@/lib/chain";
import { isConfigured } from "@/lib/client";
import { advocateName, kes, kesLabel, shortAddress, timeAgo } from "@/lib/format";
import { useAdvocateLabels, useOrg, useOrgLedger } from "@/lib/hooks";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";

/* ------------------------------------------------------------------ screen 7 */

export default function OrgOverviewPage() {
  return (
    <OrgShell>
      <Overview />
    </OrgShell>
  );
}

/** The business name, editable in place by the approver (off-chain display override). */
function EditableOrgName({
  orgId,
  fallback,
  canEdit,
  account,
  onSaved,
}: {
  orgId: string;
  fallback: string;
  canEdit: boolean;
  account: { address: string; signMessage: (a: { message: string }) => Promise<string> } | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState<string>(fallback);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  // The shell owns the display name (so Account & settings, Campaigns, etc. agree);
  // mirror it here and tell the shell to refetch after a rename.
  useEffect(() => setName(fallback), [fallback]);

  async function save() {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.orgRename);
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name: next, ...auth }),
      });
      const json = (await res.json()) as { error?: string; displayName?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not rename");
      setName(json.displayName ?? next);
      setEditing(false);
      onSaved();
      success("Business name updated");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not rename");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-2xl font-black outline-none focus:border-crimson-500"
        />
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "…" : "Save"}
        </Button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <p className="truncate text-base font-bold">{name}</p>
      {canEdit ? (
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          aria-label="Edit business name"
          className="shrink-0 text-sm text-mist-500 transition hover:text-crimson-300"
        >
          ✎
        </button>
      ) : null}
    </div>
  );
}

function Overview() {
  const { orgId, orgName, refreshOrgName } = useOrgAccessContext();
  const isApprover = useIsApprover();
  const account = useActiveAccount();
  const org = useOrg(orgId);
  const ledger = useOrgLedger(orgId);
  const labels = useAdvocateLabels(orgId);

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
  const started = activities > 0;
  const capPct = cap > 0 ? Math.min(100, (issued / cap) * 100) : 0;
  const recent = ledger.data?.recent ?? [];
  const top = ledger.data?.leaderboard ?? [];

  const gridBg = {
    backgroundImage:
      "linear-gradient(color-mix(in srgb, var(--color-ink-600) 22%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-ink-600) 22%, transparent) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  } as React.CSSProperties;

  return (
    <div className="space-y-8">
      {/* Workspace band */}
      <section className="relative isolate -mt-6 pb-10 pt-8 sm:-mt-8 sm:pt-12">
        <div
          aria-hidden
          className="absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 border-b border-ink-700 bg-ink-800/50"
          style={gridBg}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-crimson-500">
            Business workspace
          </p>
          <Pill tone={org.data.active ? "good" : "warn"}>
            {org.data.active ? "Accepting approvals" : "Paused"}
          </Pill>
        </div>
        <div className="mt-3">
          <EditableOrgName
            orgId={String(orgId)}
            fallback={orgName || org.data.name}
            canEdit={isApprover}
            account={account ?? null}
            onSaved={refreshOrgName}
          />
        </div>
        <h1 className="mt-4 max-w-3xl text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl">
          A clear view of activity, rewards, and what you may owe.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-mist-400 sm:text-lg">
          Track approved activity, committed rewards, outstanding liability, and cost per
          activity in one practical workspace.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewStat
            label="Approved activities"
            value={started ? kes(activities) : "No approved activity yet"}
            hint={
              started
                ? `${advocates} advocate${advocates === 1 ? "" : "s"} taking part`
                : "Verified actions appear here."
            }
          />
          <OverviewStat
            label="Committed rewards"
            value={issued > 0 ? kesLabel(issued) : "Nothing committed yet"}
            hint={issued > 0 ? `of a ${kesLabel(cap)} cap` : "Commit only what you approve."}
          />
          <OverviewStat
            label="Outstanding liability"
            value={outstanding > 0 ? kesLabel(outstanding) : "No liability yet"}
            hint="Unclaimed approved rewards sit here."
          />
          <OverviewStat
            label="Cost per activity"
            value={started ? kesLabel(Math.round(costPerActivity)) : "Available after approval"}
            hint="A practical view of reward cost."
          />
        </div>
      </section>

      {/* Budget + what happens next */}
      <section className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-teal-500/25 bg-teal-500/10 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-crimson-500">
              Budget &amp; liability
            </p>
            <span className="text-teal-500" aria-hidden>
              ⛨
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
            Keep reward commitments in view.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-mist-400 sm:text-base">
            {started
              ? "Your budget is capped once, on-chain, and can't be raised. This tracks what you've committed and what is still owed."
              : "Your reward budget is capped once, on-chain. Until a campaign begins, there is no reward liability to manage."}
          </p>
          <div className="mt-6 flex items-center justify-between text-sm font-semibold">
            <span>Reward budget</span>
            <span className="tabular text-mist-400">
              {cap > 0 ? `${kesLabel(cap)} cap` : "Not set"}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-700/70">
            <div className="h-full rounded-full bg-crimson-500 transition-all" style={{ width: `${capPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-mist-500">
            {kesLabel(issued)} committed · {kesLabel(outstanding)} outstanding
          </p>
          <div className="mt-6">
            <Button href={started ? "/org/liability" : "/org/settings"}>
              {started ? "View liability" : "Set up your rewards"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-6 sm:p-7">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-crimson-500">
            A practical start
          </p>
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">What happens next</h2>
          <ol className="mt-5 space-y-4 text-sm leading-relaxed text-mist-400">
            {[
              ["Create a campaign.", "Pick one action your team can recognise.", "/org/campaigns"],
              ["Invite advocates.", "Share it with regulars, guests, or your community.", "/org/campaigns"],
              ["Review approvals.", "Reward valid activity within your guardrails.", "/org"],
            ].map(([bold, rest, href], i) => (
              <li key={bold} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-mist-100 text-xs font-bold text-ink-950">
                  {i + 1}
                </span>
                <span>
                  <Link href={href} className="font-semibold text-mist-100 hover:text-crimson-500">
                    {bold}
                  </Link>{" "}
                  {rest}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Top advocates + recent activity */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Top advocates" icon="👥">
          {ledger.loading && !ledger.data ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : top.length === 0 ? (
            <DashedEmpty>Your most active advocates will appear after approved activity begins.</DashedEmpty>
          ) : (
            <ul className="divide-y divide-ink-700">
              {top.slice(0, 5).map((row, i) => (
                <li key={row.address} className="flex items-center gap-3 py-3 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-ink-700 text-[11px] text-mist-400">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nameOf(row.address)}</span>
                    <span className="block text-[11px] text-mist-500">{shortAddress(row.address)}</span>
                  </span>
                  <span className="tabular text-mist-400">{row.activities}</span>
                  <span className="tabular w-24 text-right font-semibold">
                    {kesLabel(row.creditsEarned * Number(CREDIT_VALUE_KES))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent verified activity" icon="✓">
          {recent.length === 0 ? (
            <DashedEmpty>
              No verified activity yet. Approval records will appear here when your team
              reviews them.
            </DashedEmpty>
          ) : (
            <ul className="max-h-72 space-y-3 overflow-y-auto">
              {recent.map((event, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-crimson-500" />
                  <span className="min-w-0 flex-1">
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
                    <span className="block text-[11px] text-mist-500">{timeAgo(event.timestamp)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function OverviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-ink-700 bg-ink-850 p-5 shadow-sm">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-mist-500">
        {label}
      </p>
      <p className="mt-4 text-lg font-bold leading-snug">{value}</p>
      <p className="mt-1.5 text-xs text-mist-500">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <span className="text-teal-500" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DashedEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-600 px-5 py-5 text-sm leading-relaxed text-mist-500">
      {children}
    </div>
  );
}
