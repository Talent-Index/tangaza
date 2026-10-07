"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { MonthCalendar } from "@/components/booking/MonthCalendar";
import {
  GOALS,
  SESSION_MINUTES,
  type MonthView,
  bookableDays,
  buildIcs,
  formatSlot,
  formatTime,
  isBookableSlot,
  monthOf,
  slotsForDay,
  todayEat,
} from "@/lib/booking";

const MONO = "font-mono text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.2em]";
const PANEL = "border border-ink-700 bg-ink-850 light:rounded-xl light:shadow-sm";
const FIELD =
  "w-full min-w-0 border border-ink-600 bg-ink-900 px-3.5 py-3 text-base outline-none sm:text-sm placeholder:text-mist-500 focus:border-crimson-500 light:rounded-lg light:bg-ink-850";

export function BookingForm() {
  const [days, setDays] = useState<string[]>([]);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<MonthView | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", business: "", contact: "", email: "", notes: "", website: "" });
  const [goal, setGoal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slot: string; contact: string } | null>(null);

  // Computed after mount so the server's clock and the visitor's can never disagree
  // about which days exist.
  useEffect(() => {
    const d = bookableDays();
    setDays(d);
    setView(d[0] ? monthOf(d[0]) : null);
    refreshTaken();
  }, []);

  function refreshTaken() {
    fetch("/api/bookings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("availability"))))
      .then((j: { taken: string[] }) => {
        setTaken(new Set(j.taken));
        setLoadError(null);
      })
      .catch(() => setLoadError("Couldn't check which times are free. You can still pick one."));
  }

  // Days that can be booked, and how many times each still has free.
  const free = useMemo(() => {
    const now = new Date();
    const m = new Map<string, number>();
    for (const d of days) {
      const n = slotsForDay(d).filter((s) => isBookableSlot(s, now) && !taken.has(s)).length;
      if (n > 0) m.set(d, n);
    }
    return m;
  }, [days, taken]);
  const bookable = useMemo(() => new Set(days), [days]);

  // Start on the first day that has something free, and move off a day that fills up.
  useEffect(() => {
    if (days.length === 0) return;
    if (!day || !free.has(day)) {
      const first = days.find((d) => free.has(d));
      if (first) {
        setDay(first);
        setView(monthOf(first));
        setSlot(null);
      }
    }
  }, [days, free, day]);

  const slots = useMemo(() => {
    if (!day) return [];
    const now = new Date();
    return slotsForDay(day).filter((s) => isBookableSlot(s, now));
  }, [day]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) {
      setError("Pick a day and a time first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, ...form, ...(goal ? { goal } : {}) }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          setSlot(null);
          refreshTaken();
        }
        throw new Error(json.error ?? "Could not book that time");
      }
      setDone({ slot, contact: form.contact });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book that time");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <Confirmation slot={done.slot} contact={done.contact} business={form.business} />;

  return (
    <form onSubmit={submit} className="min-w-0 space-y-8">
      <fieldset className="min-w-0">
        <legend className={`${MONO} mb-3 text-mist-400`}>1 · Pick a day</legend>
        {view && days.length > 0 ? (
          <MonthCalendar
            view={view}
            onView={setView}
            minView={monthOf(days[0])}
            maxView={monthOf(days[days.length - 1])}
            today={todayEat()}
            selected={day}
            free={free}
            bookable={bookable}
            onSelect={(d) => {
              setDay(d);
              setSlot(null);
            }}
          />
        ) : (
          <p className="text-sm text-mist-500">Loading the calendar…</p>
        )}
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={`${MONO} mb-3 text-mist-400`}>2 · Pick a time (East Africa Time)</legend>
        {slots.length === 0 ? (
          <p className="text-sm text-mist-500">No times left on this day — try another.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => {
              const isTaken = taken.has(s);
              const active = s === slot;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isTaken}
                  onClick={() => setSlot(s)}
                  aria-pressed={active}
                  className={`border px-2 py-2.5 font-mono text-sm transition light:rounded-lg ${
                    isTaken
                      ? "cursor-not-allowed border-ink-700 text-mist-500 line-through opacity-50"
                      : active
                        ? "border-crimson-500 bg-crimson-500 text-white"
                        : "border-ink-600 hover:border-mist-400"
                  }`}
                >
                  {formatTime(s)}
                </button>
              );
            })}
          </div>
        )}
        {loadError ? <p className="mt-2 text-xs text-amber-glow">{loadError}</p> : null}
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={`${MONO} mb-3 text-mist-400`}>3 · Your goal (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => {
            const active = g === goal;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(active ? null : g)}
                aria-pressed={active}
                className={`border px-3.5 py-2.5 text-sm transition light:rounded-lg ${
                  active
                    ? "border-crimson-500 bg-crimson-500 text-white"
                    : "border-ink-600 hover:border-mist-400"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-3">
        <legend className={`${MONO} mb-3 text-mist-400`}>4 · About you</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required className={FIELD} placeholder="Your name" value={form.name} maxLength={120}
            onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          <input required className={FIELD} placeholder="Business name" value={form.business} maxLength={160}
            onChange={(e) => setForm({ ...form, business: e.target.value })} autoComplete="organization" />
          <input required className={FIELD} placeholder="Phone or WhatsApp number" value={form.contact} maxLength={40}
            inputMode="tel" onChange={(e) => setForm({ ...form, contact: e.target.value })} autoComplete="tel" />
          <input className={FIELD} type="email" placeholder="Email (optional)" value={form.email} maxLength={160}
            onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </div>
        <textarea className={`${FIELD} resize-none`} rows={3} maxLength={600}
          placeholder="What do you want to achieve, and what are you pushing? (optional)"
          value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {/* Honeypot: invisible to people, tempting to bots. */}
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0"
          value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      </fieldset>

      {error ? (
        <p role="alert" className="border border-crimson-500/50 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 bg-crimson-500 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-crimson-400 disabled:opacity-50 sm:w-auto light:rounded-lg"
        >
          <Icon name="calendar" /> {submitting ? "Booking…" : "Book my session"}
        </button>
        <p className="text-xs text-mist-500">
          {slot ? `You picked ${formatSlot(slot)}.` : "Pick a day and a time."}
        </p>
      </div>
    </form>
  );
}

function Confirmation({ slot, contact, business }: { slot: string; contact: string; business: string }) {
  function download() {
    const ics = buildIcs(
      slot,
      "Ubu-Tangaza setup session",
      `Setting up ${business}'s first campaign with Daniel. He'll reach you on ${contact}.`
    );
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ubu-tangaza-session.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`${PANEL} p-6 sm:p-8`}>
      <span className="grid size-10 place-items-center bg-jade-500/15 text-jade-400 light:rounded-full">
        <Icon name="check" className="size-5" />
      </span>
      <h2 className="mt-5 text-2xl font-black tracking-tight">Session requested</h2>
      <p className="mt-2 text-sm leading-relaxed text-mist-400">
        Daniel will confirm by calling or messaging you on {contact}. Nothing else for you to do until then.
      </p>
      <dl className="mt-6 space-y-2.5 font-mono text-sm">
        <div className="flex justify-between gap-4">
          <dt>When</dt>
          <dd className="text-right">{formatSlot(slot)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Length</dt>
          <dd>{SESSION_MINUTES} minutes</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Business</dt>
          <dd className="truncate text-right">{business}</dd>
        </div>
      </dl>
      <div className="my-5 border-t border-dashed border-ink-600" />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-2 border border-ink-600 px-5 py-3 text-sm font-bold transition hover:border-mist-400 light:rounded-lg"
        >
          <Icon name="calendar" /> Add to calendar
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold text-mist-400 transition hover:text-mist-100"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
