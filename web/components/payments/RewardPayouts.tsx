"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, Pill } from "@/components/ui";
import { ORG_ID } from "@/lib/chain";
import { normalizeKenyanPhone } from "@/lib/payments/phone";
import { PaymentsBanner, statusLabel } from "./FundingScreen";

export interface RewardPayout {
  id: string;
  campaignTitle: string;
  amountKes: number;
  status: "pending" | "paid" | "failed" | "retrying";
  simulated: boolean;
  lastError: string | null;
  phone: string | null;
}

interface ModeState {
  testMode: boolean;
  simulated: boolean;
  mode: "sandbox" | "blocked";
  qadiConfigured: boolean;
  autopayConfigured: boolean;
}

const PRACTICE: RewardPayout[] = [
  {
    id: "ex-paid",
    campaignTitle: "Saturday market",
    amountKes: 500,
    status: "paid",
    simulated: true,
    lastError: null,
    phone: "+2547•••0001",
  },
  {
    id: "ex-pending",
    campaignTitle: "Saturday market",
    amountKes: 500,
    status: "pending",
    simulated: true,
    lastError: null,
    phone: "+2547•••0003",
  },
  {
    id: "ex-retry",
    campaignTitle: "Lunch hour",
    amountKes: 200,
    status: "retrying",
    simulated: true,
    lastError: "The payout network did not answer. Nothing was paid.",
    phone: "+2547•••1111",
  },
  {
    id: "ex-failed",
    campaignTitle: "Lunch hour",
    amountKes: 200,
    status: "failed",
    simulated: true,
    lastError: "Add the M-Pesa number this reward should go to.",
    phone: null,
  },
];

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

function toneFor(status: string): "good" | "bad" | "warn" | "neutral" {
  if (status === "paid") return "good";
  if (status === "failed") return "bad";
  if (status === "pending" || status === "retrying") return "warn";
  return "neutral";
}

/**
 * Cash rewards for an Ambassador. Without keys, signed-out visitors see labelled
 * examples so the statuses are visible. A signed-in Ambassador sees their own rows.
 */
export function RewardPayouts({ address }: { address?: string }) {
  const { success, error: toastError } = useToast();
  const [mode, setMode] = useState<ModeState | null>(null);
  const [rows, setRows] = useState<RewardPayout[] | null>(null);
  const [masked, setMasked] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const practice = !address && mode?.testMode !== false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const modeRes = await fetch("/api/payments/mode", { cache: "no-store" });
        const modeJson = modeRes.ok ? ((await modeRes.json()) as ModeState) : null;
        if (!cancelled && modeJson) setMode(modeJson);
        if (!address) {
          if (!cancelled) setRows(modeJson?.testMode !== false ? PRACTICE : []);
          return;
        }
        const [payRes, meRes] = await Promise.all([
          fetch(`/api/payments/payouts?address=${address}`, { cache: "no-store" }),
          fetch(`/api/me?orgId=${ORG_ID}&address=${address}`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (payRes.ok) {
          const body = (await payRes.json()) as { payouts?: RewardPayout[] };
          setRows(body.payouts ?? []);
        } else {
          const body = (await payRes.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Could not load rewards");
          setRows([]);
        }
        if (meRes.ok) {
          const me = (await meRes.json()) as { profile?: { mpesaPhoneMasked?: string } };
          setMasked(me.profile?.mpesaPhoneMasked ?? null);
        }
      } catch {
        if (!cancelled && address) setError("Could not load rewards");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    if (phone.trim() && !normalizeKenyanPhone(phone)) {
      setError("Enter a Kenyan M-Pesa number, like 07XX XXX XXX.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: String(ORG_ID), address, mpesaPhone: phone.trim() }),
      });
      const json = (await res.json()) as { error?: string; profile?: { mpesaPhoneMasked?: string } };
      if (!res.ok) throw new Error(json.error ?? "Could not save the number");
      setMasked(json.profile?.mpesaPhoneMasked ?? null);
      setPhone("");
      success("M-Pesa number saved");
      const payRes = await fetch(`/api/payments/payouts?address=${address}`, { cache: "no-store" });
      if (payRes.ok) {
        const body = (await payRes.json()) as { payouts?: RewardPayout[] };
        setRows(body.payouts ?? []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the number";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  const list = rows ?? (practice ? PRACTICE : []);

  return (
    <section className="space-y-4">
      <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">Your rewards</p>
          <h2 className="poster mt-3 text-4xl sm:text-6xl">Cash for a new customer.</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-mist-300">
            When a business approves a new customer you brought, a cash reward shows here with
            its payout status.
          </p>
        </div>
        <div className="relative min-h-56 overflow-hidden rounded-2xl border border-ink-700">
          <Image
            src="/images/landing/reward-box.png"
            alt="An open box of gold coins, the cash reward an Ambassador can be paid"
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover object-[center_62%]"
            priority
          />
        </div>
      </div>

      <PaymentsBanner mode={mode ?? (practice ? { testMode: true, simulated: true, mode: "sandbox", qadiConfigured: false, autopayConfigured: false } : null)} />
      {practice ? (
        <p className="text-sm text-mist-400">
          Examples, because you are not signed in. Nothing here was paid to a real phone.
        </p>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <ul className="space-y-3">
        {list.length === 0 ? (
          <li>
            <Card>
              <p className="text-sm text-mist-400">
                No cash reward yet. Bring a new customer, and the business approves them.
              </p>
            </Card>
          </li>
        ) : (
          list.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.campaignTitle}</p>
                  <p className="mt-1 text-sm text-mist-400">
                    {kes(row.amountKes)}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                  {row.lastError ? <p className="mt-1 text-xs text-mist-500">{row.lastError}</p> : null}
                </div>
                <Pill tone={toneFor(row.status)}>{statusLabel(row.status, row.simulated || practice)}</Pill>
              </Card>
            </li>
          ))
        )}
      </ul>

      {address ? (
        <form onSubmit={savePhone} className="card space-y-3 p-4 sm:p-5">
          <h3 className="text-base font-bold">M-Pesa number for cash rewards</h3>
          <p className="text-sm text-mist-400">
            {masked ? `Saved number ${masked}. Enter a new one to replace it.` : "We send cash rewards to this number."}
          </p>
          <label className="block">
            <span className="sr-only">M-Pesa number</span>
            <input
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm"
            />
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save number"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
