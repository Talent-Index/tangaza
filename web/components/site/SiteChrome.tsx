import Link from "next/link";
import { CONTACT } from "@/lib/contact";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#campaigns", label: "Campaigns" },
  { href: "/pricing", label: "Pricing" },
  { href: "/auth", label: "Sign in" },
];

export function SiteHeader() {
  const item = "block rounded-lg px-3 py-3 text-base text-[#15140d] hover:bg-[#ece8dc]";

  return (
    <header className="sticky top-0 z-30 border-b border-[#ddd8c8] bg-[#f3f1e9]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="whitespace-nowrap text-lg font-bold tracking-tight text-[#15140d]">
          Ubu-Tangaza
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[15px] text-[#2c2a1f] hover:underline">
              {l.label}
            </Link>
          ))}
          <Link href="/book" className="btn-gold px-4 py-2 text-sm">
            Book free setup
          </Link>
        </nav>
        {/* A native disclosure, so the menu opens even before JavaScript runs. */}
        <details className="md:hidden">
          <summary
            className="grid size-11 cursor-pointer list-none place-items-center rounded-lg border border-[#c7c1ac] text-[#15140d] [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <nav
            id="site-menu"
            className="absolute inset-x-0 top-full z-40 border-b border-[#ddd8c8] bg-[#f3f1e9] px-4 py-2 shadow-sm"
            aria-label="Mobile"
          >
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={item}>
                {l.label}
              </Link>
            ))}
            <Link href="/book" className="btn-gold my-2 w-full">
              Book free setup
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#ddd8c8] bg-[#f3f1e9]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr] md:items-start">
        <div>
          <p className="text-lg font-bold tracking-tight text-[#15140d]">Ubu-Tangaza</p>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-[#3a382c]">
            Referral and reward campaigns for Nairobi businesses. You approve every reward, and your budget has a hard limit.
          </p>
          <p className="mt-3 text-sm text-[#4a4638]">Nairobi, Kenya</p>
        </div>
        <div className="flex flex-col gap-2 text-base text-[#2c2a1f] md:items-end">
          <Link href="/#how" className="hover:underline">
            How it works
          </Link>
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
          <Link href="/book" className="hover:underline">
            Book a setup session
          </Link>
          <Link href="/feedback" className="hover:underline">
            Leave feedback
          </Link>
          <a href={`mailto:${CONTACT.email}`} className="hover:underline">
            {CONTACT.email}
          </a>
        </div>
      </div>
      <div className="border-t border-[#ddd8c8]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-[#4a4638] sm:px-6">
          <span>© {new Date().getFullYear()} Ubu-Tangaza</span>
          <span className="flex gap-4">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
