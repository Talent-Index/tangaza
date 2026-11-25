"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, Pill } from "@/components/ui";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";
import { normalizeKenyanPhone } from "@/lib/payments/phone";

export interface FundingCampaign {
  campaignId: string;
  title: string;
  rewardKind: string | null;
  rewardAmount: number | null;
  fundedKes: number;
  reservedKes: number;
  availableKes: number;
}

export interface FundingDeposit {
  id: string;
  campaignId: string;
  amountKes: number;
  status: "pending" | "paid" | "failed" | "retrying";
  simulated: boolean;
  failureReason: string | null;
  payerPhone: string | null;
}

interface ModeState {
  testMode: boolean;
  simulated: boolean;
  mode: "sandbox" | "blocked";
  qadiConfigured: boolean;
  autopayConfigured: boolean;
}

const PRACTICE_CAMPAIGNS: FundingCampaign[] = [
  {
    campaignId: "practice",
    title: "Saturday market",
    rewardKind: "cash",
    rewardAmount: 500,
    fundedKes: 2000,
    reservedKes: 500,
    availableKes: 1500,
  },
];

const PRACTICE_DEPOSITS: FundingDeposit[] = [
  {
    id: "practice-deposit",
    campaignId: "practice",
    amountKes: 2000,
    status: "paid",
    simulated: true,
    failureReason: null,
    payerPhone: "+2547•••5678",
  },
];

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

export function statusLabel(status: string, simulated: boolean) {
  const name =
    status === "paid" ? "Paid" : status === "failed" ? "Failed" : status === "retrying" ? "Retrying" : "Pending";
  return simulated ? `${name} · test` : name;
}

function toneFor(status: string): "good" | "bad" | "warn" | "neutral" {
  if (status === "paid") return "good";
  if (status === "failed") return "bad";
  if (status === "retrying" || status === "pending") return "warn";
  return "neutral";
}

export function PaymentsBanner({ mode }: { mode: ModeState | null }) {
  if (!mode) return null;
  if (mode.mode === "blocked") {
    return (
      <p className="rounded-xl border border-danger-line bg-danger-bg px-3 py-2 text-sm text-danger-text">
        Live payments are turned off. Set PAYMENTS_MODE to sandbox.
      </p>
    );
  }
  if (mode.simulated || mode.testMode) {
    const waitingOnQadi = !mode.qadiConfigured;
    return (
      <p className="rounded-xl border border-amber-glow/40 bg-amber-glow/10 px-3 py-2 text-sm text-mist-100">
        Test mode. No real M-Pesa money moves
        {waitingOnQadi
          ? ". Qadi is not connected yet, so funding stays a practice step"
          : mode.simulated
            ? " until Qadi and Autopay sandbox keys are set"
            : ""}
        . Sandbox only — live payments stay off.
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-gold-line/40 bg-gold/10 px-3 py-2 text-sm text-mist-100">
      Sandbox. Prompts and payouts use test money. Live payments are not turned on.
    </p>
  );
}

/** Balance for one campaign, used on the overview and the fund page. */
export function BalanceCard({ campaign }: { campaign: FundingCampaign }) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-text">Reward balance</p>
          <h2 className="mt-1 text-xl font-bold">{campaign.title}</h2>
        </div>
        {campaign.rewardKind === "cash" && campaign.rewardAmount != null ? (
          <Pill>{kes(campaign.rewardAmount)} when you approve a new customer</Pill>
        ) : (
          <Pill>Not a cash reward</Pill>
        )}
      </div>
      <p className="poster text-5xl text-gold-text">{kes(campaign.availableKes)}</p>
      <p className="text-sm text-mist-400">
        Available to pay Ambassadors. {kes(campaign.fundedKes)} funded
        {campaign.reservedKes > 0 ? `, ${kes(campaign.reservedKes)} waiting on a payout` : ""}.
      </p>
    </Card>
  );
}

