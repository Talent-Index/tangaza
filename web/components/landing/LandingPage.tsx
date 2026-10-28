"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FeedbackFab, FeedbackSection } from "@/components/feedback/Feedback";
import { Icon } from "@/components/icons";
import { SiteFooter } from "@/components/site/SiteChrome";
import { ThemeToggle } from "@/components/theme";
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

const POSTER = "poster";
const KICKER = "font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text";
const MUTED = "text-mist-500";
const CARD = "rounded-2xl border border-ink-700 bg-ink-850";
const PILL_AMBER =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-on-gold transition hover:bg-gold-hover";
const PILL_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-full border border-ink-500 px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-mist-100 transition hover:border-gold-line";
const PILL_CREAM =
  "inline-flex items-center justify-center gap-2 rounded-full bg-mist-100 px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-950 transition hover:opacity-90";

const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-KE"));

export function LandingPage() {
  const stats = useStats();
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-ink-950 text-mist-100">
      <FloatingPhotos />
      <div className="relative z-10">
        <Header />
        <Hero />
        <StatStrip />
        <Band />
        <HowItWorks />
        <SalonExample />
        <PickYourMoment />
        <BuildTogether stats={stats} />
        <Faq />
        <FeedbackSection />
        <SiteFooter />
      </div>
      <FeedbackFab />
    </div>
  );
}

function Header() {
  const link =
    "hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-mist-400 transition hover:text-mist-100 lg:inline";
  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="whitespace-nowrap text-base font-bold tracking-tight">
          Ubu-Tangaza<span className="text-gold-text">.</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 lg:gap-6">
          <a href="#how" className={link}>
            How it works
          </a>
          <a href="#campaigns" className={link}>
            Campaigns
          </a>
          <a href="#why" className={link}>
            Why it works
          </a>
          <Link
            href="/pricing"
            className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-mist-400 transition hover:text-mist-100 sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/auth"
            className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.1em] text-mist-400 hover:text-mist-100 sm:text-[12px] sm:tracking-[0.14em]"
          >
            Sign in
          </Link>
          <ThemeToggle className="px-2.5 sm:px-3" />
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gold px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-on-gold transition hover:bg-gold-hover sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[11px]"
          >
            Start free <Icon name="arrow-up-right" className="size-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-2.5 pt-3 sm:px-5 sm:pt-4">
      <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-3xl border border-ink-700 sm:rounded-[2rem]">
        <div aria-hidden="true" className="absolute inset-0">
          <Image
            src="/images/landing/phone-constellation.png"
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-center light:[filter:sepia(0.5)_saturate(0.85)_brightness(1.1)]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/20 light:bg-[linear-gradient(90deg,rgb(247_241_230/0.95)_30%,rgb(247_241_230/0.62)_58%,rgb(247_241_230/0.3)),linear-gradient(to_top,#f7f1e6,rgb(247_241_230/0)_40%)] max-sm:light:bg-[linear-gradient(to_top,#f7f1e6,rgb(247_241_230/0.86)_55%,rgb(247_241_230/0.74))]" />
        </div>
        <div className="relative z-10 grid grid-cols-1 items-center gap-9 px-4 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:gap-12 lg:px-12 lg:pb-24 lg:pt-14">
          <div className="min-w-0">
            <p className={`${KICKER} flex items-center gap-3`}>
              <span className="h-px w-8 bg-gold" /> New customers. Real rewards.
            </p>
            <h1 className={`${POSTER} mt-5 text-[clamp(3.15rem,12vw,5.75rem)] sm:mt-6`}>
              Get your customers to bring you <span className="text-gold-text">new</span> customers.
            </h1>
            <p className={`mt-5 max-w-md text-base leading-relaxed text-mist-400 sm:mt-6 sm:text-[17px] sm:leading-[1.65]`}>
              Your regulars already tell people about you. Now you can reward them for it. They
              bring you a new customer or come to your launch, send proof, and you check it. Only
              then do they get their airtime, voucher or discount.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={PILL_AMBER}>
                Start free <Icon name="arrow-up-right" className="size-4" />
              </Link>
              <Link href="/book" className={PILL_GHOST}>
                Book a 5-minute call
              </Link>
            </div>
            <p className={`mt-4 font-mono text-[11px] uppercase tracking-[0.14em] ${MUTED}`}>
              Your first campaign is free · nothing to pay today
            </p>
          </div>
          <ControlRoom />
        </div>
      </div>
    </section>
  );
}

