import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createFeedback, listFeedback } from "@/lib/feedback-store";

/**
 * Public feedback.
 *
 *   GET   – the homepage wall (visible entries, newest first)
 *   POST  – leave one; no account needed, so the defenses are the booking form's:
 *           a honeypot field, tight length caps, and a short per-instance cooldown.
 *
 * Entries go straight onto the homepage (that is the point), so an abusive one is
 * removed by setting feedback.hidden rather than by a moderation queue.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ feedback: await listFeedback() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[feedback:GET]", err);
    return NextResponse.json({ feedback: [] }, { status: 200 });
  }
}

const body = z.object({
  name: z.string().trim().max(60).optional(),
  message: z
    .string()
    .trim()
    .min(3, "Say a little more than that")
    .max(500, "Keep it under 500 characters"),
  // Honeypot: real people never see or fill this.
  website: z.string().max(0, "Invalid request").optional(),
});

/** One post per instance per few seconds — blunts a naive flood without a store. */
let lastPostAt = 0;
const COOLDOWN_MS = 5_000;

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid feedback" },
      { status: 400 }
    );
  }

  const now = Date.now();
  if (now - lastPostAt < COOLDOWN_MS) {
    return NextResponse.json({ error: "One moment — try again in a few seconds." }, { status: 429 });
  }
  lastPostAt = now;

  try {
    const entry = await createFeedback(parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("[feedback:POST]", err);
    return NextResponse.json({ error: "Could not save your feedback — try again." }, { status: 500 });
  }
}
