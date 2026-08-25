"use client";

import Link from "next/link";
import { BusinessWaitlistForm } from "@/components/landing/BusinessWaitlistForm";
import { BrandMark } from "@/components/ui";

const BENEFITS = [
  {
    icon: "📈",
    title: "Turn word-of-mouth into measurable sales",
    body: "Your best marketing is a happy customer telling a friend — and today you can't see it or reward it. We show you exactly which new customers a referral brought in.",
  },
  {
    icon: "📲",
    title: "Verified straight from your M-Pesa Till",
    body: "A friend pays your Till, the referrer earns — matched automatically. No dashboard to babysit, no approvals to click, no new hardware.",
  },
  {
    icon: "🎁",
    title: "Reward your way",
    body: "Cash, airtime, a voucher, a discount, or merch — you set what a referred sale is worth, in any currency. You only ever reward real, verified sales.",
  },
  {
    icon: "🔒",
    title: "Proof nobody can game",
    body: "Every referral is recorded on-chain — who referred whom, tamper-proof. No fake claims, no inflated numbers, no trust-us dashboards.",
  },
];

const STEPS = [
  "Your customer shares their personal link and gets a short code.",
  "Their friend pays your Till and enters that code as the account number.",
  "The referrer earns the reward you set — automatically, no work from you.",
];

export default function BusinessWaitlistPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-ink-950 px-4 py-8 sm:px-6 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgb(30_122_239/0.2),transparent_60%)]"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <Link href="/" className="min-w-0 shrink">
          <BrandMark className="text-base sm:text-lg" />
        </Link>
        <Link href="/auth" className="shrink-0 text-xs text-mist-500 hover:text-mist-300">
          Advocate sign in →
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 py-10 lg:grid-cols-[1.1fr_minmax(0,26rem)] lg:gap-16 lg:py-16">
        {/* Value proposition */}
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-400">
            For local businesses
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Reward the people who bring you paying customers.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-mist-400">
            Ubu-Tangaza turns your customers into a referral engine you can actually
            measure. When someone they referred pays your M-Pesa Till, we verify it and
            the referrer earns the reward you chose — automatically. You run your shop; the
            rewards run themselves.
          </p>

          <ul className="mt-8 space-y-5">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-800 text-xl">
                  {b.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-mist-100">{b.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-mist-500">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-ink-700/70 bg-ink-850/50 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500">
              How it works
            </p>
            <ol className="mt-3 space-y-3">
              {STEPS.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-mist-300">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-crimson-500/15 text-[11px] font-bold text-crimson-300">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-mist-500">
            <span className="font-semibold text-mist-300">Why we&rsquo;re a fit:</span> built
            for Kenyan shops — coffee spots, salons, boutiques — on the M-Pesa Till you
            already use. Nothing for your customers to download, nothing upfront, and you
            only pay out on sales that actually happened.
          </p>
        </div>

        {/* Form */}
        <div className="w-full lg:sticky lg:top-16">
          <BusinessWaitlistForm className="w-full" />
          <p className="mt-4 text-center text-xs text-mist-600">
            Join the waitlist and we&rsquo;ll set your shop up when the pilot opens near you.
          </p>
        </div>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl pt-4 text-center lg:text-left">
        <Link
          href="/"
          className="text-sm text-mist-500 underline underline-offset-4 hover:text-mist-300"
        >
          Back to home
        </Link>
      </footer>
    </div>
  );
}
