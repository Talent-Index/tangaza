import type { Metadata } from "next";
import { CampaignsPageClient } from "@/components/customer/CampaignsPageClient";
import { loadDiscoverForPage } from "@/lib/discover";
import type { CampaignWithOrg } from "@/lib/hooks";
import { pageMetadata } from "@/lib/seo";

/**
 * The server half of /campaigns. What a visitor sees depends on whether they are signed
 * in, which only the browser knows, so the page itself is a client component
 * (components/customer/CampaignsPageClient.tsx). The metadata and the campaign list
 * that goes into the HTML are loaded here.
 */
export const metadata: Metadata = pageMetadata({
  title: "Live and previous campaigns",
  description:
    "Customer rewards campaigns running on Ubu-Tangaza right now, and earlier ones from our test pilot. Open a campaign to see what it asks for and what the reward is.",
  path: "/campaigns",
});

// Built ahead of time and served from the CDN; rebuilt in the background at most every
// 5 minutes. The browser still fetches the list itself after loading.
export const revalidate = 300;

export default async function CampaignsPage() {
  const { campaigns, renderedAt } = await loadDiscoverForPage("campaigns");
  return <CampaignsPageClient initialCampaigns={campaigns} renderedAt={renderedAt} />;
}
