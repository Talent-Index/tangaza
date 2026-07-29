"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { BrandMark } from "@/components/ui";

/**
 * Dedicated advocate auth screen. The landing page links here instead of hosting
 * its own sign-in section — one place to sign in, whether you arrived from marketing
 * or from a deep link that bounced you out.
 */
export default function AuthPage() {
  const account = useActiveAccount();
  const router = useRouter();

  useEffect(() => {
    if (account) router.replace("/");
  }, [account, router]);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-x-clip px-4 py-12 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_40%,rgb(30_122_239/0.12),transparent_70%)]"
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
          <Link href="/" className="min-w-0 rounded-md bg-ink-900 px-2.5 py-2 sm:px-3">
            <BrandMark className="text-sm sm:text-base" />
          </Link>
          <Link
            href="/org"
            className="shrink-0 text-xs text-mist-400 underline underline-offset-4 hover:text-mist-200 sm:text-sm"
          >
            Sign in as business
          </Link>
        </div>

        <div className="card animate-fade-up px-4 py-7 sm:px-8 sm:py-8">
          <p className="text-center text-sm text-mist-500">
            Log in to manage your advocacy rewards
          </p>
          <h1 className="mt-3 text-center font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-4xl">
            Advocate portal.
          </h1>

          <div className="mt-7 sm:mt-8">
            <SignIn />
          </div>

          <div className="mt-6 flex flex-col gap-2 text-xs text-mist-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Link href="/register" className="hover:text-mist-300">
              No business account? Register →
            </Link>
            <span className="text-mist-600">No fees — ever</span>
          </div>
        </div>
      </div>
    </div>
  );
}
