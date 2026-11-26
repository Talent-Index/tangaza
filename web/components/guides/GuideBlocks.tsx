import Link from "next/link";
import type { ReactNode } from "react";
import type { GuideBlock } from "@/lib/guides/types";

const LINK = "font-semibold text-gold-text underline underline-offset-4";

/**
 * The two bits of markup a guide's text may carry: **bold** and [label](href).
 * Anything else is shown as typed. Links to the site use next/link; outside links
 * open in a new tab.
 */
export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined) {
      out.push(
        <strong key={key++} className="font-bold text-mist-100">
          {m[1]}
        </strong>,
      );
    } else {
      const href = m[3];
      out.push(
        href.startsWith("/") ? (
          <Link key={key++} href={href} className={LINK}>
            {m[2]}
          </Link>
        ) : (
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {m[2]}
          </a>
        ),
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="mt-4 space-y-5">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-[16px] leading-[1.75] text-mist-300">
          <Inline text={block.text} />
        </p>
      );

    case "list":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[16px] leading-[1.7] text-mist-300">
              <span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-gold" />
              <span>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "steps":
      return (
        <ol className="space-y-4">
          {block.items.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span
                aria-hidden
                className="mt-0.5 font-mono text-xs font-bold tabular-nums text-gold-text"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[16px] font-bold leading-snug text-mist-100">{step.title}</p>
                <p className="mt-1 text-[15px] leading-[1.7] text-mist-300">
                  <Inline text={step.text} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      );

    case "example":
      return (
        <figure className="card p-5 sm:p-6">
          <figcaption className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold-text">
            Example · {block.title}
          </figcaption>
          <dl className="mt-3 divide-y divide-ink-700">
            {block.rows.map(([label, value], i) => (
              <div key={i} className="grid gap-1 py-2.5 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
                <dt className="text-[13px] font-semibold text-mist-500">{label}</dt>
                <dd className="text-[15px] leading-relaxed text-mist-100">{value}</dd>
              </div>
            ))}
          </dl>
          {block.note ? (
            <p className="mt-3 text-sm leading-relaxed text-mist-400">
              <Inline text={block.note} />
            </p>
          ) : null}
        </figure>
      );

    case "template":
      return (
        <figure className="rounded-2xl border border-dashed border-ink-500 px-5 py-4">
          <figcaption className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-mist-500">
            {block.label}
          </figcaption>
          <blockquote className="mt-2.5 whitespace-pre-line text-[15px] leading-[1.7] text-mist-100">
            {block.text}
          </blockquote>
        </figure>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl border border-ink-700">
          {/* No minimum width: on a phone the columns wrap inside the screen, so no column
              is cut off waiting for a sideways scroll nobody notices. */}
          <table className="w-full border-collapse text-left text-[13.5px] leading-relaxed sm:text-[14px]">
            <thead>
              <tr className="border-b border-ink-700 bg-ink-850">
                {block.head.map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-3 font-bold text-mist-100 sm:px-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    c === 0 ? (
                      <th key={c} scope="row" className="px-3 py-3 align-top font-semibold text-mist-100 sm:px-4">
                        {cell}
                      </th>
                    ) : (
                      <td key={c} className="px-3 py-3 align-top text-mist-300 sm:px-4">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "note":
      return (
        <p className="rounded-xl border border-ok-line bg-ok-bg px-4 py-3.5 text-[15px] leading-relaxed text-mist-100">
          <Inline text={block.text} />
        </p>
      );
  }
}
