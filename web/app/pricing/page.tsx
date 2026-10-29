import Link from "next/link";
import { Icon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { FREE_CAMPAIGNS, priceForCampaign } from "@/lib/billing";

export const metadata = {
  title: "Pricing — Ubu-Tangaza",
  description:
    "No monthly fee and no cut of your sales. You pay a small fee per campaign, and you choose the rewards you give.",
};

const CHECK = (
  <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-gold-text" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/**
 * The prices come from lib/billing.ts, the same numbers checkout charges.
 * The live product gives two free campaigns. The mockup left "1 or 2" open,
 * so this page states the number the paywall actually uses.
 */
export default function PricingPage() {
  const third = priceForCampaign(FREE_CAMPAIGNS + 1)!;
  const later = priceForCampaign(FREE_CAMPAIGNS + 2)!;

  return (
    <div className="min-h-dvh bg-ink-950 text-mist-100">
      <SiteHeader />
      <main className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">
          <span className="h-px w-8 bg-gold" /> Pricing
        </p>
        <h1 className="poster mt-4 max-w-5xl text-[clamp(2.8rem,7vw,5.25rem)]">
          Simple prices. <span className="text-gold-text">Pay only when you run a campaign.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-mist-500">
          No monthly fee and no cut of your sales. You pay a small fee per campaign, and you
          choose the rewards you give.
        </p>

        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          <Plan
            kicker="Try it free"
            price="Free"
            note={`Your first ${FREE_CAMPAIGNS} campaigns`}
            who="Any business trying this for the first time"
            points={["All features", "Ready-made campaigns", "Help over a 5-minute call"]}
            cta="Start free"
            href="/register"
            featured
          />
          <Plan
            kicker="Pay as you go"
            price={`KES ${third.kes}`}
            note={`for the next one, then KES ${later.kes} each`}
            who="Businesses that saw it work and want more"
            points={["Each new campaign", "Receipt in your dashboard", "Credit never expires"]}
            cta="Start free"
            href="/register"
          />
          <Plan
            kicker="We run it for you"
            price="Ask us"
            note="Price to be agreed"
            who="Busy owners, groups, churches, gyms and other communities"
            points={[
              "We set up and run campaigns within your community, with your members",
              "You track everything",
            ]}
            cta="Book a 5-minute call"
            href="/book"
            cream
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">
              What a campaign costs you
            </p>
            <h2 className="poster mt-3 text-3xl">
              Two costs. <span className="text-mist-500">Both in your hands.</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-mist-500">
              Our fee per campaign, and the rewards you give. You choose the rewards. Set a
              target. When you hit it, you decide the reward.
            </p>
            <p className="mt-4 rounded-xl border border-ok-line bg-ok-bg px-3.5 py-3 text-sm leading-relaxed text-ok">
              <span className="font-bold text-mist-100">
                Your money only goes to the rewards you chose, for customers you approved.
              </span>{" "}
              We never take a cut of your sales.
            </p>
          </section>

          <section className="card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">
              Paid once, by mobile money
            </p>
            <h2 className="poster mt-3 text-3xl">How paying works</h2>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-mist-300">
              <li className="flex gap-2.5">
                <span className="font-mono text-xs font-bold text-gold-text">01</span>
                When you need a new campaign, checkout shows an exact amount and a short reference.
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-xs font-bold text-gold-text">02</span>
                Pay the exact amount by mobile money. That exact amount is how we know it&apos;s you.
              </li>
              <li className="flex gap-2.5">
                <span className="font-mono text-xs font-bold text-gold-text">03</span>
                We confirm it, and your campaign unlocks. Your receipt stays in your dashboard.
              </li>
            </ol>
            <p className="mt-4 text-sm font-semibold text-ok">
              The price you see is the price you pay. We cover the transfer fees.
            </p>
          </section>
        </div>

        <div className="relative mt-4 flex flex-col items-start justify-between gap-5 overflow-hidden rounded-3xl bg-gold px-6 py-7 text-on-gold sm:flex-row sm:items-center sm:px-9">
          <span className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full border-[22px] border-[#f4b254]/80" />
          <div className="relative">
            <h2 className="poster text-4xl">Your first campaign is free.</h2>
            <p className="mt-1.5 text-[15px] text-on-gold/80">No card, nothing to pay today.</p>
          </div>
          <Link
            href="/register"
            className="relative inline-flex items-center gap-2 rounded-full bg-ink-950 px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-mist-100"
          >
            Start free <Icon name="arrow-up-right" className="size-4" />
          </Link>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[280px_1fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">Questions</p>
            <h2 className="poster mt-3 text-4xl">Before you start.</h2>
          </div>
          <dl className="divide-y divide-ink-700 border-t border-ink-700">
            {[
              ["Is there a monthly fee?", "No."],
              ["Do I pay for the rewards?", "Yes, you give them yourself."],
              ["What if nobody joins?", "You only paid the campaign fee, and your first one is free."],
              [
                "Can you run it for us?",
                "Yes. We can run campaigns within your own community, with your members, on your behalf, and you track everything.",
              ],
            ].map(([q, a]) => (
              <div key={q} className="py-4">
                <dt className="text-[15px] font-bold">{q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-mist-500">{a}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-on-gold"
          >
            Start free <Icon name="arrow-up-right" className="size-4" />
          </Link>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 rounded-full border border-ink-500 px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em]"
          >
            Book a 5-minute call
          </Link>
        </div>

        <p className="mt-10 border-t border-ink-700 pt-6 text-xs text-mist-500">
          Payments and refunds are governed by our{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function Plan({
  kicker,
  price,
  note,
  who,
  points,
  cta,
  href,
  featured,
  cream,
}: {
  kicker: string;
  price: string;
  note: string;
  who: string;
  points: string[];
  cta: string;
  href: string;
  featured?: boolean;
  cream?: boolean;
}) {
  return (
    <article
      className={`card flex flex-col p-6 ${featured ? "border-gold/60 bg-gradient-to-b from-gold/10 to-ink-850" : ""}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">{kicker}</p>
      <p className="mt-2 min-h-11 text-sm leading-relaxed text-mist-500">{who}</p>
      <p className={`poster mt-3 text-5xl ${featured ? "text-gold-text" : ""}`}>{price}</p>
      <p className="mt-1 text-sm text-mist-400">{note}</p>
      <ul className="mt-4 flex-1 space-y-2.5 border-t border-ink-700 pt-4">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-mist-300">
            {CHECK}
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] ${
          cream
            ? "bg-mist-100 text-ink-950"
            : featured
              ? "bg-gold text-on-gold"
              : "border border-ink-500 text-mist-100"
        }`}
      >
        {cta} <Icon name="arrow-up-right" className="size-4" />
      </Link>
    </article>
  );
}
