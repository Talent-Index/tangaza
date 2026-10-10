"use client";

import { useState } from "react";
import { CoverImageField } from "@/components/org/CoverImageField";
import { Button, ErrorNote } from "@/components/ui";
import type { Campaign } from "@/lib/hooks";
import {
  DEFAULT_GOAL_LABEL,
  PAYOUT_KINDS,
  REWARD_CURRENCIES,
  describeCampaignReward,
  describeRewardRule,
  goalMeta,
  type EngagementType,
  type GoalType,
} from "@/lib/types";
import { GoalPicker } from "./GoalPicker";

/** Everything the four steps edit. Strings stay strings until the page builds the request. */
export interface CampaignDraft {
  id?: string;
  goalType?: GoalType;
  goalTarget: string;
  goalLabel: string;
  endsAt: string;
  title: string;
  offerName: string;
  offerUrl: string;
  blurb: string;
  coverUrl: string;
  engagementTypeIds: string[];
  /** The business changed the engagement selection itself, so goal defaults stop applying. */
  typesTouched?: boolean;
  /** What one person earns. Empty kind = no reward set. */
  rewardKind: string;
  rewardAmount: string;
  rewardCurrency: string;
  rewardNote: string;
  /** Approved actions one person needs to earn it. */
  rewardThreshold: string;
  rewardRepeats: boolean;
}

export const EMPTY_DRAFT: CampaignDraft = {
  goalTarget: "",
  goalLabel: "",
  endsAt: "",
  title: "",
  offerName: "",
  offerUrl: "",
  blurb: "",
  coverUrl: "",
  engagementTypeIds: [],
  rewardKind: "",
  rewardAmount: "",
  rewardCurrency: "KES",
  rewardNote: "",
  rewardThreshold: "1",
  rewardRepeats: false,
};

export function draftFromCampaign(c: Campaign): CampaignDraft {
  return {
    id: c.id,
    goalType: c.goalType,
    goalTarget: c.goalTarget ? String(c.goalTarget) : "",
    goalLabel: c.goalLabel ?? "",
    endsAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
    title: c.title,
    offerName: c.offerName ?? "",
    offerUrl: c.offerUrl ?? "",
    blurb: c.blurb ?? "",
    coverUrl: c.coverUrl ?? "",
    engagementTypeIds: c.engagementTypeIds,
    typesTouched: true, // never second-guess what an existing campaign counts
    rewardKind: c.rewardKind ?? "",
    rewardAmount: c.rewardAmount != null ? String(c.rewardAmount) : "",
    rewardCurrency: c.rewardCurrency ?? "KES",
    rewardNote: c.rewardNote ?? "",
    rewardThreshold: String(c.rewardThreshold ?? 1),
    rewardRepeats: c.rewardRepeats,
  };
}

/** "example.com" → "https://example.com"; anything that still isn't http(s) comes back "". */
export function normalizeOfferUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** A reward amount: blank = none, else a non-negative number. NaN marks an invalid entry. */
export function parseRewardAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? n : NaN;
}

export function parseThreshold(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : null;
}

/** The reward fields of a save request; null clears, so removing the reward really removes it. */
export function rewardPayload(d: CampaignDraft) {
  if (!d.rewardKind) {
    return {
      rewardKind: null, rewardAmount: null, rewardCurrency: null,
      rewardNote: null, rewardThreshold: null, rewardRepeats: false,
    };
  }
  const amount = parseRewardAmount(d.rewardAmount);
  return {
    rewardKind: d.rewardKind,
    rewardAmount: amount,
    rewardCurrency: amount != null && d.rewardKind !== "discount" ? d.rewardCurrency : null,
    rewardNote: d.rewardNote.trim() || null,
    rewardThreshold: parseThreshold(d.rewardThreshold) ?? 1,
    rewardRepeats: d.rewardRepeats,
  };
}

export function parseTarget(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : null;
}

