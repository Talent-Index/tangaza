"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CampaignContent, type Tier } from "@/components/campaign/CampaignContent";
import { CustomerShell } from "@/components/customer/Shell";
import { useToast } from "@/components/toast";
import { Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { useCampaign, useEngagementTypes, type CampaignWithOrg } from "@/lib/hooks";
import type { EngagementType } from "@/lib/types";

export interface CampaignPageClientProps {
  slug: string;
  /**
   * The share code from ?via=, present when this visit arrived through someone's
   * /s/<code> link. The server page reads it and passes it down: reading the query
   * string here with useSearchParams could push this whole tree to browser-only
   * rendering, and the campaign text has to be in the HTML the server sends.
   */
  via?: string;
  /**
   * What the server already loaded (app/c/[slug]/page.tsx). Each is shown on the first
   * render and then refreshed from the API as before; each is absent when the server
   * could not load it, and the browser fetches it instead.
   */
  initialCampaign?: CampaignWithOrg;
  initialEngagements?: EngagementType[];
  initialTiers?: Tier[];
}

/**
 * The interactive half of a campaign page: who is signed in, whether they have joined,
 * and joining.
 *
 * Readable signed out on purpose — this is the page a business posts to X or WhatsApp,
 * so a stranger should see what the campaign is, what counts, what it earns and how it
 * works before being asked for anything. Sign-in sits beside all that, not in front of it.
 */
export function CampaignPageClient(props: CampaignPageClientProps) {
  const account = useActiveAccount();

  return (
    <CustomerShell>
      <CampaignView {...props} address={account?.address} />
    </CustomerShell>
  );
}

function CampaignView({
  slug,
  via,
  address,
  initialCampaign,
  initialEngagements,
  initialTiers,
}: CampaignPageClientProps & { address?: string }) {
  const campaign = useCampaign(slug, address, initialCampaign);
  const orgId = campaign.data?.campaign.orgId;
  // The campaign's own business, not the app's default org — a FitTribe campaign
  // must list FitTribe's engagements, or "what counts" lies.
  const engagements = useEngagementTypes(orgId ? BigInt(orgId) : undefined, initialEngagements);
  const [tiers, setTiers] = useState<Tier[] | null>(initialTiers ?? null);

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  // The campaign on screen may have come from the server, or from a fetch made before
  // this person's account was known; neither says whether THEY have joined. Until the
  // answer for this account arrives the join button waits, so someone who is already
  // in is not invited to join again.
  const joinedKnown = !address || campaign.data?.checkedFor === address;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    // A refresh that fails keeps the rewards already on screen (the server's list);
    // with nothing on screen yet it falls back to "none published", as it always did.
    fetch(`/api/tiers?orgId=${orgId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { tiers?: Tier[] } | null) => {
        if (!cancelled) setTiers((have) => (j ? j.tiers ?? [] : have ?? []));
      })
      .catch(() => {
        if (!cancelled) setTiers((have) => have ?? []);
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

  // Only when there is nothing to show: a background refresh that fails on a weak
  // connection must not replace a campaign the visitor is already reading.
  if (campaign.error && !campaign.data) return <ErrorNote>{campaign.error}</ErrorNote>;

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
      checkingJoined={!joinedKnown && !campaign.error}
      address={address}
      engagements={engagements.data}
      engagementsLoading={engagements.loading}
      tiers={tiers}
      joining={joining}
      error={error ?? (!joinedKnown && campaign.error ? "Couldn't check whether you've joined. Reload to try again." : null)}
      onJoin={join}
    />
  );
}
