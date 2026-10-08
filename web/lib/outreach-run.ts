import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LLM_KEY_HINT, LlmError, llmProvider, researchNotes, writeDraft } from "./outreach-llm";
import { OUTREACH_DB_ID, listOutreach, notionHeaders, outreachNotionConfigured } from "./outreach";

/**
 * The outreach run, executed by the app itself: SerpApi finds businesses, a model (Claude
 * or Gemini, see lib/outreach-llm.ts) researches each one and writes a goal-led message,
 * and the result lands as a row in
 * the Notion tracker. No Claude routine and no Gmail: the draft is stored on the row, and
 * the console offers it as a mail-app link. Nothing is ever sent.
 *
 * A serverless function cannot hold a whole run, so it is split in two: `planRun` (one
 * SerpApi pass, deduped against the tracker) hands back a signed ticket plus the
 * candidates, and the console then calls `processCandidate` once per business. The ticket
 * is how those later calls prove the owner started the run without a wallet prompt each
 * time; it is an HMAC the server can verify and the browser cannot forge.
 *
 * All keys are server-only environment variables.
 */

const SERPAPI_KEY = process.env.SERPAPI_API_KEY?.trim();
export function inAppRunStatus(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!SERPAPI_KEY) missing.push("SERPAPI_API_KEY");
  if (!llmProvider) missing.push(LLM_KEY_HINT);
  if (!outreachNotionConfigured) missing.push("NOTION_API_KEY");
  return { ready: missing.length === 0, missing };
}

export interface Candidate {
  id: string;
  business: string;
  location: string;
  phone: string;
  website: string;
  query: string;
}

export interface SearchParams {
  queries: string[];
  location: string;
  country: string;
  perQuery: number;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/* ------------------------------------------------------------------ search */

async function searchPlaces(p: SearchParams): Promise<{ found: Omit<Candidate, "id">[]; warnings: string[] }> {
  const found: Omit<Candidate, "id">[] = [];
  const warnings: string[] = [];

  for (const query of p.queries) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("type", "search");
    url.searchParams.set("q", `${query} in ${p.location}`);
    url.searchParams.set("gl", p.country);
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", SERPAPI_KEY ?? "");

    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        warnings.push(`SerpApi answered ${res.status} for "${query}"`);
        continue;
      }
      const json = (await res.json()) as Record<string, unknown>;
      if (typeof json.error === "string") {
        warnings.push(`SerpApi: ${json.error} ("${query}")`);
        continue;
      }
      const raw = (json.local_results ??
        (json.place_results ? [json.place_results] : [])) as Record<string, unknown>[];
      let kept = 0;
      for (const r of raw) {
        if (kept >= p.perQuery) break;
        const title = typeof r.title === "string" ? r.title.trim() : "";
        if (!title || r.permanently_closed || r.temporarily_closed) continue;
        found.push({
          business: title,
          location: typeof r.address === "string" ? r.address : "",
          phone: typeof r.phone === "string" ? r.phone : "",
          website: typeof r.website === "string" ? r.website : "",
          query,
        });
        kept++;
      }
      if (raw.length === 0) warnings.push(`No results for "${query}"`);
    } catch {
      warnings.push(`Could not reach SerpApi for "${query}"`);
    }
  }
  return { found, warnings };
}

/** Search, drop anything already in the tracker (or repeated), and cap the batch. */
export async function planRun(p: SearchParams, maxNew: number) {
  const { found, warnings } = await searchPlaces(p);

  const known = new Set<string>();
  for (const row of await listOutreach()) {
    known.add(slug(row.business));
    const h = hostOf(row.website);
    if (h) known.add(`host:${h}`);
  }

  const fresh: Candidate[] = [];
  for (const f of found) {
    const id = slug(f.business);
    const host = hostOf(f.website);
    if (!id || known.has(id) || (host && known.has(`host:${host}`))) continue;
    known.add(id);
    if (host) known.add(`host:${host}`);
    fresh.push({ id, ...f });
  }

  const candidates = fresh.slice(0, maxNew);
  return {
    candidates,
    warnings,
    found: found.length,
    deferred: Math.max(0, fresh.length - candidates.length),
  };
}

/* ------------------------------------------------------------------ ticket */

interface TicketPayload {
  a: string;
  exp: number;
  c: Candidate[];
}

/** Key derived from the Notion secret and domain-separated, so it is never the secret itself. */
const ticketKey = () =>
  createHmac("sha256", process.env.NOTION_API_KEY ?? "").update("outreach-run-ticket-v1").digest();

