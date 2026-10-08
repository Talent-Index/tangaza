import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OUTREACH_ACTIONS } from "@/lib/outreach-action";
import {
  OUTREACH_NOTION_URL,
  listOutreach,
  outreachNotionConfigured,
  outreachRunConfigured,
  startOutreachRun,
} from "@/lib/outreach";
import { inAppRunStatus, planRun, processCandidate, signTicket, verifyTicket } from "@/lib/outreach-run";
import { requireOwner } from "@/lib/verify";

/**
 * Outreach console API. Reads and starting a run need a fresh wallet signature from an
 * allowed account (see lib/outreach-action.ts); there is no unauthenticated branch, and
 * config state is only revealed after the signature checks out.
 *
 *   POST { action: "read", address, ts, signature }
 *   POST { action: "run",  address, ts, signature, params }   → a plan (in-app) or "started" (external trigger)
 *   POST { action: "step", ticket, index }                    → process one business from a plan
 *
 * "step" is authorised by the ticket the signed "run" returned, not by another wallet
 * prompt: the ticket is an HMAC over the candidate list, so a caller cannot add
 * businesses or extend it. Nothing here ever sends mail.
 */
export const dynamic = "force-dynamic";
/** One business = two Gemini calls and a Notion write; give a step room to finish. */
export const maxDuration = 60;

const auth = {
  address: z.string().min(1).max(100),
  ts: z.number(),
  signature: z.string().min(1).max(2000),
};

const readBody = z.object({ action: z.literal("read"), ...auth });

const search = z.object({
  queries: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  location: z.string().trim().min(1).max(80),
  country: z.string().trim().length(2),
  perQuery: z.number().int().min(1).max(20),
});

const runBody = z.object({
  action: z.literal("run"),
  ...auth,
  params: z.object({
    mode: z.enum(["full", "outreach", "replies"]),
    maxNew: z.number().int().min(1).max(30),
    search: search.optional(),
  }),
});

const stepBody = z.object({
  action: z.literal("step"),
  ticket: z.string().min(10).max(40_000),
  index: z.number().int().min(0).max(29),
});

/** In-process guard so a double click cannot start two searches (each one spends SerpApi credits). */
let lastPlanAt = 0;
const PLAN_COOLDOWN_MS = 20_000;

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = z.discriminatedUnion("action", [readBody, runBody, stepBody]).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.action === "step") {
    if (!inAppRunStatus().ready) {
      return NextResponse.json({ error: "In-app runs are not configured on this server" }, { status: 503 });
    }
    const ticket = verifyTicket(body.ticket);
    if (!ticket) {
      return NextResponse.json({ error: "This run has expired. Start it again." }, { status: 401 });
    }
    const candidate = ticket.c[body.index];
    if (!candidate) return NextResponse.json({ error: "No such business in this run" }, { status: 400 });
    return NextResponse.json({ result: await processCandidate(candidate) });
  }

  const ok = await requireOwner({
    address: body.address,
    action: body.action === "read" ? OUTREACH_ACTIONS.read : OUTREACH_ACTIONS.run,
    ts: body.ts,
    signature: body.signature,
  });
  if (!ok.ok) return NextResponse.json({ error: ok.reason }, { status: 401 });

  if (body.action === "read") {
    const inApp = inAppRunStatus();
    const config = {
      notionConfigured: outreachNotionConfigured,
      runConfigured: outreachRunConfigured,
      inApp,
      notionUrl: OUTREACH_NOTION_URL,
    };
    if (!outreachNotionConfigured) return NextResponse.json({ ...config, rows: [] });
    try {
      return NextResponse.json({ ...config, rows: await listOutreach() });
    } catch (err) {
      console.error("[outreach:read]", err);
      return NextResponse.json(
        { ...config, rows: [], error: err instanceof Error ? err.message : "Could not read the tracker" },
        { status: 502 }
      );
    }
  }

  // An external trigger, if one is configured, keeps working as before.
  if (outreachRunConfigured) {
    const run = await startOutreachRun(body.params);
    if (!run.ok) return NextResponse.json({ error: run.reason }, { status: run.status ?? 500 });
    return NextResponse.json({ started: true });
  }

  const status = inAppRunStatus();
  if (!status.ready) {
    return NextResponse.json(
      { error: `Missing server environment variables: ${status.missing.join(", ")}` },
      { status: 503 }
    );
  }
  if (body.params.mode === "replies" || !body.params.search) {
    return NextResponse.json(
      { error: "The in-app run finds new businesses. Checking replies needs Gmail, so run that from Claude Code." },
      { status: 400 }
    );
  }
  const now = Date.now();
  if (now - lastPlanAt < PLAN_COOLDOWN_MS) {
    return NextResponse.json({ error: "A search just started. Give it a few seconds." }, { status: 429 });
  }
  lastPlanAt = now;

  try {
    const plan = await planRun(body.params.search, body.params.maxNew);
    return NextResponse.json({
      plan: {
        ticket: plan.candidates.length ? signTicket(body.address, plan.candidates) : "",
        candidates: plan.candidates.map((c) => ({
          id: c.id,
          business: c.business,
          location: c.location,
          website: c.website,
        })),
        warnings: plan.warnings,
        found: plan.found,
        deferred: plan.deferred,
      },
    });
  } catch (err) {
    lastPlanAt = 0;
    console.error("[outreach:plan]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed" }, { status: 502 });
  }
}
