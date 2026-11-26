import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { allGuides } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Guides: get more customers through referrals",
  description:
    "Plain how-to guides for small businesses in Kenya: start a referral program, choose rewards, check proof and get customers to bring you new customers.",
  path: "/guides",
});

export default function GuidesPage() {
  const guides = allGuides();

  return (
    <div className="min-h-dvh bg-ink-950 text-mist-100">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">
          <span className="h-px w-8 bg-gold" /> Guides
        </p>
        <h1 className="poster mt-4 max-w-4xl text-[clamp(2.6rem,6.5vw,4.75rem)]">
          Get more customers <span className="text-gold-text">through the ones you have.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-mist-400">
          Short, practical guides for small businesses in Kenya on referrals and customer
          rewards. Each one has steps you can use this week, with or without Ubu-Tangaza.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="card flex h-full flex-col p-6 transition hover:border-gold/60"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-text">
                  {g.audience}
                </p>
                <h2 className="font-display mt-3 text-xl font-bold leading-snug tracking-tight">
                  {g.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist-400">{g.summary}</p>
                <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.08em] text-gold-text">
                  Read the guide →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
