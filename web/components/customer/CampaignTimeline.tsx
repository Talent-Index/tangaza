"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { isCampaignLive, isCampaignPast, isCampaignUpcoming } from "@/lib/campaigns";
import type { CampaignWithOrg } from "@/lib/hooks";
import { initialsFrom } from "@/lib/identity";
import { payoutKindLabel } from "@/lib/types";
import { Spinner } from "@/components/ui";

type Tab = "upcoming" | "past";

/** Campaign clocks are shown on Kenyan time — the same clock the businesses run on. */
const NAIROBI = "Africa/Nairobi";

const COVER_FALLBACKS = [
  "/images/landing/hero-campaign.webp",
  "/images/landing/usecase-cafe.webp",
  "/images/landing/usecase-boutique.webp",
  "/images/landing/usecase-salon.webp",
] as const;

const DOT_COLORS = ["bg-gold", "bg-jade-400", "bg-crimson-300"] as const;

export function CampaignTimeline({
  campaigns,
  loading,
}: {
  campaigns: CampaignWithOrg[] | undefined;
  loading: boolean;
}) {
  const [tab, setTab] = useState<Tab>("upcoming");

  const { liveNow, businesses, filtered } = useMemo(() => {
    const list = campaigns ?? [];
    const live = list.filter(isCampaignLive);
    const shown =
      tab === "upcoming"
        ? list
            .filter(isCampaignUpcoming)
            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        : list
            .filter(isCampaignPast)
            .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return {
      liveNow: live.length,
      businesses: new Set(live.map((c) => c.orgId)).size,
      filtered: shown,
    };
  }, [campaigns, tab]);

  if (loading && !campaigns) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const heading = sectionHeading(tab, filtered);

  return (
    <div className="animate-rise">
      <Hero liveNow={liveNow} businesses={businesses} />

      <div className="mt-6 sm:mt-8">
        <div
          className="flex w-full rounded-full border border-ink-600 bg-ink-850 p-1 light:border-ink-700 sm:inline-flex sm:w-auto"
          role="tablist"
          aria-label="Campaign timeframe"
        >
          <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")}>
            Upcoming
          </TabButton>
          <TabButton active={tab === "past"} onClick={() => setTab("past")}>
            Past
          </TabButton>
        </div>
      </div>

      {filtered.length > 0 ? (
        <section className="mt-8 sm:mt-9">
          <div className="mb-[18px] flex items-center gap-3.5">
            <h2 className="poster text-[1.625rem] sm:text-[1.875rem]">{heading}</h2>
            <span className="h-px flex-1 bg-ink-600 light:bg-ink-700" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist-500">
              {campaignCount(filtered.length)}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 md:gap-6">
            {filtered.map((c) => (
              <CampaignCard key={c.id} campaign={c} tab={tab} />
            ))}
            {filtered.length % 2 === 1 ? <MoreCampaignsTile /> : null}
          </div>
        </section>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2">
          <MoreCampaignsTile />
        </div>
      )}

      <p className="pt-12 text-[13px] text-mist-500">Ubu-Tangaza · ubutangaza.biz</p>
    </div>
  );
}

