"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FeedbackSection } from "@/components/feedback/Feedback";
import { Icon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { addressUrl } from "@/lib/chain";
import type { PublicStats } from "@/lib/public-display";

function useStats(initial: PublicStats | null) {
  const [stats, setStats] = useState(initial);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: PublicStats | null) => {
        if (!cancelled && j) setStats(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

const num = (n: number) => n.toLocaleString("en-KE");

export function LandingPage({ initialStats = null }: { initialStats?: PublicStats | null }) {
  const stats = useStats(initialStats);
  return (
    <div className="marketing light min-h-dvh bg-[#f3f1e9] text-[#15140d]">
      <SiteHeader />
      <Hero />
      <StatStrip stats={stats} />
      <Band />
      <HowItWorks />
      <WhoItsFor />
      <Campaigns stats={stats} />
      <Setup />
      <ChainLine stats={stats} />
      <Faq />
      <FeedbackSection />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#6b4a12]">Referral campaigns for Kenyan businesses</p>
          <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-[3.5rem]">
            Get your customers to bring their friends.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#2c2a1f]">
            Your regulars already recommend you. Ubu-Tangaza lets you reward them for it. They bring a friend, post a review or come to your launch, then send proof. You check it and approve, and only then do they get their airtime, voucher or discount.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book" className="btn-gold">
              Book a free 5-minute call <Icon name="arrow-up-right" className="size-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-full border border-[#c7c1ac] px-5 py-3 text-base font-semibold text-[#15140d] hover:border-[#15140d]"
            >
              How it works
            </a>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:grid-cols-1">
          <div className="overflow-hidden rounded-2xl border border-[#ddd8c8]">
            <Image
              src="/images/landing/usecase-cafe.webp"
              alt="A café counter, the kind of shop Ubu-Tangaza is built for"
              width={960}
              height={720}
              priority
              className="h-56 w-full object-cover sm:h-full lg:h-64"
            />
          </div>
          <ExampleCard />
        </div>
      </div>
    </section>
  );
}

/** A picture of the approval step. The name and amount are an example, not a live claim. */
function ExampleCard() {
  return (
    <div className="rounded-2xl border border-[#ddd8c8] bg-white p-5 shadow-sm">
      <p className="text-[13px] font-semibold text-[#6b4a12]">Example</p>
      <p className="mt-2 text-lg font-bold">Wanjiru brought a friend</p>
      <p className="mt-1 text-base text-[#3a382c]">Proof: a photo at your counter</p>
      <p className="mt-3 text-base font-semibold">KES 100 airtime</p>
      <div className="mt-4 flex gap-2">
        <span className="rounded-full bg-[#e9a23b] px-4 py-2 text-sm font-semibold text-[#17130b]">Approve</span>
        <span className="rounded-full border border-[#c7c1ac] px-4 py-2 text-sm font-semibold">Reject</span>
      </div>
    </div>
  );
}

function StatStrip({ stats }: { stats: PublicStats | null }) {
  const chain = stats?.chain;
  if (!chain) {
    return (
      <section className="px-4 pb-10 sm:px-6">
        <p className="mx-auto max-w-6xl border-t border-[#ddd8c8] pt-6 text-base text-[#3a382c]">
          Every reward is approved by the business before it is given. The live totals appear here when the record is available.
        </p>
      </section>
    );
  }

  const items = [
    { big: num(chain.approved), label: "Actions approved" },
    { big: `KES ${num(chain.issuedKes)}`, label: "Rewarded" },
  ];
  if (stats?.pilotsKnown) {
    const running = stats.pilots.length;
    items.push({
      big: num(running),
      label: running === 1 ? "Campaign running" : "Campaigns running",
    });
  }

  return (
    <section className="px-4 pb-10 sm:px-6">
      <div className="mx-auto max-w-6xl border-t border-[#ddd8c8] pt-6">
        <dl className={`grid max-w-3xl gap-4 ${items.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
          {items.map((s) => (
            <div key={s.label}>
              <dt className="text-[13px] text-[#4a4638]">{s.label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{s.big}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Band() {
  return (
    <div className="bg-[#15140d] px-4 py-4 text-[#f3f1e9] sm:px-6">
      <p className="mx-auto max-w-6xl text-base font-semibold sm:text-lg">
        Made in Nairobi for cafés, gyms, salons, clinics and shops.
      </p>
    </div>
  );
}

const PATH = [
  {
    n: "01",
    title: "Set the goal",
    body: "Pick what you want, like a new customer who mentions your name, and what you'll give for it: KES 100 airtime, a free coffee or 10% off.",
  },
  {
    n: "02",
    title: "Review proof",
    body: "Customers send proof, like a screenshot of their Google review, a photo at your counter or an M-Pesa receipt. You see each one.",
  },
  {
    n: "03",
    title: "Hand over the reward",
    body: "Tap approve or reject. You hand over the reward yourself, and you can never go past the budget you set.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-[#2c2a1f]">
            Three steps. You stay in charge of every shilling.
          </p>
        </div>
        <ol className="min-w-0 border-t border-[#ddd8c8]">
          {PATH.map((s) => (
            <li key={s.n} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-[#ddd8c8] py-6">
              <span className="text-lg font-bold text-[#6b4a12]">{s.n}</span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-[#2c2a1f]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const WHO = [
  {
    src: "/images/landing/usecase-cafe.webp",
    alt: "Coffee and pastries on a café counter",
    title: "Cafés",
    line: "Example: KES 100 airtime when a regular brings a friend.",
  },
  {
    src: "/images/landing/usecase-salon.webp",
    alt: "A salon styling a client's hair",
    title: "Salons",
    line: "Example: 10% off when a customer posts about their visit.",
  },
  {
    src: "/images/landing/usecase-boutique.webp",
    alt: "Clothes on display in a small shop",
    title: "Shops",
    line: "Example: a voucher when someone sends you a new customer.",
  },
];

function WhoItsFor() {
  return (
    <section className="px-4 pb-16 sm:px-6" aria-labelledby="who-for">
      <div className="mx-auto max-w-6xl">
        <h2 id="who-for" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Who it&rsquo;s for
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {WHO.map((w) => (
            <figure key={w.title} className="overflow-hidden rounded-2xl border border-[#ddd8c8] bg-white">
              <Image src={w.src} alt={w.alt} width={640} height={480} className="h-44 w-full object-cover" />
              <figcaption className="p-4">
                <p className="text-lg font-bold">{w.title}</p>
                <p className="mt-1 text-base leading-relaxed text-[#3a382c]">{w.line}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const FALLBACK = [
  {
    title: "Referral",
    note: "A customer brings a friend",
    img: "/images/landing/usecase-cafe.webp",
    alt: "A café, an example of a referral campaign",
  },
  {
    title: "Reviews and posts",
    note: "Customers review or post about you",
    img: "/images/landing/usecase-salon.webp",
    alt: "A salon, an example of a review campaign",
  },
  {
    title: "Launch",
    note: "Get people to a new product or event",
    img: "/images/landing/usecase-boutique.webp",
    alt: "A shop, an example of a launch campaign",
  },
];

function Campaigns({ stats }: { stats: PublicStats | null }) {
  const live = stats?.pilotsKnown === false ? [] : (stats?.pilots ?? []).slice(0, 3);
  const showingLive = live.length > 0;
  return (
    <section id="campaigns" className="scroll-mt-20 px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {showingLive ? "Campaigns running now" : "What a campaign can do"}
          </h2>
          <Link href="/campaigns" className="text-base font-semibold text-[#6b4a12] underline underline-offset-4">
            See all campaigns
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showingLive
            ? live.map((p) => (
                <Link
                  key={p.id}
                  href={`/c/${p.slug}`}
                  className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#ddd8c8] bg-white hover:border-[#c7c1ac]"
                >
                  {p.coverUrl ? (
                    // Campaign covers are uploaded, so a plain img rather than next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt={`${p.title} from ${p.orgName}`} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="h-44 bg-[#ece8dc]" />
                  )}
                  <div className="p-5">
                    <p className="text-[13px] font-semibold text-[#6b4a12]">{p.orgName}</p>
                    <h3 className="mt-1 text-xl font-bold">{p.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-[#3a382c]">
                      {p.blurb?.trim() || "A live campaign from this business."}
                    </p>
                  </div>
                </Link>
              ))
            : FALLBACK.map((c) => (
                <div key={c.title} className="overflow-hidden rounded-2xl border border-[#ddd8c8] bg-white">
                  <Image src={c.img} alt={c.alt} width={640} height={400} className="h-44 w-full object-cover" />
                  <div className="p-5">
                    <h3 className="text-xl font-bold">{c.title}</h3>
                    <p className="mt-2 text-base text-[#3a382c]">{c.note}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}

function Setup() {
  return (
    <section id="why" className="scroll-mt-20 px-4 pb-16 sm:px-6">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-[#ddd8c8] bg-white lg:grid-cols-2">
        <div className="p-7 sm:p-10">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Let&rsquo;s set up your first campaign together, free.
          </h2>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[#2c2a1f]">
            Book a free 5-minute intro call with me. I&rsquo;ll explain how it works in the first minute, then we can look at the goal, the proof and the reward.
          </p>
          <p className="mt-4 text-base font-semibold">Daniel, founder</p>
          <Link href="/book" className="btn-gold mt-8">
            Book a free 5-minute call
          </Link>
        </div>
        <ul className="flex flex-col justify-center gap-5 bg-[#f8f6f0] p-7 sm:p-10">
          {["You choose the reward", "You approve every claim", "Your budget has a hard limit"].map((line) => (
            <li key={line} className="flex items-start gap-3 text-lg font-semibold">
              <Icon name="check" className="mt-1 size-5 shrink-0 text-[#6b4a12]" /> {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ChainLine({ stats }: { stats: PublicStats | null }) {
  const chain = stats?.chain;
  if (!chain) return null;
  return (
    <p className="px-4 pb-12 text-center text-base text-[#3a382c] sm:px-6">
      {num(chain.approved)} actions approved. KES {num(chain.issuedKes)} rewarded. Approvals are recorded on Avalanche
      {stats?.contract ? (
        <>
          {" "}
          (
          <a href={addressUrl(stats.contract)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            the contract
          </a>
          )
        </>
      ) : null}
      .
    </p>
  );
}

const FAQ = [
  {
    q: "Is this crypto?",
    a: "Not for you or your customers. They sign in with Google, X or email — no wallet, seed phrase or gas fees. Approvals are recorded on Avalanche in the background so the record can't be quietly changed.",
  },
  {
    q: "What does it cost?",
    a: (
      <>
        Your first campaign is free, and setup is simple.{" "}
        <Link href="/book" className="underline underline-offset-4">
          Book a free 5-minute call
        </Link>{" "}
        if you&rsquo;d like a hand, and{" "}
        <Link href="/pricing" className="underline underline-offset-4">
          see the exact prices
        </Link>{" "}
        for what campaigns cost after that.
      </>
    ),
  },
  {
    q: "What if the proof is fake?",
    a: "Nothing is rewarded until you approve it. Customers attach proof — a link, a screenshot or a photo — and you approve or reject each one. Your reward budget is capped, so you can't overspend.",
  },
  {
    q: "Who gives the reward?",
    a: "You do: airtime, a voucher, a discount or a free product. Ubu-Tangaza tracks who earned what and enforces your cap. It never holds or sends your money.",
  },
  {
    q: "Can I run this for a product launch or an event?",
    a: "Yes — a campaign is any push with a goal on it. People share, bring friends or show up; you approve what counts. Progress counts approved actions, not revenue, so we'll never promise you sales.",
  },
];

function Faq() {
  return (
    <section className="border-t border-[#ddd8c8] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions owners ask</h2>
        <div className="mt-6 border-t border-[#ddd8c8]">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-[#ddd8c8] py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold">
                {f.q}
                <Icon name="plus" className="size-4 shrink-0 text-[#6b4a12] transition group-open:rotate-45" />
              </summary>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-[#2c2a1f]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
