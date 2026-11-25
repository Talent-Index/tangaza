import "server-only";
import type { CampaignWithOrg } from "./hooks";
import { IS_MAINNET } from "./rpc";
import { listAllCampaignsDiscover } from "./store";
import { testnetCampaigns } from "./testnet-archive";

/**
 * Every campaign the public lists show: live, not-yet-started, and previous (closed or
 * ended). The client splits them.
 *
 * GET /api/campaigns?discover=true and the server-rendered home and /campaigns pages
 * both call this, so the list in the page's HTML and the one the browser fetches a
 * moment later cannot drift apart.
 *
 * On mainnet the Fuji pilot's campaigns ride along as closed testnet records; on Fuji
 * they are already real rows, so adding them there would list them twice.
 *
 * It throws when the database cannot be reached. The pages catch that and render
 * without a starting list; the API lets it surface as an error, as before.
 */
export async function loadDiscoverCampaigns(): Promise<CampaignWithOrg[]> {
  const campaigns = await listAllCampaignsDiscover();
  return IS_MAINNET ? [...campaigns, ...testnetCampaigns()] : campaigns;
}

/**
 * The list for a page that is built ahead of time and rebuilt in the background
 * (the home page and /campaigns), plus the time it was built.
 *
 * During the build the database may not be reachable, and that must not fail the
 * build: the page goes out without a starting list and the browser loads it. Once the
 * site is running, an error is rethrown instead, because a failed background rebuild
 * makes Next keep serving the last good page; swallowing it would replace that page
 * with one that has no campaign cards. Outside production (local work without a
 * database) it is swallowed too.
 */
export async function loadDiscoverForPage(
  label: string
): Promise<{ campaigns: CampaignWithOrg[] | undefined; renderedAt: number }> {
  const renderedAt = Date.now();
  try {
    return { campaigns: await loadDiscoverCampaigns(), renderedAt };
  } catch (err) {
    const building = process.env.NEXT_PHASE === "phase-production-build";
    if (!building && process.env.NODE_ENV === "production") throw err;
    console.warn(
      `[ubu-tangaza] ${label}: campaigns not loaded on the server:`,
      err instanceof Error ? err.message : err
    );
    return { campaigns: undefined, renderedAt };
  }
}
