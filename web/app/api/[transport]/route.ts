import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  listAllActiveCampaigns,
  listDirectory,
  listEngagementTypes,
  listRewardTiers,
  listStandings,
} from "@/lib/store";

/**
 * The platform as Model Context Protocol tools, at /api/mcp.
 *
 * Deliberately read-only. Reads cost nothing and are public anyway; anything that
 * mints value — submitting, approving, redeeming — should cost a wallet signature,
 * not a tool call, because msg.sender is the platform's entire identity model. An
 * agent that wants to act holds a key and follows /agents.md; an agent that wants to
 * know things plugs this in and asks.
 *
 * Streamable HTTP only (no SSE), so it needs no Redis and runs on a plain Vercel
 * function. Point any MCP client at https://ubu-tangaza.vercel.app/api/mcp.
 */

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const handler = createMcpHandler(
  (server) => {
    const byOrg = z.object({ orgId: z.string().describe("On-chain org id, e.g. '1'") });

    server.registerTool(
      "list_campaigns",
      { description: "Every live campaign across every registered business, with org names, participant counts and shareable slugs." },
      async () => json(await listAllActiveCampaigns())
    );

    server.registerTool(
      "list_engagement_types",
      { description: "What a business rewards: each engagement's label, the proof it asks for, and its weight (how many on-chain activities one approval counts for; 20 activities = one KES 500 credit).", inputSchema: byOrg },
      async ({ orgId }) => json(await listEngagementTypes(orgId))
    );

    server.registerTool(
      "get_leaderboard",
      { description: "A business's advocates ranked by approved weight — the unit its rewards are priced in.", inputSchema: byOrg },
      async ({ orgId }) => json(await listStandings(orgId))
    );

    server.registerTool(
      "get_directory",
      { description: "The business's advocate directory: display names, X handles (claimed vs verified), pending counts, last activity.", inputSchema: byOrg },
      async ({ orgId }) => json(await listDirectory(orgId))
    );

    server.registerTool(
      "get_tiers",
      { description: "The reward levels a business offers and the approved weight each unlocks.", inputSchema: byOrg },
      async ({ orgId }) => json(await listRewardTiers(orgId))
    );
  },
  {
    serverInfo: { name: "ubu-tangaza", version: "1.0.0" },
  },
  {
    basePath: "/api",
    maxDuration: 30,
    disableSse: true,
  }
);

export { handler as GET, handler as POST };
