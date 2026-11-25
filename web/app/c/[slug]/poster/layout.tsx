import type { Metadata } from "next";

/**
 * The poster is a print view of the campaign page, so only the campaign page belongs in
 * search results.
 *
 * Metadata merges key by key, the deepest segment winning, so this sits on top of what
 * the campaign layout one level up returns:
 *  - `robots` here replaces any set above it;
 *  - `alternates` is given with no canonical, because otherwise the campaign's canonical
 *    is inherited and the page says both "leave me out" and "the real page is over
 *    there", which a search engine may settle either way;
 *  - title, description and the link preview are deliberately left to the campaign
 *    layout: the printed sheet's header carries the campaign's name, and a poster link
 *    sent on WhatsApp previews as the campaign.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function PosterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
