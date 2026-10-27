"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { timeAgo } from "@/lib/format";
import { isObviouslyTestFeedback } from "@/lib/public-display";

/**
 * Public feedback, in two pieces the homepage and /feedback share:
 * a wall of what people said, and the form that adds to it. Entries show up on the
 * homepage as soon as they are left — no account, no approval step — so the form
 * carries the booking page's defenses (honeypot, length caps) rather than a login.
 */

const FIELD =
  "w-full min-w-0 border border-ink-600 bg-ink-900 px-3.5 py-3 text-base outline-none placeholder:text-mist-500 focus:border-crimson-500 sm:text-sm light:rounded-lg light:bg-ink-850";

export interface FeedbackEntry {
  id: string;
  name: string | null;
  message: string;
  createdAt: string;
}

export function useFeedback() {
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null);
  const load = useCallback(() => {
    fetch("/api/feedback", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { feedback: FeedbackEntry[] } | null) => {
        if (j) setEntries(j.feedback);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { entries, reload: load };
}

export function FeedbackWall({ entries }: { entries: FeedbackEntry[] | null }) {
  if (entries === null) return null; // still loading — don't flash the empty state
  if (entries.length === 0) {
    return (
      <p className="text-sm text-mist-500">
        Nothing here yet —{" "}
        <Link href="/feedback" className="underline underline-offset-2 hover:text-mist-300">
          be the first to leave a word
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((f) => (
        <figure
          key={f.id}
          className="min-w-0 border border-ink-700 bg-ink-850 p-4 light:rounded-xl light:shadow-sm"
        >
          <blockquote className="whitespace-pre-wrap break-words text-sm leading-relaxed text-mist-300">
            {f.message}
          </blockquote>
          <figcaption className="mt-3 flex items-baseline justify-between gap-3 text-xs text-mist-500">
            <span className="truncate font-semibold text-mist-400">{f.name || "Someone"}</span>
            <span className="shrink-0">{timeAgo(new Date(f.createdAt).getTime())}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function FeedbackForm({ onPosted }: { onPosted?: () => void }) {
  const [form, setForm] = useState({ name: "", message: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save your feedback");
      setDone(true);
      onPosted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your feedback");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="border border-ink-700 bg-ink-850 p-6 light:rounded-xl light:shadow-sm">
        <span className="grid size-10 place-items-center bg-jade-500/15 text-jade-400 light:rounded-full">
          <Icon name="check" className="size-5" />
        </span>
        <h2 className="mt-4 text-xl font-black tracking-tight">Thank you.</h2>
        <p className="mt-2 text-base leading-relaxed text-mist-400">
          Thank you. It&rsquo;s saved, and it can show on the{" "}
          <Link href="/" className="underline underline-offset-2 hover:text-mist-200">
            homepage
          </Link>{" "}
          once a few owners have written in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="min-w-0 space-y-3">
      <input
        className={FIELD}
        placeholder="Your name (optional)"
        value={form.name}
        maxLength={60}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        autoComplete="name"
      />
      <textarea
        required
        className={`${FIELD} resize-none`}
        rows={4}
        maxLength={500}
        placeholder="What should we know? What works, what doesn't, what's missing…"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
      />
      {/* Honeypot: invisible to people, tempting to bots. */}
      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })}
      />
      {error ? (
        <p role="alert" className="border border-crimson-500/50 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400 light:rounded-lg">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 bg-crimson-500 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-crimson-400 disabled:opacity-50 sm:w-auto light:rounded-lg"
        >
          <Icon name="send" /> {submitting ? "Sending…" : "Send feedback"}
        </button>
        <p className="text-xs text-mist-500">Shown publicly on the homepage.</p>
      </div>
    </form>
  );
}

/** The homepage section. Hidden until there are a couple of real quotes. */
export function FeedbackSection() {
  const { entries } = useFeedback();
  const real = (entries ?? []).filter((entry) => !isObviouslyTestFeedback(entry));
  if (entries === null || real.length < 2) return null;
  return (
    <section id="feedback" className="scroll-mt-4 border-t border-[#ddd8c8] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What business owners say</h2>
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 rounded-full border border-[#c7c1ac] px-5 py-3 text-base font-semibold hover:border-[#15140d]"
          >
            <Icon name="chat" className="size-4" /> Leave feedback
          </Link>
        </div>
        <div className="mt-8">
          <FeedbackWall entries={real} />
        </div>
      </div>
    </section>
  );
}

