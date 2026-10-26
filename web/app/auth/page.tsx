"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { SiteHeader } from "@/components/site/SiteChrome";

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
    <div className="marketing light flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <div className="relative w-full max-w-md">
        <div className="card px-4 py-7 sm:px-8 sm:py-8">
          <p className="text-center text-base text-[#3a382c]">
            Sign in or create your advocate account — same place for new and returning users.
          </p>
          <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-[#15140d] sm:text-4xl">
            Advocate portal.
          </h1>

          <div className="mt-7 sm:mt-8">
            <SignIn />
          </div>

          <div className="mt-6 space-y-2 text-center text-base text-[#3a382c]">
            <p>
              First time here? Pick email or a provider above — we&apos;ll set up your wallet
              automatically.
            </p>
            <p>
              Run a business?{" "}
              <Link href="/waitlist" className="font-semibold text-[#15140d] underline underline-offset-4">
                Join the waitlist
              </Link>
            </p>
            <p>
              <Link href="/org" className="font-semibold text-[#15140d] underline underline-offset-4">
                Sign in as a business
              </Link>
            </p>
            <p>No fees — ever</p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
