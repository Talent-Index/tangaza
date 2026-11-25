import type { Metadata } from "next";

/**
 * One place for what every page tells search engines and link previews.
 *
 * Two rules of Next's metadata merging make a shared helper necessary:
 *  - a page's `openGraph` REPLACES the root layout's whole object (site name, locale
 *    and the share image are not inherited field by field), and
 *  - a canonical set in the root layout is inherited by every page, pointing them all
 *    at one URL.
 * So each public page calls pageMetadata() with its own path, and gets a complete,
 * self-referencing set.
 */
export const SITE_URL = "https://www.ubutangaza.biz";
export const SITE_NAME = "Ubu-Tangaza";
/** The one-word spelling people type, and the domain. Shown beside the brand so a search for it matches. */
export const SITE_NAME_ONE_WORD = "Ubutangaza";
export const SITE_TAGLINE = "Referral rewards for small businesses in Kenya";
export const SITE_DESCRIPTION =
  "Ubu-Tangaza (Ubutangaza) helps small businesses in Kenya run referral and customer rewards campaigns. Customers bring you new customers, send proof, and you approve the reward.";

/** The business's X account; the root layout and every page card name it. */
export const X_HANDLE = "@ubutangaza";
export const X_PROFILE = `https://x.com/${X_HANDLE.slice(1)}`;

/** The default share card: 1200x630, in public/ so its URL never changes. */
export const SHARE_IMAGE = {
  url: "/og/ubu-tangaza.png",
  width: 1200,
  height: 630,
  alt: "Ubu-Tangaza: referral rewards for small businesses in Kenya",
} as const;

interface PageMeta {
  /** Without the brand: the root layout's template adds " | Ubu-Tangaza". */
  title: string;
  description: string;
  /** Path on the site, starting with "/". Becomes the canonical URL and og:url. */
  path: string;
  /** A page-specific share image; the site card is used when absent. */
  image?: { url: string; width?: number; height?: number; alt?: string };
  /** Keep the page out of search results (sign-in walls, tools, print views). */
  noindex?: boolean;
  /** Use the title exactly as given, skipping the " | Ubu-Tangaza" template. */
  absoluteTitle?: boolean;
}

export function pageMetadata(p: PageMeta): Metadata {
  const image = p.image ?? SHARE_IMAGE;
  const socialTitle = p.absoluteTitle ? p.title : `${p.title} | ${SITE_NAME}`;
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: p.path },
    ...(p.noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: "en_KE",
      url: p.path,
      title: socialTitle,
      description: p.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: X_HANDLE,
      title: socialTitle,
      description: p.description,
      images: [image.url],
    },
  };
}

/** For screens that must not be indexed and have nothing worth previewing. */
export function privateMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
