import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark, Button } from "@/components/ui";

// Next adds the noindex tag to a 404 by itself; this only replaces the home page's
// title, which the page would otherwise inherit from the root layout.
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist on Ubu-Tangaza.",
};

/**
 * Shown for any address the site does not have, and wherever a page calls notFound()
 * (an unknown campaign link, for one). Same frame as the legal pages, with the four
 * places a lost visitor most likely wanted.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-10 flex items-center justify-between gap-3">
        <Link href="/">
          <BrandMark className="text-base sm:text-lg" />
        </Link>
        <nav className="flex gap-4 text-xs text-mist-500">
          <Link href="/campaigns" className="hover:text-mist-300">
            Campaigns
          </Link>
          <Link href="/pricing" className="hover:text-mist-300">
            Pricing
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col justify-center pb-16">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold-text">
          Page not found
        </p>
        <h1 className="poster mt-3 text-[2.5rem] leading-none sm:text-[3.25rem]">
          We could not find that page
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-mist-300">
          The link may be old, or the address may have been typed wrong. If a business sent
          you a campaign link, ask them to send it again.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/">Go to the home page</Button>
          <Button href="/campaigns" variant="ghost">
            See campaigns
          </Button>
          <Button href="/pricing" variant="ghost">
            Pricing
          </Button>
          <Button href="/book" variant="ghost">
            Book a call
          </Button>
        </div>
      </main>
    </div>
  );
}
