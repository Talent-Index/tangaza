"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { OrgShell, useIsApprover, useOrgAccessContext } from "@/components/org/Shell";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, SectionTitle, Spinner } from "@/components/ui";

import { useEngagementTypes, useTiers } from "@/lib/hooks";
import {
  PAYOUT_KINDS,
  PROOF_KINDS,
  REWARD_CURRENCIES,
  formatReward,
  type EngagementType,
  type ProofKind,
} from "@/lib/types";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";

/**
 * What the business rewards, and what it gives for it.
 *
 * Campaigns live on /org/campaigns. This page is engagements + levels only.
 */
export default function SettingsPage() {
  return (
    <OrgShell>
      <Settings />
    </OrgShell>
  );
}

function Settings() {
  const isApprover = useIsApprover();
  const { orgId, orgName } = useOrgAccessContext();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">Rewards setup</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist-500">
          Define what {orgName || "you"} reward{orgName ? "s" : ""} and the levels advocates
          climb. Campaigns are managed separately under{" "}
          <a href="/org/campaigns" className="text-crimson-400 hover:text-crimson-300">
            Campaigns
          </a>
          .
        </p>
      </div>

      {!isApprover ? (
        <ErrorNote>
          You&rsquo;re signed in with an account that isn&rsquo;t this org&rsquo;s
          approver. You can look, but changes will not stick.
        </ErrorNote>
      ) : null}

      <EngagementEditor orgId={orgId} />
      <TierEditor orgId={orgId} />
    </div>
  );
}

/* ------------------------------------------------------------- engagements */

const EMPTY_ENGAGEMENT = {
  label: "",
  blurb: "",
  icon: "★",
  proofKind: "link" as ProofKind,
  chainCategory: 1,
  weight: 1,
};

