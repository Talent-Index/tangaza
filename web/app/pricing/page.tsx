import Link from "next/link";
import { BrandMark } from "@/components/ui";
import { FREE_CAMPAIGNS, priceForCampaign } from "@/lib/billing";

export const metadata = {
  title: "Pricing — Ubu-Tangaza",
  description:
    "Two free campaigns, then pay per campaign. No subscription, no cut of your rewards.",
};

/**
 * The pricing page renders the same price table the paywall enforces — it imports the
 * numbers from lib/billing.ts rather than stating its own, so it can never disagree
 * with what checkout actually asks for.
 */
export default function PricingPage() {
  const third = priceForCampaign(FREE_CAMPAIGNS + 1)!;
  const later = priceForCampaign(FREE_CAMPAIGNS + 2)!;

  const rows = [
    { which: `Campaigns 1–${FREE_CAMPAIGNS}`, price: "Free", note: "Prove it works on your own customers" },
    { which: `Campaign ${FREE_CAMPAIGNS + 1}`, price: `KES ${third.kes}`, note: "One-off, paid by M-Pesa" },
    { which: "Every campaign after", price: `KES ${later.kes}`, note: "Flat — it never goes up" },
  ];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-10 flex items-center justify-between gap-3">
        <Link href="/">
          <BrandMark className="text-base sm:text-lg" />
        </Link>
        <Link href="/register" className="text-xs text-mist-500 hover:text-mist-300">
          Register your business →
        </Link>
      </header>

      <main className="space-y-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crimson-400">
            Pricing
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight">
            Pay per campaign. Nothing else.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-400">
            Your first {FREE_CAMPAIGNS} campaigns are free — run them, see the referrals
            arrive, decide with your own numbers. After that each campaign is a one-off
            credit. No subscription, no cut of your sales, and the rewards you promise
            your community stay entirely yours to set.
          </p>
        </div>

        <ul className="divide-y divide-ink-700 rounded-2xl border border-ink-700">
          {rows.map((r) => (
            <li key={r.which} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{r.which}</p>
                <p className="mt-0.5 text-xs text-mist-500">{r.note}</p>
              </div>
              <p className="shrink-0 text-xl font-black tabular-nums">{r.price}</p>
            </li>
          ))}
        </ul>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">How paying works</h2>
          <ol className="space-y-3 text-sm leading-relaxed text-mist-400">
            <li>
              <span className="font-semibold text-mist-200">1.</span> When your next
              campaign needs a credit, checkout shows an exact amount and a short
              reference — e.g. <code className="text-crimson-300">KES 431 · UT-MUYU-7Q2</code>.
            </li>
            <li>
              <span className="font-semibold text-mist-200">2.</span> Pay by M-Pesa. The
              exact amount is how your payment finds you, even if the reference gets lost.
            </li>
            <li>
              <span className="font-semibold text-mist-200">3.</span> We confirm it —
              usually within the hour — and the campaign unlocks. Your receipt (M-Pesa
              code or transaction hash) stays in your dashboard.
            </li>
          </ol>
          <p className="text-xs text-mist-500">
            KES prices are set slightly above the dollar target so transfer fees are on
            us, not you. A campaign credit never expires, and a paywall never reaches
            back: campaigns that were free when you made them stay free.
          </p>
        </section>

        <div>
          <Link
            href="/register"
            className="inline-block rounded-full bg-crimson-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-crimson-400"
          >
            Start with 2 free campaigns →
          </Link>
        </div>

        <p className="border-t border-ink-700 pt-6 text-xs text-mist-500">
          Payments and refunds are governed by our{" "}
          <Link href="/terms" className="text-mist-300 underline underline-offset-4">
            Terms of Service
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="text-mist-300 underline underline-offset-4">
            Privacy Policy
          </Link>
        </p>
      </main>
    </div>
  );
}
