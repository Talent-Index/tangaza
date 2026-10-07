import type { Campaign } from "@/lib/hooks";

export function isCampaignUpcoming(c: Campaign): boolean {
  if (!c.active) return false;
  if (c.endsAt && new Date(c.endsAt).getTime() < Date.now()) return false;
  return true;
}

export function isCampaignPast(c: Campaign): boolean {
  return !isCampaignUpcoming(c);
}

export function formatCampaignDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";

  return d.toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function formatCampaignTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function groupCampaignsByDay<T extends Campaign>(
  campaigns: T[],
  order: "asc" | "desc" = "asc"
): Array<{ key: string; label: string; items: T[] }> {
  const map = new Map<string, T[]>();

  for (const c of campaigns) {
    const d = new Date(c.startsAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(c);
    else map.set(key, [c]);
  }

  const entries = [...map.entries()].sort(([a], [b]) =>
    order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
  );

  return entries.map(([key, items]) => ({
    key,
    label: formatCampaignDayLabel(items[0].startsAt),
    items: items.sort((a, b) =>
      order === "asc"
        ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    ),
  }));
}

export function isCampaignLive(c: Campaign): boolean {
  const now = Date.now();
  const start = new Date(c.startsAt).getTime();
  const end = c.endsAt ? new Date(c.endsAt).getTime() : null;
  return c.active && start <= now && (end === null || end > now);
}

/* ------------------------------------------------------------------- goals */

export interface GoalProgressInfo {
  /** A numeric target is set. Without one there is nothing to measure a percentage against. */
  hasGoal: boolean;
  target: number;
  done: number;
  pending: number;
  /** 0-100, clamped. */
  pct: number;
  reached: boolean;
  /** What is counted, e.g. "sign-ups". */
  unit: string;
  /** Whole days until ends_at; 0 means it ends today; null = no deadline; negative = ended. */
  daysLeft: number | null;
}

/**
 * Progress is the number of APPROVED actions under the campaign. It is not revenue and
 * not sales — Tangaza never sees those — so the unit is whatever the business said it is
 * counting, defaulting to "approved actions".
 */
export function goalProgress(
  c: Pick<Campaign, "goalTarget" | "goalLabel" | "approvedCount" | "pendingCount" | "endsAt">
): GoalProgressInfo {
  const target = c.goalTarget && c.goalTarget > 0 ? c.goalTarget : 0;
  const done = c.approvedCount ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  let daysLeft: number | null = null;
  if (c.endsAt) {
    const ms = new Date(c.endsAt).getTime() - Date.now();
    daysLeft = ms <= 0 ? -1 : Math.floor(ms / 86_400_000);
  }
  return {
    hasGoal: target > 0,
    target,
    done,
    pending: c.pendingCount ?? 0,
    pct,
    reached: target > 0 && done >= target,
    unit: c.goalLabel?.trim() || "approved actions",
    daysLeft,
  };
}

/** "18 days left", "Ends today", "Ended" — or null when there is no deadline. */
export function daysLeftLabel(daysLeft: number | null): string | null {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return "Ended";
  if (daysLeft === 0) return "Ends today";
  return `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
}

/** "Help <org> reach 100 sign-ups" — the public sentence for a campaign with a goal. */
export function goalSentence(
  c: Pick<Campaign, "goalTarget" | "goalLabel">,
  orgName: string
): string | null {
  if (!c.goalTarget || c.goalTarget < 1) return null;
  return `Help ${orgName} reach ${c.goalTarget.toLocaleString("en-GB")} ${
    c.goalLabel?.trim() || "approved actions"
  }`;
}
