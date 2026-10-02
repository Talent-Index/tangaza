"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { addressUrl } from "@/lib/chain";
import { CONTACT } from "@/lib/contact";

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
    coverUrl?: string;
    participants: number;
    approved: number;
  }>;
}

const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

const MONO = "font-mono text-[11px] uppercase tracking-[0.2em]";
// Square, hairline panels in the dark look; rounded paper cards in the light look.
const PANEL = "border border-ink-700 bg-ink-850 light:rounded-xl light:shadow-sm";
const BTN = "inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold transition light:rounded-lg";
const BTN_PRIMARY = `${BTN} bg-crimson-500 text-white hover:bg-crimson-400`;
const BTN_GHOST = `${BTN} border border-ink-600 text-mist-100 hover:border-mist-400`;

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

/**
 * The public page. Dark is the "warm dark" direction, light is the "daylight" one;
 * sections that differ in structure between the two render both and let the `light:`
 * variant show the right one, so the copy and live numbers stay a single source.
 */
export function LandingPage() {
  const stats = useStats();
  return (
    <div className="skin min-h-dvh bg-ink-950 text-mist-100">
      <SiteHeader />
      <Hero stats={stats} />
      <HowItWorks />
      <Pilots stats={stats} />
      <Trust stats={stats} />
      <Faq />
      <ClosingCta />
      <SiteFooter />
    </div>
  );
}

function Actions({ primary = "Start a free campaign" }: { primary?: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/register" className={BTN_PRIMARY}>
        {primary}
      </Link>
      <Link href="/book" className={BTN_GHOST}>
        <Icon name="calendar" /> Book a setup session
      </Link>
      {CONTACT.whatsapp ? (
        <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
          <Icon name="chat" /> Chat on WhatsApp
        </a>
      ) : null}
    </div>
  );
}

function LiveLine({ stats }: { stats: Stats | null }) {
  return (
    <p className="font-mono text-xs text-mist-500">
      Live on Avalanche · {num(stats?.chain?.approved)} approved · KES {num(stats?.chain?.issuedKes)} rewarded
    </p>
  );
}

/* ----------------------------------------------------------------------- hero */

