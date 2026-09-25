"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle, useTheme } from "@/components/theme";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#business", label: "For businesses" },
  { href: "#contact", label: "Contact" },
];

const LIGHT = {
  "--bg-a": "#f3f0e8",
  "--bg-b": "#fbfaf7",
  "--card": "#ffffff",
  "--soft": "#f3f0e8",
  "--border": "#e7e2d6",
  "--text": "#111412",
  "--muted": "#5b605c",
} as React.CSSProperties;

const DARK = {
  "--bg-a": "#0f1418",
  "--bg-b": "#0b0e11",
  "--card": "#151b21",
  "--soft": "#151b21",
  "--border": "#232b33",
  "--text": "#f2f4f3",
  "--muted": "#9aa3a0",
} as React.CSSProperties;

const REALITY = [
  {
    icon: "💬",
    title: "The referral is invisible",
    body: "A salon client brings a friend, or a café regular shares your new menu in a group chat. The conversation is real, but it is hard to trace.",
  },
  {
    icon: "👤",
    title: "You cannot credit the right advocate",
    body: "When a new customer makes a purchase, you may not know which supporter actually brought them to your business.",
  },
  {
    icon: "🛡",
    title: "Rewards feel difficult to control",
    body: "A boutique customer refers someone through WhatsApp — but how do you check the claim, reward fairly, and keep the campaign within budget?",
  },
];

const PATH = [
  {
    step: "01",
    title: "Create your campaign",
    body: "Choose the customer action you want to encourage, the milestones, and the reward budget.",
  },
  {
    step: "02",
    title: "Supporters spread the word",
    body: "Customers and advocates share, refer, visit, or post — based on the campaign you set.",
  },
  {
    step: "03",
    title: "Proof is submitted",
    body: "Valid activity is submitted for review, giving your business a practical record of what happened.",
  },
  {
    step: "04",
    title: "You approve, they earn",
    body: "Approve the proof you trust and issue the agreed reward only for verified results.",
  },
];

const USE_CASES = [
  {
    tag: "Café or restaurant",
    title: "Bring a friend to lunch",
    body: "Encourage regulars to introduce someone new. Reward a verified first visit with a discount or a voucher for the next meal.",
    img: "/images/landing/usecase-cafe.webp",
    alt: "Two friends sharing a meal at a restaurant",
    pos: "50% 45%",
  },
  {
    tag: "Salon or barbershop",
    title: "Reward a trusted recommendation",
    body: "Ask happy clients to refer a friend for a service. After the new client's visit is verified, issue a simple perk or service discount.",
    img: "/images/landing/usecase-salon.webp",
    alt: "A hairdresser styling a client's hair in a salon",
    pos: "50% 16%",
  },
  {
    tag: "Boutique or retail shop",
    title: "Turn WhatsApp shares into visits",
    body: "Run a campaign around a collection drop or seasonal offer. Recognise supporters when a referred customer comes in and completes a purchase.",
    img: "/images/landing/usecase-boutique.webp",
    alt: "Two women looking at clothes in a boutique",
    pos: "50% 35%",
  },
];

const BUILT = [
  {
    icon: "✦",
    title: "Simple setup",
    body: "Set the action, milestone, reward, and campaign budget around the outcome that matters to you.",
  },
  {
    icon: "✓",
    title: "Verified activity",
    body: "Review submitted proof before issuing a reward. M-Pesa Till connectivity can help verify referred sales where it is available.",
  },
  {
    icon: "▤",
    title: "Controlled rewards",
    body: "Use a defined campaign budget and choose practical rewards like discounts, vouchers, cash or M-Pesa perks, airtime, or merchandise.",
  },
  {
    icon: "☺",
    title: "Easy for participants",
    body: "Participants can get involved without a crypto wallet, seed phrase, or gas fees — so the focus stays on the campaign.",
  },
];

/**
 * Colors come from CSS variables set on the root, so one set of static class names
 * serves both themes; the dark sections and the teal bands stay the same in both.
 */
