"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { OrgShell, useIsApprover, useOrgAccessContext } from "@/components/org/Shell";
import { CoverImageField } from "@/components/org/CoverImageField";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import { useCampaigns, useEngagementTypes, type Campaign } from "@/lib/hooks";
import { isCampaignLive, isCampaignPast } from "@/lib/campaigns";

export default function OrgCampaignsPage() {
  return (
    <OrgShell>
      <CampaignsWorkspace />
    </OrgShell>
  );
}

interface CampaignDraft {
  id?: string;
  title: string;
  blurb: string;
  coverUrl: string;
  endsAt: string;
  engagementTypeIds: string[];
}

const EMPTY_DRAFT: CampaignDraft = {
  title: "",
  blurb: "",
  coverUrl: "",
  endsAt: "",
  engagementTypeIds: [],
};

function CampaignsWorkspace() {
  const isApprover = useIsApprover();
  const { orgId, orgName } = useOrgAccessContext();
  const campaigns = useCampaigns(orgId);
  const engagements = useEngagementTypes(orgId);
  const list = campaigns.data ?? [];
  const types = engagements.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  const selected = useMemo(
    () => list.find((c) => c.id === selectedId) ?? null,
    [list, selectedId]
  );

  useEffect(() => {
    if (selectedId && !list.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [list, selectedId]);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function openEdit(c: Campaign) {
    setCreating(false);
    setSelectedId(c.id);
    setDraft({
      id: c.id,
      title: c.title,
      blurb: c.blurb ?? "",
      coverUrl: c.coverUrl ?? "",
      endsAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
      engagementTypeIds: c.engagementTypeIds,
    });
    setError(null);
  }

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
          coverUrl: draft.coverUrl.trim() || null,
          endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
          active: true,
          engagementTypeIds: draft.engagementTypeIds,
        }),
      });
      const json = (await res.json()) as { error?: string; campaign?: Campaign };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      success(draft.id ? "Campaign updated" : "Campaign created");
      campaigns.refresh();
      if (json.campaign) {
        setSelectedId(json.campaign.id);
        setCreating(false);
        setDraft(EMPTY_DRAFT);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function setActive(c: Campaign, active: boolean) {
    try {
      const res = await fetch("/api/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: c.id,
          orgId: String(orgId),
          title: c.title,
          blurb: c.blurb,
          coverUrl: c.coverUrl ?? null,
          endsAt: c.endsAt ?? null,
          active,
        }),
      });
      if (!res.ok) throw new Error("Could not update");
      success(active ? "Campaign reopened" : "Campaign closed");
      campaigns.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not update");
    }
  }

  const toggleType = (id: string) =>
    setDraft((d) => ({
      ...d,
      engagementTypeIds: d.engagementTypeIds.includes(id)
        ? d.engagementTypeIds.filter((x) => x !== id)
        : [...d.engagementTypeIds, id],
    }));

  const showForm = creating || (selected && draft.id === selected.id);
  const hasCampaigns = list.length > 0;

  useEffect(() => {
    if (!campaigns.loading && !hasCampaigns && isApprover) {
      setCreating(true);
    }
  }, [campaigns.loading, hasCampaigns, isApprover]);

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Campaigns</h1>
          <p className="mt-1 max-w-2xl text-sm text-mist-500">
            Create pushes for {orgName || "your business"}, share the link, and see who joins
            and spreads the word.
          </p>
        </div>
        {isApprover ? (
          <Button type="button" onClick={openCreate} className="shrink-0">
            Create campaign
          </Button>
        ) : null}
      </header>

      {!isApprover ? (
        <ErrorNote>
          You&rsquo;re signed in with an account that isn&rsquo;t this org&rsquo;s approver.
          You can view campaigns but cannot create or edit them.
        </ErrorNote>
      ) : null}

      <CampaignOverview orgId={orgId} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-8">
        <section className="min-w-0 space-y-3">
          <SectionTitle>Your campaigns</SectionTitle>
          {campaigns.loading && list.length === 0 ? (
            <Card className="grid place-items-center py-12">
              <Spinner />
            </Card>
          ) : list.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="text-sm text-mist-500">
                No campaigns yet — fill in the form on the right to launch your first push.
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => {
                const live = isCampaignLive(c);
                const past = isCampaignPast(c);
                const active = selectedId === c.id && !creating;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setSelectedId(c.id);
                        setDraft(EMPTY_DRAFT);
                      }}
                      className={`flex w-full min-w-0 gap-3 rounded-xl border p-3 text-left transition sm:p-4 ${
                        active
                          ? "border-crimson-500 bg-crimson-500/10"
                          : "border-ink-700 bg-ink-850 hover:border-ink-600"
                      }`}
                    >
                      {c.coverUrl ? (
                        <img
                          src={c.coverUrl}
                          alt=""
                          className="size-14 shrink-0 rounded-lg object-cover sm:size-16"
                        />
                      ) : (
                        <div
                          className="grid size-14 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg sm:size-16"
                          aria-hidden
                        >
                          ◈
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {live ? (
                            <span className="rounded-full bg-jade-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-jade-400">
                              Live
                            </span>
                          ) : past || !c.active ? (
                            <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-bold uppercase text-mist-500">
                              Ended
                            </span>
                          ) : (
                            <span className="rounded-full bg-crimson-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-crimson-300">
                              Upcoming
                            </span>
                          )}
                          <span className="text-[11px] text-mist-500">
                            {c.participantCount} joined
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug">
                          {c.title}
                        </p>
                        {c.blurb ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-mist-500">{c.blurb}</p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="min-w-0">
          {showForm ? (
            <Card className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
                {draft.id ? "Edit campaign" : "New campaign"}
              </p>
              <form onSubmit={save} className="space-y-4">
                <CoverImageField
                  value={draft.coverUrl}
                  onChange={(url) => setDraft({ ...draft, coverUrl: url })}
                />
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
                  rows={3}
                  value={draft.blurb}
                  onChange={(e) => setDraft({ ...draft, blurb: e.target.value })}
                  placeholder="What's the push, and how should people participate?"
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
                {error ? <ErrorNote>{error}</ErrorNote> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving || !draft.title.trim()}>
                    {saving ? "Saving…" : draft.id ? "Save changes" : "Create campaign"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCreating(false);
                      setDraft(EMPTY_DRAFT);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          ) : selected ? (
            <CampaignDetailPanel
              campaign={selected}
              types={types}
              isApprover={isApprover}
              orgId={orgId}
              onEdit={() => openEdit(selected)}
              onToggleActive={(active) => setActive(selected, active)}
            />
          ) : (
            <Card className="py-12 text-center">
              <p className="text-sm text-mist-500">
                Select a campaign from the list to see details and manage it.
              </p>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function CampaignDetailPanel({
  campaign: c,
  types,
  isApprover,
  orgId,
  onEdit,
  onToggleActive,
}: {
  campaign: Campaign;
  types: Array<{ id: string; label: string; blurb?: string; icon: string; weight: number }>;
  isApprover: boolean;
  orgId: bigint;
  onEdit: () => void;
  onToggleActive: (active: boolean) => void;
}) {
  const account = useActiveAccount();
  const live = isCampaignLive(c);
  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/c/${c.slug}` : `/c/${c.slug}`;

  const counted = c.engagementTypeIds.length
    ? types.filter((t) => c.engagementTypeIds.includes(t.id))
    : types;

  async function copyLink() {
    try {
      if (account) {
        const res = await fetch("/api/campaigns/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: c.slug, address: account.address }),
        });
        if (res.ok) {
          const { url } = (await res.json()) as { url: string };
          await navigator.clipboard?.writeText(url);
          return;
        }
      }
      await navigator.clipboard?.writeText(publicUrl);
    } catch {
      await navigator.clipboard?.writeText(publicUrl);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
      {c.coverUrl ? (
        <img src={c.coverUrl} alt="" className="aspect-[2/1] w-full object-cover" />
      ) : (
        <div className="grid aspect-[2/1] place-items-center bg-ink-800 text-4xl text-mist-600">
          ◈
        </div>
      )}

      <div className="space-y-5 p-4 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <span className="rounded-full bg-jade-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-jade-400">
                Live
              </span>
            ) : (
              <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-bold uppercase text-mist-500">
                {c.active ? "Upcoming" : "Closed"}
              </span>
            )}
            <span className="text-xs text-mist-500">
              Started {new Date(c.startsAt).toLocaleDateString()}
              {c.endsAt
                ? ` · Ends ${new Date(c.endsAt).toLocaleDateString()}`
                : ""}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold leading-snug md:text-2xl">{c.title}</h2>
          {c.blurb ? <p className="mt-2 text-sm text-mist-400">{c.blurb}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={copyLink}>
            Copy share link
          </Button>
          <Link
            href={`/c/${c.slug}`}
            target="_blank"
            className="inline-flex min-h-10 items-center rounded-full border border-ink-600 px-4 text-sm font-medium text-mist-300 transition hover:border-ink-500"
          >
            View public page ↗
          </Link>
          {isApprover ? (
            <>
              <Button type="button" variant="ghost" onClick={onEdit}>
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleActive(!c.active)}
              >
                {c.active ? "Close campaign" : "Reopen"}
              </Button>
            </>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500">
            How to participate
          </p>
          {counted.length === 0 ? (
            <p className="mt-2 text-sm text-mist-500">
              Any activity this business rewards counts toward this campaign.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {counted.map((t) => (
                <li
                  key={t.id}
                  className="flex gap-3 rounded-lg border border-ink-700 bg-ink-900/40 p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
                    {t.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t.label}</p>
                    {t.blurb ? (
                      <p className="mt-0.5 text-xs text-mist-500">{t.blurb}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-mist-500">+{t.weight} weight per approval</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-mist-500">
            Advocates join at <code className="tabular text-mist-400">/c/{c.slug}</code>, submit
            proof on Submit, and the business approves what is real.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-ink-900/40 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">Taking part</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.participantCount}</p>
          </Card>
          <Card className="bg-ink-900/40 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">Public link</p>
            <p className="mt-1 truncate text-sm text-crimson-300">/c/{c.slug}</p>
          </Card>
        </div>

        <CampaignSharers campaignId={c.id} />
        <CampaignRoster campaignId={c.id} orgId={orgId} />
      </div>
    </div>
  );
}

/* ---- shared overview helpers (used on campaigns page) ---- */

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

function CampaignOverview({ orgId }: { orgId: bigint }) {
  const data = useCampaignOverview(orgId);
  if (!data || data.campaigns.length === 0) return null;

  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">Across all campaigns</p>
        <p className="tabular mt-1 text-2xl font-bold">
          {data.totalUniqueParticipants}
          <span className="ml-2 text-sm font-normal text-mist-500">
            distinct {data.totalUniqueParticipants === 1 ? "person" : "people"}
          </span>
        </p>
      </div>
      <p className="min-w-0 flex-1 text-right text-xs text-mist-500">
        {data.campaigns.length} campaign{data.campaigns.length === 1 ? "" : "s"} total
      </p>
    </Card>
  );
}

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
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500">
        Who&rsquo;s spreading this
      </p>
      <ul className="space-y-1">
        {sharers.slice(0, 6).map((s) => (
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

function CampaignRoster({ campaignId, orgId }: { campaignId: string; orgId: bigint }) {
  const data = useCampaignOverview(orgId);
  const participants = data?.campaigns.find((c) => c.id === campaignId)?.participants ?? [];
  if (participants.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500">
        Who joined
      </p>
      <ul className="space-y-1">
        {participants.slice(0, 10).map((p) => (
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
        {participants.length > 10 ? (
          <li className="text-xs text-mist-600">…and {participants.length - 10} more</li>
        ) : null}
      </ul>
    </div>
  );
}
