"use client";

import { useEffect, useState } from "react";

/**
 * Shows the approver what a proof actually contains, under the proof link.
 *
 * An X status link becomes the post's text (via /api/x-preview); an image link
 * becomes the image. Anything else renders nothing — and so does any failure,
 * because the preview is a courtesy on top of the link, never a gate in front of
 * it. Detection is by URL shape rather than the engagement type's proof_kind, so
 * it keeps working for retired types and for links pasted into the generic kind.
 */

const isXStatus = (url: URL) =>
  ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"].includes(
    url.hostname.toLowerCase()
  ) && /\/status\/\d+/.test(url.pathname);

const isImage = (url: URL) => /\.(png|jpe?g|gif|webp)$/i.test(url.pathname);

export function ProofPreview({ url: raw }: { url?: string }) {
  const [post, setPost] = useState<{ text: string; author: string | null } | null>(null);

  let url: URL | null = null;
  try {
    url = new URL(raw ?? "");
  } catch {
    /* not a URL (referral code, empty) — nothing to preview */
  }
  const wantsPost = url ? isXStatus(url) : false;

  useEffect(() => {
    if (!wantsPost || !raw) return;
    let cancelled = false;
    void fetch(`/api/x-preview?url=${encodeURIComponent(raw)}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean; text?: string; author?: string | null }) => {
        if (!cancelled && d.ok && d.text) setPost({ text: d.text, author: d.author ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wantsPost, raw]);

  if (!url) return null;

  if (isImage(url)) {
    return (
      <a href={raw} target="_blank" rel="noopener noreferrer" className="mt-2 block w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={raw}
          alt="Submitted proof"
          loading="lazy"
          className="max-h-48 rounded-lg border border-ink-700"
        />
      </a>
    );
  }

  if (post) {
    return (
      <blockquote className="mt-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
        <p className="whitespace-pre-line text-sm text-mist-300">“{post.text}”</p>
        {post.author ? <p className="mt-1 text-xs text-mist-500">— {post.author} on X</p> : null}
      </blockquote>
    );
  }

  return null;
}