export function FundingScreen({
  orgId,
  practice = false,
  initialCampaignId,
  initialAmount,
}: {
  orgId?: string;
  practice?: boolean;
  initialCampaignId?: string;
  initialAmount?: string;
}) {
  const account = useActiveAccount();
  const { success, error: toastError } = useToast();
  const [mode, setMode] = useState<ModeState | null>(practice ? { testMode: true, simulated: true, mode: "sandbox", qadiConfigured: false, autopayConfigured: false } : null);
  const [campaigns, setCampaigns] = useState<FundingCampaign[]>(practice ? PRACTICE_CAMPAIGNS : []);
  const [deposits, setDeposits] = useState<FundingDeposit[]>(practice ? PRACTICE_DEPOSITS : []);
  const [campaignId, setCampaignId] = useState(initialCampaignId || (practice ? "practice" : ""));
  const [amount, setAmount] = useState(initialAmount ?? (practice ? "1000" : ""));
  const [phone, setPhone] = useState(practice ? "0712 345 678" : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!practice);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    practice ? "Example only. Sign in as the business to fund a real campaign in test mode." : null
  );

  useEffect(() => {
    if (practice || !orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const [modeRes, balanceRes] = await Promise.all([
          fetch("/api/payments/mode", { cache: "no-store" }),
          fetch(`/api/payments/balance?orgId=${orgId}`, { cache: "no-store" }),
        ]);
        const modeJson = (await modeRes.json()) as ModeState & { error?: string };
        const balanceJson = (await balanceRes.json()) as {
          error?: string;
          campaigns?: FundingCampaign[];
          deposits?: FundingDeposit[];
        };
        if (cancelled) return;
        if (modeRes.ok) setMode(modeJson);
        if (!balanceRes.ok) {
          setError(balanceJson.error ?? "Could not load the balance");
        } else {
          const list = balanceJson.campaigns ?? [];
          setCampaigns(list);
          setDeposits(balanceJson.deposits ?? []);
          setCampaignId((current) => current || initialCampaignId || list[0]?.campaignId || "");
        }
      } catch {
        if (!cancelled) setError("Could not load the balance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, practice, initialCampaignId]);

  const selected = campaigns.find((c) => c.campaignId === campaignId) ?? campaigns[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (practice || (mode && !mode.qadiConfigured)) {
      setNotice(
        practice
          ? "This is an example balance. Sign in as the business to open a real campaign."
          : "Test mode. Qadi is not connected, so no M-Pesa prompt was sent. Your campaign balance stays here."
      );
      return;
    }
    const kesAmount = Number(amount);
    if (!Number.isInteger(kesAmount) || kesAmount < 1) {
      setError("Enter a whole number of shillings.");
      return;
    }
    if (!normalizeKenyanPhone(phone)) {
      setError("Enter the M-Pesa number that will approve the prompt.");
      return;
    }
    if (!selected) {
      setError("Choose a campaign first.");
      return;
    }
    setSending(true);
    try {
      if (!account) throw new Error("Sign in as the business first");
      const auth = await signOrgAction(account, orgId ?? "", ORG_ACTIONS.campaignFund);
      const res = await fetch("/api/payments/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          campaignId: selected.campaignId,
          amountKes: kesAmount,
          payerPhone: phone,
          idempotencyKey: `dep_${selected.campaignId}_${crypto.randomUUID()}`,
          ...auth,
        }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not send the prompt");
      setNotice(json.message ?? "Check the phone for the M-Pesa prompt.");
      success("M-Pesa prompt requested");
      const refresh = await fetch(`/api/payments/balance?orgId=${orgId}`, { cache: "no-store" });
      if (refresh.ok) {
        const body = (await refresh.json()) as { campaigns?: FundingCampaign[]; deposits?: FundingDeposit[] };
        setCampaigns(body.campaigns ?? []);
        setDeposits(body.deposits ?? []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send the prompt";
      setError(message);
      toastError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">Fund campaign</p>
          <h1 className="poster mt-3 text-5xl sm:text-6xl">Put money behind the reward.</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-mist-300">
            Ambassadors bring a new customer. When you approve that customer and the reward is
            cash, it can go to their M-Pesa number from this balance.
          </p>
          <div className="mt-4">
            <PaymentsBanner mode={mode} />
          </div>
        </div>
        <div className="relative min-h-56 overflow-hidden rounded-2xl border border-ink-700">
          <Image
            src="/images/landing/usecase-cafe.webp"
            alt="A cafe counter, the kind of business Ambassadors bring new customers to"
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </section>

      {loading ? <p className="text-sm text-mist-400">Loading the balance…</p> : null}
      {selected ? <BalanceCard campaign={selected} /> : !loading ? (
        <Card>
          <p className="text-sm text-mist-400">No campaign yet. Create one, then come back to fund the cash reward.</p>
        </Card>
      ) : null}

      <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5">
        <h2 className="text-lg font-bold">Send an M-Pesa prompt</h2>
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist-500">Campaign</span>
          <select
            value={selected?.campaignId ?? ""}
            onChange={(e) => setCampaignId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm"
          >
            {campaigns.map((c) => (
              <option key={c.campaignId} value={c.campaignId}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist-500">Amount (KES)</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
              className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist-500">M-Pesa number</span>
            <input
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm"
            />
          </label>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {notice ? <p className="text-sm text-mist-300">{notice}</p> : null}
        <Button type="submit" disabled={sending || (!practice && !selected)}>
          {sending ? "Sending…" : "Send M-Pesa prompt"}
        </Button>
      </form>

      {deposits.length > 0 ? (
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-mist-500">Recent deposits</h2>
          <ul className="space-y-2">
            {deposits.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700 px-3 py-2">
                <span className="text-sm font-semibold">{kes(d.amountKes)}</span>
                <Pill tone={toneFor(d.status)}>{statusLabel(d.status, d.simulated)}</Pill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Compact balance on the business overview. Links through to the fund step. */
export function FundingOverviewLink({ orgId }: { orgId: string }) {
  const [available, setAvailable] = useState<number | null>(null);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/payments/balance?orgId=${orgId}`, { cache: "no-store" }),
      fetch("/api/payments/mode", { cache: "no-store" }),
    ])
      .then(async ([balance, mode]) => {
        if (cancelled) return;
        if (mode.ok) {
          const body = (await mode.json()) as { testMode?: boolean };
          setTestMode(Boolean(body.testMode));
        }
        if (balance.ok) {
          const body = (await balance.json()) as { campaigns?: FundingCampaign[] };
          const total = (body.campaigns ?? []).reduce((sum, c) => sum + c.availableKes, 0);
          setAvailable(total);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-text">Reward balance</p>
        <p className="mt-1 text-lg font-bold">
          {available == null ? "Fund a campaign" : `KES ${available.toLocaleString("en-KE")} available`}
        </p>
        <p className="text-sm text-mist-400">
          {testMode ? "Test mode. " : ""}
          Cash rewards for Ambassadors who bring a new customer come out of this.
        </p>
      </div>
      <Link
        href="/org/funding"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-5 text-sm font-semibold text-on-gold shadow-[0_8px_24px_-8px_rgb(233_162_59/0.55)]"
      >
        Fund campaign
      </Link>
    </div>
  );
}
