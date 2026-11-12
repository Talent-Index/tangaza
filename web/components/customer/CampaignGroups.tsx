"use client";

import Link from "next/link";
import { useState } from "react";
import {
  isCampaignLive,
  isCampaignPast,
  isCampaignUpcoming,
  openCampaigns,
  previousCampaigns,
} from "@/lib/campaigns";
import type { CampaignWithOrg } from "@/lib/hooks";
import { initialsFrom } from "@/lib/identity";
import { payoutKindLabel } from "@/lib/types";
import { Spinner } from "@/components/ui";

/** Campaign clocks and dates are shown on Kenyan time — the clock the businesses run on. */
const NAIROBI = "Africa/Nairobi";

const COVER_FALLBACKS = [
  "/images/landing/hero-campaign.webp",
  "/images/landing/usecase-cafe.webp",
  "/images/landing/usecase-boutique.webp",
  "/images/landing/usecase-salon.webp",
] as const;

const DOT_COLORS = ["bg-gold", "bg-jade-400", "bg-crimson-300"] as const;

export function CampaignGroups({
  campaigns,
  loading,
  error,
  leadIds,
  previousEmpty,
  columns = "grid",
}: {
  campaigns: CampaignWithOrg[] | undefined;
  loading: boolean;
  error?: string | null;
  /** Joined campaigns are listed first inside each group. */
  leadIds?: ReadonlySet<string>;
  previousEmpty: string;
  columns?: "grid" | "stack";
}) {
  if (loading && !campaigns) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error && !campaigns) {
    return (
      <p className="py-10 text-sm text-mist-500">Couldn&apos;t load campaigns right now. It will retry on its own.</p>
    );
  }

  const list = campaigns ?? [];
  const live = leadWith(openCampaigns(list), leadIds);
  const previous = leadWith(previousCampaigns(list), leadIds);
  const grid =
    columns === "grid"
      ? "grid grid-cols-1 gap-[18px] md:grid-cols-2 md:gap-6"
      : "grid grid-cols-1 gap-[18px]";

  return (
    <div className="space-y-8 sm:space-y-9">
      <CampaignSection
        id="live"
        heading="Live now"
        count={live.length}
        emptyTitle="No live campaigns right now"
        emptyBody="When a business starts a campaign, it shows up here with the reward before you join."
      >
        {live.length > 0 ? (
          <div className={grid}>
            {live.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        ) : null}
      </CampaignSection>

      <CampaignSection
        id="previous"
        heading="Previous"
        count={previous.length}
        emptyKicker="Previous"
        emptyTitle="No previous campaigns yet"
        emptyBody={previousEmpty}
      >
        {previous.length > 0 ? (
          <div className={grid}>
            {previous.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        ) : null}
      </CampaignSection>
    </div>
  );
}

function leadWith<T extends { id: string }>(list: T[], leadIds?: ReadonlySet<string>): T[] {
  if (!leadIds || leadIds.size === 0) return list;
  const lead = list.filter((c) => leadIds.has(c.id));
  const rest = list.filter((c) => !leadIds.has(c.id));
  return [...lead, ...rest];
}

function CampaignSection({
  id,
  heading,
  count,
  emptyKicker,
  emptyTitle,
  emptyBody,
  children,
}: {
  id: string;
  heading: string;
  count: number;
  emptyKicker?: string;
  emptyTitle: string;
  emptyBody: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <div className="mb-[18px] flex items-center gap-3.5">
        <h2 id={`${id}-heading`} className="poster text-[1.625rem] sm:text-[1.875rem]">
          {heading}
        </h2>
        <span className="h-px flex-1 bg-ink-600 light:bg-ink-700" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist-500">
          {campaignCount(count)}
        </span>
      </div>
      {count > 0 ? (
        children
      ) : (
        <div className="flex flex-col justify-center rounded-[20px] border border-dashed border-ink-600 px-7 py-10 text-mist-500 light:border-ink-700 sm:px-10">
          {emptyKicker ? (
            <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-text">
              <span className="h-px w-7 bg-gold" aria-hidden />
              {emptyKicker}
            </p>
          ) : null}
          <h3 className={`poster text-[1.875rem] leading-none text-mist-100 ${emptyKicker ? "mt-3.5" : ""}`}>
            {emptyTitle}
          </h3>
          <p className="mt-2.5 max-w-[420px] text-base leading-relaxed">{emptyBody}</p>
        </div>
      )}
    </section>
  );
}

function CampaignCard({ campaign: c }: { campaign: CampaignWithOrg }) {
  const live = isCampaignLive(c);
  const upcoming = isCampaignUpcoming(c);
  const ended = isCampaignPast(c);
  const blurb = c.blurb ? publicCopy(c.blurb) : "";
  const target = targetFact(c);
  const reward = rewardFact(c);
  const initials = businessInitials(c.orgName);

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[20px] border border-ink-600 bg-ink-850 shadow-[0_18px_40px_rgba(0,0,0,0.35)] light:border-ink-700 light:shadow-[0_18px_40px_rgba(90,60,20,0.12)] ${
        ended ? "opacity-[0.92]" : ""
      }`}
    >
      <div className="relative h-[200px] sm:h-[250px]">
        <Cover campaign={c} muted={ended} />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,16,8,0.45)_0%,rgba(19,16,8,0)_35%,rgba(19,16,8,0)_55%,rgba(19,16,8,0.8)_100%)]"
        />
        <div className="absolute left-4 top-4 z-[1]">
          {live ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-ok-bg px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ok">
              <span
                className="size-[7px] rounded-full bg-ok shadow-[0_0_0_3px_rgba(127,201,139,0.25)]"
                aria-hidden
              />
              Live
            </span>
          ) : upcoming ? (
            <span className="inline-flex rounded-full bg-[rgba(19,16,8,0.75)] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
              Upcoming
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-[rgba(19,16,8,0.75)] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#cfc4ae]">
              Ended
            </span>
          )}
        </div>
        <DateMark campaign={c} />
        <div className="absolute bottom-4 left-5 z-[1] flex items-center gap-2.5 text-[#f1e9db]">
          <span className="grid size-[34px] place-items-center rounded-full bg-gold text-[13px] font-extrabold text-on-gold">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold leading-none">{c.orgName}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-[18px] pb-5 pt-[18px] sm:px-6 sm:pb-6 sm:pt-[22px]">
        <h3 className="poster break-words text-[2.125rem] sm:text-[2.5rem]">{c.title}</h3>
        {blurb ? <p className="mt-2.5 text-base leading-relaxed text-mist-300">{blurb}</p> : null}

        {target || reward ? (
          <div className="mt-[18px] flex flex-wrap gap-2.5">
            {target ? <Fact label="Target" value={target} /> : null}
            {reward ? <Fact label="Reward" value={reward} /> : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-col items-stretch gap-3 border-t border-ink-600 pt-[18px] light:border-ink-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 whitespace-nowrap text-sm text-mist-300">
            <AmbassadorDots count={c.participantCount} />
            <span>
              {c.participantCount === 0 ? (
                "No Ambassadors taking part yet"
              ) : (
                <>
                  <b className="font-bold text-mist-100">
                    {c.participantCount === 1 ? "1 Ambassador" : `${c.participantCount} Ambassadors`}
                  </b>{" "}
                  taking part
                </>
              )}
            </span>
          </p>
          <Link
            href={`/c/${c.slug}`}
            className={`inline-flex w-full shrink-0 items-center justify-center gap-2.5 rounded-full px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:ml-auto sm:w-auto ${
              ended
                ? "border border-ink-600 bg-transparent text-mist-300 hover:border-ink-500 hover:text-mist-100 light:border-ink-700"
                : "bg-gold text-on-gold shadow-[0_6px_18px_rgba(233,162,59,0.28)] hover:bg-gold-hover"
            }`}
          >
            {ended ? (
              "View results"
            ) : (
              <>
                Enter campaign <span aria-hidden>→</span>
              </>
            )}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Open-ended campaigns read "Since Thu 5 Nov". A bounded campaign keeps the calendar day. */
function DateMark({ campaign }: { campaign: CampaignWithOrg }) {
  if (!campaign.endsAt && !isCampaignUpcoming(campaign)) {
    return (
      <div className="absolute right-4 top-4 z-[1] max-w-[9.5rem] rounded-xl bg-ink-850 px-3 py-1.5 text-right leading-tight text-mist-100">
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist-500">Since</span>
        <span className="poster mt-0.5 block text-[15px] leading-none">{sinceDate(campaign.startsAt)}</span>
      </div>
    );
  }

  const when = campaignDate(campaign.startsAt);
  return (
    <div className="absolute right-4 top-4 z-[1] rounded-xl bg-ink-850 px-3 py-1.5 text-center leading-none text-mist-100">
      <span className="poster block text-2xl">{when.day}</span>
      <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist-500">
        {when.label}
      </span>
    </div>
  );
}

function Cover({ campaign, muted }: { campaign: CampaignWithOrg; muted: boolean }) {
  const fallback = fallbackCover(campaign.id);
  const [src, setSrc] = useState(campaign.coverUrl?.trim() || fallback);

  return (
    <img
      src={src}
      alt=""
      className={`absolute inset-0 h-full w-full object-cover ${muted ? "grayscale-[0.55]" : ""}`}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 light:border-ink-700">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-mist-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold leading-snug">{value}</p>
    </div>
  );
}

function AmbassadorDots({ count }: { count: number }) {
  if (count <= 0) return null;
  const shown = Math.min(3, count);
  const extra = count - shown;
  return (
    <span className="flex shrink-0" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={`size-7 rounded-full border-2 border-ink-850 ${DOT_COLORS[i % DOT_COLORS.length]} ${
            i > 0 ? "-ml-2" : ""
          }`}
        />
      ))}
      {extra > 0 ? (
        <span className="-ml-2 grid size-7 place-items-center rounded-full border-2 border-ink-850 bg-mist-300 text-[10px] font-bold text-ink-950">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

function campaignCount(n: number): string {
  return `${n} ${n === 1 ? "campaign" : "campaigns"}`;
}

/** "Thu 5 Nov" on the Nairobi calendar. */
function sinceDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: NAIROBI });
  const day = d.toLocaleDateString("en-GB", { day: "numeric", timeZone: NAIROBI });
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: NAIROBI });
  return `${weekday} ${day} ${month}`;
}

function campaignDate(iso: string): { day: string; label: string } {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: NAIROBI });
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: NAIROBI });
  const day = d.toLocaleDateString("en-GB", { day: "numeric", timeZone: NAIROBI });
  return { day, label: `${weekday} · ${month}` };
}

function fallbackCover(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  }
  return COVER_FALLBACKS[hash % COVER_FALLBACKS.length];
}

function businessInitials(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return initialsFrom(spaced);
}

function swapPhrase(text: string, pattern: RegExp, replacement: string): string {
  return text.replace(pattern, (match) => {
    const first = match.charAt(0);
    if (first && first !== first.toLowerCase() && first === first.toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

/**
 * Copy we render on this screen. Business text stays, except the phrases this
 * product does not use, and money amounts or payment brands we never show here.
 * Titles are the business's own words and are not passed through here.
 */
function publicCopy(text: string): string {
  const friendly = swapPhrase(
    swapPhrase(
      swapPhrase(text, /\bbring your friends\b/gi, "bring a new customer"),
      /\bbring a friend\b/gi,
      "bring a new customer"
    ),
    /\breferring friends\b/gi,
    "bringing a new customer"
  );
  return friendly
    .replace(/\b(?:KES|KSh)\s*[\d,]+(?:\.\d+)?/gi, "")
    .replace(/\b[\d,]+(?:\.\d+)?\s*(?:KES|KSh)\b/gi, "")
    .replace(/\b(?:M-?Pesa|Airtel Money|Safaricom)\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function targetFact(c: CampaignWithOrg): string | undefined {
  if (!c.goalTarget || c.goalTarget < 1) return undefined;
  const n = c.goalTarget.toLocaleString("en-GB");
  const unit = c.goalLabel ? publicCopy(c.goalLabel) : "";
  return unit ? `${n} ${unit}` : n;
}

function rewardFact(c: CampaignWithOrg): string | undefined {
  const note = c.rewardNote ? publicCopy(c.rewardNote) : "";
  if (note) return note;
  if (!c.rewardKind || c.rewardKind === "cash") return undefined;
  if (c.rewardKind === "discount" && c.rewardAmount != null && Number.isFinite(c.rewardAmount)) {
    return `${c.rewardAmount}% discount`;
  }
  return payoutKindLabel(c.rewardKind) || undefined;
}