/** Engagement types that suit a goal — matched on the contract category (0 referral, 1 post, 2 event). */
function suggestedTypeIds(goal: GoalType | undefined, types: EngagementType[]): string[] {
  const cats: readonly number[] = goalMeta(goal)?.categories ?? [];
  return types.filter((t) => t.active && cats.includes(t.chainCategory)).map((t) => t.id);
}

const STEPS = ["Goal", "What you’re pushing", "What people do", "Reward", "Review & launch"] as const;

const MONO = "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500";
const INPUT =
  "w-full min-w-0 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-base outline-none placeholder:text-mist-500 focus:border-crimson-500 sm:text-sm";

export function CampaignWizard({
  draft,
  setDraft,
  types,
  goalsAvailable,
  rewardsAvailable,
  saving,
  error,
  launched,
  onSubmit,
  onCancel,
  onDone,
}: {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
  types: EngagementType[];
  /** true = goals can be saved; false = DB lacks the columns; null = still checking. */
  goalsAvailable: boolean | null;
  /** true = rewards can be saved; false = DB lacks the columns; null = still checking. */
  rewardsAvailable: boolean | null;
  saving: boolean;
  error: string | null;
  /** Set once a NEW campaign has been created: swaps the wizard for the share screen. */
  launched: Campaign | null;
  onSubmit: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const editing = Boolean(draft.id);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(editing ? STEPS.length - 1 : 0);

  const goalsOn = goalsAvailable === true;
  const targetOk = !draft.goalType || parseTarget(draft.goalTarget) !== null;
  const offerUrlOk = !draft.offerUrl.trim() || normalizeOfferUrl(draft.offerUrl) !== "";
  const rewardOk =
    !draft.rewardKind ||
    (!Number.isNaN(parseRewardAmount(draft.rewardAmount)) && parseThreshold(draft.rewardThreshold) !== null);
  const stepOk = [targetOk, Boolean(draft.title.trim()) && offerUrlOk, true, rewardOk, false];
  stepOk[4] = stepOk[0] && stepOk[1] && stepOk[3];

  function go(n: number) {
    // Entering "how people can help" for the first time: lean on the goal, still editable.
    if (n === 2 && !draft.id && !draft.typesTouched && draft.engagementTypeIds.length === 0) {
      const ids = suggestedTypeIds(draft.goalType, types);
      if (ids.length) setDraft((d) => ({ ...d, engagementTypeIds: ids }));
    }
    setStep(n);
    setFurthest((f) => Math.max(f, n));
  }

  function pickGoal(g: GoalType) {
    setDraft((d) => {
      const prev = goalMeta(d.goalType)?.unit;
      const next = goalMeta(g)?.unit ?? "";
      const labelIsDefault = !d.goalLabel.trim() || d.goalLabel === prev;
      return { ...d, goalType: g, goalLabel: labelIsDefault ? next : d.goalLabel };
    });
  }

  function clearGoal() {
    setDraft((d) => ({ ...d, goalType: undefined, goalTarget: "", goalLabel: "" }));
  }

  function toggleType(id: string) {
    setDraft((d) => ({
      ...d,
      typesTouched: true,
      engagementTypeIds: d.engagementTypeIds.includes(id)
        ? d.engagementTypeIds.filter((x) => x !== id)
        : [...d.engagementTypeIds, id],
    }));
  }

  if (launched) return <Launched campaign={launched} onDone={onDone} />;

  const last = step === STEPS.length - 1;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!stepOk[step]) return;
        if (last) onSubmit();
        else go(step + 1);
      }}
      className="card min-w-0 space-y-5 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={MONO}>
            {editing ? "Edit campaign" : "New campaign"} · Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-snug sm:text-xl">{STEPS[step]}</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 shrink-0 px-2 text-sm text-mist-500 transition hover:text-mist-200"
        >
          Cancel
        </button>
      </div>

      <ol className="grid grid-cols-5 gap-1.5" aria-label="Steps">
        {STEPS.map((label, i) => {
          const reachable = i <= furthest;
          return (
            <li key={label} className="min-w-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${label}`}
                className="group flex min-h-8 w-full items-center disabled:cursor-default"
              >
                <span
                  className={`h-1.5 w-full rounded-full transition ${
                    i === step ? "bg-crimson-500" : i < step || reachable ? "bg-crimson-500/40" : "bg-ink-700"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>

      {step === 0 ? (
        <fieldset className="min-w-0 space-y-4 border-0 p-0">
          <legend className="sr-only">Goal</legend>
          {goalsOn || goalsAvailable === null ? (
            <>
              <p className="text-sm text-mist-400">
                What do you want this campaign to achieve? Progress counts the actions you
                approve — it doesn&rsquo;t measure sales or revenue.
              </p>
              <GoalPicker value={draft.goalType} onChange={pickGoal} />

              {draft.goalType ? (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className={MONO}>Target</span>
                    <input
                      inputMode="numeric"
                      value={draft.goalTarget}
                      onChange={(e) =>
                        setDraft({ ...draft, goalTarget: e.target.value.replace(/[^\d]/g, "").slice(0, 7) })
                      }
                      placeholder="100"
                      aria-invalid={!targetOk}
                      className={`${INPUT} mt-1`}
                    />
                    {!targetOk ? (
                      <span className="mt-1 block text-xs text-crimson-300">
                        Enter a whole number from 1 to 1,000,000.
                      </span>
                    ) : null}
                  </label>
                  <label className="block min-w-0">
                    <span className={MONO}>What counts toward it</span>
                    <input
                      value={draft.goalLabel}
                      maxLength={30}
                      onChange={(e) => setDraft({ ...draft, goalLabel: e.target.value })}
                      placeholder={goalMeta(draft.goalType)?.unit ?? DEFAULT_GOAL_LABEL}
                      className={`${INPUT} mt-1`}
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-ink-700 bg-ink-900/40 px-3 py-2 text-sm text-mist-400">
              Goals aren&rsquo;t available on this setup yet — you can still create a campaign.
            </p>
          )}

          <label className="block min-w-0">
            <span className={MONO}>Deadline (optional)</span>
            <input
              type="date"
              value={draft.endsAt}
              onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              className={`${INPUT} mt-1 sm:max-w-xs`}
            />
          </label>

          {goalsOn || goalsAvailable === null ? (
            <button
              type="button"
              onClick={() => {
                clearGoal();
                go(1);
              }}
              className="min-h-10 text-sm font-medium text-mist-400 underline underline-offset-4 transition hover:text-mist-100"
            >
              {editing && draft.goalType ? "Remove the goal" : "Skip, just create a campaign"}
            </button>
          ) : null}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="min-w-0 space-y-4 border-0 p-0">
          <legend className="sr-only">What you&rsquo;re pushing</legend>
          <label className="block min-w-0">
            <span className={MONO}>Campaign title</span>
            <input
              required
              value={draft.title}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Launch week"
              className={`${INPUT} mt-1`}
            />
          </label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className={MONO}>
                {goalMeta(draft.goalType)?.offerHint ?? "What are you pushing?"} (optional)
              </span>
              <input
                value={draft.offerName}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, offerName: e.target.value })}
                placeholder="Name of the product, event or offer"
                className={`${INPUT} mt-1`}
              />
            </label>
            <label className="block min-w-0">
              <span className={MONO}>Link to it (optional)</span>
              <input
                type="url"
                inputMode="url"
                value={draft.offerUrl}
                maxLength={300}
                onChange={(e) => setDraft({ ...draft, offerUrl: e.target.value })}
                placeholder="https://"
                aria-invalid={!offerUrlOk}
                className={`${INPUT} mt-1`}
              />
              {!offerUrlOk ? (
                <span className="mt-1 block text-xs text-crimson-300">
                  That doesn&rsquo;t look like a web link.
                </span>
              ) : null}
            </label>
          </div>
          <label className="block min-w-0">
            <span className={MONO}>Short description (optional)</span>
            <textarea
              rows={3}
              value={draft.blurb}
              maxLength={500}
              onChange={(e) => setDraft({ ...draft, blurb: e.target.value })}
              placeholder="What's the push, and how should people take part?"
              className={`${INPUT} mt-1 resize-none`}
            />
          </label>
          <CoverImageField value={draft.coverUrl} onChange={(url) => setDraft({ ...draft, coverUrl: url })} />
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="min-w-0 space-y-3 border-0 p-0">
          <legend className="sr-only">How people can help</legend>
          {types.length === 0 ? (
            <p className="rounded-xl border border-ink-700 bg-ink-900/40 px-3 py-2 text-sm text-mist-400">
              You haven&rsquo;t set up any actions yet, so anything you reward will count. You can
              add specific actions later in Rewards.
            </p>
          ) : (
            <>
              <p className="text-sm text-mist-400">
                What should people do for this campaign — share about it, post, bring a
                friend? Tap to turn actions on or off. None selected means every action you
                reward counts.
                {!editing && draft.goalType && draft.engagementTypeIds.length > 0 && !draft.typesTouched
                  ? ` We picked the ones that usually suit "${goalMeta(draft.goalType)?.label.toLowerCase()}".`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {types.map((t) => {
                  const on = draft.engagementTypeIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(t.id)}
                      className={`min-h-10 max-w-full rounded-full border px-3.5 py-2 text-left text-sm transition ${
                        on
                          ? "border-crimson-500 bg-crimson-500/15 text-crimson-300"
                          : "border-ink-600 text-mist-400 hover:border-ink-500"
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </fieldset>
      ) : null}

      {step === 3 ? (
        <RewardStep draft={draft} setDraft={setDraft} available={rewardsAvailable} unit={draft.goalLabel.trim() || goalMeta(draft.goalType)?.unit} />
      ) : null}

      {step === 4 ? <Review draft={draft} types={types} goalsOn={goalsOn} editing={editing} onJump={go} /> : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => go(step - 1)} className="w-full sm:w-auto">
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          disabled={!stepOk[step] || (last && saving)}
          className="w-full sm:w-auto"
        >
          {last ? (saving ? "Saving…" : editing ? "Save changes" : "Launch campaign") : "Next"}
        </Button>
      </div>
    </form>
  );
}

function Review({
  draft,
  types,
  goalsOn,
  editing,
  onJump,
}: {
  draft: CampaignDraft;
  types: EngagementType[];
  goalsOn: boolean;
  editing: boolean;
  onJump: (step: number) => void;
}) {
  const target = parseTarget(draft.goalTarget);
  const meta = goalMeta(draft.goalType);
  const unit = draft.goalLabel.trim() || meta?.unit || DEFAULT_GOAL_LABEL;
  const picked = types.filter((t) => draft.engagementTypeIds.includes(t.id));

  const rows: Array<{ label: string; step: number; value: React.ReactNode }> = [
    {
      label: "Goal",
      step: 0,
      value:
        goalsOn && meta && target
          ? `${meta.label}: ${target.toLocaleString("en-GB")} ${unit}`
          : goalsOn
            ? "No goal — a plain campaign"
            : "Not available yet",
    },
    {
      label: "Deadline",
      step: 0,
      value: draft.endsAt
        ? new Date(draft.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "None",
    },
    { label: "Title", step: 1, value: draft.title.trim() || "—" },
    {
      label: "Pushing",
      step: 1,
      value: draft.offerName.trim() ? (
        <>
          {draft.offerName.trim()}
          {draft.offerUrl.trim() ? (
            <span className="block break-all text-xs text-mist-500">{normalizeOfferUrl(draft.offerUrl)}</span>
          ) : null}
        </>
      ) : (
        "Nothing named"
      ),
    },
    {
      label: "Reward",
      step: 3,
      value: draft.rewardKind
        ? `${describeCampaignReward({
            rewardKind: draft.rewardKind,
            rewardAmount: parseRewardAmount(draft.rewardAmount),
            rewardCurrency: draft.rewardCurrency,
            rewardNote: draft.rewardNote,
          })} ${describeRewardRule(parseThreshold(draft.rewardThreshold), draft.rewardRepeats)}`
        : "No reward set",
    },
    {
      label: "Counts",
      step: 2,
      value: picked.length ? picked.map((t) => `${t.icon} ${t.label}`).join(" · ") : "Every action you reward",
    },
  ];

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-ink-700 rounded-xl border border-ink-700">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <dt className={MONO}>{r.label}</dt>
              <dd className="mt-0.5 break-words text-sm">{r.value}</dd>
            </div>
            <button
              type="button"
              onClick={() => onJump(r.step)}
              className="min-h-8 shrink-0 text-xs font-semibold text-crimson-400 underline underline-offset-4"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-mist-500">
        {editing ? "Saving updates the public page right away. " : ""}
        Customers submit proof, you approve what&rsquo;s real, and you honour the rewards within
        the budget you capped. Tangaza never holds the money.
      </p>
    </div>
  );
}

function Launched({ campaign: c, onDone }: { campaign: Campaign; onDone: () => void }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/c/${c.slug}` : `/c/${c.slug}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is shown for manual copy */
    }
  }

  return (
    <div className="card min-w-0 space-y-4 p-4 sm:p-5">
      <div>
        <p className={MONO}>Campaign created</p>
        <h2 className="mt-1 break-words text-lg font-bold leading-snug sm:text-xl">
          {c.title} is live
        </h2>
        <p className="mt-2 text-sm text-mist-400">
          Share this link. Anyone who opens it can join, do the actions you picked and submit
          proof — then you approve what&rsquo;s real in Approvals.
        </p>
      </div>
      <div className="min-w-0 rounded-xl border border-crimson-500/30 bg-crimson-500/5 p-3">
        <code className="block break-all rounded-lg bg-ink-850 px-3 py-2 text-xs text-crimson-300">{url}</code>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={copy} className="w-full sm:w-auto">
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
          <Button href={`/c/${c.slug}`} variant="ghost" className="w-full sm:w-auto">
            View public page
          </Button>
        </div>
      </div>
      <Button type="button" variant="ghost" onClick={onDone} className="w-full sm:w-auto">
        Done
      </Button>
    </div>
  );
}

