import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { listAllCampaignsDiscover } from "@/lib/store";

/**
 * /sitemap.xml: every page a search engine should know about.
 *
 * Built on each request rather than once at deploy (the default for this file), so a
 * campaign a business starts today is listed today. Timed revalidation would not do
 * that here: a cached copy is only refreshed after somebody asks for it, and a sitemap
 * is asked for so rarely that crawlers would keep being handed the previous one.
 */
export const dynamic = "force-dynamic";

// Pages anyone can open without signing in. Sign-in walls and business tools are left
// out; they carry a noindex tag.
const STATIC_PATHS = ["/", "/pricing", "/book", "/campaigns", "/register", "/feedback", "/privacy", "/terms"];

const abs = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

// No lastModified, priority or changeFrequency: nothing records when a campaign was last
// edited, and a guessed date is worse than none (Google stops trusting dates that turn
// out wrong, and ignores the other two).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: abs(path) }));

  try {
    // Database rows only. The testnet pilot's read-only pages (/testnet/<slug>) are left
    // out on purpose and carry a noindex tag: they are history for visitors, and thin
    // pages about a test run should not be what a search for the brand turns up.
    const campaigns = await listAllCampaignsDiscover();
    for (const c of campaigns) {
      if (c.slug) entries.push({ url: abs(`/c/${encodeURIComponent(c.slug)}`) });
    }
  } catch (err) {
    // A database problem must not take the whole sitemap down with it.
    console.error("[sitemap] could not list campaigns", err);
  }

  return entries;
}
