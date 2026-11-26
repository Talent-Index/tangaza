import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideBlocks, Inline } from "@/components/guides/GuideBlocks";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { getGuide, guideSlugs, relatedGuides } from "@/lib/guides";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * One guide. All of them come from lib/guides, so every page is built ahead of time
 * and any other slug is a real 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return guideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  const meta = pageMetadata({
    title: g.metaTitle,
    description: g.description,
    path: `/guides/${g.slug}`,
  });
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article",
      publishedTime: g.published,
      modifiedTime: g.updated,
    },
  };
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();

  const url = `${SITE_URL}/guides/${g.slug}`;
  const publisher = { "@type": "Organization", name: SITE_NAME, url: SITE_URL };
  const related = relatedGuides(g);

  return (
    <div className="min-h-dvh bg-ink-950 text-mist-100">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: g.title,
            description: g.description,
            datePublished: g.published,
            dateModified: g.updated,
            inLanguage: "en-KE",
            mainEntityOfPage: url,
            author: publisher,
            publisher,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Guides", item: `${SITE_URL}/guides` },
              { "@type": "ListItem", position: 2, name: g.title, item: url },
            ],
          },
        ]}
      />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <article>
          <nav aria-label="Breadcrumb" className="text-xs text-mist-500">
            <Link href="/guides" className="hover:text-mist-300">
              Guides
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span>{g.audience}</span>
          </nav>

          <h1 className="font-display mt-5 text-[clamp(2rem,5.2vw,3rem)] font-bold leading-[1.1] tracking-tight">
            {g.title}
          </h1>
          <p className="mt-3 text-xs text-mist-500">
            Updated <time dateTime={g.updated}>{longDate(g.updated)}</time> · By the {SITE_NAME}{" "}
            team, Nairobi
          </p>

          <div className="mt-7 space-y-4">
            {g.intro.map((text, i) => (
              <p
                key={i}
                className={
                  i === 0
                    ? "text-[18px] leading-[1.7] text-mist-100"
                    : "text-[16px] leading-[1.75] text-mist-300"
                }
              >
                <Inline text={text} />
              </p>
            ))}
          </div>

          <nav aria-label="On this page" className="mt-8 rounded-2xl border border-ink-700 px-5 py-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-mist-500">
              On this page
            </p>
            <ol className="mt-2.5 space-y-1.5 text-[15px]">
              {g.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-mist-300 underline-offset-4 hover:text-gold-text hover:underline">
                    {s.heading}
                  </a>
                </li>
              ))}
              {g.faqs.length ? (
                <li>
                  <a href="#questions" className="text-mist-300 underline-offset-4 hover:text-gold-text hover:underline">
                    Common questions
                  </a>
                </li>
              ) : null}
            </ol>
          </nav>

          {g.sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-11 scroll-mt-6">
              <h2 className="font-display text-[1.6rem] font-bold leading-tight tracking-tight">
                {s.heading}
              </h2>
              <GuideBlocks blocks={s.blocks} />
            </section>
          ))}

          {g.faqs.length ? (
            <section id="questions" className="mt-11 scroll-mt-6">
              <h2 className="font-display text-[1.6rem] font-bold leading-tight tracking-tight">
                Common questions
              </h2>
              <dl className="mt-4 divide-y divide-ink-700 border-y border-ink-700">
                {g.faqs.map((f) => (
                  <div key={f.q} className="py-4">
                    <dt className="text-[16px] font-bold">{f.q}</dt>
                    <dd className="mt-1.5 text-[15px] leading-[1.7] text-mist-300">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </article>

        <aside className="mt-12 rounded-3xl bg-gold px-6 py-7 text-on-gold sm:px-8">
          <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
            Run this as a campaign on {SITE_NAME}
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-on-gold/80">
            Your customers share a link and send you the name of each friend they bring. You
            approve each one and give the reward yourself. No monthly fee.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-ink-950 px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-mist-100"
            >
              Start free <Icon name="arrow-up-right" className="size-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-full border border-on-gold/40 px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em]"
            >
              See pricing
            </Link>
          </div>
        </aside>

        {related.length ? (
          <nav aria-label="Read next" className="mt-12">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-mist-500">
              Read next
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/guides/${r.slug}`}
                    className="card block h-full p-5 transition hover:border-gold/60"
                  >
                    <p className="text-[16px] font-bold leading-snug">{r.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-mist-400">{r.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