/** Step 4: what one person earns, and when. Optional — a campaign can run without one. */
export function RewardStep({
  draft,
  setDraft,
  available,
  unit,
}: {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
  available: boolean | null;
  /** What is counted, e.g. "sign-ups"; reads "approved actions" when unset. */
  unit?: string;
}) {
  if (available === false) {
    return (
      <p className="rounded-xl border border-ink-700 bg-ink-900/40 px-3 py-2 text-sm text-mist-400">
        Rewards aren&rsquo;t available on this setup yet — you can still launch the campaign.
      </p>
    );
  }

  const amount = parseRewardAmount(draft.rewardAmount);
  const threshold = parseThreshold(draft.rewardThreshold);
  const counted = unit || DEFAULT_GOAL_LABEL;

  return (
    <fieldset className="min-w-0 space-y-4 border-0 p-0">
      <legend className="sr-only">Reward</legend>
      <p className="text-sm text-mist-400">
        What will you give people who take part? You hand it over yourself — Tangaza tracks
        who has earned it and what you still owe.
      </p>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reward type">
        {PAYOUT_KINDS.map((k) => {
          const on = draft.rewardKind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setDraft((d) => ({ ...d, rewardKind: on ? "" : k.id }))}
              className={`min-h-10 rounded-full border px-3.5 py-2 text-sm transition ${
                on
                  ? "border-crimson-500 bg-crimson-500/15 text-crimson-300"
                  : "border-ink-600 text-mist-400 hover:border-ink-500"
              }`}
            >
              {k.icon} {k.label}
            </button>
          );
        })}
      </div>

      {draft.rewardKind ? (
        <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className={MONO}>
                {draft.rewardKind === "discount" ? "Discount (%)" : "Amount (optional)"}
              </span>
              <div className="mt-1 flex min-w-0 gap-2">
                <input
                  inputMode="decimal"
                  value={draft.rewardAmount}
                  onChange={(e) =>
                    setDraft({ ...draft, rewardAmount: e.target.value.replace(/[^\d.]/g, "").slice(0, 10) })
                  }
                  placeholder={draft.rewardKind === "discount" ? "10" : "500"}
                  aria-invalid={Number.isNaN(amount)}
                  className={`${INPUT} min-w-0 flex-1`}
                />
                {draft.rewardKind !== "discount" ? (
                  <select
                    value={draft.rewardCurrency}
                    onChange={(e) => setDraft({ ...draft, rewardCurrency: e.target.value })}
                    aria-label="Currency"
                    className="shrink-0 rounded-xl border border-ink-700 bg-ink-850 px-2 py-2.5 text-sm outline-none focus:border-crimson-500"
                  >
                    {REWARD_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              {Number.isNaN(amount) ? (
                <span className="mt-1 block text-xs text-crimson-300">Enter a number.</span>
              ) : null}
            </label>
            <label className="block min-w-0">
              <span className={MONO}>Describe it (optional)</span>
              <input
                value={draft.rewardNote}
                maxLength={120}
                onChange={(e) => setDraft({ ...draft, rewardNote: e.target.value })}
                placeholder={
                  draft.rewardKind === "merch" ? "A branded T-shirt" : "e.g. 500 KSh airtime, any network"
                }
                className={`${INPUT} mt-1`}
              />
            </label>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className={MONO}>Earned after</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={draft.rewardThreshold}
                  onChange={(e) =>
                    setDraft({ ...draft, rewardThreshold: e.target.value.replace(/[^\d]/g, "").slice(0, 5) })
                  }
                  aria-invalid={threshold === null}
                  className={`${INPUT} w-24`}
                />
                <span className="min-w-0 text-sm text-mist-400">{counted} per person</span>
              </div>
              {threshold === null ? (
                <span className="mt-1 block text-xs text-crimson-300">
                  Enter a whole number from 1 to 10,000.
                </span>
              ) : null}
            </label>
            <fieldset className="min-w-0 border-0 p-0">
              <legend className={MONO}>How often</legend>
              <div className="mt-1 flex gap-2">
                {[
                  { repeats: false, label: "Once" },
                  { repeats: true, label: "Every time" },
                ].map((o) => {
                  const on = draft.rewardRepeats === o.repeats;
                  return (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDraft({ ...draft, rewardRepeats: o.repeats })}
                      className={`min-h-10 flex-1 rounded-xl border px-3 text-sm transition ${
                        on
                          ? "border-crimson-500 bg-crimson-500/15 text-crimson-300"
                          : "border-ink-600 text-mist-400 hover:border-ink-500"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {threshold !== null && !Number.isNaN(amount) ? (
            <p className="rounded-xl border border-crimson-500/30 bg-crimson-500/5 px-3 py-2 text-sm text-mist-200">
              People earn{" "}
              <span className="font-semibold">
                {describeCampaignReward({
                  rewardKind: draft.rewardKind,
                  rewardAmount: amount,
                  rewardCurrency: draft.rewardCurrency,
                  rewardNote: draft.rewardNote,
                })}
              </span>{" "}
              {describeRewardRule(threshold, draft.rewardRepeats, counted.replace(/s$/, ""))}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-mist-500">Pick one to set a reward, or skip this step.</p>
      )}
    </fieldset>
  );
}
