import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  createApplication,
  listApplications,
  listApplicationsForApprover,
  markApplicationRegistered,
  type ApplicationStatus,
} from "@/lib/store";
import { pledgeMessage } from "@/lib/pledge";
import { canAutoRegister, registerOrgOnChain } from "@/lib/registrar";
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
  // ?approver= scopes the answer to one wallet's own pledges, which is what the business
  // portal asks for. Without it this is the platform's queue.
  const approver = req.nextUrl.searchParams.get("approver");
  if (approver) {
    if (!isAddress(approver)) {
      return NextResponse.json({ error: "approver must be an address" }, { status: 400 });
    }
    return NextResponse.json({
      applications: await listApplicationsForApprover(approver),
    });
  }

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

  /**
   * Register it now rather than leaving them staring at a receipt.
   *
   * A signed pledge that sits in Postgres until an operator runs a script reads, from
   * the business's side, as nothing having happened — they signed, and their org never
   * appeared. So the platform makes its on-chain call here, in the same request.
   *
   * A failure is not fatal: the pledge is already stored and verified, so the
   * application stays 'signed' and the /admin queue picks it up exactly as before. The
   * business is told which of the two happened instead of being told it's done when it
   * isn't.
   */
  if (!canAutoRegister()) {
    return NextResponse.json({ application, registered: false }, { status: 201 });
  }

  try {
    const { orgId, txHash } = await registerOrgOnChain({
      name: application.name,
      approverAddress: application.approverAddress,
      emissionCapKes: application.emissionCapKes,
    });
    const registeredApp = await markApplicationRegistered(application.id, orgId, txHash);
    return NextResponse.json(
      { application: registeredApp ?? application, registered: true, orgId, txHash },
      { status: 201 }
    );
  } catch (err) {
    console.error("[applications] instant registration failed", err);
    return NextResponse.json(
      {
        application,
        registered: false,
        registrationError:
          err instanceof Error ? err.message : "Could not register on Avalanche",
      },
      { status: 201 }
    );
  }
}
