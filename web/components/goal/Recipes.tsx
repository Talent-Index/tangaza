"use client";

import { EMPTY_DRAFT, type CampaignDraft } from "./CampaignWizard";

/**
 * Campaign recipes: launch from an outcome, not a blank form.
 *
 * A shop owner doesn't arrive wanting "a campaign" — they want more customers on slow
 * days, or friends of regulars walking in. Each recipe prefills every wizard step with
 * a working campaign for one of those outcomes, so the owner only touches two things:
 * what they'll give, and what it's worth. The full wizard stays one tap away for
 * anyone who wants to build from scratch.
 *
 * Engagement types are deliberately NOT prefilled: an empty selection means "every
 * action you reward counts", which is the right default for a first campaign and
 * avoids guessing at per-org type ids.
 */
export interface CampaignRecipe {
  id: string;
  icon: string;
  /** The outcome, in the owner's words — this is the button label. */
  title: string;
  /** One line on what happens after launch. */
  outcome: string;
  /** One line previewing the prefilled give-back, so the card promises no surprises. */
  gives: string;
  draft: Partial<CampaignDraft>;
}

export const CAMPAIGN_RECIPES: CampaignRecipe[] = [
  {
    id: "bring-a-friend",
    icon: "🤝",
    title: "Bring a friend",
    outcome: "Regulars share their link; every friend who joins is counted to them.",
    gives: "Starts at a KES 200 voucher per 2 friends — change it on the next screen.",
    draft: {
      goalType: "community",
      goalTarget: "20",
      goalLabel: "friends brought",
      title: "Bring a friend",
      blurb:
        "Know someone who'd love this place? Bring them along — every friend you bring counts, and we'll thank you for it.",
      rewardKind: "voucher",
      rewardAmount: "200",
      rewardThreshold: "2",
      rewardRepeats: true,
    },
  },
  {
    id: "slow-days",
    icon: "📅",
    title: "Fill quiet days",
    outcome: "People book ahead for the days you choose; each booking is counted.",
    gives: "Starts at 10% off per booking — change it on the next screen.",
    draft: {
      goalType: "bookings",
      goalTarget: "15",
      title: "Quiet-day bookings",
      blurb: "Book ahead for our quiet days and there's something in it for you.",
      rewardKind: "discount",
      rewardAmount: "10",
      rewardThreshold: "1",
      rewardRepeats: true,
    },
  },
  {
    id: "launch",
    icon: "🚀",
    title: "Launch something new",
    outcome: "Your community pushes the new thing; sign-ups are counted to whoever brought them.",
    gives: "Starts at a free taste of the new thing per 3 sign-ups.",
    draft: {
      goalType: "launch",
      goalTarget: "30",
      title: "Launch week",
      blurb: "We're launching something new — try it, tell people, and earn a thank-you.",
      rewardKind: "product",
      rewardNote: "A free sample of the new thing",
      rewardThreshold: "3",
      rewardRepeats: false,
    },
  },
  {
    id: "talked-about",
    icon: "📣",
    title: "Get talked about",
    outcome: "Customers post about you with proof; every approved post is counted.",
    gives: "Starts at KES 100 airtime per 5 posts — change it on the next screen.",
    draft: {
      goalType: "awareness",
      goalTarget: "25",
      title: "Talk about us",
      blurb: "Post about us — tag us, show the moment — and earn airtime for it.",
      rewardKind: "airtime",
      rewardAmount: "100",
      rewardThreshold: "5",
      rewardRepeats: true,
    },
  },
];

export function recipeDraft(r: CampaignRecipe): CampaignDraft {
  return { ...EMPTY_DRAFT, ...r.draft };
}

export function RecipePicker({
  onPick,
  onScratch,
  onCancel,
}: {
  onPick: (r: CampaignRecipe) => void;
  onScratch: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card min-w-0 space-y-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
            New campaign
          </p>
          <h2 className="mt-1 text-lg font-bold leading-snug sm:text-xl">
            What do you want more of?
          </h2>
          <p className="mt-1 text-sm text-mist-400">
            Pick one and it&rsquo;s ready to launch — you just set what you&rsquo;ll give.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 shrink-0 px-2 text-sm text-mist-500 transition hover:text-mist-200"
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {CAMPAIGN_RECIPES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r)}
            className="min-w-0 rounded-xl border border-ink-700 bg-ink-850 p-3.5 text-left transition hover:border-crimson-500/60 hover:bg-crimson-500/5"
          >
            <span className="text-xl" aria-hidden>
              {r.icon}
            </span>
            <span className="mt-1.5 block text-sm font-semibold">{r.title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-mist-500">{r.outcome}</span>
            <span className="mt-2 block text-[11px] text-mist-400">{r.gives}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onScratch}
        className="min-h-10 text-sm font-medium text-mist-400 underline underline-offset-4 transition hover:text-mist-100"
      >
        Or build one from scratch →
      </button>
    </div>
  );
}
