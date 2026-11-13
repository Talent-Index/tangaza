"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { Icon, type IconName } from "@/components/icons";
import { ThemeToggle } from "@/components/theme";

type Role = "ambassador" | "business";

const COPY: Record<
  Role,
  {
    pill: string;
    article: string;
    noun: string;
    intro: string;
    can: string;
    benefits: { icon: IconName; label: string; short: string }[];
  }
> = {
  ambassador: {
    pill: "Ambassadors Portal",
    article: "an",
    noun: "Ambassador",
    intro:
      "New here or coming back? Sign in to join a campaign, bring a new customer, and see what you have earned.",
    can: "As an Ambassador, you can:",
    benefits: [
      { icon: "gift", label: "Join campaigns from shops you like", short: "Join campaigns" },
      { icon: "send", label: "Send proof in a minute", short: "Send proof" },
      {
        icon: "receipt",
        label: "See what you have earned and what is still coming",
        short: "Track rewards",
      },
    ],
  },
  business: {
    pill: "Business portal",
    article: "a",
    noun: "Business",
    intro:
      "Create a campaign, let Ambassadors bring a new customer, and track what comes in.",
    can: "As a business, you can:",
    benefits: [
      { icon: "plus", label: "Create a campaign", short: "Create a campaign" },
      {
        icon: "user-check",
        label: "Reach new customers through Ambassadors",
        short: "Reach customers",
      },
      { icon: "sliders", label: "Track results", short: "Track results" },
    ],
  },
};

const CHIPS: { icon: IconName; label: string }[] = [
  { icon: "lock", label: "No password" },
  { icon: "user-check", label: "Free for Ambassadors" },
  { icon: "gift", label: "You choose the reward" },
  { icon: "clipboard", label: "First campaign free" },
];

/**
 * One sign-in page for both sides. Ambassadors still land on the home campaign
 * list. A business sign-in continues into the business portal, the same place
 * /org already sends a signed-in business.
 */