function EngagementEditor({ orgId }: { orgId: bigint }) {
  const engagements = useEngagementTypes(orgId);
  const account = useActiveAccount();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  const [editing, setEditing] = useState<EngagementType | null>(null);
  const [form, setForm] = useState(EMPTY_ENGAGEMENT);

  function startEdit(t: EngagementType) {
    setEditing(t);
    setForm({
      label: t.label,
      blurb: t.blurb ?? "",
      icon: t.icon,
      proofKind: t.proofKind,
      chainCategory: t.chainCategory,
      weight: t.weight,
    });
    setError(null);
  }

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_ENGAGEMENT);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.engagementSave);
      const res = await fetch("/api/engagement-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(orgId),
          ...form,
          // Editing overwrites every column, so round-trip the fields the form
          // doesn't expose or they reset to defaults.
          ...(editing ? { id: editing.id, active: editing.active, sortOrder: editing.sortOrder } : {}),
          ...auth,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      success(editing ? "Engagement updated" : "Engagement added");
      resetForm();
      engagements.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function retire(id: string) {
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.engagementRetire);
      const res = await fetch(`/api/engagement-types?orgId=${orgId}&id=${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      });
      if (!res.ok) throw new Error("Could not retire");
      if (editing?.id === id) resetForm();
      success("Engagement retired");
      engagements.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not retire");
    }
  }

  const types = engagements.data ?? [];

  return (
    <section>
      <SectionTitle>Engagements</SectionTitle>

      {engagements.loading && types.length === 0 ? (
        <Card className="grid place-items-center py-8">
          <Spinner />
        </Card>
      ) : (
        <ul className="mb-4 space-y-2">
          {types.map((t) => (
            <li key={t.id}>
              <Card className="flex items-center gap-3 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
                  {t.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="truncate text-xs text-mist-500">
                    {t.blurb ? `${t.blurb} · ` : ""}
                    asks for {PROOF_KINDS.find((p) => p.id === t.proofKind)?.label}
                  </p>
                </div>
                <span className="tabular shrink-0 rounded-full border border-ink-600 px-2 py-0.5 text-[11px] text-mist-400">
                  +{t.weight}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  className="shrink-0 text-xs text-mist-400 underline underline-offset-4 hover:text-crimson-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => retire(t.id)}
                  className="shrink-0 text-xs text-mist-500 underline underline-offset-4 hover:text-crimson-300"
                >
                  Retire
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        {editing ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
            Editing “{editing.label}”
          </p>
        ) : null}
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
          <input
            required
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Instagram Reel"
            className="sm:col-span-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
          <input
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            placeholder="📸"
            className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-center text-sm outline-none focus:border-crimson-500"
          />
          <select
            value={form.proofKind}
            onChange={(e) => setForm({ ...form, proofKind: e.target.value as ProofKind })}
            className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-crimson-500"
          >
            {PROOF_KINDS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
            className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-crimson-500"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                worth {w}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={saving || !form.label.trim()}>
            {saving ? "…" : editing ? "Save" : "Add"}
          </Button>
          <input
            value={form.blurb}
            onChange={(e) => setForm({ ...form, blurb: e.target.value })}
            placeholder="What should someone do? (shown on the submit form)"
            className="sm:col-span-6 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
          {editing ? (
            <button
              type="button"
              onClick={resetForm}
              className="sm:col-span-6 justify-self-start text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300"
            >
              Cancel edit
            </button>
          ) : null}
        </form>
        {error ? (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ levels */

interface LadderTier {
  id: string;
  level: number;
  name: string;
  perk: string;
  icon: string;
  thresholdWeight: number;
  amount?: number;
  currency?: string;
  rewardKind?: string;
}

const EMPTY_TIER = {
  level: 1,
  name: "",
  perk: "",
  icon: "★",
  thresholdWeight: 5,
  amount: "" as number | "",
  currency: "KES",
  rewardKind: "cash",
};

function TierEditor({ orgId }: { orgId: bigint }) {
  const tiers = useTiers(undefined, orgId);
  const account = useActiveAccount();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_TIER);

  function startEdit(t: LadderTier) {
    setEditingId(t.id);
    setForm({
      level: t.level,
      name: t.name,
      perk: t.perk,
      icon: t.icon,
      thresholdWeight: t.thresholdWeight,
      amount: t.amount ?? "",
      currency: t.currency ?? "KES",
      rewardKind: t.rewardKind ?? "cash",
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_TIER);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.tierSave);
      // A level is keyed by its number, so re-posting the same level updates it in place.
      const res = await fetch("/api/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(orgId),
          ...form,
          amount: form.amount === "" ? null : Number(form.amount),
          ...auth,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      success(editingId ? "Level updated" : "Level added");
      // After adding a new level, tee up the next one; after an edit, clear.
      if (editingId) resetForm();
      else setForm({ ...EMPTY_TIER, level: form.level + 1, icon: form.icon });
      tiers.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: LadderTier) {
    if (typeof window !== "undefined" && !window.confirm(`Delete level "${t.name}"?`)) return;
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.tierDelete);
      const res = await fetch(`/api/tiers?orgId=${orgId}&id=${encodeURIComponent(t.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      });
      if (!res.ok) throw new Error("Could not delete");
      if (editingId === t.id) resetForm();
      success("Level deleted");
      tiers.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  const ladder = (tiers.data?.tiers ?? []) as LadderTier[];

  return (
    <section>
      <SectionTitle>Levels</SectionTitle>
      <ul className="mb-4 space-y-2">
        {ladder.map((t) => (
          <li key={t.id}>
            <Card className="flex items-center gap-3 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
                {t.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {t.name}{" "}
                  <span className="font-normal text-mist-500">
                    after {t.thresholdWeight} activities
                  </span>
                </p>
                <p className="truncate text-xs text-mist-500">
                  {t.amount != null || t.rewardKind ? (
                    <span className="mr-2 rounded-full bg-jade-500/15 px-2 py-0.5 text-jade-400">
                      {formatReward({ amount: t.amount, currency: t.currency, rewardKind: t.rewardKind })}
                    </span>
                  ) : null}
                  {t.perk}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(t)}
                className="shrink-0 text-xs text-mist-400 underline underline-offset-4 hover:text-crimson-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(t)}
                className="shrink-0 text-xs text-mist-500 underline underline-offset-4 hover:text-crimson-300"
              >
                Delete
              </button>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        {editingId ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
            Editing level {form.level}
          </p>
        ) : null}
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
          <input
            type="number"
            min={1}
            value={form.level}
            onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
            className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-crimson-500"
            aria-label="Level number"
          />
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Champion"
            className="sm:col-span-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
          <input
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-center text-sm outline-none focus:border-crimson-500"
            aria-label="Icon"
          />
          <input
            type="number"
            min={0}
            value={form.thresholdWeight}
            onChange={(e) => setForm({ ...form, thresholdWeight: Number(e.target.value) })}
            className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-crimson-500"
            aria-label="Activities needed to reach this level"
            title="Activities needed to reach this level"
          />
          <Button type="submit" disabled={saving || !form.name.trim() || !form.perk.trim()}>
            {saving ? "…" : editingId ? "Save" : "Add"}
          </Button>

          {/* The reward this level unlocks — any form, any currency, honoured off-chain. */}
          <select
            value={form.rewardKind}
            onChange={(e) => setForm({ ...form, rewardKind: e.target.value })}
            className="sm:col-span-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-crimson-500"
            aria-label="Reward type"
          >
            {PAYOUT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.icon} {k.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: e.target.value === "" ? "" : Number(e.target.value) })
            }
            placeholder={form.rewardKind === "discount" ? "% off" : "Amount"}
            className="sm:col-span-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
            aria-label="Reward amount"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            disabled={form.rewardKind === "discount"}
            className="sm:col-span-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-crimson-500 disabled:opacity-40"
            aria-label="Currency"
          >
            {REWARD_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.symbol}
              </option>
            ))}
          </select>

          <input
            required
            value={form.perk}
            onChange={(e) => setForm({ ...form, perk: e.target.value })}
            placeholder="Describe it, e.g. “500 KSh airtime” or “a free seat at any paid workshop”"
            className="sm:col-span-6 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="sm:col-span-6 justify-self-start text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300"
            >
              Cancel edit
            </button>
          ) : null}
        </form>
        {error ? (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
