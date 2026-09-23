"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";

const NAV = [
  { href: "#about", label: "About" },
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Why us" },
];

const STEPS = [
  {
    step: "01",
    title: "Create Campaigns",
    body: "Businesses define custom social or walk-in actions and set milestones.",
  },
  {
    step: "02",
    title: "Track Progress",
    body: "Advocates submit link/photo proof, verified directly before credit issuance.",
  },
  {
    step: "03",
    title: "Reward Campaigners",
    // The pilot verifies M-Pesa referrals for attribution only — the payout itself is
    // still honoured by the business, not sent automatically by the platform. Said that
    // way so this line stays true once the pilot is live, not just aspirational.
    body: "Unlock in-house perks, tiers, and M-Pesa-verified rewards.",
  },
];

/**
 * A compact, dashboard-style homepage — white and teal, one or two screens deep,
 * rather than a long dark narrative scroll. Live campaign data still comes from the
 * same feed every other campaign list on the site uses; the numbers here are real,
 * not the placeholder "16 of 20" style copy a static mock would show.
 */
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-white text-gray-900">
      <LandingNav />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <Hero />
        <PlatformMechanism />
        <SolvencyBar />
      </main>

      <Footer />
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

  return (
    <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          ubu-tangaza
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-500 lg:flex">
          <a href="/" className="border-b-2 border-teal-600 pb-1 text-teal-700">
            Home
          </a>
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="pb-1 transition hover:text-gray-900">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="hidden rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 sm:inline-block"
          >
            Sign In
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-md border border-gray-300 text-gray-700 lg:hidden"
          >
            <span className="flex w-4 flex-col gap-1" aria-hidden>
              <span className={`h-0.5 w-full rounded-full bg-gray-700 transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`h-0.5 w-full rounded-full bg-gray-700 transition ${open ? "opacity-0" : ""}`} />
              <span className={`h-0.5 w-full rounded-full bg-gray-700 transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-gray-200 px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-gray-600">
            <a href="/" onClick={() => setOpen(false)} className="text-teal-700">
              Home
            </a>
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 inline-block rounded-md bg-teal-600 px-4 py-2 text-center text-white"
            >
              Sign In
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <section id="about" className="grid gap-8 pt-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
          Verified word-of-mouth platform &middot; Run a campaign
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 sm:text-[2.75rem]">
          Grow through trackable campaigns.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">
          Create campaigns for your business, grow by encouraging customer advocacy,
          track every action, and reward your most active campaigners.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Create a Campaign
          </Link>
          <Link
            href="/campaigns"
            className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 transition hover:border-gray-400"
          >
            Explore Live Pushes
          </Link>
        </div>
      </div>

      <HappeningNow />
    </section>
  );
}

/**
 * Live campaigns, pulled from the same feed the discovery page uses. The progress
 * line is generated from what a campaign actually reports — participants joined, not
 * a "X of Y claimed" framing the schema has no per-campaign target to back up.
 */
function HappeningNow() {
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; title: string; orgName: string; participantCount: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns?all=true")
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((j: { campaigns: typeof campaigns }) => {
        if (!cancelled) setCampaigns((j.campaigns ?? []).slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-gray-900">Happening Now in Nairobi</p>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-teal-600" />
          </span>
          Live Updates
        </p>
      </div>

      <div className="mt-4 space-y-2.5">
        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-teal-100 bg-white px-4 py-4 text-sm text-gray-500">
            No campaigns live right now — check back shortly.
          </div>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="rounded-lg border border-teal-100 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">
                {c.orgName} &mdash; {c.title}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {c.participantCount > 0
                  ? `${c.participantCount} ${c.participantCount === 1 ? "person" : "people"} taking part`
                  : "Just launched — be the first to join"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PlatformMechanism() {
  return (
    <section id="how" className="mt-14 sm:mt-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
        Platform mechanism
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map((item) => (
          <div key={item.step} className="rounded-xl border border-gray-200 p-5">
            <p className="text-2xl font-bold text-teal-600">{item.step}</p>
            <p className="mt-2 font-semibold text-gray-900">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SolvencyBar() {
  return (
    <section id="why" className="mt-6">
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold text-gray-900">Blockchain Solvency Guarantee</p>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Capped budgets are permanently set on the Avalanche Fuji network, ensuring
            rules can never be quietly altered.
          </p>
        </div>
        <a
          href={addressUrl(CONTRACT_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          Verified On-Chain
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Trackable business campaigns &middot; Nairobi, Kenya &middot; Avalanche Fuji</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/waitlist" className="underline underline-offset-4 hover:text-gray-800">
            Business waitlist
          </Link>
          <Link href="/register" className="underline underline-offset-4 hover:text-gray-800">
            Register on Avalanche
          </Link>
          <a
            href="mailto:danielmwihoti@ubutangaza.biz"
            className="underline underline-offset-4 hover:text-gray-800"
          >
            danielmwihoti@ubutangaza.biz
          </a>
        </div>
      </div>
    </footer>
  );
}
