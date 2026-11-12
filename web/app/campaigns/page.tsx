"use client";

import { useMemo } from "react";
import { CampaignTimeline } from "@/components/customer/CampaignTimeline";
import { CustomerShell } from "@/components/customer/Shell";
import { SessionRestoreScreen } from "@/components/customer/SessionRestore";
import { LandingPage } from "@/components/landing/LandingPage";
import { useDiscoverCampaigns, useJoinedCampaigns } from "@/lib/hooks";
import { useAdvocateSession } from "@/lib/session";

export default function CampaignsPage() {
  const { account, isRestoring } = useAdvocateSession();
  const campaigns = useDiscoverCampaigns();
  const joined = useJoinedCampaigns(account?.address);
  const leadIds = useMemo(
    () => new Set((joined.data ?? []).map((c) => c.id)),
    [joined.data]
  );

  if (isRestoring) return <SessionRestoreScreen />;
  if (!account) return <LandingPage />;

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
