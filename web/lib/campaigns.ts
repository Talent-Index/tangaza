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
