import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/ui";
import { getTestnetCampaign, testnetSlugs } from "@/lib/testnet-archive";

/**
 * Read-only results for a campaign from the Fuji testnet pilot. Everything comes from
 * the frozen snapshot in lib/testnet-archive.ts, so every page is built ahead of time
 * and any other slug is a real 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return testnetSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getTestnetCampaign(slug);
  if (!c) return {};
  return {
    title: `${c.title} (testnet pilot)`,
    description: `${c.orgName} ran this campaign on the Ubu-Tangaza testnet pilot. ${c.participantCount} ${
      c.participantCount === 1 ? "person" : "people"
    } took part.`,
    alternates: { canonical: `/testnet/${slug}` },
  };
}

const NAIROBI = "Africa/Nairobi";

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: NAIROBI,
  });
}

export default async function TestnetCampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getTestnetCampaign(slug);
  if (!c) notFound();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Link href="/">
          <BrandMark className="text-base sm:text-lg" />
        </Link>
        <Link href="/#previous" className="text-xs text-mist-500 hover:text-mist-300">
          ← All campaigns
        </Link>
      </header>

      <main>
        {c.coverUrl ? (
          <img
            src={c.coverUrl}
            alt=""
            className="mb-7 aspect-[2/1] w-full rounded-[20px] object-cover grayscale-[0.4]"
          />
        ) : null}

        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold-text">
          Testnet pilot · Ended
        </p>
        <h1 className="poster mt-3 break-words text-[2.5rem] leading-none sm:text-[3.25rem]">
          {c.title}
        </h1>
        <p className="mt-3 text-base font-bold text-mist-300">{c.orgName}</p>
        {c.blurb ? <p className="mt-4 text-base leading-relaxed text-mist-300">{c.blurb}</p> : null}

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Took part" value={String(c.participantCount)} />
          <Stat label="Approved" value={String(c.approvedCount)} />
          <Stat label="Ran" value={`${day(c.startsAt)} – ${day(c.endsAt ?? c.startsAt)}`} wide />
        </dl>

        <div className="mt-8 rounded-[20px] border border-dashed border-ink-600 px-6 py-5 text-sm leading-relaxed text-mist-400 light:border-ink-700">
          This campaign ran on the Avalanche Fuji test network while Ubu-Tangaza was in its
          pilot. Ubu-Tangaza moved to Avalanche mainnet on 5 November 2026; the numbers above
          are as they stood then, and testnet entries do not carry over.
          {c.continuesOnMainnet ? (
            <>
              {" "}
              {c.orgName} is running it again on mainnet.{" "}
              <Link
                href={`/c/${c.slug}`}
                className="font-semibold text-gold-text underline underline-offset-4"
              >
                Open the live campaign →
              </Link>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 light:border-ink-700 ${
        wide ? "col-span-2 sm:col-span-1" : ""
      }`}
    >
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-mist-500">{label}</dt>
      <dd className="mt-1 text-[15px] font-bold leading-snug">{value}</dd>
    </div>
  );
}
