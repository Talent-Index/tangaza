"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Card } from "@/components/ui";

type ShareLink = {
  url: string;
  clickCount: number;
  joinCount: number;
};

/**
 * Your personal /s/XXXX link for a campaign. Send this to the person you are
 * referring — clicks and joins through it are credited to you automatically.
 */
export function CampaignShareCard({
  slug,
  address,
}: {
  slug: string;
  address: string;
}) {
  const { success, error: toastError } = useToast();
  const [link, setLink] = useState<ShareLink | null>(null);

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
        const json = (await res.json()) as ShareLink;
        if (!cancelled) setLink(json);
      } catch {
        // Card stays empty; the rest of the page still works.
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
        await navigator.share({
          title: "Join me on this campaign",
          text: "Open my link to join — it credits me when you do.",
          url: link.url,
        });
        return;
      }
      await navigator.clipboard.writeText(link.url);
      success("Link copied — send it to who you are referring");
    } catch {
      toastError("Could not copy the link");
    }
  }

  return (
    <Card className="border-crimson-500/30 bg-crimson-500/5">
      <p className="text-sm font-semibold">Share this link with who you are referring</p>
      <p className="mt-1 text-xs leading-relaxed text-mist-500">
        This is your personal short link (<span className="tabular text-mist-400">/s/…</span>
        ). When they open it and join, clicks and joins count as yours — you do not type a
        referral code on Submit.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="tabular min-w-0 flex-1 truncate rounded-lg border border-ink-700 bg-ink-850 px-2 py-1.5 text-xs text-mist-300">
          {link.url.replace(/^https?:\/\//, "")}
        </code>
        <Button type="button" onClick={share}>
          Share link
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-mist-500">
        <span className="tabular text-mist-400">{link.clickCount}</span> click
        {link.clickCount === 1 ? "" : "s"} ·{" "}
        <span className="tabular text-mist-400">{link.joinCount}</span> joined through you
      </p>
    </Card>
  );
}

/**
 * Shown on Submit when the engagement is a referral: no code field — point people
 * at their campaign share link instead.
 */
export function ReferralShareGuide({
  campaignSlug,
  address,
}: {
  campaignSlug?: string | null;
  address?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          How referrals work
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mist-400">
          Share your personal campaign link with the person you are bringing. The app
          mints a short <span className="tabular text-mist-300">/s/XXXX</span> link for
          you and tracks clicks and joins automatically — there is nothing to type here.
        </p>
      </div>

      {campaignSlug && address ? (
        <CampaignShareCard slug={campaignSlug} address={address} />
      ) : (
        <Card className="bg-ink-850/60">
          <p className="text-sm text-mist-400">
            Open a campaign under <span className="text-mist-300">Happening now</span>,
            join it, then use <span className="text-mist-300">Share this link</span> to
            send your personal link to who you are referring.
          </p>
          <Button href="/" variant="ghost" className="mt-3 w-full sm:w-auto">
            Find a campaign
          </Button>
        </Card>
      )}

      <p className="text-xs text-mist-500">
        In the note below, add their name so the business knows who you brought.
      </p>
    </div>
  );
}
