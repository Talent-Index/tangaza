import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { resumeAmbassadorPayouts } from "@/lib/payments/hooks";
import { normalizeKenyanPhone } from "@/lib/payments/phone";
import { getAdvocateProfile, setAdvocateDisplayName, setAdvocateMpesaPhone } from "@/lib/store";

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

  const { orgId, address, displayName, mpesaPhone } = body as {
    orgId?: string;
    address?: string;
    displayName?: string | null;
    mpesaPhone?: string | null;
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "address must be an address" }, { status: 400 });
  }

  // Empty clears it, which falls the display back to the handle or the pseudonym.
  let profile = await getAdvocateProfile(String(orgId), address);
  if (displayName !== undefined) {
    const name = typeof displayName === "string" ? displayName.trim().slice(0, 60) : "";
    profile = await setAdvocateDisplayName(String(orgId), address, name || null);
  }

  if (mpesaPhone !== undefined) {
    const raw = typeof mpesaPhone === "string" ? mpesaPhone.trim() : "";
    const phone = raw ? normalizeKenyanPhone(raw) : null;
    if (raw && !phone) {
      return NextResponse.json({ error: "Enter a Kenyan M-Pesa number, like 07XX XXX XXX." }, { status: 400 });
    }
    profile = await setAdvocateMpesaPhone(String(orgId), address, phone);
    try {
      await resumeAmbassadorPayouts(address);
    } catch (err) {
      console.error("[payments] could not resume payouts:", err instanceof Error ? err.message : "error");
    }
  }

  return NextResponse.json({ profile });
}
