import "server-only";

/**
 * Server side of the outreach console: reads the Notion "Business Outreach Tracker" and
 * asks the outside world to start a workflow run.
 *
 * The workflow itself (.claude/workflows/business-outreach.js) runs in Claude Code, not
 * here. Notion is the shared state: the workflow writes rows, this app reads them. The
 * "Run" button does not execute anything — it POSTs to OUTREACH_RUN_URL (a routine's API
 * trigger) with a bearer token that never leaves the server.
 *
 * Nothing here is NEXT_PUBLIC_: the Notion key and the run token are server-only.
 */

const NOTION_KEY = process.env.NOTION_API_KEY?.trim();
const DB_ID = (process.env.OUTREACH_NOTION_DB_ID ?? "13f5368dc21045c6b89b50fdd89c06b8").replace(/-/g, "").trim();
const RUN_URL = process.env.OUTREACH_RUN_URL?.trim();
const RUN_TOKEN = process.env.OUTREACH_RUN_TOKEN?.trim();

export const outreachNotionConfigured = Boolean(NOTION_KEY);
export const outreachRunConfigured = Boolean(RUN_URL && RUN_TOKEN);
export const OUTREACH_NOTION_URL = `https://www.notion.so/${DB_ID}`;

export interface OutreachRow {
  id: string;
  url: string;
  business: string;
  status: string;
  kind: string;
  source: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  campaigns: string;
  confidence: string;
  nextAction: string;
  lastReply: string;
  followUps: number;
  firstDrafted: string;
  lastChecked: string;
  searchQuery: string;
}

type Prop = Record<string, unknown> | undefined;

const text = (p: Prop): string => {
  const arr = (p?.title ?? p?.rich_text) as { plain_text?: string }[] | undefined;
  return Array.isArray(arr) ? arr.map((t) => t.plain_text ?? "").join("") : "";
};
const select = (p: Prop): string => ((p?.select as { name?: string } | null)?.name ?? "");
const plain = (p: Prop, key: string): string => {
  const v = p?.[key];
  return typeof v === "string" ? v : "";
};
const date = (p: Prop): string => ((p?.date as { start?: string } | null)?.start ?? "");

function toRow(page: Record<string, unknown>): OutreachRow {
  const props = (page.properties ?? {}) as Record<string, Prop>;
  return {
    id: String(page.id),
    url: String(page.url ?? ""),
    business: text(props["Business"]),
    status: select(props["Status"]),
    kind: select(props["Kind"]),
    source: select(props["Source"]),
    email: plain(props["Email"], "email"),
    phone: plain(props["Phone"], "phone_number"),
    website: plain(props["Website"], "url"),
    location: text(props["Location"]),
    campaigns: text(props["Campaigns"]),
    confidence: select(props["Research confidence"]),
    nextAction: text(props["Next action"]),
    lastReply: text(props["Last reply"]),
    followUps: Number((props["Follow-ups"] as { number?: number } | undefined)?.number ?? 0),
    firstDrafted: date(props["First drafted"]),
    lastChecked: date(props["Last checked"]),
    searchQuery: text(props["Search query"]),
  };
}

/** Every row of the tracker, newest edits first. Capped at 500 rows. */
export async function listOutreach(): Promise<OutreachRow[]> {
  if (!NOTION_KEY) return [];
  const rows: OutreachRow[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      // 404 almost always means the database was not shared with the integration.
      throw new Error(
        res.status === 404
          ? "Notion could not find the tracker. Share the database with your integration (… → Connections)."
          : `Notion returned ${res.status}`
      );
    }
    const json = (await res.json()) as { results: Record<string, unknown>[]; has_more: boolean; next_cursor: string | null };
    rows.push(...json.results.map(toRow));
    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
  }
  return rows;
}

export interface RunParams {
  mode: "full" | "outreach" | "replies";
  maxNew: number;
  search?: { queries: string[]; location: string; country: string; perQuery: number };
}

/** In-process guard so a double click or a replayed request cannot start two runs at once. */
let lastRunAt = 0;
const RUN_COOLDOWN_MS = 60_000;

export async function startOutreachRun(
  params: RunParams
): Promise<{ ok: true } | { ok: false; reason: string; status?: number }> {
  if (!RUN_URL || !RUN_TOKEN) return { ok: false, reason: "Run trigger is not configured", status: 503 };
  const now = Date.now();
  if (now - lastRunAt < RUN_COOLDOWN_MS) {
    return { ok: false, reason: "A run was just started — give it a minute", status: 429 };
  }
  lastRunAt = now;

  const prompt =
    "Run the business-outreach workflow with these args (drafts only, never send email): " +
    JSON.stringify(params);
  try {
    const res = await fetch(RUN_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${RUN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, params }),
      cache: "no-store",
    });
    if (!res.ok) {
      lastRunAt = 0;
      return { ok: false, reason: `The run trigger answered ${res.status}`, status: 502 };
    }
    return { ok: true };
  } catch {
    lastRunAt = 0;
    return { ok: false, reason: "Could not reach the run trigger", status: 502 };
  }
}
