"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle, useTheme } from "@/components/theme";
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
 * This page doesn't use the app's ink, mist and crimson CSS-variable tokens (those
 * drive the dark, orange-accented product surfaces) — it's deliberately white-and-teal
 * to match a specific design. So it can't get dark mode "for free" the way every other
 * page does by inheriting the tokens; each section below reads useTheme() itself and
 * switches between two literal palettes. Both keep the teal accent — only the paper
 * and text swap between the light and dark look.
 */
export function LandingPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className={`flex min-h-dvh flex-col transition-colors ${dark ? "bg-[#0b0e11] text-gray-100" : "bg-white text-gray-900"}`}>
      <LandingNav />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:py-8">
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
  const { theme } = useTheme();
  const dark = theme === "dark";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`border-b backdrop-blur transition-colors ${
        dark ? "border-gray-800 bg-[#0b0e11]/90" : "border-gray-200 bg-white/90"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className={`text-lg font-bold tracking-tight ${dark ? "text-white" : "text-gray-900"}`}>
          ubu-tangaza
        </Link>

        <nav className={`hidden items-center gap-6 text-sm font-medium lg:flex ${dark ? "text-gray-400" : "text-gray-500"}`}>
          <a href="/" className="border-b-2 border-teal-500 pb-1 text-teal-500">
            Home
          </a>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`pb-1 transition ${dark ? "hover:text-white" : "hover:text-gray-900"}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/auth"
            className="hidden rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 sm:inline-block"
          >
            Sign In
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className={`grid size-9 place-items-center rounded-md border lg:hidden ${
              dark ? "border-gray-700 text-gray-200" : "border-gray-300 text-gray-700"
            }`}
          >
            <span className="flex w-4 flex-col gap-1" aria-hidden>
              <span
                className={`h-0.5 w-full rounded-full transition ${dark ? "bg-gray-200" : "bg-gray-700"} ${open ? "translate-y-1.5 rotate-45" : ""}`}
              />
              <span
                className={`h-0.5 w-full rounded-full transition ${dark ? "bg-gray-200" : "bg-gray-700"} ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`h-0.5 w-full rounded-full transition ${dark ? "bg-gray-200" : "bg-gray-700"} ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className={`border-t px-4 py-4 lg:hidden ${dark ? "border-gray-800" : "border-gray-200"}`}>
          <nav className={`flex flex-col gap-3 text-sm font-medium ${dark ? "text-gray-300" : "text-gray-600"}`}>
            <a href="/" onClick={() => setOpen(false)} className="text-teal-500">
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
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <section id="about" className="grid gap-8 pt-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-500">
          Verified word-of-mouth platform &middot; Run a campaign
        </p>
        <h1 className={`mt-3 text-4xl font-bold leading-[1.1] tracking-tight sm:text-[2.75rem] lg:text-5xl ${dark ? "text-white" : "text-gray-900"}`}>
          Grow through trackable campaigns.
        </h1>
        <p className={`mt-4 max-w-lg text-base leading-relaxed lg:mt-5 lg:text-lg ${dark ? "text-gray-400" : "text-gray-600"}`}>
          Create campaigns for your business, grow by encouraging customer advocacy,
          track every action, and reward your most active campaigners.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 lg:mt-6">
          <Link
            href="/register"
            className="rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold lg:px-6 lg:py-3 lg:text-base text-white transition hover:bg-teal-500"
          >
            Create a Campaign
          </Link>
          <Link
            href="/campaigns"
            className={`rounded-md border px-5 py-2.5 text-sm font-semibold lg:px-6 lg:py-3 lg:text-base transition ${
              dark
                ? "border-gray-700 text-gray-100 hover:border-gray-500"
                : "border-gray-300 text-gray-800 hover:border-gray-400"
            }`}
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
  const { theme } = useTheme();
  const dark = theme === "dark";
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
    <div
      className={`rounded-xl border p-5 lg:p-6 ${
        dark ? "border-teal-900/50 bg-teal-950/20" : "border-teal-100 bg-teal-50/60"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Happening Now in Nairobi</p>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-500">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-teal-500" />
          </span>
          Live Updates
        </p>
      </div>

      <div className="mt-4 space-y-2.5">
        {campaigns.length === 0 ? (
          <div
            className={`rounded-lg border px-4 py-4 text-sm ${
              dark ? "border-teal-900/50 bg-[#0b0e11] text-gray-400" : "border-teal-100 bg-white text-gray-500"
            }`}
          >
            No campaigns live right now — check back shortly.
          </div>
        ) : (
          campaigns.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border px-4 py-3 ${
                dark ? "border-teal-900/50 bg-[#0b0e11]" : "border-teal-100 bg-white"
              }`}
            >
              <p className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>
                {c.orgName} &mdash; {c.title}
              </p>
              <p className={`mt-0.5 text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>
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
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <section id="how" className="mt-14 sm:mt-16 lg:mt-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-500">
        Platform mechanism
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map((item) => (
          <div key={item.step} className={`rounded-xl border p-5 lg:p-6 ${dark ? "border-gray-800" : "border-gray-200"}`}>
            <p className="text-2xl font-bold text-teal-500 lg:text-3xl">{item.step}</p>
            <p className={`mt-2 font-semibold lg:text-lg ${dark ? "text-white" : "text-gray-900"}`}>{item.title}</p>
            <p className={`mt-2 text-sm leading-relaxed lg:text-base ${dark ? "text-gray-400" : "text-gray-500"}`}>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SolvencyBar() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <section id="why" className="mt-6 lg:mt-5">
      <div
        className={`flex flex-col items-start justify-between gap-4 rounded-xl border p-5 lg:p-6 sm:flex-row sm:items-center ${
          dark ? "border-gray-800 bg-gray-900/60" : "border-gray-200 bg-gray-50"
        }`}
      >
        <div>
          <p className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Blockchain Solvency Guarantee</p>
          <p className={`mt-1 max-w-xl text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>
            Capped budgets are permanently set on the Avalanche Fuji network, ensuring
            rules can never be quietly altered.
          </p>
        </div>
        <a
          href={addressUrl(CONTRACT_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
        >
          Verified On-Chain
        </a>
      </div>
    </section>
  );
}

function Footer() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <footer className={`border-t px-4 py-8 sm:px-6 ${dark ? "border-gray-800" : "border-gray-200"}`}>
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
          dark ? "text-gray-400" : "text-gray-500"
        }`}
      >
        <p>Trackable business campaigns &middot; Nairobi, Kenya &middot; Avalanche Fuji</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/waitlist" className={`underline underline-offset-4 ${dark ? "hover:text-gray-200" : "hover:text-gray-800"}`}>
            Business waitlist
          </Link>
          <Link href="/register" className={`underline underline-offset-4 ${dark ? "hover:text-gray-200" : "hover:text-gray-800"}`}>
            Register on Avalanche
          </Link>
          <a
            href="mailto:danielmwihoti@ubutangaza.biz"
            className={`underline underline-offset-4 ${dark ? "hover:text-gray-200" : "hover:text-gray-800"}`}
          >
            danielmwihoti@ubutangaza.biz
          </a>
        </div>
      </div>
    </footer>
  );
}
