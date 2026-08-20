"use client";

import { useState } from "react";
import { OrgShell, useIsApprover, useOrgAccessContext } from "@/components/org/Shell";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, SectionTitle, Spinner } from "@/components/ui";

import { useEngagementTypes, useTiers } from "@/lib/hooks";
import { PROOF_KINDS, type ProofKind } from "@/lib/types";

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

function EngagementEditor({ orgId }: { orgId: bigint }) {
  const engagements = useEngagementTypes(orgId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    label: "",
    blurb: "",
    icon: "★",
    proofKind: "link" as ProofKind,
    chainCategory: 1,
    weight: 1,
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/engagement-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: String(orgId), ...form }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setForm({ ...form, label: "", blurb: "" });
      success("Engagement added");
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
      await fetch(`/api/engagement-types?orgId=${orgId}&id=${id}`, { method: "DELETE" });
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
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-6">
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
            {saving ? "…" : "Add"}
          </Button>
          <input
            value={form.blurb}
            onChange={(e) => setForm({ ...form, blurb: e.target.value })}
            placeholder="What should someone do? (shown on the submit form)"
            className="sm:col-span-6 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
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

function TierEditor({ orgId }: { orgId: bigint }) {
  const tiers = useTiers(undefined, orgId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({ level: 1, name: "", perk: "", icon: "★", thresholdWeight: 5 });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: String(orgId), ...form }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setForm({ ...form, name: "", perk: "", level: form.level + 1 });
      success("Level added");
      tiers.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  const ladder = tiers.data?.tiers ?? [];

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
                    at {t.thresholdWeight} weight
                  </span>
                </p>
                <p className="truncate text-xs text-mist-500">{t.perk}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-6">
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
            aria-label="Weight needed"
          />
          <Button type="submit" disabled={saving || !form.name.trim() || !form.perk.trim()}>
            {saving ? "…" : "Add"}
          </Button>
          <input
            required
            value={form.perk}
            onChange={(e) => setForm({ ...form, perk: e.target.value })}
            placeholder="What do they unlock? e.g. a free seat at any paid workshop"
            className="sm:col-span-6 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
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
