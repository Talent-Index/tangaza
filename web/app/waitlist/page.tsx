"use client";

import Link from "next/link";
import { BusinessWaitlistForm } from "@/components/landing/BusinessWaitlistForm";
import { BrandMark } from "@/components/ui";

export default function BusinessWaitlistPage() {
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
        <Link href="/auth" className="shrink-0 text-xs text-mist-500 hover:text-mist-300">
          Advocate sign in →
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center py-8 sm:py-12">
        <BusinessWaitlistForm className="w-full" />
        <Link
          href="/"
          className="mt-8 text-sm text-mist-500 underline underline-offset-4 hover:text-mist-300"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
