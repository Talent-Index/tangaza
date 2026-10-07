"use client";

import { Icon } from "@/components/icons";
import { GOAL_TYPES, type GoalType } from "@/lib/types";

/**
 * The six things a business can be trying to achieve. A radio group of large chips —
 * two across on a phone, three from `sm` — each one a 44px+ tap target, no hover-only state.
 */
export function GoalPicker({
  value,
  onChange,
}: {
  value: GoalType | undefined;
  onChange: (next: GoalType) => void;
}) {
  return (
    <div role="radiogroup" aria-label="What do you want to achieve?" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {GOAL_TYPES.map((g) => {
        const selected = value === g.id;
        return (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(g.id)}
            className={`flex min-h-24 min-w-0 flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${
              selected
                ? "border-crimson-500 bg-crimson-500/10"
                : "border-ink-700 bg-ink-850 hover:border-ink-500"
            }`}
          >
            <span
              className={`grid size-8 place-items-center rounded-lg ${
                selected ? "bg-crimson-500 text-white" : "bg-ink-700 text-mist-300"
              }`}
            >
              <Icon name={g.icon} className="size-4" />
            </span>
            <span className="text-sm font-semibold leading-tight">{g.label}</span>
            <span className="text-[11px] leading-snug text-mist-500">{g.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}
