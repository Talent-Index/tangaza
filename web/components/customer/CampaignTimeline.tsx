"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatCampaignTime,
  groupCampaignsByDay,
  isCampaignLive,
  isCampaignPast,
  isCampaignUpcoming,
} from "@/lib/campaigns";
import type { CampaignWithOrg } from "@/lib/hooks";
import { EmptyState, Spinner } from "@/components/ui";

type Tab = "upcoming" | "past";

export function CampaignTimeline({
  campaigns,
  loading,
}: {
  campaigns: CampaignWithOrg[] | undefined;
  loading: boolean;
}) {
  const [tab, setTab] = useState<Tab>("upcoming");

  const filtered = useMemo(() => {
    const list = campaigns ?? [];
    if (tab === "upcoming") {
      return list
        .filter(isCampaignUpcoming)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return list
      .filter(isCampaignPast)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [campaigns, tab]);

  const groups = useMemo(
    () => groupCampaignsByDay(filtered, tab === "upcoming" ? "asc" : "desc"),
    [filtered, tab]
  );

  if (loading && !campaigns) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-6 md:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Campaigns</h1>
          <p className="mt-1 text-sm text-mist-500">
            Browse what businesses are running — join live pushes or revisit past ones.
          </p>
        </div>

        <div
          className="flex shrink-0 rounded-full border border-ink-700 bg-ink-850 p-1"
          role="tablist"
          aria-label="Campaign timeframe"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upcoming"}
            onClick={() => setTab("upcoming")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === "upcoming"
                ? "bg-ink-700 text-mist-100"
                : "text-mist-500 hover:text-mist-300"
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            onClick={() => setTab("past")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === "past"
                ? "bg-ink-700 text-mist-100"
                : "text-mist-500 hover:text-mist-300"
            }`}
          >
            Past
          </button>
        </div>
      </header>

      {filtered.length === 0 ? (
        <EmptyState
          icon={tab === "upcoming" ? "◈" : "◎"}
          title={tab === "upcoming" ? "No upcoming campaigns" : "No past campaigns"}
          body={
            tab === "upcoming"
              ? "When a business launches a push, it will show up here."
              : "Closed or ended campaigns will appear here once they wrap up."
          }
        />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.key}>
              <p className="mb-3 text-xs font-semibold text-mist-400 md:hidden">{group.label}</p>

              <div className="grid md:grid-cols-[minmax(0,7rem)_1fr] md:gap-x-6">
                <div className="relative hidden pt-1 md:block">
                  <p className="text-sm font-semibold leading-snug text-mist-400">{group.label}</p>
                  <div
                    className="absolute top-2 h-[calc(100%+2.5rem)] w-px bg-ink-600"
                    style={{ left: "calc(100% + 1.25rem)" }}
                    aria-hidden
                  />
                  <div
                    className="absolute top-2.5 size-2 rounded-full bg-ink-500"
                    style={{ left: "calc(100% + 1.125rem)" }}
                    aria-hidden
                  />
                </div>

                <ul className="min-w-0 space-y-3 md:space-y-4">
                  {group.items.map((c) => (
                    <li key={c.id}>
                      <CampaignTimelineCard campaign={c} tab={tab} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignTimelineCard({
  campaign: c,
  tab,
}: {
  campaign: CampaignWithOrg;
  tab: Tab;
}) {
  const live = isCampaignLive(c);
  const ended = tab === "past" || !c.active;

  return (
    <article className="rounded-xl border border-ink-700 bg-ink-850 p-4 transition hover:border-ink-600 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-jade-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-jade-400">
                <span className="size-1.5 rounded-full bg-jade-400" aria-hidden />
                Live
              </span>
            ) : ended ? (
              <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mist-500">
                Ended
              </span>
            ) : (
              <span className="rounded-full bg-crimson-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-crimson-300">
                Upcoming
              </span>
            )}
            <span className="text-xs text-mist-500">{formatCampaignTime(c.startsAt)}</span>
          </div>

          <div>
            <p className="text-xs text-mist-500">{c.orgName}</p>
            <h2 className="mt-0.5 break-words text-base font-bold leading-snug md:text-lg">
              {c.title}
            </h2>
          </div>

          {c.blurb ? (
            <p className="line-clamp-2 break-words text-sm text-mist-500">{c.blurb}</p>
          ) : null}

          <p className="text-xs text-mist-500">
            {c.participantCount} advocate{c.participantCount === 1 ? "" : "s"} taking part
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 md:flex-col md:items-end">
          <Link
            href={`/c/${c.slug}`}
            className={`inline-flex min-h-10 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
              live
                ? "bg-mist-100 text-ink-950 hover:opacity-90"
                : "border border-ink-600 text-mist-300 hover:border-ink-500 hover:text-mist-100"
            }`}
          >
            {live ? "Enter campaign" : tab === "past" ? "View campaign" : "Join campaign"}
          </Link>
        </div>
      </div>
    </article>
  );
}
