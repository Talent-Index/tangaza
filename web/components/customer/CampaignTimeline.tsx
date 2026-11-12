"use client";

import Image from "next/image";
import { useMemo } from "react";
import { CampaignGroups } from "@/components/customer/CampaignGroups";
import { isCampaignLive } from "@/lib/campaigns";
import type { CampaignWithOrg } from "@/lib/hooks";

export function CampaignTimeline({
  campaigns,
  loading,
  error,
  leadIds,
}: {
  campaigns: CampaignWithOrg[] | undefined;
  loading: boolean;
  error?: string | null;
  /** Joined campaigns are listed first inside each group. */
  leadIds?: ReadonlySet<string>;
}) {
  const { liveNow, businesses } = useMemo(() => {
    const list = campaigns ?? [];
    const live = list.filter(isCampaignLive);
    return {
      liveNow: live.length,
      businesses: new Set(live.map((c) => c.orgId)).size,
    };
  }, [campaigns]);

  if (loading && !campaigns) {
    return (
      <CampaignGroups
        campaigns={undefined}
        loading
        previousEmpty=""
      />
    );
  }

  return (
    <div className="animate-rise">
      <Hero liveNow={liveNow} businesses={businesses} />

      <div className="mt-8 sm:mt-9">
        <CampaignGroups
          campaigns={campaigns}
          loading={false}
          error={error}
          leadIds={leadIds}
          previousEmpty="Closed campaigns and campaigns past their end date show up here, including ones you joined."
        />
      </div>

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