function ControlRoom() {
  return (
    <div className="relative mb-10 min-w-0 sm:mb-12">
      <div className={`${CARD} relative p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:p-6`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={KICKER}>Campaign control room</p>
            <p className="mt-1 text-lg font-bold">Bring a new customer · December</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-line bg-ok-bg px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ok">
            <span className="size-1.5 rounded-full bg-ok" /> Live
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-ink-700 bg-ink-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">
                New customers approved
              </p>
              <p className={`${POSTER} mt-1 text-5xl`}>18</p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold text-on-gold">
              <Icon name="check" className="size-5" />
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full w-3/5 rounded-full bg-gold" />
          </div>
          <p className={`mt-2 text-xs ${MUTED}`}>every one of them checked and approved by the business</p>
        </div>

        <RoomRow
          label="Otieno brought 2 new clients"
          by="Payment receipt · yesterday"
          tag="APPROVED"
          tone="ok"
          dot
        />
        <RoomRow
          label="Wanjiku brought Amina"
          by="Photo at the counter · waiting for you"
          tag="CHECK IT"
          tone="gold"
        />
      </div>

      <div className="absolute -bottom-11 left-3 max-w-[250px] rounded-2xl border border-ink-700 bg-ink-800 p-3.5 shadow-[0_20px_40px_rgba(0,0,0,0.45)] sm:-left-6 sm:p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">Your target</p>
        <p className={`${POSTER} mt-1 text-lg leading-[1.15] text-gold-text`}>
          Set a target. When you hit it, you decide the reward.
        </p>
      </div>
    </div>
  );
}

function RoomRow({
  label,
  by,
  tag,
  tone,
  dot,
}: {
  label: string;
  by: string;
  tag: string;
  tone: "ok" | "gold";
  dot?: boolean;
}) {
  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {dot ? <span className="size-1.5 shrink-0 rounded-full bg-ok" /> : null}
          <span className="truncate">{label}</span>
        </p>
        <p className={`truncate text-xs ${MUTED}`}>{by}</p>
      </div>
      <span
        className={`shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
          tone === "ok" ? "text-ok" : "text-gold-text"
        }`}
      >
        {tag}
      </span>
    </div>
  );
}

