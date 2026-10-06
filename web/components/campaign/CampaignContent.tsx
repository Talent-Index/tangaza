"use client";

import Link from "next/link";
import { CampaignShareCard } from "@/components/customer/CampaignShareCard";
import { SignIn } from "@/components/customer/SignIn";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { ErrorNote } from "@/components/ui";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";
import { shortAddress } from "@/lib/format";
import type { CampaignWithOrg } from "@/lib/hooks";
import { PROOF_KINDS, formatReward, type EngagementType } from "@/lib/types";

const MONO = "font-mono text-[11px] uppercase tracking-[0.2em]";
// Square hairline panels in the dark look; rounded paper cards in the light look.
const PANEL = "border border-ink-700 bg-ink-850 light:rounded-xl light:shadow-sm";
const BTN =
  "inline-flex items-center justify-center gap-2 bg-crimson-500 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-crimson-400 disabled:opacity-50 light:rounded-lg";

export interface Tier {
  id: string;
  level: number;
  name: string;
  perk: string;
  icon: string;
  thresholdWeight: number;
  amount?: number;
  currency?: string;
  rewardKind?: string;
  engagementTypeId?: string;
  targetCount?: number;
}

const STEPS = [
  { title: "Sign in", body: "With Google, X or email. No wallet, seed phrase or fees." },
  { title: "Take part", body: "Do one of the actions above for the business." },
  { title: "Submit proof", body: "Add a link, a screenshot or a photo of what you did." },
  { title: "Get approved", body: "The business reviews it. Approved activity counts toward your rewards." },
];

export interface CampaignContentProps {
  slug: string;
  campaign: CampaignWithOrg;
  joined: boolean;
  address?: string;
  /** Every engagement the business has defined (the campaign may count only some). */
  engagements: EngagementType[] | null;
  engagementsLoading: boolean;
  tiers: Tier[] | null;
  joining: boolean;
  error: string | null;
  onJoin: () => void;
}

