"use client";

import { use } from "react";
import { Spinner } from "@/components/ui";
import { useCampaign } from "@/lib/hooks";
import { describeCampaignReward, describeRewardRule } from "@/lib/types";

/**
 * A counter poster for the campaign — the share kit's paper leg.
 *
 * SMEs distribute at the till, not in a dashboard: this page prints onto one sheet a
 * customer can act on while waiting to pay. Deliberately light-on-white (the app's dark
 * theme wastes ink and prints badly), with the URL set large enough to type from across
 * a counter. The print button hides itself on paper.
 */
export default function PosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const campaign = useCampaign(slug);

  if (campaign.loading && !campaign.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!campaign.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-8 text-center text-neutral-600">
        <p>That campaign doesn&rsquo;t exist or has been closed.</p>
      </div>
    );
  }

  const c = campaign.data.campaign;
  const url = typeof window !== "undefined" ? `${window.location.host}/c/${c.slug}` : `ubutangaza.biz/c/${c.slug}`;
  const reward = c.rewardKind
    ? `${describeCampaignReward(c)} ${describeRewardRule(c.rewardThreshold ?? 1, c.rewardRepeats)}`
    : null;

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-10 py-12 print:max-w-none print:px-0 print:py-0">
        <button
          type="button"
          onClick={() => window.print()}
          className="mb-10 self-start rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white print:hidden"
        >
          Print this poster
        </button>

        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {c.orgName}
        </p>
        <h1 className="mt-3 text-5xl font-black leading-tight tracking-tight">{c.title}</h1>
        {reward ? (
          <p className="mt-5 text-2xl font-bold leading-snug">
            Earn {reward}.
          </p>
        ) : null}
        {c.blurb ? <p className="mt-3 max-w-xl text-lg text-neutral-600">{c.blurb}</p> : null}

        <ol className="mt-10 space-y-5 text-lg">
          <PosterStep n={1}>
            Open the link below on your phone and join — sign in with Google, no app
            needed.
          </PosterStep>
          <PosterStep n={2}>
            Do your thing and share your personal link with friends — everything you do is
            counted to you.
          </PosterStep>
          <PosterStep n={3}>
            {c.kind === "referral"
              ? "Friend paying by M-Pesa? They enter your code as the account number — the sale counts to you automatically."
              : "Watch your progress — when you hit the goal, the reward is yours."}
          </PosterStep>
        </ol>

        <div className="mt-12 rounded-2xl border-4 border-neutral-900 px-8 py-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Start here
          </p>
          <p className="mt-2 break-all text-3xl font-black tracking-tight">{url}</p>
        </div>

        <p className="mt-auto pt-10 text-center text-sm text-neutral-400">
          Every reward is backed by a budget written on-chain — the business can&rsquo;t
          quietly stiff you. Powered by Ubu-Tangaza.
        </p>
      </div>
    </div>
  );
}

function PosterStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-base font-bold text-white">
        {n}
      </span>
      <span className="min-w-0 leading-relaxed">{children}</span>
    </li>
  );
}
