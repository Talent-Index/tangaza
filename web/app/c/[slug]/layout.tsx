import type { Metadata } from "next";
import { getCampaignBySlug } from "@/lib/store";

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
    const c = await getCampaignBySlug(slug);
    if (!c) return {};
    // Many campaigns are named after the business itself; don't say it twice.
    const title =
      c.title.trim().toLowerCase() === c.orgName.trim().toLowerCase()
        ? c.title
        : `${c.title} · ${c.orgName}`;
    const description =
      c.blurb?.trim() ||
      `Take part in ${c.title} from ${c.orgName}, share your activity, and get rewarded once the business approves it.`;
    return {
      title: `${title} | Ubu-Tangaza`,
      description,
      openGraph: {
        title,
        description,
        siteName: "Ubu-Tangaza",
        type: "website",
        ...(c.coverUrl ? { images: [{ url: c.coverUrl }] } : {}),
      },
      twitter: {
        card: c.coverUrl ? "summary_large_image" : "summary",
        title,
        description,
        ...(c.coverUrl ? { images: [c.coverUrl] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