export default function AuthPage() {
  const account = useActiveAccount();
  const router = useRouter();
  const [role, setRole] = useState<Role>("ambassador");
  const roleRef = useRef<Role>("ambassador");
  roleRef.current = role;

  useEffect(() => {
    if (!account) return;
    router.replace(roleRef.current === "business" ? "/org" : "/");
  }, [account, router]);

  return (
    <div className="auth-page relative min-h-dvh overflow-x-clip bg-ink-950 text-mist-100">
      <div
        className="auth-drift pointer-events-none absolute -left-24 top-16 size-[28rem] rounded-full bg-[rgb(233_162_59/0.16)] blur-3xl light:bg-[rgb(233_162_59/0.28)]"
        aria-hidden
      />
      <div
        className="auth-drift-late pointer-events-none absolute -right-16 bottom-0 size-[22rem] rounded-full bg-[rgb(233_162_59/0.1)] blur-3xl light:bg-[rgb(233_162_59/0.2)]"
        aria-hidden
      />

      <header className="auth-rise relative z-10 border-b border-ink-700/60 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="whitespace-nowrap text-base font-bold tracking-tight">
            Ubu-Tangaza<span className="text-gold-text">.</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-400 transition hover:text-mist-100 sm:gap-1.5 sm:text-[12px] sm:tracking-[0.14em]"
            >
              <Icon name="chevron-left" className="size-4" />
              Back to Home
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] md:gap-8 lg:gap-10">
          <div>
            <div className="auth-rise auth-d1">
              <FadeSwap
                role={role}
                render={(id) => {
                  const item = COPY[id];
                  return (
                    <>
                      <span className="inline-flex items-center gap-2 rounded-full border border-gold-line/40 bg-gold/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-text">
                        <span className="size-1.5 rounded-full bg-gold" aria-hidden />
                        {item.pill}
                      </span>
                      <h1 className="poster mt-4 text-[clamp(2.7rem,6.5vw,4.6rem)]">
                        Sign in as {item.article}
                        <br />
                        <span className="text-gold-text">{item.noun}.</span>
                      </h1>
                      <p className="mt-4 max-w-md text-base leading-relaxed text-mist-300 sm:text-lg">
                        {item.intro}
                      </p>
                    </>
                  );
                }}
              />
            </div>

            <div className="auth-rise auth-d2 card relative z-10 mt-6 p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] light:shadow-[0_18px_40px_-24px_rgba(90,60,20,0.28)] sm:p-7">
              <RoleTabs role={role} onChange={setRole} />
              <div
                role="tabpanel"
                id="auth-panel"
                aria-labelledby={`auth-tab-${role}`}
                className="mt-5"
              >
                <SignIn embedded />
              </div>
              <div className="md:hidden">
                <FadeSwap role={role} render={(id) => <BenefitIcons copy={COPY[id]} />} />
              </div>
            </div>
          </div>

          <aside className="auth-lift auth-rise auth-d3 card hidden p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] light:shadow-[0_18px_40px_-24px_rgba(90,60,20,0.28)] md:block sm:p-7">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <FadeSwap
                  role={role}
                  render={(id) => {
                    const item = COPY[id];
                    return (
                      <>
                        <h2 className="text-xl font-bold leading-snug">{item.can}</h2>
                        <ul className="mt-5 flex flex-col gap-3">
                          {item.benefits.map((benefit) => (
                            <li
                              key={benefit.label}
                              className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 px-3.5 py-3"
                            >
                              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-text">
                                <Icon name={benefit.icon} className="size-4" />
                              </span>
                              <span className="text-sm font-semibold leading-snug">{benefit.label}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    );
                  }}
                />
              </div>
              <Megaphone />
            </div>
          </aside>
        </div>

        <div className="auth-rise auth-d4 mt-8">
          <Link
            href="/register"
            className="auth-lift flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-line/50 bg-gold/10 px-5 py-4 transition hover:border-gold-line"
          >
            <span className="text-base font-semibold">Run a business?</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-gold-text">
              Start your free campaign
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </Link>
          <p className="mt-4 text-center text-sm text-mist-400">
            Need help?{" "}
            <Link href="/book" className="font-bold text-gold-text underline underline-offset-4">
              Book a 5-minute call
            </Link>
          </p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {CHIPS.map((chip) => (
              <li
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-3 py-1.5 text-[12px] font-semibold text-mist-300"
              >
                <Icon name={chip.icon} className="size-3.5 text-gold-text" />
                {chip.label}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs leading-relaxed text-mist-500">
            Customer-led growth for Kenyan businesses through trusted, trackable campaigns.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Both copies stay mounted so the tab change can crossfade instead of popping. */
function FadeSwap({
  role,
  render,
}: {
  role: Role;
  render: (role: Role) => ReactNode;
}) {
  return (
    <div className="grid">
      {(["ambassador", "business"] as const).map((id) => (
        <div
          key={id}
          className={`col-start-1 row-start-1 transition-opacity duration-300 ease-out ${
            role === id ? "z-10 opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={role !== id}
        >
          {render(id)}
        </div>
      ))}
    </div>
  );
}

function RoleTabs({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Who is signing in"
      className="relative grid grid-cols-2 rounded-full border border-ink-600 bg-ink-900 p-1"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-gold shadow-[0_8px_18px_-10px_rgba(233,162,59,0.95)] transition-transform duration-300 ease-out"
        style={{ transform: role === "business" ? "translateX(100%)" : "translateX(0%)" }}
      />
      {(
        [
          ["ambassador", "Ambassador"],
          ["business", "Business"],
        ] as const
      ).map(([id, label]) => {
        const selected = role === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`auth-tab-${id}`}
            aria-selected={selected}
            aria-controls="auth-panel"
            onClick={() => onChange(id)}
            className={`auth-no-lift relative z-10 rounded-full px-3 py-2.5 text-[13px] font-bold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
              selected ? "text-on-gold" : "text-mist-400 hover:text-mist-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BenefitIcons({ copy }: { copy: (typeof COPY)[Role] }) {
  return (
    <div className="mt-5 border-t border-ink-700 pt-4">
      <div className="mb-3 flex items-center gap-2.5">
        <Megaphone compact />
        <p className="text-sm font-bold">{copy.can}</p>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {copy.benefits.map((item) => (
          <li key={item.label} className="flex flex-col items-center gap-2 text-center">
            <span className="grid size-10 place-items-center rounded-full border border-gold-line/40 bg-gold/10 text-gold-text">
              <Icon name={item.icon} className="size-4" />
            </span>
            <span className="text-[11px] font-semibold leading-snug text-mist-300">{item.short}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Megaphone({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`auth-wiggle grid shrink-0 place-items-center rounded-2xl border border-gold-line/40 bg-gold/15 text-gold-text ${
        compact ? "size-9 rounded-xl" : "size-12"
      }`}
      aria-hidden
    >
      <Icon name="megaphone" className={compact ? "size-4" : "size-6"} />
    </span>
  );
}
