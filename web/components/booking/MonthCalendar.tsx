"use client";

import { Icon } from "@/components/icons";
import {
  type MonthView,
  monthGrid,
  monthLabel,
  sameMonth,
  shiftMonth,
} from "@/lib/booking";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * A month grid for choosing a day. Pure and presentational: the form decides which
 * days are open (and how many times each has left) and this just draws them.
 */
export function MonthCalendar({
  view,
  onView,
  minView,
  maxView,
  today,
  selected,
  free,
  bookable,
  onSelect,
}: {
  view: MonthView;
  onView: (v: MonthView) => void;
  minView: MonthView;
  maxView: MonthView;
  /** Today's date in EAT, YYYY-MM-DD. */
  today: string;
  selected: string | null;
  /** Open days → how many times are still free that day. Absent = can't be booked. */
  free: Map<string, number>;
  /** Days inside the booking window (so a fully-booked one can say so). */
  bookable: Set<string>;
  onSelect: (day: string) => void;
}) {
  const weeks = monthGrid(view);
  const canPrev = !sameMonth(view, minView);
  const canNext = !sameMonth(view, maxView);

  const nav =
    "grid size-9 place-items-center border border-ink-600 transition hover:border-mist-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-ink-600 light:rounded-lg";

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-bold" aria-live="polite">
          {monthLabel(view)}
        </p>
        <div className="flex gap-2">
          <button type="button" className={nav} disabled={!canPrev} onClick={() => onView(shiftMonth(view, -1))} aria-label="Previous month">
            <Icon name="chevron-left" />
          </button>
          <button type="button" className={nav} disabled={!canNext} onClick={() => onView(shiftMonth(view, 1))} aria-label="Next month">
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((d) => (
          <p key={d} className="pb-1 text-center font-mono text-[10px] uppercase tracking-wider text-mist-500 sm:text-[11px]">
            {d}
          </p>
        ))}

        {weeks.flat().map((day, i) => {
          if (!day) return <span key={`pad-${i}`} aria-hidden />;
          const n = free.get(day) ?? 0;
          const open = n > 0;
          const isSel = day === selected;
          const isToday = day === today;
          const full = !open && bookable.has(day);
          const num = Number(day.slice(8));

          return (
            <button
              key={day}
              type="button"
              disabled={!open}
              onClick={() => onSelect(day)}
              aria-pressed={isSel}
              aria-label={`${day}${open ? `, ${n} times free` : full ? ", fully booked" : ", unavailable"}`}
              title={full ? "Fully booked" : undefined}
              className={`relative aspect-square min-w-0 border text-sm transition light:rounded-lg ${
                isSel
                  ? "border-crimson-500 bg-crimson-500 font-bold text-white"
                  : open
                    ? "border-ink-600 font-semibold hover:border-crimson-500"
                    : "cursor-not-allowed border-transparent text-mist-500/50"
              }`}
            >
              {num}
              {isToday ? (
                <span
                  aria-hidden
                  className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${
                    isSel ? "bg-white" : "bg-crimson-500"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-mist-500">
        Greyed-out days are closed (Sundays), already passed, or fully booked.
      </p>
    </div>
  );
}
