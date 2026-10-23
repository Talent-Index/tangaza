import Link from "next/link";
import { BrandMark } from "@/components/ui";

/** The frame both legal pages (/terms, /privacy) share: brand, cross-links, dated title. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-10 flex items-center justify-between gap-3">
        <Link href="/">
          <BrandMark className="text-base sm:text-lg" />
        </Link>
        <nav className="flex gap-4 text-xs text-mist-500">
          <Link href="/pricing" className="hover:text-mist-300">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-mist-300">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-mist-300">
            Privacy
          </Link>
        </nav>
      </header>
      <main>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-mist-500">Last updated {updated}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
    </div>
  );
}

export function LegalSection({
  n,
  h,
  children,
}: {
  n: number;
  h: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold">
        {n}. {h}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-mist-400">{children}</p>
    </section>
  );
}