export function signTicket(address: string, candidates: Candidate[], ttlMs = 30 * 60_000): string {
  if (!process.env.NOTION_API_KEY) throw new Error("NOTION_API_KEY is not set");
  const body = Buffer.from(JSON.stringify({ a: address, exp: Date.now() + ttlMs, c: candidates } satisfies TicketPayload)).toString("base64url");
  const mac = createHmac("sha256", ticketKey()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyTicket(ticket: string): TicketPayload | null {
  // Without the secret the key is a constant anyone could compute, so refuse outright.
  if (!process.env.NOTION_API_KEY) return null;
  const [body, mac] = ticket.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", ticketKey()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TicketPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ notion */

const rt = (s: string) => ({ rich_text: s ? [{ type: "text", text: { content: s.slice(0, 1900) } }] : [] });

async function createRow(props: Record<string, unknown>): Promise<void> {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({ parent: { database_id: OUTREACH_DB_ID }, properties: props }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Notion could not find the tracker. Share the database with your integration."
        : `Notion returned ${res.status} when saving the row`
    );
  }
}

/* ------------------------------------------------------------------ one business */

export interface StepResult {
  business: string;
  ok: boolean;
  skipped?: boolean;
  status?: string;
  email?: string;
  note?: string;
  error?: string;
  /** Set when waiting could fix it: the console retries after this many seconds. */
  retryAfter?: number;
  /** A daily quota will not recover within a run, so the console stops. */
  daily?: boolean;
  /** Model tokens and web searches this business used, so spend is visible against a small balance. */
  usage?: { inTok: number; outTok: number; searches: number };
}

export async function processCandidate(c: Candidate): Promise<StepResult> {
  try {
    // Re-check at write time: another run (or a person) may have added it meanwhile.
    const existing = await listOutreach();
    const host = hostOf(c.website);
    if (existing.some((r) => slug(r.business) === c.id || (host && hostOf(r.website) === host))) {
      return { business: c.business, ok: true, skipped: true, note: "Already in the tracker" };
    }

    let notes = "";
    const usage = { inTok: 0, outTok: 0, searches: 0 };
    try {
      const r = await researchNotes(c);
      notes = r.notes;
      usage.inTok += r.usage.inTok;
      usage.outTok += r.usage.outTok;
      usage.searches += r.usage.searches;
    } catch (err) {
      // A research timeout should not lose the business: fall through with empty notes.
      if (err instanceof LlmError || !(err instanceof Error) || !/timed out|timeout|aborted/i.test(err.message)) throw err;
    }

    const written = await writeDraft(c, notes || "(research unavailable)");
    const d = written.draft;
    usage.inTok += written.usage.inTok;
    usage.outTok += written.usage.outTok;
    usage.searches += written.usage.searches;

    // An address is only trusted if the research notes actually contain it.
    const emailOk =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.publicEmail) && notes.toLowerCase().includes(d.publicEmail.toLowerCase());
    const email = emailOk ? d.publicEmail : "";
    const website = c.website || (/^https?:\/\//.test(d.website) ? d.website : "");

    const confidence = (["high", "medium", "low", "none"] as string[]).includes(d.confidence) ? d.confidence : "low";
    const channel = email ? "email" : c.phone ? "whatsapp_text" : "none";
    const status = email ? "needs_review" : c.phone ? "whatsapp_ready" : "needs_contact";
    const nextAction =
      status === "needs_review"
        ? "Review the draft, then send it from your mail app (the console has an Open in mail link)"
        : status === "whatsapp_ready"
          ? "No public email found. Send the draft as a WhatsApp message"
          : "No email or phone found. Find a contact method";
    const today = new Date().toISOString().slice(0, 10);

    await createRow({
      Business: { title: [{ type: "text", text: { content: c.business.slice(0, 200) } }] },
      "Business ID": rt(c.id),
      Status: { select: { name: status } },
      Source: { select: { name: "prospect" } },
      Kind: { select: { name: "cold" } },
      Email: { email: email || null },
      Phone: { phone_number: c.phone || null },
      Website: { url: website || null },
      Location: rt(c.location),
      "Search query": rt(c.query),
      "Vision / goal": rt([d.vision, ...d.goals].filter(Boolean).join(" | ")),
      Campaigns: rt(d.campaigns.map((x) => `${x.name}: ${x.summary}`).join("\n")),
      "Research confidence": { select: { name: confidence } },
      Channel: { select: { name: channel } },
      "Draft subject": rt(d.subject),
      "Draft body": rt(d.body),
      "Follow-ups": { number: 0 },
      "Next action": rt(nextAction),
      "First drafted": { date: { start: today } },
      "Last checked": { date: { start: today } },
    });

    return { business: c.business, ok: true, status, email, note: nextAction, usage };
  } catch (err) {
    if (err instanceof LlmError && (err.status === 429 || err.daily)) {
      return { business: c.business, ok: false, error: err.message, retryAfter: err.retryAfter, daily: err.daily };
    }
    return { business: c.business, ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
