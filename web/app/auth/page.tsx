"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme";

/**
 * Ambassador sign-in. One place to join or come back, whether you arrived from
 * the homepage or from a link that asked you to sign in first.
 */
export default function AuthPage() {
  const account = useActiveAccount();
  const router = useRouter();

  useEffect(() => {
    if (account) router.replace("/");
  }, [account, router]);

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-ink-950 text-mist-100">
      <div className="pointer-events-none absolute inset-0 opacity-20 light:opacity-40" aria-hidden>
        <Image
          src="/images/landing/phone-constellation.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover light:[filter:sepia(0.55)_saturate(0.9)_contrast(0.9)]"
          priority
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgb(233_162_59/0.08),transparent_65%)] light:bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgb(233_162_59/0.16),transparent_65%)]" />

      <header className="relative z-10 border-b border-ink-700/60 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="min-w-0">
            <span className="block text-base font-bold tracking-tight">
              Ubu-Tangaza<span className="text-gold-text">.</span>
            </span>
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.2em] text-gold-text">
              Ambassadors
            </span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6">
            <Link href="/#how" className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-mist-400 hover:text-mist-100 sm:inline">
              How it works
            </Link>
            <Link href="/campaigns" className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-mist-400 hover:text-mist-100 md:inline">
              Campaigns
            </Link>
            <ThemeToggle />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-on-gold">
              Sign in <Icon name="arrow-up-right" className="size-3.5" />
            </span>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_460px] lg:gap-14">
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-line bg-ok-bg px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ok">
            <Icon name="check" className="size-3.5" /> Free for ambassadors
          </span>
          <h1 className="poster mt-4 text-[clamp(3rem,8vw,4.1rem)]">
            <span className="sm:hidden">
              Sign in to
              <br />
              take part.
            </span>
            <span className="hidden sm:inline">
              Sign in as
              <br />
              an ambassador.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-mist-300 sm:text-lg">
            New here or coming back? Sign in to join campaigns, send proof and track your rewards.
          </p>
          <ul className="mt-6 hidden flex-col gap-3 text-[15px] sm:flex">
            {[
              "Join campaigns from shops you like",
              "Send proof in a minute",
              "See what you have earned and what is still coming",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <Icon name="check" className="size-4 text-gold-text" />
                {line}
              </li>
            ))}
          </ul>
          <Image
            src="/images/landing/reward-coins.png"
            alt=""
            width={110}
            height={110}
            className="pointer-events-none absolute -right-4 top-0 hidden w-24 rotate-6 rounded-2xl opacity-80 lg:block"
          />
        </div>

        <div>
          <div className="card relative z-10 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] sm:p-8">
            <SignIn />
          </div>
          <p className="relative z-10 mt-4 text-center text-sm leading-loose text-mist-500">
            Run a business?{" "}
            <Link href="/register" className="font-bold text-gold-text underline underline-offset-4">
              Start your free campaign
            </Link>
            <br />
            <Link href="/org" className="underline underline-offset-4 hover:text-mist-100">
              Sign in as a business
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