export function CampaignContent({
  slug,
  campaign: c,
  joined,
  address,
  engagements,
  engagementsLoading,
  tiers,
  joining,
  error,
  onJoin: join,
}: CampaignContentProps) {
  // Which of the business's engagements this campaign counts. Falls back to all of
  // them when the org didn't narrow it, which is what an empty list means.
  const all = engagements ?? [];
  const counted = c.engagementTypeIds.length
    ? all.filter((t) => c.engagementTypeIds.includes(t.id))
    : all;
  const typeLabel = (id?: string) => all.find((t) => t.id === id)?.label ?? "activity";
  const proofLabels = [
    ...new Set(counted.map((t) => PROOF_KINDS.find((p) => p.id === t.proofKind)?.label).filter(Boolean)),
  ] as string[];

  const ended = c.endsAt ? new Date(c.endsAt).getTime() < Date.now() : false;
  const closed = !c.active || ended;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="animate-rise grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ----------------------------------------------------------------- hero */}
      <header className="min-w-0 lg:col-start-1 lg:row-start-1">
        <div className="flex flex-wrap items-center gap-3">
          <p className={`${MONO} text-crimson-500`}>Campaign · {c.orgName}</p>
          {closed ? (
            <span className="border border-ink-600 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-mist-400 light:rounded-full">
              Closed
            </span>
          ) : (
            <span className="border border-jade-500/50 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-jade-400 light:rounded-full">
              Live
            </span>
          )}
          {!address && !closed ? (
            <a
              href="#take-part"
              className="border border-ink-600 px-3 py-1 text-xs font-semibold transition hover:border-crimson-500 light:rounded-full lg:hidden"
            >
              Sign in to take part
            </a>
          ) : null}
        </div>

        <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          {c.title}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-mist-400 sm:text-lg">
          {c.blurb?.trim() ||
            `Take part in ${c.title}, share what you did, and the business reviews it. Approved activity counts toward your rewards.`}
        </p>

        {c.coverUrl ? (
          <div className="mt-8 overflow-hidden border border-ink-700 bg-ink-900 light:rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.coverUrl}
              alt={`${c.title} — ${c.orgName}`}
              className="mx-auto h-auto max-h-[34rem] w-full object-contain"
            />
          </div>
        ) : null}
      </header>

      {/* ------------------------------------------------------------- sidebar */}
      <aside className="min-w-0 space-y-4 lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:self-start lg:sticky lg:top-6">
        <section id="take-part" className={`${PANEL} scroll-mt-6 p-6`}>
          <p className={`${MONO} text-crimson-500`}>Your next step</p>

          {closed ? (
            <>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Closed.</h2>
              <p className="mt-3 text-sm leading-relaxed text-mist-400">
                This campaign has ended. Anything you already submitted still counts.
              </p>
              <Link href="/campaigns" className={`${BTN} mt-5 w-full`}>
                Find another campaign
              </Link>
            </>
          ) : !address ? (
            <>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Come on in.</h2>
              <p className="mt-3 mb-5 text-sm leading-relaxed text-mist-400">
                Sign in to take part and submit activity for the business to review. No seed
                phrase, no fees — your social login is your account.
              </p>
              <SignIn />
            </>
          ) : joined ? (
            <>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">You&rsquo;re in.</h2>
              <p className="mt-3 text-sm leading-relaxed text-mist-400">
                Do any of the actions on this page, then submit your proof. It counts toward this
                campaign and your rewards.
              </p>
              <Link href={`/submit?c=${c.slug}`} className={`${BTN} mt-5 w-full`}>
                <Icon name="send" /> Submit an activity
              </Link>
              <div className="mt-4">
                <CampaignShareCard slug={slug} address={address} />
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Join in.</h2>
              <p className="mt-3 text-sm leading-relaxed text-mist-400">
                Joining lets the business know you&rsquo;re taking part. What you earn depends on
                what gets approved.
              </p>
              <button type="button" onClick={join} disabled={joining} className={`${BTN} mt-5 w-full`}>
                {joining ? "Joining…" : "Join this campaign"}
              </button>
            </>
          )}
          {error ? (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          ) : null}
        </section>

        <section className={`${PANEL} p-6`}>
          <h2 className="font-bold">Campaign details</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Detail label="Business" value={c.orgName} />
            <Detail
              label="Runs"
              value={c.endsAt ? `${fmt(c.startsAt)} → ${fmt(c.endsAt)}` : `From ${fmt(c.startsAt)}, no end date`}
            />
            <Detail label="Taking part" value={`${c.participantCount} ${c.participantCount === 1 ? "person" : "people"}`} />
            {proofLabels.length > 0 ? <Detail label="Proof accepted" value={proofLabels.join(", ")} /> : null}
            <Detail
              label="Recorded on"
              value={
                <a
                  href={addressUrl(CONTRACT_ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-crimson-500"
                >
                  Avalanche · {shortAddress(CONTRACT_ADDRESS)} <Icon name="external-link" className="size-3" />
                </a>
              }
            />
          </dl>
          <ShareLink slug={c.slug} />
        </section>
      </aside>

      {/* ------------------------------------------------------- ways to take part */}
      <section className="min-w-0 lg:col-start-1">
        <p className={`${MONO} text-crimson-500`}>What counts</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Ways to take part</h2>
        {counted.length === 0 ? (
          <p className={`${PANEL} mt-5 p-5 text-sm text-mist-500`}>
            {engagementsLoading ? "Loading…" : "The business hasn’t set what counts yet. Check back soon."}
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {counted.map((t) => {
              const proof = PROOF_KINDS.find((p) => p.id === t.proofKind)?.label;
              const body = (
                <>
                  <span className="grid size-10 shrink-0 place-items-center bg-ink-700 text-lg light:rounded-lg">
                    {t.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.label}</span>
                    {t.blurb ? <span className="mt-1 block text-sm leading-snug text-mist-400">{t.blurb}</span> : null}
                    <span className="mt-2 block font-mono text-[11px] uppercase tracking-wider text-mist-500">
                      {proof ? `Proof: ${proof}` : null}
                      {proof ? " · " : null}counts ×{t.weight}
                    </span>
                  </span>
                </>
              );
              const cls = `${PANEL} flex gap-4 p-5 transition`;
              return (
                <li key={t.id}>
                  {address && joined && !closed ? (
                    <Link href={`/submit?c=${c.slug}`} className={`${cls} hover:border-crimson-500`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------ what you earn */}
      <section className="min-w-0 lg:col-start-1">
        <p className={`${MONO} text-crimson-500`}>What you can earn</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Rewards from {c.orgName}</h2>
        {tiers === null ? null : tiers.length === 0 ? (
          <p className={`${PANEL} mt-5 p-5 text-sm leading-relaxed text-mist-400`}>
            {c.orgName} hasn&rsquo;t published its rewards yet. Everything they approve is still
            recorded, so nothing you do is lost.
          </p>
        ) : (
          <ul className={`${PANEL} mt-5 divide-y divide-ink-700`}>
            {tiers.map((t) => {
              const reward =
                t.amount != null || t.rewardKind
                  ? formatReward({ amount: t.amount, currency: t.currency, rewardKind: t.rewardKind })
                  : null;
              const goal = t.engagementTypeId
                ? `After ${t.targetCount} × ${typeLabel(t.engagementTypeId)}`
                : `After ${t.thresholdWeight} approved activities`;
              return (
                <li key={t.id} className="flex items-start gap-4 p-5">
                  <span className="grid size-10 shrink-0 place-items-center bg-ink-700 text-lg light:rounded-lg">
                    {t.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{t.name}</span>
                      {reward ? (
                        <span className="bg-jade-500/15 px-2 py-0.5 text-xs font-semibold text-jade-400 light:rounded-full">
                          {reward}
                        </span>
                      ) : null}
                    </span>
                    {t.perk ? <span className="mt-1 block text-sm text-mist-400">{t.perk}</span> : null}
                    <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-wider text-mist-500">
                      {goal}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------- how it works */}
      <section className="min-w-0 lg:col-start-1">
        <p className={`${MONO} text-crimson-500`}>The process</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`${PANEL} p-5`}>
              <p className="font-mono text-xs text-crimson-500">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-3 font-semibold">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-mist-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------------------------- note */}
      <section className={`${PANEL} min-w-0 p-6 lg:col-start-1`}>
        <p className="flex items-center gap-2 font-semibold">
          <Icon name="clipboard" className="size-4 text-crimson-500" /> Reviewed with care
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mist-400">
          Submitted activity is reviewed by the business. Rewards become eligible only after valid
          activity is approved. Share only genuine, verifiable activity.
        </p>
      </section>
    </div>
  );
}


function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-mist-500">{label}</dt>
      <dd className="mt-1 leading-snug">{value}</dd>
    </div>
  );
}

/** Copies this campaign's shareable URL — the link a business posts is this page. */
function ShareLink({ slug }: { slug: string }) {
  const { success } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(`${window.location.origin}/c/${slug}`)
          .then(() => success("Campaign link copied"));
      }}
      className="mt-5 text-xs font-semibold text-crimson-500 underline underline-offset-4 transition hover:text-crimson-400"
    >
      Copy campaign link
    </button>
  );
}
