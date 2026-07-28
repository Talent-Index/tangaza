import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { claimAdvocateXHandle, getAdvocateXLink, unlinkAdvocateX } from "@/lib/store";
import { isValidHandle, normaliseHandle } from "@/lib/types";

/**
 * The X handle an advocate says is theirs.
 *
 *   GET    – read the current link
 *   POST   – claim a handle
 *   DELETE – unlink
 *
 * A claim proves nothing on its own — anyone can type @jack — so this stores it as
 * 'claimed', never 'verified'. Verification needs OAuth, and only verified links will
 * ever be eligible for automatic ingestion, because that path ends in a reward.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const address = req.nextUrl.searchParams.get("address");
  if (!orgId || !address) {
    return NextResponse.json({ error: "orgId and address are required" }, { status: 400 });
  }
  const link = await getAdvocateXLink(orgId, address);
  return NextResponse.json({ link: link ?? null });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { orgId, address, handle, displayName } = body as {
    orgId?: string;
    address?: string;
    handle?: string;
    displayName?: string;
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }
  if (!handle || typeof handle !== "string") {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  // Accepts "@you", "you", or a pasted profile URL — they all mean the same thing.
  const normalised = normaliseHandle(handle);
  if (!isValidHandle(normalised)) {
    return NextResponse.json(
      { error: "That doesn't look like an X handle — letters, numbers and _ only, up to 15" },
      { status: 400 }
    );
  }

  const link = await claimAdvocateXHandle({
    orgId: String(orgId),
    address,
    handle: normalised,
    displayName: displayName?.slice(0, 60),
  });

  if (!link) {
    return NextResponse.json(
      { error: `@${normalised} is already linked to another account here` },
      { status: 409 }
    );
  }

  return NextResponse.json({ link }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const address = req.nextUrl.searchParams.get("address");
  if (!orgId || !address) {
    return NextResponse.json({ error: "orgId and address are required" }, { status: 400 });
  }
  await unlinkAdvocateX(orgId, address);
  return NextResponse.json({ ok: true });
}
