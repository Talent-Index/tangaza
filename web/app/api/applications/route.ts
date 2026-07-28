import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { createApplication, listApplications, type ApplicationStatus } from "@/lib/store";
import { pledgeMessage } from "@/lib/pledge";
import { verifySignedText } from "@/lib/verify";

/**
 * A business applying to run rewards.
 *
 *   GET  ?status=signed – the platform's queue of applications to register
 *   POST                – apply, with the pledge signed by the approver's wallet
 *
 * This is an application rather than a registration because `registerOrg` is
 * `onlyOwner` on the contract, deliberately: registering an org mints the right to
 * issue reward liabilities against a cap nobody can later raise. Handing that to anyone
 * with a wallet would make the cap worthless as a guarantee. So a business signs its
 * pledge here and the platform makes the on-chain call.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as ApplicationStatus | null;
  const applications = await listApplications(status ?? undefined);
  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { name, contactEmail, approverAddress, emissionCapKes, pledge, ts, signature } =
    body as {
      name?: string;
      contactEmail?: string;
      approverAddress?: string;
      emissionCapKes?: number;
      pledge?: string;
      ts?: number;
      signature?: string;
    };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }
  if (!approverAddress || !isAddress(approverAddress)) {
    return NextResponse.json(
      { error: "approverAddress must be the wallet that will approve activities" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(emissionCapKes) || (emissionCapKes as number) <= 0) {
    return NextResponse.json({ error: "Budget must be more than zero" }, { status: 400 });
  }
  if (!pledge?.trim()) {
    return NextResponse.json({ error: "Say what you'll give the community" }, { status: 400 });
  }

  const message = pledgeMessage({
    name: name.trim(),
    approverAddress,
    emissionCapKes: emissionCapKes as number,
    pledge: pledge.trim(),
    ts: Number(ts),
  });

  // The signature has to come from the same wallet that will hold approval rights —
  // otherwise the pledge is signed by one party and honoured by another.
  const verdict = await verifySignedText({
    address: approverAddress,
    message,
    signature: signature ?? "",
    ts: Number(ts),
  });

  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 401 });
  }

  const application = await createApplication({
    name: name.trim().slice(0, 120),
    contactEmail: contactEmail?.trim().slice(0, 160),
    approverAddress,
    emissionCapKes: Math.floor(emissionCapKes as number),
    pledge: pledge.trim().slice(0, 2000),
    signature: signature as string,
    signedMessage: message,
  });

  return NextResponse.json({ application }, { status: 201 });
}
