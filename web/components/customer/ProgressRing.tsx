"use client";

/** Progress toward the next KES 500 credit. 20 approved activities = one credit. */
export function ProgressRing({
  done,
  total,
  size = 168,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total === 0 ? 0 : Math.min(done / total, 1);
  const remaining = Math.max(total - done, 0);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`${done} of ${total} activities approved`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-700)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#tangaza-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2,0.8,0.2,1)" }}
        />
        <defs>
          <linearGradient id="tangaza-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-crimson-600)" />
            <stop offset="100%" stopColor="var(--color-crimson-400)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute grid place-items-center text-center">
        <span className="tabular text-4xl font-black leading-none">{done}</span>
        <span className="mt-1 text-xs text-mist-500">of {total} activities</span>
        <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-crimson-300">
          {remaining === 0 ? "Reward ready" : `${remaining} to go`}
        </span>
      </div>
    </div>
  );
}
