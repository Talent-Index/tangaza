import "server-only";
import { cache } from "react";
import { getCampaignBySlug, listEngagementTypes, listRewardTiers } from "./store";

/**
 * What the public campaign page (/c/<slug>) loads on the server, so the HTML a search
 * engine or a link preview receives already holds the campaign instead of a spinner.
 *
 * Each loader returns exactly what its API route returns to the browser hooks
 * (/api/campaigns?slug=, /api/engagement-types, /api/tiers), because the page hands the
 * result to those hooks as their starting value. Everything in it is plain JSON: dates
 * are ISO strings and ids are strings, so it crosses to a client component as is.
 */

/**
 * One campaign by its slug, or undefined when there is none.
 *
 * Wrapped in cache() because the layout's generateMetadata and the page both need it
 * during the same request: they share one query instead of each running their own.
 */
export const loadCampaign = cache((slug: string) => getCampaignBySlug(slug));

/** The business's active engagements, as GET /api/engagement-types?orgId= lists them. */
export function loadEngagementTypes(orgId: string) {
  return listEngagementTypes(orgId);
}

/** The business's reward ladder, as GET /api/tiers?orgId= lists it. */
export function loadRewardTiers(orgId: string) {
  return listRewardTiers(orgId);
}
