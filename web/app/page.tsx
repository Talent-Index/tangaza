import type { Metadata } from "next";
import { HomeClient } from "@/components/home/HomeClient";
import { loadDiscoverForPage } from "@/lib/discover";
import { allGuides } from "@/lib/guides";
import type { CampaignWithOrg } from "@/lib/hooks";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, pageMetadata } from "@/lib/seo";

/**
 * The server half of the home page. The page itself is a client component
 * (components/home/HomeClient.tsx) because it depends on who is signed in, and a client
 * component cannot export metadata, so the title, canonical link and share card live
 * here.
 */
export const metadata: Metadata = pageMetadata({
  // "Ubu-Tangaza | Referral rewards for small businesses in Kenya"
  title: `${SITE_NAME} | ${SITE_TAGLINE}`,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
});

// Built ahead of time and served from the CDN like before; rebuilt in the background at
// most every 5 minutes so the campaign cards in the HTML stay close to the truth. The
// browser still fetches the list itself after loading, so nobody acts on old data.
export const revalidate = 300;

export default async function Page() {
  const { campaigns, renderedAt } = await loadDiscoverForPage("home");
  // Only the card text crosses to the browser, not the guides themselves.
  const guides = allGuides()
    .slice(0, 3)
    .map(({ slug, title, summary }) => ({ slug, title, summary }));
  return <HomeClient initialCampaigns={campaigns} renderedAt={renderedAt} guides={guides} />;
}