function Hero({ liveNow, businesses }: { liveNow: number; businesses: number }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-ink-600 bg-ink-800 light:border-ink-700 sm:min-h-[250px]">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-45 sm:w-[58%] sm:opacity-100">
        <Image
          src="/images/landing/phone-constellation.png"
          alt=""
          fill
          priority
          sizes="(min-width: 640px) 58vw, 100vw"
          className="object-cover object-[center_45%]"
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-ink-800)_25%,transparent),var(--color-ink-800)_92%)] sm:bg-[linear-gradient(90deg,var(--color-ink-800)_0%,color-mix(in_srgb,var(--color-ink-800)_95%,transparent)_42%,color-mix(in_srgb,var(--color-ink-800)_30%,transparent)_70%,transparent_100%)]"
      />

      <div className="relative z-10 px-[22px] pb-1 pt-[30px] sm:px-12 sm:pb-11 sm:pt-11">
        <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-text">
          <span className="h-px w-7 bg-gold" aria-hidden />
          For Ambassadors
        </p>
        <h1 className="poster mt-3.5 text-[3.625rem] sm:text-[5.75rem]">Campaigns</h1>
        <p className="mt-3 max-w-[470px] text-[15px] leading-relaxed text-mist-300 sm:text-[17px]">
          Browse what businesses are running. Join a live campaign, bring a new customer, and the
          business decides your reward.
        </p>
      </div>

      <div className="relative z-10 flex gap-2.5 px-[22px] pb-[22px] pt-4 sm:px-12 sm:pb-8 lg:absolute lg:bottom-[34px] lg:right-10 lg:px-0 lg:pb-0 lg:pt-0">
        <Stat label="Live now" value={liveNow} />
        <Stat label="Businesses" value={businesses} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 flex-1 rounded-[14px] border border-ink-600 bg-ink-850 px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] light:border-ink-700 light:shadow-[0_18px_40px_rgba(90,60,20,0.12)] sm:min-w-[130px] sm:flex-none sm:px-4 sm:py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-mist-500">{label}</p>
      <p className="poster text-[1.5rem] leading-tight sm:text-[1.875rem]">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-full px-5 py-2.5 text-center text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:flex-none sm:px-[22px] ${
        active ? "bg-mist-100 text-ink-950" : "text-mist-500 hover:text-mist-100"
      }`}
    >
      {children}
    </button>
  );
}

function CampaignCard({ campaign: c, tab }: { campaign: CampaignWithOrg; tab: Tab }) {
  const live = isCampaignLive(c);
  const ended = tab === "past" || !c.active;
  const when = campaignDate(c.startsAt);
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
              Live · {campaignClock(c.startsAt)}
            </span>
          ) : ended ? (
            <span className="inline-flex rounded-full bg-[rgba(19,16,8,0.75)] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#cfc4ae]">
              Ended
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-[rgba(19,16,8,0.75)] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
              Upcoming · {campaignClock(c.startsAt)}
            </span>
          )}
        </div>
        <div className="absolute right-4 top-4 z-[1] rounded-xl bg-ink-850 px-3 py-1.5 text-center leading-none text-mist-100">
          <span className="poster block text-2xl">{when.day}</span>
          <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist-500">
            {when.label}
          </span>
        </div>
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
                    {c.participantCount === 1
                      ? "1 Ambassador"
                      : `${c.participantCount} Ambassadors`}
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

function MoreCampaignsTile() {
  return (
    <div className="flex flex-col justify-center rounded-[20px] border border-dashed border-ink-600 px-7 py-10 text-mist-500 light:border-ink-700 sm:px-10">
      <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-text">
        <span className="h-px w-7 bg-gold" aria-hidden />
        Coming up
      </p>
      <h3 className="poster mt-3.5 text-[1.875rem] leading-none text-mist-100">
        More campaigns on the way
      </h3>
      <p className="mt-2.5 max-w-[380px] text-base leading-relaxed">
        When a business you follow starts a new campaign, it shows up here. You&apos;ll see the
        target and the reward before you join.
      </p>
    </div>
  );
}

function sectionHeading(tab: Tab, items: CampaignWithOrg[]): string {
  if (tab === "past") return "Past";
  const live = items.filter(isCampaignLive).length;
  if (live > 0 && live === items.length) return "Live now";
  if (live === 0) return "Coming up";
  return "Upcoming";
}

function campaignCount(n: number): string {
  return `${n} ${n === 1 ? "campaign" : "campaigns"}`;
}

function campaignClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: NAIROBI,
  });
}

function campaignDate(iso: string): { day: string; label: string } {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: NAIROBI });
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: NAIROBI });
  const day = d.toLocaleDateString("en-GB", { day: "numeric", timeZone: NAIROBI });
  return { day, label: `${weekday} · ${month}` };
}

/** Same photo every time for a campaign that has no cover of its own. */
function fallbackCover(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  }
  return COVER_FALLBACKS[hash % COVER_FALLBACKS.length];
}

/** "FitTribe" → "FT", "Nancy Bakes" → "NB". */
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
