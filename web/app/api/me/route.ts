import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getAdvocateProfile, setAdvocateDisplayName } from "@/lib/store";

/**
 * What an advocate has told us about themselves — their name and, if they linked one,
 * their X handle.
 *
 * This exists because sign-in does not supply it. Google gives thirdweb an email, but
 * X gives it neither an email nor a username, so an X-only advocate was being shown a
 * pseudonym derived from their wallet address. Deterministic, and not their name.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const address = req.nextUrl.searchParams.get("address");
  if (!orgId || !address || !isAddress(address)) {
    return NextResponse.json(
      { error: "orgId and a valid address are required" },
      { status: 400 }
    );
  }
  const profile = await getAdvocateProfile(orgId, address);
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { orgId, address, displayName } = body as {
    orgId?: string;
    address?: string;
    displayName?: string | null;
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }

  // Empty clears it, which falls the display back to the handle or the pseudonym.
  const name = typeof displayName === "string" ? displayName.trim().slice(0, 60) : "";
  const profile = await setAdvocateDisplayName(String(orgId), address, name || null);

  return NextResponse.json({ profile });
}
