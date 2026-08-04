import { NextRequest, NextResponse } from "next/server";
import { resolveShareCode } from "@/lib/store";

/**
 * The short link people actually post: /s/<code> → the campaign, with the sharer
 * riding along as ?via=. The click is counted here, server-side, in the same statement
 * that resolves the code — reliable even when the visitor bounces before the campaign
 * page ever hydrates, and impossible to forget from a client beacon.
 */
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const hit = await resolveShareCode(code).catch(() => undefined);
  const dest = hit ? `/c/${hit.slug}?via=${code.toUpperCase()}` : "/";
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin), 302);
}
