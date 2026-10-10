import { NextRequest, NextResponse } from "next/server";
import { getOrgContact, getOrgDisplayName, setOrgDisplayName } from "@/lib/store";
import { requireApprover } from "@/lib/verify";
import { ORG_ACTIONS } from "@/lib/org-action";

/**
 * A business's profile: its editable display name, and the contact details it gave
 * at registration (read-only here).
 *
 * The on-chain name is immutable (set once at registerOrg, no setter), so this is the
 * name a business can change. It is verified against the org's on-chain approver, same
 * as every other business mutation.
 *
 *   GET   ?orgId=1   – { displayName, contact }
 *   PATCH            – set it (approver-signed)
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const [displayName, contact] = await Promise.all([
    getOrgDisplayName(orgId),
    getOrgContact(orgId),
  ]);
  // Public GET: only what a customer could see anyway — no phone or email.
  const { contactPhone: _phone, contactEmail: _email, ...publicContact } = contact;
  return NextResponse.json({ displayName, contact: publicContact });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { orgId, name, address, ts, signature } = body as {
    orgId?: string;
    name?: string;
    address?: string;
    ts?: number;
    signature?: string;
  };

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const auth = await requireApprover({
    orgId: String(orgId),
    address: address ?? "",
    action: ORG_ACTIONS.orgRename,
    ts: Number(ts),
    signature: signature ?? "",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  await setOrgDisplayName(String(orgId), name.trim().slice(0, 80));
  return NextResponse.json({ displayName: name.trim().slice(0, 80) });
}
