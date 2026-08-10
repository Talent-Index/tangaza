import { NextRequest, NextResponse } from "next/server";

/**
 * Turns an X post link into the post's text, so the approvals queue can show what
 * was actually said instead of a bare URL.
 *
 * Uses X's public oEmbed endpoint — keyless, and the only sanctioned way to read a
 * post without API credentials. The server proxies it because the endpoint sends no
 * CORS headers, and because proxying lets the CDN cache each post once for everyone
 * (posts don't change; s-maxage a day). Failures return ok:false and the queue just
 * shows the link — the preview is a courtesy, never a dependency.
 *
 * Only x.com / twitter.com status URLs are accepted, so this cannot be used to make
 * the server fetch arbitrary addresses.
 */

export const dynamic = "force-dynamic";

const HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"]);

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
};

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/g, (m) => ENTITIES[m] ?? m);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!HOSTS.has(target.hostname.toLowerCase()) || !/\/status\/\d+/.test(target.pathname)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // oEmbed has read both hosts for years, but twitter.com is the documented one.
  target.hostname = "twitter.com";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(
      `https://publish.twitter.com/oembed?omit_script=true&dnt=true&hide_thread=true&url=${encodeURIComponent(
        target.toString()
      )}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`oembed ${res.status}`);

    const data = (await res.json()) as { html?: string; author_name?: string };
    // The html is a blockquote: post text in <p>, then "— Author (@handle) date".
    // The <p> alone is the post; everything after it is chrome we re-add ourselves.
    const para = data.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
    const text = decode(
      para.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    ).trim();
    if (!text) throw new Error("no text in oembed html");

    return NextResponse.json(
      { ok: true, text: text.slice(0, 500), author: data.author_name ?? null },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  }
}
