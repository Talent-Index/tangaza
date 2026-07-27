"use client";

import { kes } from "@/lib/format";

/**
 * A single ratio against a hard limit — a meter, not a chart.
 * Fill carries severity; the unfilled track is a lighter step of the same ramp so
 * the state reads across the whole bar.
 */
export function BudgetMeter({
  issued,
  cap,
  redeemed,
}: {
  issued: number;
  cap: number;
  redeemed: number;
}) {
  const pct = cap === 0 ? 0 : Math.min(issued / cap, 1);
  const redeemedPct = cap === 0 ? 0 : Math.min(redeemed / cap, 1);

  const severity = pct >= 1 ? "danger" : pct >= 0.8 ? "warning" : "accent";
  const fill = {
    accent: "var(--color-crimson-500)",
    warning: "var(--color-amber-glow)",
    danger: "var(--color-crimson-600)",
  }[severity];

  const state = {
    accent: "Within budget",
    warning: "Approaching the cap",
    danger: "Cap reached — no new rewards can be minted",
  }[severity];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          {kes(issued)} <span className="text-mist-500">of {kes(cap)} KES committed</span>
        </p>
        <p className="text-xs text-mist-500">{Math.round(pct * 100)}% of the cap</p>
      </div>

      <div
        className="relative h-3 w-full overflow-hidden rounded-full"
        style={{ background: "color-mix(in oklab, var(--color-crimson-500) 16%, transparent)" }}
        role="meter"
        aria-valuenow={issued}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-label={`${kes(issued)} of ${kes(cap)} KES committed`}
      >
        {/* Committed (issued) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{ width: `${pct * 100}%`, background: fill }}
        />
        {/* Already paid out — a darker inset showing what is settled, not outstanding.
            The 2px surface gap keeps the two fills from reading as one block. */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{
            width: `${redeemedPct * 100}%`,
            background: "var(--color-ink-950)",
            opacity: 0.45,
            borderRight: redeemedPct > 0 ? "2px solid var(--color-ink-850)" : undefined,
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-mist-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: fill }} />
          Committed to advocates
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-600" />
          Already paid out ({kes(redeemed)} KES)
        </span>
        <span className={severity === "accent" ? "" : "font-medium text-amber-glow"}>
          {state}
        </span>
      </div>
    </div>
  );
}
