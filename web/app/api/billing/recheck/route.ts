import { NextRequest, NextResponse } from "next/server";
import { getBillingStatus, payInstructions } from "@/lib/billing";
import { runOnchainMatch } from "@/lib/billing-match";

/**
 * Run the on-chain payment watcher.
 *
 *   POST { orgId } – the "I've paid / check again" button: scan (throttled to one scan
 *                    per 30s per instance, so pressing it eagerly is harmless), then
 *                    return that business's fresh billing status.
 *   GET            – the cron backstop (vercel.json, hourly). If CRON_SECRET is set,
 *                    the Authorization header must carry it — Vercel sends
 *                    `Bearer <CRON_SECRET>` on scheduled invocations.
 *
 * The M-Pesa side needs no recheck: Daraja pushes to /api/mpesa/confirmation.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { orgId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!body.orgId || !/^\d+$/.test(String(body.orgId))) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  try {
    const scan = await runOnchainMatch();
    const billing = await getBillingStatus(String(body.orgId));
    return NextResponse.json({ billing, instructions: payInstructions(), scan });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const scan = await runOnchainMatch(true);
    return NextResponse.json({ scan });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
