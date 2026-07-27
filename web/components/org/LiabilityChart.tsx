"use client";

import { useMemo, useRef, useState } from "react";
import type { LedgerPoint } from "@/lib/events";
import { kes, formatDate } from "@/lib/format";

/**
 * Outstanding liability over time.
 *
 * Form: emphasis — outstanding is the story (accent hue), committed is context
 * (de-emphasis gray). Not two y-axes, not eight categorical hues for one number.
 * Palette validated against the dark chart surface (#14141c):
 *   CVD ΔE 9.5 · normal-vision ΔE 22.7 · both marks >= 3:1 contrast.
 */

const OUTSTANDING = "#f0325a";
const COMMITTED = "#7c7c8f";
const SURFACE = "#14141c";

const W = 760;
const H = 288;
const PAD = { top: 18, right: 74, bottom: 36, left: 62 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

interface Row {
  x: number;
  outstanding: number;
  committed: number;
  timestamp: number;
}

/** Clean axis ticks: 0 / 1,000 / 2,000 rather than 0 / 1,137 / 2,274. */
function niceMax(value: number) {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

export function LiabilityChart({
  points,
  capKES,
}: {
  points: LedgerPoint[];
  capKES: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { rows, yMax, ticks, timeMode } = useMemo(() => {
    // Start the curve at zero so the growth is visible from the origin.
    const seed: LedgerPoint = {
      timestamp: points[0]?.timestamp ?? 0,
      issuedKES: 0,
      redeemedKES: 0,
      outstandingKES: 0,
      kind: "earned",
    };
    const all = [seed, ...points];

    const times = all.map((p) => p.timestamp);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    // Seeded demos write many events in the same second — fall back to event order
    // rather than stacking every point on one x.
    const useTime = maxT - minT > 60_000;

    const rows: Row[] = all.map((p, i) => ({
      x: useTime
        ? PAD.left + ((p.timestamp - minT) / (maxT - minT)) * PLOT_W
        : PAD.left + (i / Math.max(all.length - 1, 1)) * PLOT_W,
      outstanding: p.outstandingKES,
      committed: p.issuedKES,
      timestamp: p.timestamp,
    }));

    const peak = Math.max(capKES, ...all.map((p) => p.issuedKES), 1);
    const yMax = niceMax(peak);

    return {
      rows,
      yMax,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f)),
      timeMode: useTime,
    };
  }, [points, capKES]);

  const y = (value: number) => PAD.top + PLOT_H - (value / yMax) * PLOT_H;

  const line = (get: (r: Row) => number) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${r.x.toFixed(1)},${y(get(r)).toFixed(1)}`).join(" ");

  const area = `${line((r) => r.outstanding)} L${rows[rows.length - 1].x.toFixed(1)},${y(0)} L${rows[0].x.toFixed(1)},${y(0)} Z`;

  const last = rows[rows.length - 1];
  const capY = y(capKES);

  function pick(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    rows.forEach((r, i) => {
      const d = Math.abs(r.x - svgX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActive(nearest);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((current) => {
      const base = current ?? rows.length - 1;
      const next = e.key === "ArrowLeft" ? base - 1 : base + 1;
      return Math.max(0, Math.min(rows.length - 1, next));
    });
  }

  const hovered = active === null ? null : rows[active];

  if (points.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-mist-500">
        No rewards issued yet — the liability curve starts at your first approval.
      </p>
    );
  }

  return (
    <div>
      {/* Legend — always present for two series, mirroring the marks (line keys). */}
      <div className="mb-4 flex flex-wrap items-center gap-5 text-xs">
        <span className="inline-flex items-center gap-2 text-mist-300">
          <svg width="16" height="4" aria-hidden>
            <rect width="16" height="3" rx="1.5" fill={OUTSTANDING} />
          </svg>
          Outstanding liability
        </span>
        <span className="inline-flex items-center gap-2 text-mist-400">
          <svg width="16" height="4" aria-hidden>
            <rect width="16" height="3" rx="1.5" fill={COMMITTED} />
          </svg>
          Committed to date
        </span>
        <span className="inline-flex items-center gap-2 text-mist-500">
          <svg width="16" height="4" aria-hidden>
            <rect width="16" height="1.5" y="1" fill="var(--color-amber-glow)" />
          </svg>
          Emission cap
        </span>

        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="ml-auto rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-400 hover:border-ink-500 hover:text-mist-200"
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="auto"
          role="img"
          tabIndex={0}
          aria-label={`Outstanding liability over time. Currently ${kes(last.outstanding)} KES of a ${kes(capKES)} KES cap.`}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-crimson-500"
        >
          {/* Gridlines: solid hairlines, one step off the surface. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-ink-700)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                className="tabular"
                fontSize="11"
                fill="var(--color-mist-500)"
              >
                {kes(t)}
              </text>
            </g>
          ))}

          {/* The cap: a real threshold, so it reads as one. */}
          {capY > PAD.top ? (
            <>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={capY}
                y2={capY}
                stroke="var(--color-amber-glow)"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0.75"
              />
              <text
                x={W - PAD.right + 6}
                y={capY + 4}
                fontSize="11"
                fill="var(--color-amber-glow)"
              >
                Cap
              </text>
            </>
          ) : null}

          {/* Outstanding: the story. Area wash at ~10%, 2px line. */}
          <path d={area} fill={OUTSTANDING} opacity="0.1" />
          <path
            d={line((r) => r.committed)}
            fill="none"
            stroke={COMMITTED}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={line((r) => r.outstanding)}
            fill="none"
            stroke={OUTSTANDING}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Crosshair */}
          {hovered ? (
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--color-ink-500)"
              strokeWidth="1"
            />
          ) : null}

          {/* End markers, each with a 2px surface ring so they stay legible. */}
          <circle cx={last.x} cy={y(last.committed)} r="4" fill={COMMITTED} stroke={SURFACE} strokeWidth="2" />
          <circle cx={last.x} cy={y(last.outstanding)} r="4.5" fill={OUTSTANDING} stroke={SURFACE} strokeWidth="2" />

          {hovered && hovered !== last ? (
            <>
              <circle cx={hovered.x} cy={y(hovered.committed)} r="4" fill={COMMITTED} stroke={SURFACE} strokeWidth="2" />
              <circle cx={hovered.x} cy={y(hovered.outstanding)} r="4.5" fill={OUTSTANDING} stroke={SURFACE} strokeWidth="2" />
            </>
          ) : null}

          {/* One direct label: the endpoint of the series the chart is about. */}
          <text
            x={last.x + 10}
            y={y(last.outstanding) + 4}
            fontSize="12"
            fontWeight="700"
            fill="var(--color-mist-100)"
          >
            {kes(last.outstanding)}
          </text>

          {/* X axis band */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
            stroke="var(--color-ink-600)"
            strokeWidth="1"
          />
          <text x={PAD.left} y={H - 12} fontSize="11" fill="var(--color-mist-500)">
            {timeMode ? formatDate(rows[0].timestamp) : "First reward"}
          </text>
          <text
            x={W - PAD.right}
            y={H - 12}
            textAnchor="end"
            fontSize="11"
            fill="var(--color-mist-500)"
          >
            {timeMode ? formatDate(last.timestamp) : "Now"}
          </text>
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-ink-600 bg-ink-900/95 p-3 text-xs shadow-xl backdrop-blur"
            style={{
              left: `${(hovered.x / W) * 100}%`,
              transform:
                hovered.x > W * 0.6 ? "translateX(-108%)" : "translateX(8px)",
            }}
          >
            <p className="mb-2 text-[11px] text-mist-500">
              {hovered.timestamp ? formatDate(hovered.timestamp) : "—"}
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-mist-400">
                <svg width="12" height="3" aria-hidden>
                  <rect width="12" height="3" rx="1.5" fill={OUTSTANDING} />
                </svg>
                Outstanding
              </span>
              <span className="tabular font-semibold text-mist-100">
                {kes(hovered.outstanding)}
              </span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-mist-400">
                <svg width="12" height="3" aria-hidden>
                  <rect width="12" height="3" rx="1.5" fill={COMMITTED} />
                </svg>
                Committed
              </span>
              <span className="tabular font-semibold text-mist-100">
                {kes(hovered.committed)}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Table twin — every value reachable without hovering. */}
      {showTable ? (
        <div className="mt-5 max-h-72 overflow-y-auto rounded-lg border border-ink-700">
          <table className="w-full text-xs">
            <caption className="sr-only">Liability ledger, one row per reward event</caption>
            <thead className="sticky top-0 bg-ink-850">
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-mist-500">
                <th scope="col" className="px-4 py-2 font-semibold">
                  When
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
                  Committed
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
                  Outstanding
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.slice(1).reverse().map((r, i) => (
                <tr key={i} className="border-t border-ink-800">
                  <td className="px-4 py-2 text-mist-400">
                    {r.timestamp ? formatDate(r.timestamp) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{kes(r.committed)}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {kes(r.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