function StatStrip() {
  const items = [
    { big: "KES 0", label: "To start" },
    { big: "5 min", label: "To set up" },
    { big: "100%", label: "Your control" },
  ];
  return (
    <section className="px-4 pb-10 pt-2 sm:px-6 sm:pb-14">
      <div className="mx-auto max-w-6xl border-t border-ink-700 pt-8">
        <div className="grid max-w-xl grid-cols-3 gap-3 sm:gap-6">
          {items.map((s) => (
            <div key={s.label}>
              <p className={`${POSTER} text-[2rem] sm:text-5xl`}>{s.big}</p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Band() {
  return (
    <div className="bg-gold px-4 py-4 text-on-gold sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.04em]">
          Rewards for customers who bring you customers.
        </p>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
          New customers&ensp;·&ensp;Launches&ensp;·&ensp;Events
        </p>
      </div>
    </div>
  );
}

const PATH = [
  {
    n: "01",
    title: "Pick a campaign",
    body: "Choose a ready-made one, like Bring a new customer, and set the reward you'll give.",
  },
  {
    n: "02",
    title: "Check the proof",
    body: "Customers send proof, like a photo at your counter, a link to their post or a payment receipt. You see every one.",
  },
  {
    n: "03",
    title: "Give the reward",
    body: "Approve the real ones. You give the reward yourself. Set a target. When you hit it, you decide the reward.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <div>
          <p className={KICKER}>How it works</p>
          <h2 className={`${POSTER} mt-5 text-[clamp(2.5rem,7vw,4.25rem)]`}>
            You set the reward.
            <br />
            You check the proof.
            <br />
            <span className="text-mist-500">We keep count.</span>
          </h2>
        </div>
        <ol className="min-w-0 border-t border-ink-700">
          {PATH.map((s) => (
            <li key={s.n} className="grid grid-cols-[3.5rem_1fr_auto] items-start gap-4 border-b border-ink-700 py-7">
              <span className={`${POSTER} text-3xl text-gold-text`}>{s.n}</span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${MUTED}`}>{s.body}</p>
              </div>
              <Icon name="arrow-up-right" className="mt-1 size-4 text-gold-text" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SalonExample() {
  const tiles = [
    { k: "Campaign", v: "1", d: "run by the salon" },
    { k: "New clients", v: "10", d: "from one campaign" },
    { k: "The reward", v: "Salon picks", d: "cash, a t-shirt or merchandise, or a free treat" },
  ];
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-dashed border-gold-line/70 bg-ink-800 lg:grid lg:grid-cols-[280px_1fr]">
        <div className="relative h-44 lg:h-auto lg:min-h-[220px]">
          <Image
            src="/images/landing/usecase-salon.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 280px, 100vw"
            className="object-cover object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink-800 max-lg:bg-gradient-to-t" />
        </div>
        <div className="p-6 sm:p-9 lg:p-10">
          <span className="inline-flex rounded-full border border-dashed border-gold-line px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-text">
            Example
          </span>
          <h3 className={`${POSTER} mt-4 text-[clamp(1.8rem,4vw,2.5rem)]`}>
            A salon gets 10 new clients from one campaign.
          </h3>
          <p className={`mt-3.5 max-w-xl text-[15px] leading-relaxed ${MUTED}`}>
            Whoever brought them gets a reward the salon chooses: cash, a t-shirt or merchandise,
            or a free treat.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {tiles.map((t) => (
              <div key={t.k} className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">{t.k}</p>
                <p className={`${POSTER} mt-1.5 text-[1.35rem] leading-none sm:text-3xl`}>{t.v}</p>
                <p className={`mt-1 text-[11px] leading-snug sm:text-xs ${MUTED}`}>{t.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const TEMPLATES = [
  {
    title: "Bring a new customer",
    note: "Your customers bring you someone new",
    img: "/images/landing/usecase-cafe.webp",
  },
  {
    title: "Posts and shares",
    note: "Customers post about you or share your offer",
    img: "/images/landing/usecase-salon.webp",
  },
  {
    title: "Launch something new",
    note: "People come to your launch or try it first",
    img: "/images/landing/usecase-boutique.webp",
  },
];

function PickYourMoment() {
  return (
    <section id="campaigns" className="scroll-mt-16 px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={KICKER}>Ready-made campaigns</p>
            <h2 className={`${POSTER} mt-5 text-[clamp(2.5rem,7vw,4.25rem)]`}>
              Pick your
              <br />
              moment.
            </h2>
          </div>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold-text underline underline-offset-8"
          >
            See all campaigns <Icon name="arrow-up-right" className="size-3.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((c, i) => (
            <Link
              key={c.title}
              href="/register"
              className={`${CARD} group flex min-h-[18rem] min-w-0 flex-col justify-between p-5 transition hover:border-gold/60 ${
                i === 0 ? "border-gold/50" : ""
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">
                0{i + 1} / Campaign
                <Icon
                  name="arrow-up-right"
                  className="size-4 text-gold-text transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>
              <div className="relative mt-4 h-40 overflow-hidden rounded-xl border border-ink-700">
                <Image src={c.img} alt="" fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-850/70 to-transparent" />
              </div>
              <div className="min-w-0 pt-5">
                <h3 className={`${POSTER} text-3xl`}>{c.title}</h3>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-text">{c.note}</p>
              </div>
            </Link>
          ))}
        </div>
        <p className={`mt-4 text-[13px] ${MUTED}`}>
          Your first campaign is free. We can set it up with you on a 5-minute call.
        </p>
      </div>
    </section>
  );
}

function BuildTogether({ stats }: { stats: Stats | null }) {
  const approved = stats?.chain?.approved;
  return (
    <section id="why" className="scroll-mt-16 px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid overflow-hidden rounded-3xl border border-ink-700 lg:grid-cols-[1.2fr_minmax(0,0.8fr)]">
          <div className="bg-ink-800 p-7 sm:p-12">
            <p className={KICKER}>Build it together</p>
            <h2 className={`${POSTER} mt-5 max-w-xl text-[clamp(2.3rem,6vw,3.9rem)]`}>
              Your first campaign deserves a real plan.
            </h2>
            <p className={`mt-5 max-w-md text-base leading-relaxed ${MUTED}`}>
              Book a free 5-minute call. We&apos;ll help you pick the goal, the proof and the
              reward. We can also run campaigns within your own community, with your members, on
              your behalf. You track everything.
            </p>
            <Link href="/book" className={`${PILL_CREAM} mt-8`}>
              Book a 5-minute call <Icon name="arrow-up-right" className="size-4" />
            </Link>
          </div>
          <div className="relative overflow-hidden bg-gold p-7 text-on-gold sm:p-12">
            <span className="absolute -right-16 -top-16 size-48 rounded-full border-[20px] border-[#f4b254]/60" />
            <p className={`${POSTER} text-7xl`}>01</p>
            <div className="mt-10 border-t border-on-gold/30 pt-6">
              <p className="flex items-start gap-2 text-lg font-bold leading-snug">
                <Icon name="check" className="mt-1 size-5 shrink-0" /> No vague numbers. No surprise costs.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-on-gold/75">
                You see every step before any reward goes out.
              </p>
            </div>
          </div>
        </div>

        <p className={`mt-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] ${MUTED}`}>
          {approved != null ? `${num(approved)} approved actions · ` : null}
          every one approved by the business
          {stats?.contract ? (
            <>
              {" · "}
              <a
                href={addressUrl(stats.contract)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-gold-text"
              >
                the record
              </a>
            </>
          ) : null}
        </p>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "Is this crypto?",
    a: "No. You and your customers sign in with Google, X or email. There's nothing to install. We keep a record of every approval that can't be changed later.",
  },
  {
    q: "What does it cost?",
    a: (
      <>
        Your first campaign is free. After that you pay a small fee per campaign. No monthly fee
        and no cut of your sales.{" "}
        <Link href="/pricing" className="text-gold-text underline underline-offset-4">
          See the prices
        </Link>
        .
      </>
    ),
  },
  {
    q: "What if the proof is fake?",
    a: "Nothing goes out until you check it. Customers send proof, and you approve the real ones.",
  },
  {
    q: "Who gives the reward?",
    a: "You do. Airtime, a voucher or a discount. Set a target. When you hit it, you decide the reward.",
  },
  {
    q: "Can I run this for a product launch or an event?",
    a: "Yes. People can come to your launch or try something new. You check what counts.",
  },
  {
    q: "Can you run it for us?",
    a: "Yes. We can run campaigns within your own community, with your members, on your behalf, and you track everything.",
    tag: true,
  },
];

function Faq() {
  return (
    <section className="border-t border-ink-700 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className={KICKER}>Questions owners ask</p>
        <div className="mt-6 border-t border-ink-700">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-ink-700 py-4" open={f.q === "Is this crypto?" || f.tag}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold">
                <span>
                  {f.q}
                  {f.tag ? (
                    <span className="ml-2 inline-block rounded-md bg-gold px-2 py-0.5 align-middle font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-on-gold">
                      New
                    </span>
                  ) : null}
                </span>
                <Icon name="plus" className="size-4 shrink-0 text-gold-text transition group-open:rotate-45" />
              </summary>
              <p className={`mt-3 max-w-xl text-sm leading-relaxed ${MUTED}`}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const PHOTOS = [
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
            className="h-auto w-full rounded-3xl shadow-2xl saturate-[0.9] light:[filter:sepia(0.35)_saturate(0.9)]"
          />
        </div>
      ))}
    </div>
  );
}
