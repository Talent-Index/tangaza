"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme";
import { CONTACT } from "@/lib/contact";


export function SiteHeader() {
  return (
    <header className="border-b border-ink-700">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Ubu-Tangaza
        </Link>
        <nav className="flex items-center gap-4 text-[13px] text-mist-400 sm:gap-7">
          <Link href="/#how" className="transition hover:text-mist-100">
            How it works
          </Link>
          <Link href="/#pilots" className="transition hover:text-mist-100">
            Pilots
          </Link>
          <Link href="/auth" className="font-semibold text-mist-100 transition hover:text-crimson-500">
            Sign in
          </Link>
          <ThemeToggle />
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
            Built by Daniel Mwihoti. Born at the Team1 Avalanche Game Jam.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-mist-400 md:items-end">
          <Link href="/#how" className="hover:text-mist-100">
            How it works
          </Link>
          <Link href="/#pilots" className="hover:text-mist-100">
            Pilots
          </Link>
          <Link href="/book" className="hover:text-mist-100">
            Book a setup session
          </Link>
        </div>
      </div>
      <div className="border-t border-ink-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-mist-500 sm:px-6">
          <a href={`mailto:${CONTACT.email}`} className="font-mono text-[11px] tracking-[0.04em] hover:text-mist-300">
            {CONTACT.email}
          </a>
          <span>Ubu-Tangaza</span>
        </div>
      </div>
    </footer>
  );
}
