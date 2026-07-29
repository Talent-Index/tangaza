"use client";

import Link from "next/link";
import { SignIn } from "@/components/customer/SignIn";
import { BrandMark, Button } from "@/components/ui";
import { CREDIT_VALUE_KES, MILESTONE_ACTIVITIES } from "@/lib/chain";
import { kesLabel } from "@/lib/format";

const NAV = [
  { href: "#about", label: "About" },
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Why us" },
  { href: "#signin", label: "Contact" },
];

const CARDS = [
  {
    title: "Referrals that count",
    body: "Walk someone in, share your link, or host an event. The business approves what is real — and only then does it count toward your reward.",
    visual: "refer",
    offset: "lg:mt-0",
  },
  {
    title: "Posts with proof",
    body: "Shout-outs on X, Reels, WhatsApp status — submit the link or screenshot. Weighted by what the business values most.",
    visual: "post",
    offset: "lg:mt-24",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-ink-950 text-mist-100">
      <LandingNav />
      <Hero />
      <Solutions />
      <WhyUs />
      <PortalSignIn />
      <footer className="border-t border-ink-700/80 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <p className="max-w-md text-sm text-mist-500">
            Proof-of-advocacy rewards on Avalanche. Budgets are capped once and can never
            be raised.
          </p>
          <Link
            href="/register"
            className="text-sm text-mist-400 underline underline-offset-4 hover:text-mist-200"
          >
            I run a business →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 px-4 pt-5 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-md bg-ink-950/90 px-3 py-2 backdrop-blur"
          aria-label="Ubu-Tangaza home"
        >
          <BrandMark />
        </Link>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-ink-900/70 px-2 py-1.5 backdrop-blur md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-300 transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-white/25 sm:block" aria-hidden />
            <a
              href="#signin"
              className="rounded-full bg-crimson-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-crimson-400"
            >
              Sign in
            </a>
          </nav>

          <a
            href="#signin"
            className="rounded-full bg-crimson-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white md:hidden"
          >
            Sign in
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="about"
      className="relative flex min-h-dvh items-end overflow-hidden pb-20 pt-28 sm:items-center sm:pb-24"
    >
      {/* Atmosphere — no stock photo; sharp geometry + gradient */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgb(30_122_239/0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgb(5_11_24/0.55)_55%,rgb(5_11_24)_92%)]" />
        <div className="absolute -right-20 top-24 h-[28rem] w-[28rem] rounded-full border border-crimson-500/20" />
        <div className="absolute -right-8 top-40 h-[20rem] w-[20rem] rounded-full border border-white/5" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <div className="max-w-xl animate-fade-up">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Advocacy, rewarded.
            <br />
            Community, paid.
          </h1>

          <div className="mt-6 flex items-center gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-crimson-400" />
            <span className="h-px w-8 bg-white/35" />
            <span className="h-px w-8 bg-white/20" />
            <span className="h-px w-8 bg-white/10" />
          </div>

          <p className="mt-6 max-w-md text-base leading-relaxed text-mist-300 sm:text-lg">
            Ubu-Tangaza pays you for real advocacy — referrals, posts, events — from a
            business budget written once on Avalanche and never raised.
          </p>

          <div className="mt-9 flex items-center gap-3">
            <Button href="#how" variant="light" className="px-7">
              Explore how it works
            </Button>
            <a
              href="#signin"
              aria-label="Go to sign in"
              className="grid size-12 place-items-center rounded-full bg-white text-ink-950 transition hover:bg-mist-100"
            >
              <span aria-hidden className="text-lg leading-none">
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Solutions() {
  return (
    <section id="how" className="border-t border-ink-800 bg-ink-950 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl animate-fade-up">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Connected reward
            <br />
            solutions
          </h2>
          <p className="mt-5 text-base leading-relaxed text-mist-400">
            Whether it is a walk-in referral or a shout-out on X, Ubu-Tangaza coordinates
            proof, approval, and payout in one loop — so you earn without juggling
            spreadsheets or seed phrases.
          </p>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-2 md:gap-12">
          {CARDS.map((card, i) => (
            <article
              key={card.title}
              className={`animate-fade-up ${card.offset}`}
              style={{ animationDelay: `${120 + i * 100}ms` }}
            >
              <div className="overflow-hidden rounded-sm border border-ink-600/80">
                <CardVisual kind={card.visual} />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-500">{card.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-20 grid gap-6 border-t border-ink-800 pt-12 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Submit",
              body: "File a referral, post, or event with the proof the business asks for.",
            },
            {
              step: "02",
              title: "Get approved",
              body: "The business signs approval on-chain. That is what makes it real.",
            },
            {
              step: "03",
              title: "Claim",
              body: `Every ${MILESTONE_ACTIVITIES} approved activities unlocks ${kesLabel(CREDIT_VALUE_KES)} you can redeem.`,
            },
          ].map((item) => (
            <div key={item.step}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-crimson-400">
                {item.step}
              </p>
              <p className="mt-2 font-display text-lg font-bold text-white">{item.title}</p>
              <p className="mt-2 text-sm text-mist-500">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardVisual({ kind }: { kind: string }) {
  if (kind === "post") {
    return (
      <div className="relative flex aspect-[16/10] items-end bg-gradient-to-br from-ink-800 via-ink-850 to-ink-950 p-6">
        <div className="absolute right-8 top-8 h-24 w-24 rounded-full border border-crimson-400/30" />
        <div className="absolute right-16 top-16 h-16 w-16 rounded-full bg-crimson-500/20 blur-xl" />
        <div className="relative w-full max-w-xs rounded-xl border border-ink-600 bg-ink-900/80 p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-ink-700 text-xs font-bold">
              𝕏
            </span>
            <div className="h-2 w-24 rounded-full bg-ink-600" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-full rounded-full bg-ink-700" />
            <div className="h-2 w-[80%] rounded-full bg-ink-700" />
            <div className="h-2 w-[65%] rounded-full bg-ink-700" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[#0c1c3a] via-ink-850 to-ink-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgb(30_122_239/0.25),transparent_50%)]" />
      <div className="relative grid w-full max-w-sm grid-cols-3 gap-3 px-8">
        {["👥", "🎤", "★"].map((icon, i) => (
          <div
            key={icon}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border border-ink-600/80 bg-ink-900/70"
            style={{ transform: `translateY(${i === 1 ? -8 : 0}px)` }}
          >
            <span className="text-xl" aria-hidden>
              {icon}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhyUs() {
  return (
    <section id="why" className="border-t border-ink-800 px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A budget everyone can audit
          </h2>
          <p className="mt-5 text-base leading-relaxed text-mist-400">
            The emission cap is set once at registration. No function can raise it. Credits
            only exist because a business approved a real activity — and every claim shrinks
            outstanding liability on Avalanche Fuji.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              "No seed phrase. No gas fees. Social sign-in only.",
              "Pilot with Blockchain Centre Kenya — built for Team1 Kenya.",
              `${kesLabel(CREDIT_VALUE_KES)} per milestone, paid as real rewards.`,
            ].map((line) => (
              <li key={line} className="flex gap-3 text-sm text-mist-300">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-crimson-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mist-500">
            Solvency promise
          </p>
          <p className="mt-4 font-display text-2xl font-bold leading-snug text-white">
            The reward budget can never grow — only shrink as people claim.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-mist-500">
            That rule is enforced by the contract, not by a settings toggle. Advocacy is a
            community act; the return should be something the community can verify.
          </p>
        </div>
      </div>
    </section>
  );
}

function PortalSignIn() {
  return (
    <section
      id="signin"
      className="relative border-t border-ink-800 px-6 py-24"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_40%,rgb(30_122_239/0.12),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <div className="rounded-md bg-ink-900 px-3 py-2">
            <BrandMark className="text-base" />
          </div>
          <Link
            href="/org"
            className="text-sm text-mist-400 underline underline-offset-4 hover:text-mist-200"
          >
            Sign in as business
          </Link>
        </div>

        <div className="card animate-fade-up px-6 py-8 sm:px-8">
          <p className="text-center text-sm text-mist-500">
            Log in to manage your advocacy rewards
          </p>
          <h2 className="mt-3 text-center font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
            Advocate portal.
          </h2>

          <div className="mt-8">
            <SignIn />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 text-xs text-mist-500">
            <Link href="/register" className="hover:text-mist-300">
              No business account? Register →
            </Link>
            <span className="text-mist-600">No fees — ever</span>
          </div>
        </div>
      </div>
    </section>
  );
}
