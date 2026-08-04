"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";
import { shortAddress } from "@/lib/format";
import { useCampaign, useEngagementTypes } from "@/lib/hooks";

/**
 * A campaign, reached by its shared link.
 *
 * Readable signed out on purpose — this is the page a business posts to X, so the first
 * thing a stranger sees should be what the campaign is and what it pays, not a login
 * wall. Signing in is only needed to join.
 */
export default function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const account = useActiveAccount();

  return (
    <CustomerShell>
      <Suspense fallback={null}>
        <CampaignView slug={slug} address={account?.address} />
      </Suspense>
    </CustomerShell>
  );
}

function CampaignView({ slug, address }: { slug: string; address?: string }) {
  // Present when this visit arrived through someone's /s/<code> link — the join
  // carries it so the sharer gets the credit.
  const via = useSearchParams().get("via");
  const campaign = useCampaign(slug, address);
  // The campaign's own business, not the app's default org — a FitTribe campaign
  // must list FitTribe's engagements, or "what counts" lies.
  const engagements = useEngagementTypes(
    campaign.data ? BigInt(campaign.data.campaign.orgId) : undefined
  );

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  if (campaign.loading && !campaign.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (campaign.error) return <ErrorNote>{campaign.error}</ErrorNote>;

  if (!campaign.data) {
    return (
      <EmptyState
        icon="🔍"
        title="No such campaign"
        body="That link may have expired, or the business may have closed it."
        action={<Button href="/">Go home</Button>}
      />
    );
  }

  const { campaign: c, joined } = campaign.data;

  /**
   * Signed-out visitors get the doorway, not the room: the campaign's name and how
   * many are in, then a sign-in. The full brief — what counts, what it pays, the
   * share tooling — is for people with an account, which every share link is trying
   * to create in the first place.
   */
  if (!address) {
    return (
      <div className="animate-rise space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-crimson-400">
            Campaign
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight">{c.title}</h1>
          <p className="mt-3 text-xs text-mist-500">{c.participantCount} taking part</p>
        </div>
        <Card>
          <p className="mb-4 text-sm text-mist-400">
            Sign in to see what counts, what it earns you, and to take part. No seed
            phrase, no fees — your social login is your account.
          </p>
          <SignIn />
        </Card>
      </div>
    );
  }

  // Which of the business's engagements this campaign counts. Falls back to all of
  // them when the org didn't narrow it, which is what an empty list means.
  const all = engagements.data ?? [];
  const counted = c.engagementTypeIds.length
    ? all.filter((t) => c.engagementTypeIds.includes(t.id))
    : all;

  const ended = c.endsAt ? new Date(c.endsAt).getTime() < Date.now() : false;
  const closed = !c.active || ended;

  async function join() {
    if (!address) return;
    setError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, address, via: via ?? undefined }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not join");
      success("You're in the campaign");
      campaign.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not join";
      setError(msg);
      toastError(msg);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-crimson-400">
          {closed ? "Closed" : "Campaign"}
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight">{c.title}</h1>
        {c.blurb ? <p className="mt-2 text-sm text-mist-400">{c.blurb}</p> : null}
        <p className="mt-3 text-xs text-mist-500">
          {c.participantCount} taking part
          {c.endsAt
            ? ` · ${closed ? "ended" : "ends"} ${new Date(c.endsAt).toLocaleDateString()}`
            : ""}
        </p>
        {/*
         * The campaign's on-chain anchor. A campaign is an off-chain framing, but every
         * approval it produces is written to one contract under one orgId — this line is
         * the auditable link between "the thing the business posted" and "the ledger the
         * rewards actually live on".
         */}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist-500">
          <span>
            Org&nbsp;#{c.orgId} on{" "}
            <a
              href={addressUrl(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-crimson-300 underline underline-offset-4 hover:text-crimson-400"
            >
              {shortAddress(CONTRACT_ADDRESS)} ↗
            </a>
          </span>
          <span aria-hidden>·</span>
          <ShareLink slug={c.slug} />
        </p>
      </div>

      {closed ? (
        <Card className="bg-ink-850/60">
          <p className="text-sm text-mist-400">
            This campaign has closed. Anything you already submitted still counts.
          </p>
        </Card>
      ) : joined ? (
        <Card className="border-jade-500/40 bg-jade-500/10">
          <p className="text-sm font-semibold text-jade-400">You&rsquo;re in.</p>
          <p className="mt-1 text-xs text-mist-400">
            Do any of the things below and submit your proof — it counts toward this
            campaign and toward your level.
          </p>
        </Card>
      ) : (
        <Button onClick={join} disabled={joining} className="w-full">
          {joining ? "Joining…" : "Join this campaign"}
        </Button>
      )}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {address && joined && !closed ? (
        <ShareCard slug={slug} address={address} />
      ) : null}

      <section>
        <SectionTitle>What counts</SectionTitle>
        {counted.length === 0 ? (
          <Card className="bg-ink-850/60">
            <p className="text-sm text-mist-500">
              The business hasn&rsquo;t set what counts yet.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {counted.map((t) => (
              <li key={t.id}>
                <Link
                  href={closed ? "/" : `/submit?c=${c.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 p-4 transition hover:border-crimson-500/50"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
                    {t.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.label}</span>
                    {t.blurb ? (
                      <span className="block truncate text-xs text-mist-500">{t.blurb}</span>
                    ) : null}
                  </span>
                  <span className="tabular shrink-0 rounded-full border border-ink-600 px-2 py-0.5 text-[11px] text-mist-400">
                    +{t.weight}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="bg-ink-850/60">
        <p className="text-xs leading-relaxed text-mist-500">
          Joining is just so the business knows you&rsquo;re taking part. What you earn
          is decided by what gets approved — the same whether you joined or not.
        </p>
      </Card>
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
      className="text-crimson-300 underline underline-offset-4 transition hover:text-crimson-400"
    >
      Copy campaign link
    </button>
  );
}


/**
 * Your personal link for this campaign. Every click and every join that arrives
 * through it is credited to you — shares stop being anonymous the moment there is
 * something to measure.
 */
function ShareCard({ slug, address }: { slug: string; address: string }) {
  const { success, error: toastError } = useToast();
  const [link, setLink] = useState<{
    url: string;
    clickCount: number;
    joinCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/campaigns/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, address }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          url: string;
          clickCount: number;
          joinCount: number;
        };
        if (!cancelled) setLink(json);
      } catch {
        // The card simply doesn't render its numbers; sharing the plain URL still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, address]);

  if (!link) return null;

  async function share() {
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join me on this campaign", url: link.url });
        return;
      }
      await navigator.clipboard.writeText(link.url);
      success("Your link is copied — every join through it counts as yours");
    } catch {
      toastError("Could not copy the link");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Share this campaign</p>
          <p className="mt-1 text-xs text-mist-500">
            Your link: <span className="tabular text-mist-300">{link.clickCount}</span> click
            {link.clickCount === 1 ? "" : "s"} ·{" "}
            <span className="tabular text-mist-300">{link.joinCount}</span> joined through you
          </p>
        </div>
        <code className="tabular truncate rounded-lg border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-mist-400">
          {link.url.replace(/^https?:\/\//, "")}
        </code>
        <Button onClick={share}>Share</Button>
      </div>
    </Card>
  );
}
