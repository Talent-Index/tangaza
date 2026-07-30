import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { recordWalletConnection } from "@/lib/store";

/**
 * Records a wallet connection, called by the client the moment an account connects.
 *
 * Deliberately an upsert of public facts only — an address, which extension signed it
 * in, timestamps. There is nothing to authenticate: the row asserts "this address
 * connected", which is not a claim anyone gains by forging, and the addresses that
 * matter downstream (submissions, approvals) are all proven against the chain anyway.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { address, adminAddress, walletId } = body as {
    address?: string;
    adminAddress?: string;
    walletId?: string;
  };

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }
  if (adminAddress && !isAddress(adminAddress)) {
    return NextResponse.json({ error: "adminAddress must be an address" }, { status: 400 });
  }

  await recordWalletConnection({
    address,
    adminAddress,
    walletId: typeof walletId === "string" ? walletId.slice(0, 64) : undefined,
  });

  return NextResponse.json({ ok: true });
}
