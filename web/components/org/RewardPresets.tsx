"use client";

import { REWARD_PRESETS, type RewardPreset } from "@/lib/types";

const CHIP =
  "min-h-10 rounded-full border px-3.5 py-2 text-left text-sm transition";

/**
 * The six common rewards, plus a way to type one instead.
 * `onPick(null)` means the business wants to type their own.
 */
export function RewardPresets({
  selectedId,
  onPick,
}: {
  selectedId: string | null;
  onPick: (preset: RewardPreset | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Preset rewards">
      {REWARD_PRESETS.map((p) => {
        const on = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(p)}
            className={`${CHIP} ${
              on
                ? "border-crimson-500 bg-crimson-500/15 text-crimson-300"
                : "border-ink-600 text-mist-400 hover:border-ink-500"
            }`}
          >
            {p.label}
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={selectedId === "custom"}
        onClick={() => onPick(null)}
        className={`${CHIP} ${
          selectedId === "custom"
            ? "border-crimson-500 bg-crimson-500/15 text-crimson-300"
            : "border-ink-600 text-mist-400 hover:border-ink-500"
        }`}
      >
        Custom
      </button>
    </div>
  );
}