export function LandingPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div
      style={dark ? DARK : LIGHT}
      className="min-h-dvh bg-[var(--bg-b)] text-[var(--text)] transition-colors"
    >
      <Header dark={dark} />
      <Hero dark={dark} />
      <Reality />
      <Path />
      <UseCases />
      <Built />
      <Trust />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-full bg-teal-500 text-sm font-bold text-white">
        U
      </span>
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : ""}`}>Ubu-Tangaza</span>
    </Link>
  );
}

function Header({ dark }: { dark: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const cta = dark
    ? "bg-white text-gray-900 hover:bg-gray-200"
    : "bg-gray-900 text-white hover:bg-black";

  return (
    <header className="bg-[var(--bg-a)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--muted)] lg:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-[var(--text)]">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/auth"
            className="hidden text-sm font-medium text-[var(--muted)] transition hover:text-[var(--text)] sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={`hidden rounded-full px-5 py-2 text-sm font-semibold transition sm:inline-block ${cta}`}
          >
            Start a campaign
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-md border border-[var(--border)] lg:hidden"
          >
            <span className="flex w-4 flex-col gap-1" aria-hidden>
              <span className={`h-0.5 w-full rounded-full bg-[var(--text)] transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`h-0.5 w-full rounded-full bg-[var(--text)] transition ${open ? "opacity-0" : ""}`} />
              <span className={`h-0.5 w-full rounded-full bg-[var(--text)] transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-[var(--border)] px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link href="/auth" onClick={() => setOpen(false)} className="text-[var(--muted)]">
              Sign in
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className={`mt-1 rounded-full px-5 py-2.5 text-center font-semibold ${cta}`}
            >
              Start a campaign
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-500 ${className}`}>
      {children}
    </p>
  );
}

function Hero({ dark }: { dark: boolean }) {
  return (
    <section className="bg-[var(--bg-a)] px-4 pb-20 pt-6 sm:px-6 sm:pb-24 sm:pt-10">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <Kicker>Word of mouth, made visible</Kicker>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Turn happy customers into measurable referrals.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Ubu-Tangaza helps businesses launch verified referral campaigns, see
            what brought customers through the door, and reward real results.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-500"
            >
              Start a campaign ↗
            </Link>
            <a
              href="#how"
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-sm font-semibold transition hover:border-teal-500"
            >
              See how it works ⊙
            </a>
          </div>
          <p className="mt-6 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
            For cafés, salons, boutiques, retailers, service teams and event businesses.
          </p>
        </div>

        <HeroVisual dark={dark} />
      </div>
    </section>
  );
}

