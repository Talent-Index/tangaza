import { NextResponse } from "next/server";
import { getPublicStats } from "@/lib/public-stats";

// Dynamic so it never runs at build time; the CDN header does the caching, which keeps
// every visitor to the landing page from costing a chain read and a DB query.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getPublicStats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[stats]", err);
    return NextResponse.json({ error: "Stats unavailable" }, { status: 500 });
  }
}