function Hero({ stats }: { stats: Stats | null }) {
  const pilot = stats?.pilots[0];
  return (
    <section className="px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <p className={`${MONO} text-crimson-500`}>Word of mouth, made visible</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">
          Reward the customers who bring you customers.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-mist-400 sm:text-lg">
          Every referral is approved by you and recorded on Avalanche.
        </p>
        <div className="mt-8">
          <Actions />
        </div>
        <p className="mt-5 text-xs text-mist-500">
          For cafés, salons, boutiques, gyms and event businesses.
        </p>

        {/* Dark: the product itself, with live numbers. */}
        <div className="mt-12 max-w-3xl border border-ink-700 bg-ink-900 light:hidden">
          <p className="border-b border-ink-700 px-4 py-2.5 font-mono text-xs text-mist-500">
            app.ubutangaza.biz
          </p>
          <div className="grid grid-cols-3 gap-3 p-4">
            <Tile label="Awaiting" value={num(stats?.awaiting)} />
            <Tile label="Approved" value={num(stats?.chain?.approved)} />
            <Tile label="Rewarded (KES)" value={num(stats?.chain?.issuedKes)} accent />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ink-700 px-4 py-3 text-sm">
            <span className="truncate">
              {pilot ? `${pilot.orgName} · ${pilot.title}` : "Your first campaign"}
            </span>
            <span className="shrink-0 font-mono text-xs text-amber-glow">
              {pilot ? "live" : "open"}
            </span>
          </div>
        </div>

        {/* Light: the same numbers as a receipt. */}
        <div className="mt-12 hidden max-w-md light:block">
          <Receipt
            rows={[
              ["Awaiting approval", num(stats?.awaiting)],
              ["Approved", num(stats?.chain?.approved)],
              ["Rewards issued", `KES ${num(stats?.chain?.issuedKes)}`],
            ]}
            totalLabel="Rewards claimed"
            total={`KES ${num(stats?.chain?.redeemedKes)}`}
            footer={`contract ${shortAddr(stats?.contract ?? "")} · Avalanche Fuji`}
          />
        </div>

        <div className="mt-5">
          <LiveLine stats={stats} />
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-ink-700 bg-ink-850 p-4">
      <p className="text-xs text-mist-400">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold ${accent ? "text-jade-400" : ""}`}>{value}</p>
    </div>
  );
}

/** Mono rows, a dashed rule, then a total — the daylight look's M-Pesa-confirmation feel. */
function Receipt({
  rows,
  totalLabel,
  total,
  totalTone,
  footer,
}: {
  rows: Array<[string, string]>;
  totalLabel: string;
  total: string;
  totalTone?: string;
  footer?: string;
}) {
  return (
    <div className={`${PANEL} p-5 font-mono text-sm`}>
      <dl className="space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt>{k}</dt>
            <dd className="tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="my-3 border-t border-dashed border-ink-600" />
      <div className="flex justify-between gap-4">
        <span>{totalLabel}</span>
        <span className={`tabular ${totalTone ?? ""}`}>{total}</span>
      </div>
      {footer ? <p className="mt-3 text-xs text-mist-500">{footer}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ how it works */

const STEPS = [
  { title: "You set the campaign", body: "Action, reward and budget cap.", short: "Set the campaign" },
  { title: "Customers share and submit proof", body: "A link, a screenshot, or a receipt photo.", short: "Customers submit proof" },
  { title: "You tap approve", body: "Recorded on Avalanche.", short: "You tap approve" },
  {
    title: "They get rewarded, your budget updates",
    body: "Airtime, a voucher or a discount you honour.",
    short: "They get rewarded",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-4 border-t border-ink-700 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className={`${MONO} text-crimson-500`}>How it works</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          Four steps. One tap from you.
        </h2>

        {/* Dark: timeline */}
        <ol className="mt-10 max-w-xl space-y-6 border-l border-ink-700 pl-6 light:hidden">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <p className={`font-bold ${i === 3 ? "text-jade-400" : ""}`}>{s.title}</p>
              <p className="mt-1 text-sm text-mist-400">{s.body}</p>
            </li>
          ))}
        </ol>

        {/* Light: ticket stubs */}
        <div className="mt-10 hidden max-w-2xl grid-cols-2 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-sm light:grid">
          {STEPS.map((s, i) => (
            <div
              key={s.short}
              className={`p-5 ${i % 2 === 0 ? "border-r border-dashed border-ink-600" : ""} ${
                i < 2 ? "border-b border-dashed border-ink-600" : ""
              }`}
            >
              <p className={`font-mono text-[11px] uppercase tracking-[0.2em] ${i === 3 ? "text-jade-400" : "text-crimson-500"}`}>
                Step {i + 1}
              </p>
              <p className="mt-1 font-semibold">{s.short}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ pilots */

function Pilots({ stats }: { stats: Stats | null }) {
  const pilots = stats?.pilots ?? [];
  return (
    <section id="pilots" className="scroll-mt-4 border-t border-ink-700 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className={`${MONO} text-crimson-500`}>Live pilots</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Running now</h2>

        {pilots.length === 0 ? (
          <p className="mt-8 max-w-md text-sm text-mist-400">
            {stats ? "No campaigns are live this moment." : "Loading live campaigns…"}
          </p>
        ) : (
          <>
            {/* Dark: rows */}
            <ul className="mt-8 max-w-2xl divide-y divide-ink-700 border border-ink-700 bg-ink-850 light:hidden">
              {pilots.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/c/${p.slug}`}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm transition hover:bg-ink-800"
                  >
                    <span className="min-w-0 truncate">
                      {p.orgName} · {p.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-mist-400">
                      {p.approved > 0 ? `${p.approved} approved` : "open"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Light: cards */}
            <div className="mt-8 hidden gap-4 light:grid sm:grid-cols-2 lg:grid-cols-3">
              {pilots.map((p) => (
                <Link
                  key={p.id}
                  href={`/c/${p.slug}`}
                  className="overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-sm transition hover:border-crimson-500"
                >
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt="" loading="lazy" className="h-32 w-full object-cover" />
                  ) : (
                    <div
                      className="h-32 w-full bg-ink-800"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, transparent 0 10px, color-mix(in srgb, var(--color-ink-600) 40%, transparent) 10px 12px)",
                      }}
                      aria-hidden
                    />
                  )}
                  <div className="p-4">
                    <p className="font-semibold">{p.orgName}</p>
                    <p className="mt-0.5 text-sm text-mist-400">{p.title}</p>
                    <p className="mt-2 font-mono text-xs text-mist-500">
                      {p.approved > 0 ? `${p.approved} approved` : "open"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- trust */

const TRUST_DARK: Array<[IconName, string]> = [
  ["sliders", "Set the action, reward and cap"],
  ["receipt", "Review proof before rewarding"],
  ["gift", "Airtime, vouchers, discounts"],
  ["user-check", "No wallet, seed phrase or gas fees"],
];
const TRUST_LIGHT: Array<[IconName, string]> = [
  ["receipt", "Review proof first"],
  ["lock", "Cap locked in code"],
  ["gift", "Airtime or vouchers"],
  ["user-check", "No crypto for customers"],
];

function Trust({ stats }: { stats: Stats | null }) {
  const c = stats?.chain;
  const outstanding = c ? c.issuedKes - c.redeemedKes : null;
  const pct = c && c.capKes > 0 ? Math.min(100, (c.issuedKes / c.capKes) * 100) : 0;
  const snow = stats?.contract ? addressUrl(stats.contract) : undefined;

  return (
    <section className="border-t border-ink-700 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className={`${MONO} text-crimson-500`}>Trust and accountability</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
          Reward real activity, not guesswork.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-400 sm:text-base">
          The cap is set once and locked in code. Every redemption lowers what you owe.
        </p>

        {/* Dark: budget meter */}
        <div className="mt-10 max-w-2xl light:hidden">
          <div className="border border-ink-700 bg-ink-850 p-6">
            <p className="text-sm text-mist-400">Outstanding liability · all businesses</p>
            <p className="tabular mt-2 font-mono text-4xl font-bold sm:text-5xl">KES {num(outstanding)}</p>
            <div className="mt-5 h-2 bg-ink-700">
              <div className="h-full bg-crimson-500" style={{ width: `${Math.max(pct, c ? 1 : 0)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-mist-500">
              <span>
                Issued {num(c?.issuedKes)} · redeemed {num(c?.redeemedKes)}
              </span>
              <span>Cap {num(c?.capKes)}</span>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-2 text-xs text-jade-400">
              <Icon name="lock" className="size-3.5" /> Cap is locked in the contract
              {snow ? (
                <>
                  <span className="text-mist-500">·</span>
                  <a href={snow} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    View on Snowtrace <Icon name="external-link" className="size-3" />
                  </a>
                </>
              ) : null}
            </p>
          </div>
          <ul className="mt-2 divide-y divide-ink-700">
            {TRUST_DARK.map(([icon, label]) => (
              <li key={label} className="flex items-center gap-3 py-3.5 text-sm">
                <Icon name={icon} className="size-4 text-crimson-500" /> {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Light: proof sheet */}
        <div className="mt-10 hidden max-w-md light:block">
          <Receipt
            rows={[
              ["Budget cap", `KES ${num(c?.capKes)}`],
              ["Issued", `KES ${num(c?.issuedKes)}`],
              ["Redeemed", `KES ${num(c?.redeemedKes)}`],
            ]}
            totalLabel="You owe"
            total={`KES ${num(outstanding)}`}
            totalTone="text-crimson-500"
            footer={`all businesses · contract ${shortAddr(stats?.contract ?? "")} · Fuji`}
          />
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
            {TRUST_LIGHT.map(([icon, label]) => (
              <li key={label} className="text-sm">
                <Icon name={icon} className="mb-1.5 size-5 text-crimson-500" />
                {label}
              </li>
            ))}
          </ul>
          {snow ? (
            <a href={snow} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-crimson-500 hover:underline">
              View on Snowtrace <Icon name="external-link" className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------- faq */

const FAQ = [
  {
    q: "Is this crypto?",
    a: "Not for you or your customers. They sign in with Google, X or email — no wallet, seed phrase or gas fees. Approvals are recorded on Avalanche in the background so the record can't be quietly changed.",
  },
  {
    q: "What does it cost?",
    a: "Your first campaign is free, and I set it up with you. Nothing is charged without you agreeing to it first.",
  },
  {
    q: "What if referrals are fake?",
    a: "Nothing is rewarded until you approve it. Customers attach proof — a link, a screenshot or a photo — and you approve or reject each one. Your reward budget is capped, so you can't overspend.",
  },
  {
    q: "Who gives the reward?",
    a: "You do: airtime, a voucher, a discount or a free product. Ubu-Tangaza tracks who earned what and enforces your cap. It never holds or sends your money.",
  },
];

function Faq() {
  return (
    <section className="border-t border-ink-700 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Questions owners ask</h2>
        <div className="mt-6 divide-y divide-ink-700 border border-ink-700 bg-ink-850 light:rounded-xl">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon name="plus" className="size-4 shrink-0 transition group-open:rotate-45" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-mist-400">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- closing */

function ClosingCta() {
  return (
    <section className="border-t border-ink-700 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        {/* Dark: framed offer */}
        <div className="border border-crimson-500 bg-ink-900 p-8 text-center sm:p-12 light:hidden">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">First campaign free.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-mist-400 sm:text-base">
            I set it up with you in 10 minutes. You only tap approve.
          </p>
          <div className="mt-7 flex justify-center">
            <Actions primary="Start a campaign" />
          </div>
        </div>

        {/* Light: bold band */}
        <div className="hidden rounded-2xl bg-crimson-500 p-8 text-center text-white sm:p-12 light:block">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Try it free this week.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/85 sm:text-base">
            One campaign, set up for you. I set it up with you in 10 minutes — you only tap approve.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/book" className={`${BTN} bg-white text-crimson-500 hover:bg-white/90`}>
              <Icon name="calendar" /> Book a setup session
            </Link>
            <Link href="/register" className={`${BTN} border border-white/60 text-white hover:bg-white/10`}>
              Start a campaign
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
