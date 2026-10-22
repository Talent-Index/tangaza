"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, Spinner } from "@/components/ui";

/**
 * Concierge billing console — the human half of Phase 1.
 *
 * Until payments auto-match, the flow is: a business opens a checkout → pays the exact
 * KES amount with the reference → tells us on WhatsApp → whoever holds
 * BILLING_ADMIN_SECRET matches it on the M-Pesa/ramp statement and confirms it here,
 * pasting the receipt or tx hash. The secret lives only in this tab's memory.
 */

interface AdminIntent {
  code: string;
  orgId: string;
  businessCode: string;
  credits: number;
  amountKes: number;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface AdminUnmatched {
  ref: string;
  source: string;
  amount: number;
  payer: string | null;
  note: string | null;
  seenAt: string;
}

export default function AdminBillingPage() {
  const [secret, setSecret] = useState("");
  const [intents, setIntents] = useState<AdminIntent[] | null>(null);
  const [unmatched, setUnmatched] = useState<AdminUnmatched[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  async function call(body: Record<string, unknown>) {
    const res = await fetch("/api/billing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, secret }),
    });
    const json = (await res.json()) as {
      error?: string;
      intents?: AdminIntent[];
      unmatched?: AdminUnmatched[];
    };
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const json = await call({ action: "list" });
      setIntents(json.intents ?? []);
      setUnmatched(json.unmatched ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(ref: string) {
    if (!window.confirm(`Mark ${ref} as resolved? Do this after confirming the right intent (or refunding).`))
      return;
    setBusy(true);
    try {
      await call({ action: "resolve", code: ref });
      success(`${ref} resolved`);
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not resolve");
      setBusy(false);
    }
  }

  async function confirm(code: string) {
    const matchedRef = window.prompt(
      `Confirm ${code} — paste the M-Pesa receipt or tx hash (optional):`
    );
    if (matchedRef === null) return; // cancelled
    setBusy(true);
    try {
      await call({ action: "confirm", code, matchedRef: matchedRef.trim() || undefined });
      success(`${code} confirmed — credits granted`);
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not confirm");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-black">Billing — open checkouts</h1>
        <p className="mt-1 text-sm text-mist-500">
          Confirm a payment once it shows on the M-Pesa / ramp statement. Expired intents
          are listed too: someone who paid late still paid.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="flex gap-2"
      >
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="BILLING_ADMIN_SECRET"
          className="w-full rounded-full border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
        <Button type="submit" disabled={busy || !secret.trim()}>
          {busy ? <Spinner className="size-4" /> : "Load"}
        </Button>
      </form>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {intents !== null ? (
        intents.length === 0 ? (
          <Card className="py-10 text-center">
            <p className="text-sm text-mist-500">No open checkouts.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {intents.map((i) => (
              <li
                key={i.code}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-850 p-4"
              >
                <div className="min-w-0">
                  <p className="font-bold">
                    {i.code}{" "}
                    {i.status === "expired" ? (
                      <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-semibold uppercase text-mist-500">
                        expired
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-mist-400">
                    org #{i.orgId} ({i.businessCode}) · expects{" "}
                    <span className="font-semibold text-mist-200 tabular-nums">
                      KES {i.amountKes.toLocaleString("en-GB")}
                    </span>{" "}
                    · {i.credits} credit{i.credits === 1 ? "" : "s"} · opened{" "}
                    {new Date(i.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => confirm(i.code)} disabled={busy}>
                  Confirm payment
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {intents !== null && unmatched.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">
            Unmatched payments <span className="text-sm font-normal text-mist-500">— arrived, attributed to nobody</span>
          </h2>
          <p className="text-xs text-mist-500">
            Wrong amount, overpayment or a stranger. Find the owner, confirm their intent
            above with this ref pasted in, then resolve it here. Overpayments: confirm the
            intent and settle the difference off-platform.
          </p>
          <ul className="space-y-2">
            {unmatched.map((u) => (
              <li
                key={u.ref}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-crimson-500/30 bg-crimson-500/5 p-4"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold">{u.ref}</p>
                  <p className="mt-0.5 text-sm text-mist-400">
                    {u.source} ·{" "}
                    <span className="font-semibold text-mist-200 tabular-nums">
                      {u.source === "mpesa" ? "KES " : "$"}
                      {u.amount.toLocaleString("en-GB")}
                    </span>
                    {u.payer ? ` · from ${u.payer}` : ""}
                    {u.note ? ` · ${u.note}` : ""} ·{" "}
                    {new Date(u.seenAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => resolve(u.ref)} disabled={busy}>
                  Resolve
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
