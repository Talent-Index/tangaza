/**
 * What the public site is allowed to show.
 *
 * A couple of placeholder rows were left in the production database (a feedback
 * entry that says "Test", and a game-demo campaign). This does not delete them.
 * It only keeps obvious placeholders off public pages. The business still sees
 * its own campaigns in the dashboard.
 */

export interface PublicChainTotals {
  businesses: number;
  approved: number;
  capKes: number;
  issuedKes: number;
  redeemedKes: number;
}

export interface PublicPilot {
  id: string;
  slug: string;
  title: string;
  orgName: string;
  blurb?: string;
  coverUrl?: string;
  rewards: string[];
  participants: number;
  approved: number;
}

export interface PublicStats {
  awaiting: number | null;
  chain: PublicChainTotals | null;
  contract: string;
  pilots: PublicPilot[];
  /** False when the campaign list could not be read, so the page must not say "0 campaigns". */
  pilotsKnown: boolean;
}

const PLACEHOLDER = /^(test|testing|demo|asdf|xxx|foo|bar|placeholder|lorem|lorem ipsum)$/i;

export function isObviouslyTestFeedback(entry: { name: string | null; message: string }): boolean {
  const name = (entry.name ?? "").trim();
  const message = entry.message.trim();
  if (!message) return false;
  if (PLACEHOLDER.test(message)) return true;
  if (name && PLACEHOLDER.test(name) && message.toLowerCase() === name.toLowerCase()) return true;
  return false;
}

export function isObviouslyTestCampaign(campaign: {
  title?: string | null;
  orgName?: string | null;
  blurb?: string | null;
  slug?: string | null;
}): boolean {
  const title = (campaign.title ?? "").trim();
  const org = (campaign.orgName ?? "").trim();
  const slug = (campaign.slug ?? "").trim().toLowerCase();
  if (PLACEHOLDER.test(title) || (org && PLACEHOLDER.test(org))) return true;
  const blob = `${title} ${campaign.blurb ?? ""}`.toLowerCase();
  if (blob.includes("how quick are you") || blob.includes("fastest time to finish a level")) return true;
  if (slug.startsWith("how-quick-are-you")) return true;
  if (org.toLowerCase() === "memorabilia" && /level|fastest time|quickest time/.test(blob)) return true;
  return false;
}
