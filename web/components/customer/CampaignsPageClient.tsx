"use client";

import { useMemo } from "react";
import { CampaignGroups } from "@/components/customer/CampaignGroups";
import { CampaignTimeline } from "@/components/customer/CampaignTimeline";
import { CustomerShell } from "@/components/customer/Shell";
import { SessionRestoreScreen } from "@/components/customer/SessionRestore";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { useDiscoverCampaigns, useJoinedCampaigns, type CampaignWithOrg } from "@/lib/hooks";
import { useAdvocateSession } from "@/lib/session";

type Discover = ReturnType<typeof useDiscoverCampaigns>;

/**
 * /campaigns. A signed-in person gets their campaign list inside the app shell; anyone
 * else gets a public page listing the same campaigns.
 *
 * `initialCampaigns` is the list the server loaded for this render, so the public
 * page's HTML already holds the campaign cards and their links.
 *
 * The session is only ever restored in the browser, after the first render: on the
 * server, and on the browser's first pass over the server's HTML, nobody is signed in
 * and nothing is restoring. So both produce the public page, and the spinner or the
 * signed-in view only come in afterwards.
 */
export function CampaignsPageClient({
  initialCampaigns,
  renderedAt,
}: {
  initialCampaigns?: CampaignWithOrg[];
  /** When the server built this HTML; the campaign cards sort by it on first render. */
  renderedAt?: number;
}) {
  const { account, isRestoring } = useAdvocateSession();
  const campaigns = useDiscoverCampaigns(initialCampaigns);
  const joined = useJoinedCampaigns(account?.address);
  const leadIds = useMemo(
    () => new Set((joined.data ?? []).map((c) => c.id)),
    [joined.data]
  );

  if (isRestoring) return <SessionRestoreScreen />;
  if (!account) return <PublicCampaigns campaigns={campaigns} renderedAt={renderedAt} />;

  return (
    <CustomerShell>
      <CampaignTimeline
        campaigns={campaigns.data ?? undefined}
        loading={campaigns.loading}
        error={campaigns.error}
        leadIds={leadIds}
      />
    </CustomerShell>
  );
}

/** What a visitor who is not signed in sees: the site's own header and footer around the list. */
function PublicCampaigns({ campaigns, renderedAt }: { campaigns: Discover; renderedAt?: number }) {
  return (
    <div className="min-h-dvh bg-ink-950 text-mist-100">
      <SiteHeader />
      <main className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">
          <span className="h-px w-8 bg-gold" /> Live and previous
        </p>
        <h1 className="poster mt-4 text-[clamp(2.8rem,7vw,5.25rem)]">Campaigns</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-mist-500">
          Campaigns running on Ubu-Tangaza now, and earlier ones from our test pilot. Open one
          to see what it asks for and what the reward is.
        </p>

        <div className="mt-9">
          <CampaignGroups
            campaigns={campaigns.data ?? undefined}
            loading={campaigns.loading}
            error={campaigns.error}
            renderedAt={renderedAt}
            previousEmpty="When a business closes a campaign, or its end date passes, it stays here. You can still open it and see what the reward was."
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
