"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme";
import { CONTACT } from "@/lib/contact";
import { SITE_NAME, SITE_NAME_ONE_WORD, X_PROFILE } from "@/lib/seo";


export function SiteHeader() {
  return (
    <header className="border-b border-ink-700">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="whitespace-nowrap text-lg font-bold tracking-tight">
          Ubu-Tangaza<span className="text-gold-text">.</span>
        </Link>
        <nav className="flex items-center gap-3 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.14em] text-mist-400 sm:gap-6">
          <Link href="/#how" className="hidden transition hover:text-mist-100 md:inline">
            How it works
          </Link>
          <Link href="/pricing" className="hidden transition hover:text-mist-100 sm:inline">
            Pricing
          </Link>
          <Link href="/auth" className="text-mist-100 transition hover:text-gold-text">
            Sign in
          </Link>
          <ThemeToggle />
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-on-gold hover:bg-gold-hover"
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-700">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr] md:items-start">
        <div>
          <p className="text-lg font-bold tracking-tight">Ubu-Tangaza</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist-400">
            Your customers bring you new customers. They send proof, you check it, and
            you give the reward.
          </p>
          <p className="mt-3 text-xs text-mist-500">Nairobi, Kenya</p>
          {/* People type the name as one word, as in the web address. Saying so in plain
              text gives a search for that spelling something on the page to match. */}
          <p className="mt-1 text-xs text-mist-500">
            {SITE_NAME} (also written {SITE_NAME_ONE_WORD})
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-mist-400 md:items-end">
          <Link href="/#how" className="hover:text-mist-100">
            How it works
          </Link>
          <Link href="/campaigns" className="hover:text-mist-100">
            Campaigns
          </Link>
          <Link href="/pricing" className="hover:text-mist-100">
            Pricing
          </Link>
          <Link href="/book" className="hover:text-mist-100">
            Book a 5-minute call
          </Link>
          <a href={`mailto:${CONTACT.email}`} className="hover:text-mist-100">
            {CONTACT.email}
          </a>
          {/* rel="me" tells search engines the X profile and this site are the same business. */}
          <a href={X_PROFILE} target="_blank" rel="me noopener" className="hover:text-mist-100">
            {SITE_NAME} on X
          </a>
        </div>
      </div>
      <div className="border-t border-ink-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-mist-500 sm:px-6">
          <span>© {new Date().getFullYear()} Ubu-Tangaza</span>
          <span className="flex gap-4">
            <Link href="/terms" className="hover:text-mist-300">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-mist-300">
              Privacy
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
