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
import { chatReady, interpretInstruction } from "@/lib/outreach-chat";
import { inAppRunStatus, planRun, processCandidate, signTicket, verifyTicket } from "@/lib/outreach-run";
import { sendRowDraft, sendStatus } from "@/lib/outreach-send";
import { requireOwner } from "@/lib/verify";

/**
 * Outreach console API. Every action except "step" needs a fresh wallet signature from
 * an allowed account (see lib/outreach-action.ts); there is no unauthenticated branch,
 * and config state is only revealed after the signature checks out.
 *
 *   POST { action: "read", address, ts, signature }
 *   POST { action: "chat", …auth, instruction }        → a typed day plan (nothing runs)
 *   POST { action: "run",  …auth, params }             → a plan + ticket (in-app) or "started" (external trigger)
 *   POST { action: "step", ticket, index }             → process one business from a plan
 *   POST { action: "send", …auth, rowId }              → send ONE row's draft
 *
 * "step" is authorised by the ticket the signed "run" returned, not by another wallet
 * prompt: the ticket is an HMAC over the candidate list, so a caller cannot add
 * businesses or extend it. "send" is the only thing that sends mail, and its signature
 * is bound to the one row id it may send (the `detail` in the signed message), so
 * nothing sends without the owner approving that exact message.
 */
export const dynamic = "force-dynamic";
/** One business = two model calls and a Notion write; give a step room to finish. */
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
    /** Businesses asked for by name (from the instruction box) — researched without a Maps search. */
    prospects: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
  }),
});

const stepBody = z.object({
  action: z.literal("step"),
  ticket: z.string().min(10).max(40_000),
  index: z.number().int().min(0).max(29),
});

const chatBody = z.object({
  action: z.literal("chat"),
  ...auth,
  instruction: z.string().trim().min(3, "Say what should happen today").max(1000),
});

const sendBody = z.object({
  action: z.literal("send"),
  ...auth,
  rowId: z.string().trim().min(10).max(80),
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

  const parsed = z
    .discriminatedUnion("action", [readBody, runBody, stepBody, chatBody, sendBody])
    .safeParse(json);
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
    action: OUTREACH_ACTIONS[body.action],
    ts: body.ts,
    signature: body.signature,
    // A send signature is only valid for the one row it names.
    detail: body.action === "send" ? body.rowId : undefined,
  });
  if (!ok.ok) return NextResponse.json({ error: ok.reason }, { status: 401 });

  if (body.action === "read") {
    const inApp = inAppRunStatus();
    const config = {
      notionConfigured: outreachNotionConfigured,
      runConfigured: outreachRunConfigured,
      inApp,
      send: sendStatus(),
      chatReady: chatReady(),
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

  if (body.action === "chat") {
    if (!chatReady()) {
      return NextResponse.json({ error: "Set ANTHROPIC_API_KEY on the server to use the instruction box" }, { status: 503 });
    }
    try {
      const plan = await interpretInstruction(body.instruction);
      // Resolve "send X" names against the tracker so the console can show exactly
      // what would go out — matching is on names, loosely, because people abbreviate.
      const sends: { id: string; business: string; email: string; subject: string }[] = [];
      const unknownSends: string[] = [];
      if (plan.sendTo.length) {
        const rows = await listOutreach();
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        for (const name of plan.sendTo) {
          const n = norm(name);
          const row = rows.find((r) => {
            const b = norm(r.business);
            return b === n || b.includes(n) || n.includes(b);
          });
          if (row && row.email && row.draftBody && row.status !== "sent") {
            sends.push({ id: row.id, business: row.business, email: row.email, subject: row.draftSubject });
          } else {
            unknownSends.push(row ? `${name} (no sendable draft)` : name);
          }
        }
      }
      return NextResponse.json({ plan, sends, unknownSends });
    } catch (err) {
      console.error("[outreach:chat]", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not interpret that" },
        { status: 502 }
      );
    }
  }

  if (body.action === "send") {
    if (!sendStatus().ready) {
      return NextResponse.json(
        { error: `Sending is not configured — set ${sendStatus().missing.join(", ")} on the server` },
        { status: 503 }
      );
    }
    // Re-read the row from Notion so what goes out is what the tracker holds.
    const row = (await listOutreach()).find((r) => r.id === body.rowId);
    if (!row) return NextResponse.json({ error: "No such row in the tracker" }, { status: 404 });
    const sent = await sendRowDraft(row);
    if (!sent.ok) return NextResponse.json({ error: sent.reason }, { status: 502 });
    return NextResponse.json({ sent: sent.to });
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
  const prospects = body.params.prospects ?? [];
  if (body.params.mode === "replies" || (!body.params.search && prospects.length === 0)) {
    return NextResponse.json(
      { error: "The in-app run finds and researches businesses. Checking replies needs Gmail, so run that from Claude Code." },
      { status: 400 }
    );
  }
  const now = Date.now();
  if (now - lastPlanAt < PLAN_COOLDOWN_MS) {
    return NextResponse.json({ error: "A search just started. Give it a few seconds." }, { status: 429 });
  }
  lastPlanAt = now;

  try {
    const plan = await planRun(body.params.search ?? null, body.params.maxNew, prospects);
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
