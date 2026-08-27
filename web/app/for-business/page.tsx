"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark, Button } from "@/components/ui";

/**
 * A recruiter's tool: pull this up on your phone at a shop counter. It shows the
 * business join link, one-tap share (native / WhatsApp / copy), and a QR the owner
 * can scan to land on the pitch — the fastest path from "hello" to a signed-up merchant.
 */

// Canonical target so a scanned QR always points at production, wherever this is viewed.
const JOIN_URL = "https://ubutangaza.biz/waitlist";
const SHARE_TEXT =
  "Reward the people who bring your shop new customers — verified from your M-Pesa Till, your reward your way. Join Ubu-Tangaza:";
const QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(
  JOIN_URL
)}`;

export default function ForBusinessPage() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(JOIN_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore — the link is shown for manual copy */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Ubu-Tangaza for business", text: SHARE_TEXT, url: JOIN_URL });
      } catch {
        /* user dismissed */
      }
    } else {
      copy();
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${JOIN_URL}`)}`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-ink-950 px-4 py-8 sm:px-6 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgb(30_122_239/0.2),transparent_60%)]"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-lg items-center justify-between gap-3">
        <Link href="/" className="min-w-0 shrink">
          <BrandMark className="text-base sm:text-lg" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center py-8 text-center sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          Invite a business
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
          Get their shop on Ubu-Tangaza in a minute.
        </h1>
        <p className="mt-3 max-w-md text-sm text-mist-400">
          Have them scan this — or send the link. They land on the pitch and can join the
          waitlist or register on the spot.
        </p>

        {/* QR */}
        <div className="mt-8 rounded-2xl border border-ink-700/80 bg-white p-4 shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QR_SRC}
            alt="Scan to join Ubu-Tangaza"
            width={320}
            height={320}
            className="size-56 sm:size-64"
          />
        </div>

        {/* The link */}
        <div className="mt-6 flex w-full max-w-md items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-ink-700 bg-ink-850 px-3 py-3 text-left text-sm text-crimson-300">
            {JOIN_URL}
          </code>
          <Button type="button" variant="ghost" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </Button>
        </div>

        {/* Quick share */}
        <div className="mt-4 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={share} className="flex-1">
            Share
          </Button>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-jade-500/40 bg-jade-500/10 px-6 text-sm font-semibold text-jade-300 transition hover:bg-jade-500/20"
          >
            WhatsApp
          </a>
        </div>

        <div className="mt-8 flex items-center gap-4 text-sm">
          <Link href="/waitlist" className="text-mist-300 underline underline-offset-4 hover:text-white">
            Preview what they&rsquo;ll see ↗
          </Link>
          <Link href="/register" className="text-mist-500 underline underline-offset-4 hover:text-mist-300">
            Register now
          </Link>
        </div>
      </main>
    </div>
  );
}
