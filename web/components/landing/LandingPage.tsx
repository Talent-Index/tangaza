"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FeedbackFab, FeedbackSection } from "@/components/feedback/Feedback";
import { Icon } from "@/components/icons";
import { SiteFooter } from "@/components/site/SiteChrome";
import { addressUrl } from "@/lib/chain";

interface Stats {
  awaiting: number | null;
  chain: {
    businesses: number;
    approved: number;
    capKes: number;
    issuedKes: number;
    redeemedKes: number;
  } | null;
  contract: string;
  pilots: Array<{
    id: string;
    slug: string;
    title: string;
    orgName: string;
    blurb?: string;
    coverUrl?: string;
  }>;
}

function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Stats | null) => {
        if (!cancelled && j) setStats(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

/*
 * The "control room" direction: warm charcoal, one amber, poster type. This page owns
 * its palette outright (no theme variants) — the design is dark by nature, like the
 * campaign mock it comes from.
 */
const BG = "bg-[#131008]";
const CARD = "rounded-2xl border border-[#2d2619] bg-[#1b1710]";
const AMBER = "#e9a23b";
const CREAM = "text-[#f1e9db]";
const MUTED = "text-[#9d937f]";
const POSTER = "font-[family-name:var(--font-anton)] uppercase leading-[0.92] tracking-[0.01em]";
const KICKER = "font-mono text-[11px] uppercase tracking-[0.22em] text-[#e9a23b]";
const PILL_AMBER =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#e9a23b] px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[#17130b] transition hover:bg-[#f4b254]";
const PILL_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[#443a28] px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[#f1e9db] transition hover:border-[#e9a23b]";

const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-KE"));

export function LandingPage() {
  const stats = useStats();
  return (
    <div className={`${BG} relative min-h-dvh overflow-x-clip ${CREAM}`}>
      <FloatingPhotos />
      <div className="relative z-10">
        <Header />
        <Hero stats={stats} />
        <StatStrip />
        <Band />
        <ClearPath />
        <PickYourMoment stats={stats} />
        <WhyItWorks stats={stats} />
        <Faq />
        <FeedbackSection />
        <SiteFooter />
      </div>
      <FeedbackFab />
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

function Header() {
  const link = "hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b7ac96] transition hover:text-[#f1e9db] md:inline";
  return (
    <header className="sticky top-0 z-30 border-b border-[#2d2619]/60 bg-[#131008]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="whitespace-nowrap text-base font-bold tracking-tight">
          Ubu-Tangaza<span className="text-[#e9a23b]">.</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <a href="#how" className={link}>
            How it works
          </a>
          <a href="#campaigns" className={link}>
            Campaigns
          </a>
          <a href="#why" className={link}>
            Why it works
          </a>
          {/* Visible on phones too — a price nobody can find reads as a price being hidden. */}
          <Link
            href="/pricing"
            className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b7ac96] transition hover:text-[#f1e9db]"
          >
            Pricing
          </Link>
          <Link href="/auth" className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b7ac96] hover:text-[#f1e9db]">
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#e9a23b] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#17130b] transition hover:bg-[#f4b254] sm:px-5"
          >
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Start a campaign</span> <Icon name="arrow-up-right" className="size-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero({ stats }: { stats: Stats | null }) {
  return (
    <section className="px-3 pt-4 sm:px-5">
      <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-[2rem] border border-[#2d2619]">
        {/* The scene itself: the constellation phone fading into the check-card phone
            and back — a slow ambient loop, fully visible behind a readability gradient. */}
        <div aria-hidden="true" className="absolute inset-0">
          <Image
            src="/images/landing/phone-check-coins.png"
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-center"
          />
          <Image
            src="/images/landing/phone-constellation.png"
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-center motion-safe:animate-[crossfade_18s_ease-in-out_infinite]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#131008] via-[#131008]/55 to-[#131008]/20" />
        </div>
        <div className="relative z-10 grid grid-cols-1 items-center gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:px-12 lg:pb-24">
        <div className="min-w-0">
          <p className={`${KICKER} flex items-center gap-3`}>
            <span className="h-px w-8 bg-[#e9a23b]" /> Verified actions. Real rewards.
          </p>
          <h1 className={`${POSTER} mt-6 text-[clamp(3.4rem,11vw,7.5rem)]`}>
            Make every
            <br />
            <span className="text-[#e9a23b]">action</span>
            <br />
            count.
          </h1>
          <p className={`mt-6 max-w-md text-base leading-relaxed sm:text-lg ${MUTED}`}>
            Turn referrals, visits and social proof into rewards your business controls. Run
            campaigns with clear goals, verified progress and only the outcomes you approve.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className={PILL_AMBER}>
              Create your campaign <Icon name="arrow-up-right" className="size-4" />
            </Link>
            <a href="#how" className={PILL_GHOST}>
              See the process
            </a>
          </div>
        </div>

        <ControlRoom stats={stats} />
        </div>
      </div>
    </section>
  );
}

/** The product, as a card: a live campaign mid-approval. Real numbers when we have them. */
function ControlRoom({ stats }: { stats: Stats | null }) {
  const approved = stats?.chain?.approved ?? null;
  const title = stats?.pilots[0]?.title ?? "Referral sprint";
  return (
    <div className="relative mb-10 min-w-0">
      <div className={`${CARD} relative p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:p-6`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={KICKER}>Campaign control room</p>
            <p className="mt-1 truncate text-lg font-bold">{title}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2e4d33] bg-[#17241a] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7fc98b]">
            <span className="size-1.5 rounded-full bg-[#7fc98b]" /> Live
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-[#2d2619] bg-[#141109] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9d937f]">Approved actions</p>
              <p className={`${POSTER} mt-1 text-5xl`}>{approved === null ? "—" : num(approved)}</p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e9a23b] text-[#17130b]">
              <Icon name="check" className="size-5" />
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#2d2619]">
            <div className="h-full w-3/4 rounded-full bg-[#e9a23b]" />
          </div>
          <p className={`mt-2 text-xs ${MUTED}`}>every one of them approved by the business, on-chain</p>
        </div>

        <div className="mt-3 space-y-2.5">
          <RoomRow label="Bring a friend to a session" by="Submitted with proof" tag="approved" />
          <RoomRow label="Share your launch post" by="Awaiting your review" tag="review" />
        </div>
      </div>

      {/* The promise, floated like a stamp over the card's corner. */}
      <div className="absolute -bottom-12 left-4 max-w-[240px] rounded-2xl border border-[#2d2619] bg-[#17130b] p-4 shadow-xl sm:-left-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9d937f]">Reward budget</p>
        <p className={`${POSTER} mt-1 text-xl text-[#e9a23b]`}>Keeps its promise</p>
      </div>
    </div>
  );
}

function RoomRow({ label, by, tag }: { label: string; by: string; tag: "approved" | "review" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2d2619] bg-[#141109] px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {tag === "approved" ? <span className="size-1.5 shrink-0 rounded-full bg-[#7fc98b]" /> : null}
          {label}
        </p>
        <p className={`truncate text-xs ${MUTED}`}>{by}</p>
      </div>
      <span
        className={`shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
          tag === "approved" ? "text-[#7fc98b]" : "text-[#e9a23b]"
        }`}
      >
        {tag}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- stats row */

function StatStrip() {
  const items = [
    { big: "100%", label: "Your control" },
    { big: "0", label: "Guesswork" },
    { big: "1", label: "Clear goal" },
  ];
  return (
    <section className="px-4 pb-16 sm:px-6">
      <div className="mx-auto max-w-6xl border-t border-[#2d2619] pt-8">
        <div className="grid max-w-xl grid-cols-3 gap-6">
          {items.map((s) => (
            <div key={s.label}>
              <p className={`${POSTER} text-4xl sm:text-5xl`}>{s.big}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9d937f]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Band() {
  return (
    <div className="bg-[#e9a23b] px-4 py-4 text-[#17130b] sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.04em]">
          The campaign platform for businesses that back their word.
        </p>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
          Referrals&ensp;·&ensp;Engagement&ensp;·&ensp;Launches
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the path */

const PATH = [
  {
    n: "01",
    title: "Set the goal",
    body: "Choose the action that turns attention into a measurable outcome — and the reward you'll honour for it.",
  },
  {
    n: "02",
    title: "Review proof",
    body: "See every submission — a link, a screenshot, a receipt — before it moves your campaign forward.",
  },
  {
    n: "03",
    title: "Release rewards",
    body: "Approve the moments that matter. Each approval lands on Avalanche, and your capped budget only counts what you approved.",
  },
];

function ClearPath() {
  return (
    <section id="how" className="scroll-mt-16 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className={KICKER}>The clear path</p>
          <h2 className={`${POSTER} mt-5 text-[clamp(2.6rem,7vw,4.5rem)]`}>
            You set the
            <br />
            standard.
            <br />
            <span className="text-[#6e6350]">We keep the receipts.</span>
          </h2>
        </div>
        <ol className="min-w-0 border-t border-[#2d2619]">
          {PATH.map((s) => (
            <li key={s.n} className="grid grid-cols-[3.5rem_1fr_auto] items-start gap-4 border-b border-[#2d2619] py-7">
              <span className={`${POSTER} text-3xl text-[#e9a23b]`}>{s.n}</span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${MUTED}`}>{s.body}</p>
              </div>
              <Icon name="arrow-up-right" className="mt-1 size-4 text-[#e9a23b]" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- campaign cards */

const TEMPLATES = [
  { title: "Verified Referral Campaign", note: "Friends through the door, proven" },
  { title: "Customer Engagement Campaign", note: "Posts, reviews and visits that count" },
  { title: "Product Launch Campaign", note: "A push with a number on it" },
];

/** Every card gets a picture — the campaign's own cover when it has one, these otherwise. */
const CARD_IMGS = [
  "/images/landing/usecase-cafe.webp",
  "/images/landing/usecase-salon.webp",
  "/images/landing/usecase-boutique.webp",
];

function PickYourMoment({ stats }: { stats: Stats | null }) {
  const live = (stats?.pilots ?? []).slice(0, 3);
  const cards = live.length
    ? live.map((p, i) => ({
        key: p.id,
        href: `/c/${p.slug}`,
        n: `0${i + 1}`,
        title: p.title,
        note: `Live now · ${p.orgName}`,
        img: p.coverUrl || CARD_IMGS[i % CARD_IMGS.length],
      }))
    : TEMPLATES.map((t, i) => ({
        key: t.title,
        href: "/register",
        n: `0${i + 1}`,
        title: t.title,
        note: t.note,
        img: CARD_IMGS[i],
      }));

  return (
    <section id="campaigns" className="scroll-mt-16 px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={KICKER}>{live.length ? "Running right now" : "Start with a clear brief"}</p>
            <h2 className={`${POSTER} mt-5 text-[clamp(2.6rem,7vw,4.5rem)]`}>
              Pick your
              <br />
              moment.
            </h2>
          </div>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#e9a23b] underline underline-offset-8 hover:text-[#f4b254]"
          >
            See all campaigns <Icon name="arrow-up-right" className="size-3.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => (
            <Link
              key={c.key}
              href={c.href}
              className={`${CARD} group flex min-h-[18rem] min-w-0 flex-col justify-between p-5 transition hover:border-[#e9a23b]/60 ${
                i === 1 ? "border-[#e9a23b]/50" : ""
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[#9d937f]">
                {c.n} / Campaign
                <Icon name="arrow-up-right" className="size-4 text-[#e9a23b] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div className="relative mt-4 h-40 overflow-hidden rounded-xl border border-[#2d2619]">
                {/* Campaign covers can live anywhere (uploads), so a plain img, not next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.img}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1b1710]/70 to-transparent" />
              </div>
              <div className="min-w-0 pt-5">
                <h3 className={`${POSTER} break-words text-3xl`}>{c.title}</h3>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#e9a23b]">{c.note}</p>
              </div>
            </Link>
          ))}
        </div>
        {!live.length ? (
          <p className={`mt-4 text-xs ${MUTED}`}>Your first campaign is free — we set it up with you.</p>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- the big CTA */

function WhyItWorks({ stats }: { stats: Stats | null }) {
  return (
    <section id="why" className="scroll-mt-16 px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid overflow-hidden rounded-3xl border border-[#2d2619] lg:grid-cols-[1.2fr_minmax(0,0.8fr)]">
          <div className="bg-[#17130b] p-7 sm:p-12">
            <p className={KICKER}>Build it together</p>
            <h2 className={`${POSTER} mt-5 max-w-xl text-[clamp(2.4rem,6vw,4rem)]`}>
              Your first campaign deserves a real plan.
            </h2>
            <p className={`mt-5 max-w-md text-base leading-relaxed ${MUTED}`}>
              Book a free 30-minute setup session. We will help you map the goal, the proof and
              the reward without losing sight of your business.
            </p>
            <Link
              href="/book"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#f1e9db] px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[#17130b] transition hover:bg-white"
            >
              Build my first campaign <Icon name="arrow-up-right" className="size-4" />
            </Link>
          </div>
          <div className="relative overflow-hidden bg-[#e9a23b] p-7 text-[#17130b] sm:p-12">
            <span className="absolute -right-16 -top-16 size-48 rounded-full border-[20px] border-[#f4b254]/60" />
            <p className={`${POSTER} text-7xl`}>01</p>
            <div className="mt-10 border-t border-[#17130b]/30 pt-6">
              <p className="flex items-start gap-2 text-lg font-bold leading-snug">
                <Icon name="check" className="mt-1 size-5 shrink-0" /> No vague numbers. No unclear payouts.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#17130b]/75">
                Every step is visible before your reward budget moves.
              </p>
            </div>
          </div>
        </div>

        {/* The receipts, literally: live on-chain numbers under the promise. */}
        <p className={`mt-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] ${MUTED}`}>
          Live on Avalanche · {num(stats?.chain?.approved)} approved actions · KES {num(stats?.chain?.issuedKes)} rewarded ·{" "}
          {stats?.contract ? (
            <a href={addressUrl(stats.contract)} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-[#e9a23b]">
              the contract
            </a>
          ) : (
            "the contract"
          )}
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- faq */

const FAQ = [
  {
    q: "Is this crypto?",
    a: "Not for you or your customers. They sign in with Google, X or email — no wallet, seed phrase or gas fees. Approvals are recorded on Avalanche in the background so the record can't be quietly changed.",
  },
  {
    q: "What does it cost?",
    a: (
      <>
        Your first 2 campaigns are free — run them, see the referrals arrive, decide with
        your own numbers. After that it&rsquo;s a small one-off price per campaign, paid
        by M-Pesa. No subscription, no cut of your sales.{" "}
        <Link href="/pricing" className="text-[#e9a23b] underline underline-offset-4">
          See the exact prices
        </Link>
        .
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
    <section className="border-t border-[#2d2619] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className={KICKER}>Questions owners ask</p>
        <div className="mt-6 border-t border-[#2d2619]">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-[#2d2619] py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold">
                {f.q}
                <Icon name="plus" className="size-4 shrink-0 text-[#e9a23b] transition group-open:rotate-45" />
              </summary>
              <p className={`mt-3 max-w-xl text-sm leading-relaxed ${MUTED}`}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- floating photo layer */

const PHOTOS = [
  // Gold reward coins by the phone — swells gently as you scroll past the clear path.
  {
    src: "/images/landing/reward-coins.png",
    className: "right-[-6rem] top-[135vh] w-72 rotate-6 opacity-35 sm:right-[-3rem] lg:right-10",
    speed: -0.08,
    zoom: 0.0003,
  },
  {
    src: "/images/landing/usecase-cafe.webp",
    className: "left-[-6rem] top-[235vh] w-72 -rotate-3 opacity-35 lg:left-2",
    speed: -0.07,
    zoom: 0,
  },
  {
    src: "/images/landing/usecase-salon.webp",
    className: "right-[-4rem] top-[330vh] w-56 rotate-3 opacity-35 lg:right-8",
    speed: -0.1,
    zoom: 0,
  },
];

/**
 * Photos drifting slowly behind the content as you scroll — decoration only, so they
 * sit in their own non-interactive layer and move via a single rAF-throttled scroll
 * listener writing transforms directly (no re-renders).
 */
function FloatingPhotos() {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = Array.from(wrap.current?.querySelectorAll<HTMLElement>("[data-speed]") ?? []);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        for (const el of els) {
          // Drift with the scroll; a photo with a zoom also swells and shrinks with it.
          const zoom = Number(el.dataset.zoom);
          const scale = zoom ? Math.min(1 + y * zoom, 1.35) : 1;
          el.style.transform = `translateY(${y * Number(el.dataset.speed)}px) scale(${scale})`;
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={wrap} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-clip">
      {PHOTOS.map((p) => (
        <div key={p.src} data-speed={p.speed} data-zoom={p.zoom} className={`absolute ${p.className}`}>
          <Image
            src={p.src}
            alt=""
            width={384}
            height={384}
            className="h-auto w-full rounded-3xl shadow-2xl saturate-[0.9]"
          />
        </div>
      ))}
    </div>
  );
}
