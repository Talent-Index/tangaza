"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@/components/ui";

/** One tap is enough to reject; the free text only adds detail. */
export const REJECT_PRESETS = [
  "Proof unclear",
  "Not one of our customers",
  "Duplicate",
  "Outside the campaign dates",
  "Other",
] as const;

export const REJECT_NOTE_MAX = 200;

/**
 * What the advocate will read after "Not approved:". A preset on its own is the reason;
 * typed detail is appended to it. "Other" has nothing to say without the detail, so the
 * dialog asks for it rather than send a reason that reads "Other".
 */
export function composeRejectReason(preset: string, note: string): string {
  const detail = note.trim().slice(0, REJECT_NOTE_MAX);
  if (preset === "Other") return detail;
  return detail ? `${preset} — ${detail}` : preset;
}

/**
 * The reject step of the approvals queue: pick a reason, optionally add a line, confirm.
 * A modal on its own layer — Escape and the backdrop cancel, Tab stays inside, and focus
 * goes back to whatever opened it. A bottom sheet with full-width buttons on phones.
 */
export function RejectDialog({
  subject,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  /** Who/what is being rejected, e.g. "Wanjiru's Instagram story". */
  subject: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [preset, setPreset] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstChip = useRef<HTMLButtonElement>(null);

  // Remember what had focus so closing hands it back, and park focus on the first chip.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    firstChip.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), textarea:not([disabled])"
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const reason = preset ? composeRejectReason(preset, note) : "";
  const needsDetail = preset === "Other" && !reason;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onKeyDown={onKeyDown}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cancel"
        disabled={busy}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-850 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6"
      >
        <h2 id={titleId} className="text-lg font-bold">
          Reject this activity?
        </h2>
        <p className="mt-1 text-sm text-mist-500">
          {subject} won&rsquo;t count. They&rsquo;ll see the reason you pick, so keep it kind and
          specific.
        </p>

        <div role="group" aria-label="Reason" className="mt-4 flex flex-wrap gap-2">
          {REJECT_PRESETS.map((p, i) => {
            const on = preset === p;
            return (
              <button
                key={p}
                ref={i === 0 ? firstChip : undefined}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => setPreset(p)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium transition disabled:opacity-45 ${
                  on
                    ? "border-crimson-500 bg-crimson-500/15 text-crimson-300"
                    : "border-ink-600 text-mist-300 hover:border-ink-500 hover:text-mist-100"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-mist-300">
            {preset === "Other" ? "What was wrong?" : "Add a note (optional)"}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, REJECT_NOTE_MAX))}
            maxLength={REJECT_NOTE_MAX}
            rows={3}
            disabled={busy}
            placeholder={
              preset === "Other" ? "Tell them in a few words" : "e.g. the photo is too dark to read"
            }
            className="mt-1.5 block w-full resize-none rounded-xl border border-ink-600 bg-ink-900 px-3 py-2.5 text-base text-mist-100 placeholder:text-mist-500 focus:border-crimson-500 focus:outline-none"
          />
          <span className="mt-1 block text-right text-xs text-mist-500">
            {note.length}/{REJECT_NOTE_MAX}
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-crimson-500/40 bg-crimson-500/10 px-3 py-2 text-sm text-crimson-300"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-ink-600 px-6 text-sm font-semibold text-mist-300 transition hover:border-ink-500 hover:text-mist-100 disabled:opacity-45 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={busy || !preset || needsDetail}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-crimson-500 px-6 text-sm font-semibold text-white transition hover:bg-crimson-400 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            {busy ? (
              <>
                <Spinner /> Rejecting…
              </>
            ) : (
              "Reject"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
