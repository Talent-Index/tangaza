"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { OrgShell, useIsApprover, useOrgAccessContext } from "@/components/org/Shell";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, SectionTitle, Spinner, Stat } from "@/components/ui";
import { shortAddress } from "@/lib/format";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";
import { PAYOUT_KINDS, REWARD_CURRENCIES, formatReward } from "@/lib/types";

const PMF_TARGET = 15;

interface Purchase {
  id: string;
  amount: number;
  msisdn?: string;
  firstName?: string;
  referrer?: string;
  createdAt: string;
}
interface PilotData {
  config: {
    tillShortcode?: string;
    rewardAmount?: number;
    rewardCurrency?: string;
    rewardKind?: string;
  };
  count: { verified: number; total: number };
  purchases: Purchase[];
}

export default function OrgPilotPage() {
  return (
    <OrgShell>
      <Pilot />
    </OrgShell>
  );
}

function Pilot() {
  const isApprover = useIsApprover();
  const account = useActiveAccount();
  const { orgId, orgName } = useOrgAccessContext();
  const { success, error: toastError } = useToast();

  const [data, setData] = useState<PilotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ till: "", amount: "" as number | "", currency: "KES", kind: "cash" });

  async function load() {
    try {
      const res = await fetch(`/api/org/mpesa?orgId=${orgId}`);
      const json = (await res.json()) as PilotData;
      setData(json);
      setForm({
        till: json.config.tillShortcode ?? "",
        amount: json.config.rewardAmount ?? "",
        currency: json.config.rewardCurrency ?? "KES",
        kind: json.config.rewardKind ?? "cash",
      });
    } catch {
      /* leave empty */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.mpesaConfig);
      const res = await fetch("/api/org/mpesa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(orgId),
          tillShortcode: form.till,
          rewardAmount: form.amount === "" ? null : Number(form.amount),
          rewardCurrency: form.currency,
          rewardKind: form.kind,
          ...auth,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      success("Pilot settings saved");
      load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const reward = data?.config
    ? formatReward({
        amount: data.config.rewardAmount,
        currency: data.config.rewardCurrency,
        rewardKind: data.config.rewardKind,
      })
    : "";

  // Group verified purchases by referrer for the "who you owe" list.
  const owed = new Map<string, number>();
  for (const p of data?.purchases ?? []) {
    if (p.referrer) owed.set(p.referrer, (owed.get(p.referrer) ?? 0) + 1);
  }

  const verified = data?.count.verified ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">Referral pilot</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist-500">
          Reward the people who bring {orgName || "you"} paying customers — verified
          automatically from your M-Pesa Till, no dashboard to babysit.
        </p>
      </div>

      {!isApprover ? (
        <ErrorNote>You can view the pilot but only the approver can change settings.</ErrorNote>
      ) : null}

      {/* Progress toward the PMF target */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Verified referred sales"
          value={`${verified}`}
          hint={`of ${PMF_TARGET} pilot target`}
          tone="jade"
        />
        <Stat label="Referrers earning" value={`${owed.size}`} hint="distinct people owed" />
        <Stat
          label="Till payments seen"
          value={`${data?.count.total ?? 0}`}
          hint="all C2B confirmations"
        />
      </section>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-jade-500 transition-all"
          style={{ width: `${Math.min(100, (verified / PMF_TARGET) * 100)}%` }}
        />
      </div>

      {/* One-screen setup */}
      <section>
        <SectionTitle>Setup</SectionTitle>
        <Card>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs text-mist-500">Your M-Pesa Till / shortcode</label>
              <input
                value={form.till}
                onChange={(e) => setForm({ ...form, till: e.target.value })}
                placeholder="e.g. 174379"
                className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs text-mist-500">Reward per referred sale</label>
              <div className="flex gap-2">
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="rounded-xl border border-ink-700 bg-ink-850 px-2 py-2 text-sm outline-none focus:border-crimson-500"
                  aria-label="Reward type"
                >
                  <optgroup label="Cash">
                    {PAYOUT_KINDS.filter((k) => k.id === "cash").map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.icon} {k.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Incentive">
                    {PAYOUT_KINDS.filter((k) => k.id !== "cash").map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.icon} {k.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder={form.kind === "discount" ? "% off" : "Amount"}
                  className="w-24 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
                  aria-label="Reward amount"
                />
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  disabled={form.kind === "discount"}
                  className="rounded-xl border border-ink-700 bg-ink-850 px-2 py-2 text-sm outline-none focus:border-crimson-500 disabled:opacity-40"
                  aria-label="Currency"
                >
                  {REWARD_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {isApprover ? (
              <Button type="submit" disabled={saving} className="sm:col-span-2">
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : null}
          </form>
          <p className="mt-3 border-t border-ink-700 pt-3 text-xs leading-relaxed text-mist-500">
            How it works: a referrer shares their link and gets a short code. Their friend
            pays your Till and enters that code as the M-Pesa <em>account number</em>. The
            payment is matched here automatically and the referrer is owed{" "}
            {reward || "the reward above"} — you honour it your way.
          </p>
        </Card>
      </section>

      {/* Who you owe */}
      <section>
        <SectionTitle>Who you owe</SectionTitle>
        {loading ? (
          <Card className="grid place-items-center py-10">
            <Spinner />
          </Card>
        ) : owed.size === 0 ? (
          <Card className="py-10 text-center">
            <p className="text-sm text-mist-500">
              No verified referrals yet. Once a friend pays your Till with a referrer&rsquo;s
              code, they show up here.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {[...owed.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([referrer, n]) => (
                <li key={referrer}>
                  <Card className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{shortAddress(referrer)}</p>
                      <p className="text-xs text-mist-500">
                        {n} referred sale{n === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-jade-500/15 px-3 py-1 text-sm font-semibold text-jade-400">
                      owe {reward}
                      {n > 1 ? ` × ${n}` : ""}
                    </span>
                  </Card>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