function HeroVisual({ dark }: { dark: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-md pb-14 lg:max-w-none">
      <div className="absolute -right-4 bottom-6 h-[78%] w-[80%] rounded-[2rem] bg-teal-500" aria-hidden />
      <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#3b2a1e] via-[#261c15] to-[#120f0d] shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/landing/hero-campaign.webp"
          alt="A shop owner checking a referral on her phone in her café"
          width={1400}
          height={933}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: "35% 40%" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-xl bg-white p-3.5 text-gray-900 shadow-lg sm:inset-x-6">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700">✓</span>
          <div>
            <p className="text-sm font-semibold">A referral has been submitted</p>
            <p className="text-xs text-gray-500">Review the activity, approve what is valid, then issue the reward.</p>
          </div>
        </div>
      </div>

      <div
        className={`absolute inset-x-6 bottom-0 grid grid-cols-3 rounded-xl p-3 text-center shadow-xl sm:inset-x-10 ${
          dark ? "bg-[#1b232a]" : "bg-white"
        }`}
      >
        {[
          ["💬", "Recommend"],
          ["🧾", "Verify visit"],
          ["🎁", "Reward"],
        ].map(([icon, label], i) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span
              className={`grid size-8 place-items-center rounded-full text-sm ${
                i === 2 ? "bg-teal-500 text-white" : "bg-teal-500/15"
              }`}
            >
              {icon}
            </span>
            <span className="text-[11px] font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reality() {
  return (
    <section className="bg-[var(--bg-b)] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Kicker>The everyday reality</Kicker>
        <h2 className="mt-3 max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          Your customers already recommend you. You just can&rsquo;t see what happens next.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {REALITY.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
              <span className="grid size-9 place-items-center rounded-lg bg-teal-500/15 text-base">{item.icon}</span>
              <p className="mt-5 font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Path() {
  return (
    <section id="how" className="scroll-mt-4 bg-[#1a1a17] px-4 py-16 text-white sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <Kicker>A clear path from mention to reward</Kicker>
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            Run word-of-mouth campaigns with proof built in.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
            Ubu-Tangaza keeps the campaign simple for your team and clear for the customers
            who support your business.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {PATH.map((item) => (
            <div key={item.step} className="rounded-xl border border-white/10 bg-[#24241f] p-5">
              <p className="text-xs font-semibold text-teal-400">{item.step}</p>
              <p className="mt-6 font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section id="use-cases" className="scroll-mt-4 bg-[var(--bg-a)] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Kicker>Campaign ideas for everyday business</Kicker>
            <h2 className="mt-3 max-w-md text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Made for the places people already talk about.
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)]">
            Start with one clear action, one real reward, and a campaign your team can manage.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {USE_CASES.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.img}
                alt={item.alt}
                loading="lazy"
                width={1000}
                height={600}
                className="h-56 w-full object-cover"
                style={{ objectPosition: item.pos }}
              />
              <div className="p-6">
                <Kicker className="!text-[10px]">{item.tag}</Kicker>
                <p className="mt-2 text-lg font-bold">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
              </div>
            </article>
          ))}

          <article className="flex flex-col justify-end rounded-2xl bg-teal-600 p-7 text-white">
            <span className="grid size-9 place-items-center rounded-lg bg-white/15">🎟️</span>
            <p className="mt-16 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-100">
              Event or experience business
            </p>
            <p className="mt-2 text-xl font-bold leading-snug">Fill the next experience with people who care.</p>
            <p className="mt-2 text-sm leading-relaxed text-teal-50">
              Invite past guests to share an upcoming tasting, show, pop-up, or experience.
              Offer approved advocates airtime, merchandise, vouchers, or cash perks.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function Built() {
  return (
    <section id="business" className="scroll-mt-4 bg-[var(--bg-b)] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <Kicker>Built for real local businesses</Kicker>
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            A campaign you can run without making it complicated.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            Keep your team focused on customers. Ubu-Tangaza helps you set the rules, review
            activity, and make each reward decision with context.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {BUILT.map((item) => (
            <div key={item.title} className="rounded-xl border border-[var(--border)] bg-[var(--soft)] p-5">
              <span className="text-teal-500" aria-hidden>{item.icon}</span>
              <p className="mt-5 font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="bg-[var(--bg-a)] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl rounded-3xl bg-[#1a1a17] p-8 text-white sm:p-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div>
            <Kicker>Trust and accountability</Kicker>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-teal-400 sm:text-3xl">
              Reward real activity — not guesswork.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-400">
              Ubu-Tangaza is designed so activity can be reviewed before rewards are issued.
              Your campaign spending can be capped and recorded, giving you a clearer view of
              where each reward is going.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#24241f] p-5">
            <p className="text-sm font-semibold text-teal-400">For transparency</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Protected campaign budgets can be recorded on Avalanche Fuji to support a
              transparent record of campaign activity. This works in the background — your
              business and participants do not need to manage crypto wallets.
            </p>
            <a
              href={addressUrl(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-teal-400 underline underline-offset-4 hover:text-teal-300"
            >
              Verify on-chain →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-teal-600 px-4 py-20 text-center text-white sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100">
          For businesses of every size
        </p>
        <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          Turn word of mouth into something you can measure.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-teal-50 sm:text-base">
          If your business grows through referrals, repeat customers, social sharing, and
          walk-ins, see whether Ubu-Tangaza fits the way you already work.
        </p>
        <Link
          href="/register"
          className="mt-7 inline-block rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          Start a campaign ↗
        </Link>
        <p className="mt-4 text-xs text-teal-100">
          Start with one clear campaign goal and one reward your customers will value.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contact" className="scroll-mt-4 bg-[#1a1a17] px-4 py-12 text-white sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 md:flex-row md:items-end">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-400">
            Trackable word-of-mouth campaigns for local businesses built around proof,
            accountability, and shared rewards.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-gray-400 md:items-end">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </a>
            ))}
          </div>
          <a href="mailto:danielmwihoti@ubutangaza.biz" className="underline underline-offset-4 hover:text-white">
            danielmwihoti@ubutangaza.biz
          </a>
        </div>
      </div>
    </footer>
  );
}
