import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { dripTo, isFaucetConfigured } from "@/lib/faucet";

/**
 * Tops up a brand-new wallet with a little Fuji AVAX, called by the funds gate the
 * moment it sees a signed-in account below the requirement.
 *
 * There is no session to authenticate — the address is client-asserted, like
 * /api/wallets — so the route trusts nothing about the caller: whether this address
 * gets AVAX is decided entirely in lib/faucet.ts against the chain (is it actually
 * below the gate?) and the drips table (has it been funded before? too many from
 * this IP today?). Refusals are 200s with a reason, because to the UI they are not
 * errors — they are "show the manual instructions instead".
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { address } = body as { address?: string };
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }

  if (!isFaucetConfigured) {
    return NextResponse.json({ ok: false, reason: "unavailable" });
  }

  // First hop of x-forwarded-for is the client as Vercel saw it. Spoofable in
  // principle, but the per-address-once rule is the primary guard; this only feeds
  // the daily caps.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const result = await dripTo(address, ip);
  return NextResponse.json(result);
}
