import type { Campaign } from "@/lib/hooks";
import { daysLeftLabel, goalProgress } from "@/lib/campaigns";

type ProgressCampaign = Pick<
  Campaign,
  "goalTarget" | "goalLabel" | "approvedCount" | "pendingCount" | "endsAt"
>;

/**
 * Progress toward a campaign's goal: a bar and one honest sentence.
 *
 * The number is APPROVED ACTIONS under the campaign (sign-ups, bookings, posts — whatever
 * the business chose to count), never revenue or sales. Without a goal it says so instead
 * of inventing a target, so old campaigns render fine.
 */
export function GoalProgress({
  campaign,
  showPending = false,
  className = "",
}: {
  campaign: ProgressCampaign;
  /** Add "· 3 awaiting approval" — for the business view, where it's actionable. */
  showPending?: boolean;
  className?: string;
}) {
  const p = goalProgress(campaign);
  const left = daysLeftLabel(p.daysLeft);
  const pending =
    showPending && p.pending > 0 ? `${p.pending} awaiting approval` : null;

  if (!p.hasGoal) {
    return (
      <p className={`min-w-0 text-xs text-mist-500 ${className}`}>
        No goal set
        {p.done > 0 ? ` · ${p.done} approved` : ""}
        {pending ? ` · ${pending}` : ""}
        {left ? ` · ${left}` : ""}
      </p>
    );
  }

  const sentence = p.reached
    ? "Goal reached"
    : `${p.done.toLocaleString("en-GB")} of ${p.target.toLocaleString("en-GB")} ${p.unit}`;
  const detail = [
    p.reached ? `${p.done.toLocaleString("en-GB")} of ${p.target.toLocaleString("en-GB")} ${p.unit}` : null,
    left,
    pending,
  ].filter(Boolean) as string[];

  return (
    <div className={`min-w-0 ${className}`}>
      <div
        role="progressbar"
        aria-label={`Progress toward ${p.target} ${p.unit}`}
        aria-valuemin={0}
        aria-valuemax={p.target}
        aria-valuenow={Math.min(p.done, p.target)}
        aria-valuetext={`${p.done} of ${p.target} ${p.unit}`}
        className="h-2 overflow-hidden rounded-full bg-ink-700"
      >
        <div
          className={`h-full rounded-full transition-all ${p.reached ? "bg-jade-500" : "bg-crimson-500"}`}
          style={{ width: `${p.pct}%` }}
        />
      </div>
      <p className="mt-1.5 break-words text-xs text-mist-400">
        <span className={`font-semibold ${p.reached ? "text-jade-400" : "text-mist-100"}`}>
          {sentence}
        </span>
        {detail.map((d) => (
          <span key={d} className="text-mist-500">
            {" · "}
            {d}
          </span>
        ))}
      </p>
    </div>
  );
}
