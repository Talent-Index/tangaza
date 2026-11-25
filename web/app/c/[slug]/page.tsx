import { notFound } from "next/navigation";
import { CampaignPageClient } from "@/components/campaign/CampaignPageClient";
import { loadCampaign, loadEngagementTypes, loadRewardTiers } from "@/lib/campaign-server";

/**
 * A campaign, reached by its shared link.
 *
 * Loaded here on the server so the HTML itself carries the campaign: its name, what it
 * is about, the cover, what counts and what it earns. A search engine or a link preview
 * reads that HTML and never runs the browser fetches this page used to depend on. The
 * signed-in parts (joining, the joined state) stay in CampaignPageClient, which starts
 * from this data and refreshes it.
 *
 * No loading.tsx above this route, and nothing here is wrapped in Suspense, on purpose:
 * the "does it exist" check has to finish before any of the response is sent, or an
 * unknown link could no longer answer with a real 404 status.
 */
export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  // Present when this visit arrived through someone's /s/<code> link — the join
  // carries it so the sharer gets the credit. First value wins if it is repeated.
  const rawVia = (await searchParams).via;
  const via = Array.isArray(rawVia) ? rawVia[0] : rawVia;

  let campaign: Awaited<ReturnType<typeof loadCampaign>>;
  let loaded = false;
  try {
    campaign = await loadCampaign(slug);
    loaded = true;
  } catch (err) {
    // The database did not answer. That says nothing about whether the campaign
    // exists, so no 404: send the page without data and let the browser load it
    // through the API, as this page did before it was rendered on the server.
    console.warn("[campaign page] could not load on the server, the browser will fetch it:", err);
  }

  // Outside the try: notFound() works by throwing, and the catch above would swallow it.
  if (loaded && !campaign) notFound();

  // What counts and what it earns belong to the campaign's business. If either fails
  // it is simply left out and the browser fetches that one part.
  const [engagements, tiers] = campaign
    ? await Promise.all([
        loadEngagementTypes(campaign.orgId).catch(() => undefined),
        loadRewardTiers(campaign.orgId).catch(() => undefined),
      ])
    : [undefined, undefined];

  return (
    // Keyed by slug so moving from one campaign to another starts from that campaign's
    // data rather than keeping the previous one's state.
    <CampaignPageClient
      key={slug}
      slug={slug}
      via={via}
      initialCampaign={campaign}
      initialEngagements={engagements}
      initialTiers={tiers}
    />
  );
}
