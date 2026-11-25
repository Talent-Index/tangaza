import type { Metadata } from "next";
import { loadCampaign } from "@/lib/campaign-server";
import { goalSentence } from "@/lib/campaigns";
import { pageMetadata } from "@/lib/seo";

/**
 * The link preview IS the first thing a stranger sees of a campaign — a business posts
 * this URL on X or WhatsApp. So the card shows the campaign, not the generic site.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    // Shared with the page through cache(): one query per request, not two.
    const c = await loadCampaign(slug);
    // No such campaign: the page answers with a 404. Name it here too, or the browser
    // swaps the tab title back to the site's default once the page's scripts run.
    if (!c) return { title: "Page not found", robots: { index: false, follow: false } };
    // Many campaigns are named after the business itself; don't say it twice.
    const title =
      c.title.trim().toLowerCase() === c.orgName.trim().toLowerCase()
        ? c.title
        : `${c.title} · ${c.orgName}`;
    const goal = goalSentence(c, c.orgName);
    const description =
      c.blurb?.trim() ||
      (goal ? `${goal}. Take part, share what you did, and get rewarded once the business approves it.` : "") ||
      `Take part in ${c.title} from ${c.orgName}, share your activity, and get rewarded once the business approves it.`;
    return pageMetadata({
      // No brand here: the root layout's title template adds it.
      title,
      description,
      path: `/c/${c.slug}`,
      // The campaign's own cover when it has one; the site card otherwise.
      ...(c.coverUrl ? { image: { url: c.coverUrl, alt: `${c.title}, ${c.orgName}` } } : {}),
    });
  } catch {
    return {};
  }
}

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
