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
import { requireOwner } from "@/lib/verify";

/**
 * Platform-owner outreach console API. Everything here needs a fresh wallet signature
 * from the contract owner (see lib/outreach-action.ts) — there is no unauthenticated
 * branch, and config state is only revealed after the signature checks out.
 *
 *   POST { action: "read", address, ts, signature }
 *   POST { action: "run",  address, ts, signature, params }
 *
 * "run" does not execute the workflow here; it fires the configured trigger. The
 * workflow only ever creates Gmail drafts — it never sends mail.
 */
export const dynamic = "force-dynamic";

const auth = {
  address: z.string().min(1).max(100),
  ts: z.number(),
  signature: z.string().min(1).max(2000),
};

const readBody = z.object({ action: z.literal("read"), ...auth });

const runBody = z.object({
  action: z.literal("run"),
  ...auth,
  params: z.object({
    mode: z.enum(["full", "outreach", "replies"]),
    maxNew: z.number().int().min(1).max(30),
    search: z
      .object({
        queries: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
        location: z.string().trim().min(1).max(80),
        country: z.string().trim().length(2),
        perQuery: z.number().int().min(1).max(20),
      })
      .optional(),
  }),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = z.discriminatedUnion("action", [readBody, runBody]).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  const ok = await requireOwner({
    address: body.address,
    action: body.action === "read" ? OUTREACH_ACTIONS.read : OUTREACH_ACTIONS.run,
    ts: body.ts,
    signature: body.signature,
  });
  if (!ok.ok) return NextResponse.json({ error: ok.reason }, { status: 401 });

  if (body.action === "read") {
    const config = {
      notionConfigured: outreachNotionConfigured,
      runConfigured: outreachRunConfigured,
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

  const run = await startOutreachRun(body.params);
  if (!run.ok) return NextResponse.json({ error: run.reason }, { status: run.status ?? 500 });
  return NextResponse.json({ started: true });
}
