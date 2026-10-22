"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/components/toast";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import { CONTACT } from "@/lib/contact";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";

/**
 * Campaign-credit checkout. The first 2 campaigns are free; after that a campaign
 * costs a credit, bought by M-Pesa against an exact amount + reference code minted by
 * the server (/api/billing). Nothing here knows a price — every number is served.
 *
 * Attribution is the exact amount AND the reference, so the panel's whole job is to
 * make those two things impossible to get wrong: the amount is the headline, the code
 * is one tap to copy, and "I've paid" opens WhatsApp with both prefilled.
 */

export interface BillingView {
  businessCode: string;
  campaignsCreated: number;
  credits: number;
  freeRemaining: number;
  nextPriceKes: number | null;
  nextPriceUsd: number | null;
  paymentRequired: boolean;
  pendingIntent: IntentView | null;
  receipts: IntentView[];
}

export interface IntentView {
  code: string;
  credits: number;
  amountKes: number;
  status: string;
  matchedRef: string | null;
  expiresAt: string;
  createdAt: string;
}

export function useBilling(orgId: bigint) {
  const [data, setData] = useState<{ billing: BillingView; instructions: string | null } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing?orgId=${orgId}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as { billing: BillingView; instructions: string | null });
    } catch {
      /* transient — the next refresh retries */
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

/** One line of billing truth next to "Create campaign". */
export function BillingBadge({ billing }: { billing: BillingView | undefined }) {
  if (!billing) return null;
  const text =
    billing.freeRemaining > 0
      ? `${billing.freeRemaining} free campaign${billing.freeRemaining === 1 ? "" : "s"} left`
      : billing.credits > 0
        ? `${billing.credits} campaign credit${billing.credits === 1 ? "" : "s"}`
        : billing.nextPriceKes !== null
          ? `Next campaign: KES ${billing.nextPriceKes.toLocaleString("en-GB")}`
          : null;
  if (!text) return null;
  return (
    <span className="rounded-full border border-ink-600 px-3 py-1.5 text-xs text-mist-400">
      {text}
    </span>
  );
}

export function CheckoutPanel({
  orgId,
  billing,
  instructions,
  onRefresh,
  onReady,
  onCancel,
  mode = "gate",
}: {
  orgId: bigint;
  billing: BillingView;
  instructions: string | null;
  onRefresh: () => Promise<void> | void;
  /** Called when a credit is available — the caller reopens campaign creation. */
  onReady?: () => void;
  onCancel?: () => void;
  /**
   * "gate" = shown because creation is blocked (collapses to "create your campaign"
   * the moment a credit lands). "page" = the /org/billing session: always shows the
   * full picture, and lets a business buy a credit ahead of needing it.
   */
  mode?: "gate" | "page";
}) {
  const account = useActiveAccount();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { success, error: toastError } = useToast();
  const intent = billing.pendingIntent;

  // While a checkout is open, watch for the concierge confirming the payment.
  useEffect(() => {
    if (!intent) return;
    const t = setInterval(() => void onRefresh(), 20_000);
    return () => clearInterval(t);
  }, [intent, onRefresh]);

  async function start() {
    if (!account) return;
    setError(null);
    setStarting(true);
    try {
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.billingIntent);
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: String(orgId), ...auth }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not open a checkout");
      await onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open a checkout";
      setError(msg);
      toastError(msg);
    } finally {
      setStarting(false);
    }
  }

  async function copyCode() {
    if (!intent) return;
    try {
      await navigator.clipboard?.writeText(intent.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the code is shown for manual copy */
    }
  }

  /** "Check again": kick the on-chain watcher, then pull fresh status. */
  async function recheck() {
    try {
      await fetch("/api/billing/recheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: String(orgId) }),
      });
    } catch {
      /* the plain refresh below still runs */
    }
    await onRefresh();
  }

  // Gate mode, payment confirmed while the panel was open: straight back to creation.
  if (mode === "gate" && !billing.paymentRequired) {
    return (
      <div className="card min-w-0 space-y-4 p-4 sm:p-5">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
          Payment received
        </p>
        <h2 className="text-lg font-bold sm:text-xl">You have a campaign credit ✓</h2>
        <Button type="button" onClick={onReady}>
          Create your campaign →
        </Button>
      </div>
    );
  }

  const paidMsg = intent
    ? `Hi! I've paid KES ${intent.amountKes} for a Tangaza campaign credit — reference ${intent.code}.`
    : "";

  return (
    <div className="card min-w-0 space-y-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
            Campaign {billing.campaignsCreated + 1}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-snug sm:text-xl">
            {intent
              ? "Pay to unlock your next campaign"
              : billing.paymentRequired
                ? "Your next campaign needs a credit"
                : "Campaign credits"}
          </h2>
          <p className="mt-1 text-sm text-mist-400">
            Your first 2 campaigns were free. From here each campaign costs a one-off
            credit — no subscription, and your live campaigns and rewards are never
            touched.
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 shrink-0 px-2 text-sm text-mist-500 transition hover:text-mist-200"
          >
            Close
          </button>
        ) : null}
      </div>

      {intent ? (
        <>
          <div className="rounded-xl border border-crimson-500/30 bg-crimson-500/5 p-4">
            <p className="text-sm text-mist-400">Pay exactly</p>
            <p className="mt-1 text-3xl font-black tabular-nums">
              KES {intent.amountKes.toLocaleString("en-GB")}
            </p>
            <p className="mt-3 text-sm text-mist-400">Reference</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded-lg bg-ink-850 px-3 py-2 text-base font-bold tracking-wider text-crimson-300">
                {intent.code}
              </code>
              <Button type="button" variant="ghost" onClick={copyCode}>
                {copied ? "Copied ✓" : "Copy"}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mist-500">
              {instructions ??
                "We'll send the M-Pesa payment details on WhatsApp — tap “I’ve paid / get details” below."}{" "}
              The exact amount matters: it's how your payment finds you. Valid until{" "}
              {new Date(intent.expiresAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {CONTACT.whatsapp ? (
              <a
                href={`${CONTACT.whatsapp}?text=${encodeURIComponent(paidMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-crimson-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-crimson-400 sm:w-auto sm:px-6"
              >
                I&rsquo;ve paid / get details
              </a>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => void recheck()}>
              Check again
            </Button>
          </div>
          <p className="text-xs text-mist-500">
            Once the payment lands it&rsquo;s matched to your reference or exact amount and
            this unlocks itself — usually within minutes.
          </p>
        </>
      ) : billing.nextPriceKes !== null ? (
        <>
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
            <p className="text-3xl font-black tabular-nums">
              KES {billing.nextPriceKes.toLocaleString("en-GB")}
            </p>
            <p className="mt-1 text-sm text-mist-400">
              One campaign credit · paid by M-Pesa · you get a receipt here
            </p>
          </div>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button type="button" onClick={start} disabled={starting || !account}>
            {starting ? <Spinner className="size-4" /> : "Get a campaign credit"}
          </Button>
          <p className="text-xs text-mist-500">
            This signs with your approver account and reserves an exact amount + reference
            for 24 hours. Nothing is charged until you pay.
          </p>
        </>
      ) : (
        <p className="rounded-xl border border-ink-700 bg-ink-900/40 px-3 py-2.5 text-sm text-mist-400">
          Your next campaign is free — nothing to pay. Credits only come into it once
          your free campaigns are used.
        </p>
      )}

      {billing.receipts.length > 0 ? (
        <div>
          <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
            Your payments
          </p>
          <ul className="space-y-1">
            {billing.receipts.map((r) => (
              <li key={r.code} className="flex justify-between gap-3 text-xs text-mist-400">
                <span className="truncate">
                  {r.code} · KES {r.amountKes.toLocaleString("en-GB")}
                </span>
                <span className="tabular shrink-0 text-mist-500">
                  {r.matchedRef ?? "confirmed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
