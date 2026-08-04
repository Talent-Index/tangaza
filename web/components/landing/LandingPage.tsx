"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark, Button } from "@/components/ui";
import { MILESTONE_ACTIVITIES } from "@/lib/chain";

const NAV = [
  { href: "#about", label: "About" },
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Why us" },
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
    <div className="min-h-dvh overflow-x-clip bg-ink-950 text-mist-100">
      <LandingNav />
      <Hero />
      <LiveCampaigns />
      <Solutions />
      <WhyUs />
      <footer className="border-t border-ink-700/80 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <p className="max-w-md text-sm leading-relaxed text-mist-500">
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <header
      className={`absolute inset-x-0 top-0 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 ${
        open ? "z-50" : "z-30"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link
          href="/"
          className="min-w-0 shrink rounded-md bg-ink-950/90 px-2.5 py-2 backdrop-blur sm:px-3"
          aria-label="Ubu-Tangaza home"
          onClick={close}
        >
          <BrandMark className="text-base sm:text-lg" />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-ink-900/70 px-2 py-1.5 backdrop-blur lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-300 transition hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <span className="mx-1 h-4 w-px bg-white/25" aria-hidden />
          <Link
            href="/auth"
            className="rounded-full bg-crimson-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-crimson-400"
          >
            Sign in
          </Link>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/auth"
            className="rounded-full bg-crimson-500 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            onClick={close}
          >
            Sign in
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-full border border-white/15 bg-ink-900/80 text-white backdrop-blur"
          >
            <span className="flex w-4 flex-col gap-1" aria-hidden>
              <span
                className={`h-0.5 w-full rounded-full bg-white transition ${open ? "translate-y-1.5 rotate-45" : ""}`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-white transition ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-white transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="fixed inset-0 z-40 bg-ink-950/95 px-4 pt-24 backdrop-blur-md lg:hidden"
        >
          <nav className="mx-auto flex max-w-sm flex-col gap-2">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={close}
                className="rounded-full border border-ink-700 bg-ink-900 px-5 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-mist-100"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/register"
              onClick={close}
              className="mt-4 text-center text-sm text-mist-400 underline underline-offset-4"
            >
              I run a business →
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <section
      id="about"
      className="relative flex min-h-dvh items-end overflow-hidden pb-16 pt-24 sm:items-center sm:pb-24 sm:pt-28"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgb(30_122_239/0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgb(5_11_24/0.55)_55%,rgb(5_11_24)_92%)]" />
        <div className="absolute -right-32 top-16 h-[22rem] w-[22rem] rounded-full border border-crimson-500/20 sm:-right-20 sm:top-24 sm:h-[28rem] sm:w-[28rem]" />
        <div className="absolute -right-16 top-32 h-[14rem] w-[14rem] rounded-full border border-white/5 sm:-right-8 sm:top-40 sm:h-[20rem] sm:w-[20rem]" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="max-w-xl animate-fade-up">
          <h1 className="font-display text-[2.35rem] font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Advocacy, rewarded.
            <br />
            Community, paid.
          </h1>

          <div className="mt-5 flex items-center gap-1.5 sm:mt-6" aria-hidden>
            <span className="size-2 rounded-full bg-crimson-400" />
            <span className="h-px w-8 bg-white/35" />
            <span className="h-px w-8 bg-white/20" />
            <span className="h-px w-8 bg-white/10" />
          </div>

          <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-mist-300 sm:mt-6 sm:text-lg">
            Ubu-Tangaza pays you for real advocacy — referrals, posts, events — from a
            business budget written once on Avalanche and never raised.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-9">
            <Button href="#how" variant="light" className="min-h-12 px-5 sm:px-7">
              How it works
            </Button>
            <Link
              href="/auth"
              aria-label="Go to sign in"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-ink-950 transition hover:bg-mist-100"
            >
              <span aria-hidden className="text-lg leading-none">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Solutions() {
  return (
    <section id="how" className="border-t border-ink-800 bg-ink-950 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl animate-fade-up">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Connected reward
            <br />
            solutions
          </h2>
          <p className="mt-4 text-base leading-relaxed text-mist-400 sm:mt-5">
            Whether it is a walk-in referral or a shout-out on X, Ubu-Tangaza coordinates
            proof, approval, and payout in one loop — so you earn without juggling
            spreadsheets or seed phrases.
          </p>
        </div>

        <div className="mt-10 grid gap-10 md:mt-16 md:grid-cols-2 md:gap-12">
          {CARDS.map((card, i) => (
            <article
              key={card.title}
              className={`animate-fade-up ${card.offset}`}
              style={{ animationDelay: `${120 + i * 100}ms` }}
            >
              <div className="overflow-hidden rounded-sm border border-ink-600/80">
                <CardVisual kind={card.visual} />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white sm:mt-5 sm:text-xl">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-500">{card.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-8 border-t border-ink-800 pt-10 sm:mt-20 sm:grid-cols-3 sm:gap-6 sm:pt-12">
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
              body: `Every ${MILESTONE_ACTIVITIES} approved activities unlocks in-house offers, rewards and discounts you can redeem.`,
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
      <div className="relative flex aspect-[16/10] items-end bg-gradient-to-br from-ink-800 via-ink-850 to-ink-950 p-4 sm:p-6">
        <div className="absolute right-6 top-6 h-16 w-16 rounded-full border border-crimson-400/30 sm:right-8 sm:top-8 sm:h-24 sm:w-24" />
        <div className="absolute right-12 top-12 h-12 w-12 rounded-full bg-crimson-500/20 blur-xl sm:right-16 sm:top-16 sm:h-16 sm:w-16" />
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
      <div className="relative grid w-full max-w-sm grid-cols-3 gap-2 px-4 sm:gap-3 sm:px-8">
        {["👥", "🎤", "★"].map((icon, i) => (
          <div
            key={icon}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border border-ink-600/80 bg-ink-900/70"
            style={{ transform: `translateY(${i === 1 ? -8 : 0}px)` }}
          >
            <span className="text-lg sm:text-xl" aria-hidden>
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
    <section id="why" className="border-t border-ink-800 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A budget everyone can audit
          </h2>
          <p className="mt-4 text-base leading-relaxed text-mist-400 sm:mt-5">
            The emission cap is set once at registration. No function can raise it. Credits
            only exist because a business approved a real activity — and every claim shrinks
            outstanding liability on Avalanche Fuji.
          </p>
          <ul className="mt-6 space-y-4 sm:mt-8">
            {[
              "No seed phrase. No gas fees. Social sign-in only.",
              "Pilot with Blockchain Centre Kenya — built for Team1 Kenya.",
              "Real in-house rewards every milestone — offers, discounts, vouchers.",
            ].map((line) => (
              <li key={line} className="flex gap-3 text-sm text-mist-300">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-crimson-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mist-500">
            Solvency promise
          </p>
          <p className="mt-3 font-display text-xl font-bold leading-snug text-white sm:mt-4 sm:text-2xl">
            The reward budget can never grow — only shrink as people claim.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-mist-500 sm:mt-4">
            That rule is enforced by the contract, not by a settings toggle. Advocacy is a
            community act; the return should be something the community can verify.
          </p>
        </div>
      </div>
    </section>
  );
}


/**
 * What's happening right now, shown to everyone — the door is visible from the
 * street. Opening a campaign asks you to sign in: viewing is the hook, taking part
 * is the account.
 */
function LiveCampaigns() {
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; slug: string; title: string; blurb?: string; orgName: string; participantCount: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns?all=true")
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((j: { campaigns: typeof campaigns }) => {
        if (!cancelled) setCampaigns(j.campaigns ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (campaigns.length === 0) return null;

  return (
    <section className="border-t border-ink-700/80 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-crimson-400">
          Happening now
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Live campaigns you can join today.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="group rounded-2xl border border-ink-700 bg-ink-850/60 p-5 transition hover:border-crimson-500/50"
            >
              <p className="text-xs text-mist-500">{c.orgName}</p>
              <p className="mt-1 font-semibold text-mist-100 group-hover:text-white">
                {c.title}
              </p>
              {c.blurb ? (
                <p className="mt-2 line-clamp-2 text-sm text-mist-500">{c.blurb}</p>
              ) : null}
              <p className="mt-3 text-xs text-crimson-300">
                {c.participantCount} taking part · sign in to view →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
