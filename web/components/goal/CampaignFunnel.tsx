"use client";

import { ErrorNote, Spinner } from "@/components/ui";
import { useCampaignFunnel } from "@/lib/hooks";

/**
 * Where a campaign's audience drops off: people sharing, people joining, actions
 * submitted, actions approved. Bars are scaled to the biggest stage, not to a promised
 * conversion, and "approved" is a count of approvals — not sales. Redemptions aren't
 * shown: they happen on-chain and aren't derived here.
 */
export function CampaignFunnel({
  campaignId,
  orgId,
}: {
  campaignId: string;
  orgId: bigint;
}) {
  const f = useCampaignFunnel(campaignId, orgId);

  if (f.error && !f.data) return <ErrorNote>{f.error}</ErrorNote>;
  if (!f.data) {
    return (
      <div className="grid place-items-center py-4">
        <Spinner />
      </div>
    );
  }

  const d = f.data;
  const stages = [
    { label: "People sharing", value: d.shares, note: d.clicks > 0 ? `${d.clicks} link clicks` : undefined },
    { label: "Joined", value: d.joined },
    { label: "Submitted", value: d.submitted, note: d.pending > 0 ? `${d.pending} waiting` : undefined },
    { label: "Approved", value: d.approved, note: d.rejected > 0 ? `${d.rejected} declined` : undefined, strong: true },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div>
      <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
        How it&rsquo;s going
      </p>
      <ul className="space-y-2.5">
        {stages.map((s) => (
          <li key={s.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-mist-400">{s.label}</span>
              <span className="tabular shrink-0 font-semibold text-mist-100">
                {s.value.toLocaleString("en-GB")}
                {s.note ? <span className="ml-2 font-normal text-mist-500">{s.note}</span> : null}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
              <div
                className={`h-full rounded-full ${s.strong ? "bg-jade-500" : "bg-crimson-500/70"}`}
                style={{ width: `${(s.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-mist-600">
        &ldquo;Approved&rdquo; is actions the business signed off — not sales or revenue.
      </p>
    </div>
  );
}
