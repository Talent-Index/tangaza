import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/BookingForm";
import { Icon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { SESSION_MINUTES } from "@/lib/booking";
import { CONTACT } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Book a setup session | Ubu-Tangaza",
  description:
    "Pick a time and we'll set up your first referral campaign together — the action, the reward and the budget cap.",
};

const MONO = "font-mono text-[11px] uppercase tracking-[0.2em]";

export default function BookPage() {
  return (
    <div className="skin min-h-dvh bg-ink-950 text-mist-100">
      <SiteHeader />
      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <p className={`${MONO} text-crimson-500`}>Book a setup session</p>
            <h1 className="mt-5 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">
              Let&rsquo;s set up your first campaign.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-mist-400">
              A {SESSION_MINUTES}-minute call. We pick the action, the reward and the budget
              cap together, then you only tap approve. Your first campaign is free.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-mist-400">
              {[
                "What you sell, and who your regulars are",
                "One action you'd like customers to do for you",
                "A reward you're happy to give for it",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Icon name="clipboard" className="mt-0.5 size-4 shrink-0 text-crimson-500" /> {line}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs leading-relaxed text-mist-500">
              We use your details only to arrange this session. Prefer email? Write to{" "}
              <a href={`mailto:${CONTACT.email}`} className="underline underline-offset-2 hover:text-mist-300">
                {CONTACT.email}
              </a>
              .
            </p>
          </div>
          <div className="min-w-0 border border-ink-700 bg-ink-850 p-4 sm:p-8 light:rounded-xl light:shadow-sm">
            <BookingForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
