"use client";

import { useEffect, useState } from "react";
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
        {error ? <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div> : null}
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
        {error ? <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div> : null}
      </Card>
    </section>
  );
}
  id?: string;
  title: string;
  blurb: string;
  endsAt: string;
  engagementTypeIds: string[];
}

const EMPTY_DRAFT: CampaignDraft = { title: "", blurb: "", endsAt: "", engagementTypeIds: [] };

/**
 * Create, edit, open and close campaigns — live. Saving refreshes straight from the
 * API, and the advocate side reads the same rows, so a change here is on "Happening
 * now" and the campaign page as soon as they next load.
 */
function CampaignEditor({ orgId }: { orgId: bigint }) {
  const account = useActiveAccount();
  const campaigns = useCampaigns(orgId);
  const engagements = useEngagementTypes(orgId);
  const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const types = engagements.data ?? [];
  const list = campaigns.data ?? [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          orgId: String(orgId),
          title: draft.title,
          blurb: draft.blurb || undefined,
          endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
          active: true,
          engagementTypeIds: draft.engagementTypeIds,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setDraft(EMPTY_DRAFT);
      campaigns.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(c: { id: string; title: string; blurb?: string; endsAt?: string }, active: boolean) {
    await fetch("/api/campaigns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: c.id, orgId: String(orgId), title: c.title, blurb: c.blurb,
        endsAt: c.endsAt ?? null, active,
      }),
    });
    campaigns.refresh();
  }

  const toggleType = (id: string) =>
    setDraft((d) => ({
      ...d,
      engagementTypeIds: d.engagementTypeIds.includes(id)
        ? d.engagementTypeIds.filter((x) => x !== id)
        : [...d.engagementTypeIds, id],
    }));

  return (
    <section>
      <SectionTitle>Campaigns</SectionTitle>

      <CampaignOverview orgId={orgId} />

      <ul className="mb-4 space-y-2">
        {list.map((c) => {
          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${c.slug}`;
          return (
            <li key={c.id}>
              <Card className="flex flex-wrap items-center gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {c.title}{" "}
                    {!c.active ? (
                      <span className="text-xs font-normal text-mist-500">· closed</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-mist-500">
                    {c.participantCount} taking part ·{" "}
                    {c.engagementTypeIds.length || "all"} engagements count
                    {c.endsAt ? ` · ends ${new Date(c.endsAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <code className="tabular truncate rounded-lg border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-mist-400">
                  /c/{c.slug}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    // The business's own attributed link — its shares are measured
                    // exactly like an advocate's.
                    try {
                      if (account) {
                        const res = await fetch("/api/campaigns/share", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ slug: c.slug, address: account.address }),
                        });
                        if (res.ok) {
                          const { url: shareUrl } = (await res.json()) as { url: string };
                          await navigator.clipboard?.writeText(shareUrl);
                          return;
                        }
                      }
                      await navigator.clipboard?.writeText(url);
                    } catch {
                      await navigator.clipboard?.writeText(url);
                    }
                  }}
                  className="text-xs text-mist-400 underline underline-offset-4 hover:text-crimson-300"
                >
                  Copy your link
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      id: c.id,
                      title: c.title,
                      blurb: c.blurb ?? "",
                      endsAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
                      engagementTypeIds: c.engagementTypeIds,
                    })
                  }
                  className="text-xs text-mist-400 underline underline-offset-4 hover:text-crimson-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActive(c, !c.active)}
                  className="text-xs text-mist-500 underline underline-offset-4 hover:text-crimson-300"
                >
                  {c.active ? "Close" : "Reopen"}
                </button>
                <CampaignSharers campaignId={c.id} />
                <CampaignRoster campaignId={c.id} />
              </Card>
            </li>
          );
        })}
      </ul>

      <Card>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          {draft.id ? "Edit campaign" : "New campaign"}
        </p>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Launch week"
              className="sm:col-span-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
            />
            <input
              type="date"
              value={draft.endsAt}
              onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-crimson-500"
              aria-label="Ends on"
            />
          </div>
          <textarea
            rows={2}
            value={draft.blurb}
            onChange={(e) => setDraft({ ...draft, blurb: e.target.value })}
            placeholder="What's the push, and why should people take part?"
            className="w-full resize-none rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
          {types.length > 0 ? (
            <div>
              <p className="mb-2 text-xs text-mist-500">
                What counts (none selected = everything counts):
              </p>
              <div className="flex flex-wrap gap-2">
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleType(t.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      draft.engagementTypeIds.includes(t.id)
                        ? "border-crimson-500 bg-crimson-500/15 text-crimson-300"
                        : "border-ink-600 text-mist-400 hover:border-ink-500"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !draft.title.trim()}>
              {saving ? "Saving…" : draft.id ? "Save changes" : "Create campaign"}
            </Button>
            {draft.id ? (
              <Button variant="ghost" onClick={() => setDraft(EMPTY_DRAFT)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
      </Card>
    </section>
  );
}

/**
 * Who is spreading this campaign — the word-of-mouth ledger. Only renders once
 * somebody actually has.
 */
function CampaignSharers({ campaignId }: { campaignId: string }) {
  const [sharers, setSharers] = useState<
    Array<{ sharer: string; displayName?: string; clickCount: number; joinCount: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/share?campaignId=${campaignId}`)
      .then((r) => (r.ok ? r.json() : { sharers: [] }))
      .then((j: { sharers: typeof sharers }) => {
        if (!cancelled) setSharers(j.sharers ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (sharers.length === 0) return null;

  return (
    <div className="w-full border-t border-ink-800 pt-3">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-mist-500">
        Who&rsquo;s spreading this
      </p>
      <ul className="space-y-1">
        {sharers.slice(0, 5).map((s) => (
          <li key={s.sharer} className="flex justify-between text-xs text-mist-400">
            <span className="truncate">
              {s.displayName ?? `${s.sharer.slice(0, 6)}…${s.sharer.slice(-4)}`}
            </span>
            <span className="tabular shrink-0">
              {s.clickCount} clicks · {s.joinCount} joined
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface OverviewData {
  campaigns: Array<{
    id: string;
    title: string;
    participants: Array<{
      address: string;
      displayName?: string;
      referredByName?: string;
      referredBy?: string;
    }>;
  }>;
  totalUniqueParticipants: number;
}

let overviewCache: { orgId: string; data: OverviewData } | null = null;

/** One fetch shared by the summary line and every campaign's roster. */
function useCampaignOverview(orgId: bigint) {
  const [data, setData] = useState<OverviewData | null>(
    overviewCache?.orgId === String(orgId) ? overviewCache.data : null
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/overview?orgId=${orgId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: OverviewData | null) => {
        if (!cancelled && j) {
          overviewCache = { orgId: String(orgId), data: j };
          setData(j);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return data;
}

/**
 * The org-wide truth above the per-campaign cards: how many distinct people all the
 * campaigns reach together — one person in three campaigns is one person.
 */
function CampaignOverview({ orgId }: { orgId: bigint }) {
  const data = useCampaignOverview(orgId);
  if (!data || data.campaigns.length === 0) return null;

  return (
    <Card className="mb-4 flex flex-wrap items-center gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">
          Across all campaigns
        </p>
        <p className="tabular mt-1 text-2xl font-bold">
          {data.totalUniqueParticipants}
          <span className="ml-2 text-sm font-normal text-mist-500">
            distinct {data.totalUniqueParticipants === 1 ? "person" : "people"} taking part
          </span>
        </p>
      </div>
      <p className="min-w-0 flex-1 text-right text-xs text-mist-500">
        {data.campaigns.length} campaign{data.campaigns.length === 1 ? "" : "s"} — each
        roster below shows exactly who, and who brought them.
      </p>
    </Card>
  );
}

/** Who joined this campaign, newest first, with referral credit where it exists. */
function CampaignRoster({ campaignId }: { campaignId: string }) {
  const { orgId } = useOrgAccessContext();
  const data = useCampaignOverview(orgId);
  const participants = data?.campaigns.find((c) => c.id === campaignId)?.participants ?? [];
  if (participants.length === 0) return null;

  return (
    <div className="w-full border-t border-ink-800 pt-3">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-mist-500">
        Who joined
      </p>
      <ul className="space-y-1">
        {participants.slice(0, 8).map((p) => (
          <li key={p.address} className="flex justify-between gap-3 text-xs text-mist-400">
            <span className="truncate">
              {p.displayName ?? `${p.address.slice(0, 6)}…${p.address.slice(-4)}`}
            </span>
            {p.referredBy ? (
              <span className="shrink-0 text-mist-500">
                via {p.referredByName ?? `${p.referredBy.slice(0, 6)}…`}
              </span>
            ) : (
              <span className="shrink-0 text-mist-600">direct</span>
            )}
          </li>
        ))}
        {participants.length > 8 ? (
          <li className="text-xs text-mist-600">…and {participants.length - 8} more</li>
        ) : null}
      </ul>
    </div>
  );
}
