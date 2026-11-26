import { guide as salon } from "./get-more-salon-barbershop-customers-kenya";
import { guide as newShop } from "./promote-new-shop-opening-kenya";
import { guide as rewardIdeas } from "./referral-reward-ideas-kenya";
import { guide as startProgram } from "./start-referral-program-small-business-kenya";
import type { Guide } from "./types";
import { guide as whatsappMessages } from "./whatsapp-referral-message-templates";

/**
 * Every guide on the site, in the order /guides lists them. A guide exists once it is
 * in this list: the page, the sitemap entry and the "read next" links all come from here.
 */
const GUIDES: Guide[] = [startProgram, whatsappMessages, salon, rewardIdeas, newShop];

export function allGuides(): Guide[] {
  return GUIDES;
}

export function guideSlugs(): string[] {
  return GUIDES.map((g) => g.slug);
}

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** The guides a guide points to, skipping any slug that is not (or no longer) published. */
export function relatedGuides(guide: Guide): Guide[] {
  return guide.related.flatMap((slug) => {
    const g = slug === guide.slug ? undefined : getGuide(slug);
    return g ? [g] : [];
  });
}
