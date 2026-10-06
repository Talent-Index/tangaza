"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CampaignContent, type Tier } from "@/components/campaign/CampaignContent";
import { CustomerShell } from "@/components/customer/Shell";
import { useToast } from "@/components/toast";
import { Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { useCampaign, useEngagementTypes } from "@/lib/hooks";

/**
 * A campaign, reached by its shared link.
 *
 * Readable signed out on purpose — this is the page a business posts to X or WhatsApp,
 * so a stranger should see what the campaign is, what counts, what it earns and how it
 * works before being asked for anything. Sign-in sits beside all that, not in front of it.
 */
export default function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const account = useActiveAccount();

  return (
    <CustomerShell>
      <Suspense fallback={null}>
        <CampaignView slug={slug} address={account?.address} />
      </Suspense>
    </CustomerShell>
  );
}

function CampaignView({ slug, address }: { slug: string; address?: string }) {
  // Present when this visit arrived through someone's /s/<code> link — the join
  // carries it so the sharer gets the credit.
  const via = useSearchParams().get("via");
  const campaign = useCampaign(slug, address);
  const orgId = campaign.data?.campaign.orgId;
  // The campaign's own business, not the app's default org — a FitTribe campaign
  // must list FitTribe's engagements, or "what counts" lies.
  const engagements = useEngagementTypes(orgId ? BigInt(orgId) : undefined);
  const [tiers, setTiers] = useState<Tier[] | null>(null);

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    fetch(`/api/tiers?orgId=${orgId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { tiers?: Tier[] } | null) => {
        if (!cancelled) setTiers(j?.tiers ?? []);
      })
      .catch(() => {
        if (!cancelled) setTiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (campaign.loading && !campaign.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (campaign.error) return <ErrorNote>{campaign.error}</ErrorNote>;

  if (!campaign.data) {
    return (
      <EmptyState
        icon="🔍"
        title="No such campaign"
        body="That link may have expired, or the business may have closed it."
        action={<Button href="/">Go home</Button>}
      />
    );
  }

  async function join() {
    if (!address) return;
    setError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, address, via: via ?? undefined }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not join");
      success("You're in the campaign");
      campaign.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not join";
      setError(msg);
      toastError(msg);
    } finally {
      setJoining(false);
    }
  }

  return (
    <CampaignContent
      slug={slug}
      campaign={campaign.data.campaign}
      joined={campaign.data.joined}
      address={address}
      engagements={engagements.data}
      engagementsLoading={engagements.loading}
      tiers={tiers}
      joining={joining}
      error={error}
      onJoin={join}
    />
  );
}
