"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { OrgShell, useIsApprover, useOrgAccessContext } from "@/components/org/Shell";
import {
  CampaignWizard,
  EMPTY_DRAFT,
  draftFromCampaign,
  normalizeOfferUrl,
  parseTarget,
  rewardPayload,
  type CampaignDraft,
} from "@/components/goal/CampaignWizard";
import { CampaignFunnel } from "@/components/goal/CampaignFunnel";
import { GoalProgress } from "@/components/goal/GoalProgress";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import {
  useCampaigns,
  useEngagementTypes,
  useGoalsAvailable,
  useRewardsAvailable,
  type Campaign,
} from "@/lib/hooks";
import { isCampaignLive, isCampaignPast } from "@/lib/campaigns";
import { describeCampaignReward, describeRewardRule, goalMeta } from "@/lib/types";
import { txUrl } from "@/lib/chain";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";

export default function OrgCampaignsPage() {
  return (
    <OrgShell>
      <CampaignsWorkspace />
    </OrgShell>
  );
}

function CampaignsWorkspace() {
  const isApprover = useIsApprover();
  const account = useActiveAccount();
  const { orgId, orgName } = useOrgAccessContext();
  const campaigns = useCampaigns(orgId);
  const engagements = useEngagementTypes(orgId);
  const list = campaigns.data ?? [];
  const types = engagements.data ?? [];
  const goalsAvailable = useGoalsAvailable();
  const rewardsAvailable = useRewardsAvailable();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Set once a NEW campaign has been saved: the wizard turns into the share screen.
  const [launched, setLaunched] = useState<Campaign | null>(null);
  const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT);
  const [wizardKey, setWizardKey] = useState(0);
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
    setLaunched(null);
    setWizardKey((k) => k + 1);
    setError(null);
  }

  function openEdit(c: Campaign) {
    setCreating(false);
    setSelectedId(c.id);
    setDraft(draftFromCampaign(c));
    setLaunched(null);
    setWizardKey((k) => k + 1);
    setError(null);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.campaignSave);
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
          // Editing must not silently reopen a closed campaign; only a new one starts active.
          active: draft.id ? selected?.active ?? true : true,
          engagementTypeIds: draft.engagementTypeIds,
          // Goal fields only when the database can hold them; null clears, so a business
          // that skips or removes the goal really ends up with none.
          ...(goalsAvailable === true
            ? {
                goalType: draft.goalType ?? null,
                goalTarget: draft.goalType ? parseTarget(draft.goalTarget) : null,
                goalLabel: draft.goalType ? draft.goalLabel.trim() || null : null,
                offerName: draft.offerName.trim() || null,
                offerUrl: normalizeOfferUrl(draft.offerUrl) || null,
              }
            : {}),
          ...(rewardsAvailable === true ? rewardPayload(draft) : {}),
          ...auth,
        }),
      });
      const json = (await res.json()) as { error?: string; campaign?: Campaign };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      success(draft.id ? "Campaign updated" : "Campaign created");
      campaigns.refresh();
      if (json.campaign) {
        setSelectedId(json.campaign.id);
        if (draft.id) {
          setCreating(false);
          setDraft(EMPTY_DRAFT);
        } else {
          setLaunched(json.campaign);
        }
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
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.campaignSave);
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
          ...auth,
        }),
      });
      if (!res.ok) throw new Error("Could not update");
      success(active ? "Campaign reopened" : "Campaign closed");
      campaigns.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function remove(c: Campaign) {
    const warning =
      c.participantCount > 0
        ? `Delete "${c.title}"? ${c.participantCount} ${
            c.participantCount === 1 ? "person has" : "people have"
          } joined. This removes the campaign and its share links for good — approved work and weight are kept. Consider closing it instead.`
        : `Delete "${c.title}"? This cannot be undone.`;
    if (typeof window !== "undefined" && !window.confirm(warning)) return;
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.campaignDelete);
      const res = await fetch(
        `/api/campaigns?orgId=${orgId}&id=${encodeURIComponent(c.id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(auth),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not delete");
      success("Campaign deleted");
      setSelectedId(null);
      setCreating(false);
      setLaunched(null);
      setDraft(EMPTY_DRAFT);
      campaigns.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Could not delete");
    }
  }

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
                No campaigns yet — start with a goal and launch your first push.
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
                        setLaunched(null);
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
                            <span className="rounded-full bg-jade-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-jade-400">
                              Live
                            </span>
                          ) : past || !c.active ? (
                            <span className="rounded-full bg-ink-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-mist-500">
                              Ended
                            </span>
                          ) : (
                            <span className="rounded-full bg-crimson-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-crimson-300">
                              Upcoming
                            </span>
                          )}
                          {c.kind === "referral" ? (
                            <span className="rounded-full bg-ink-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-mist-300">
                              Referral
                            </span>
                          ) : null}
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
                        <GoalProgress campaign={c} showPending className="mt-2.5" />
                        {c.goalType ? (
                          <p className="mt-1 text-[11px] text-mist-600">
                            {goalMeta(c.goalType)?.label}
                          </p>
                        ) : null}
                      </div>
                    </button>
                    {active ? (
                      <div className="mt-2 rounded-xl border border-ink-700 bg-ink-900/40 p-3 sm:p-4">
                        <CampaignFunnel campaignId={c.id} orgId={orgId} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="min-w-0">
          {showForm ? (
            <CampaignWizard
              key={wizardKey}
              draft={draft}
              setDraft={setDraft}
              types={types}
              goalsAvailable={goalsAvailable}
              rewardsAvailable={rewardsAvailable}
              saving={saving}
              error={error}
              launched={launched}
              onSubmit={save}
              onCancel={() => {
                setCreating(false);
                setLaunched(null);
                setDraft(EMPTY_DRAFT);
                setError(null);
              }}
              onDone={() => {
                setCreating(false);
                setLaunched(null);
                setDraft(EMPTY_DRAFT);
              }}
            />
          ) : selected ? (
            <CampaignDetailPanel
              campaign={selected}
              types={types}
              isApprover={isApprover}
              orgId={orgId}
              onEdit={() => openEdit(selected)}
              onToggleActive={(active) => setActive(selected, active)}
              onDelete={() => remove(selected)}
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
  onDelete,
}: {
  campaign: Campaign;
  types: Array<{ id: string; label: string; blurb?: string; icon: string; weight: number }>;
  isApprover: boolean;
  orgId: bigint;
  onEdit: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
}) {
  const account = useActiveAccount();
  const live = isCampaignLive(c);
  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/c/${c.slug}` : `/c/${c.slug}`;
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    try {
      await navigator.clipboard?.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is shown for manual copy */
    }
  }

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
              <span className="rounded-full bg-jade-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-jade-400">
                Live
              </span>
            ) : (
              <span className="rounded-full bg-ink-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-mist-500">
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
          <h2 className="mt-2 break-words text-xl font-bold leading-snug md:text-2xl">{c.title}</h2>
          {c.goalTarget ? (
            <p className="mt-1 text-sm font-medium text-mist-200">
              Goal: {goalMeta(c.goalType)?.label ?? "Reach"} ·{" "}
              {c.goalTarget?.toLocaleString("en-GB")} {c.goalLabel?.trim() || "approved actions"}
            </p>
          ) : null}
          {c.offerName ? (
            <p className="mt-1 break-words text-sm text-mist-400">
              Pushing:{" "}
              {c.offerUrl ? (
                <a
                  href={c.offerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-crimson-300 underline underline-offset-4"
                >
                  {c.offerName} ↗
                </a>
              ) : (
                c.offerName
              )}
            </p>
          ) : null}
          {c.rewardKind ? (
            <p className="mt-1 break-words text-sm text-mist-400">
              Reward:{" "}
              <span className="text-mist-200">{describeCampaignReward(c)}</span>{" "}
              {describeRewardRule(c.rewardThreshold, c.rewardRepeats)}
            </p>
          ) : null}
          {c.blurb ? <p className="mt-2 text-sm text-mist-400">{c.blurb}</p> : null}
          <GoalProgress campaign={c} showPending className="mt-3" />
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
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium text-mist-500 transition hover:text-crimson-300"
              >
                Delete
              </button>
            </>
          ) : null}
        </div>

        {/* The broadcast invite: send this to people so they join the campaign. */}
        <div className="rounded-xl border border-crimson-500/30 bg-crimson-500/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-400">
            Invite link — send this so people join
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-850 px-3 py-2 text-xs text-crimson-300">
              {publicUrl}
            </code>
            <Button type="button" variant="ghost" onClick={copyInvite}>
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-mist-500">
            Anyone who opens it can join. Everything they do then shows in Activity below.
          </p>
        </div>

        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-ink-900/40 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">Taking part</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.participantCount}</p>
          </Card>
          <Card className="bg-ink-900/40 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">Approved</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.approvedCount}</p>
            <p className="mt-0.5 text-[11px] text-mist-500">
              {c.pendingCount > 0 ? `${c.pendingCount} awaiting approval` : "Nothing waiting"}
            </p>
          </Card>
          <Card className="bg-ink-900/40 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist-500">Public link</p>
            <p className="mt-1 truncate text-sm text-crimson-300">/c/{c.slug}</p>
          </Card>
        </div>

        <CampaignSharers campaignId={c.id} />
        <CampaignRoster campaignId={c.id} orgId={orgId} />
        <CampaignActivity campaignId={c.id} />
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
    <p className="border-t border-ink-700 pt-4 text-sm text-mist-500">
      {data.campaigns.length} campaign{data.campaigns.length === 1 ? "" : "s"} ·{" "}
      <span className="font-semibold text-mist-100">{data.totalUniqueParticipants}</span>{" "}
      distinct {data.totalUniqueParticipants === 1 ? "person" : "people"} reached across all
      of them
    </p>
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
      <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
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
      <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
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

interface ActivityRow {
  advocate: string;
  name?: string;
  typeLabel: string;
  typeIcon: string;
  weight: number;
  status: string;
  submittedAt: string;
  txHash?: string;
}

/** Every activity logged under this campaign — what people actually did, and its status. */
function CampaignActivity({ campaignId }: { campaignId: string }) {
  const [items, setItems] = useState<ActivityRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/activity?campaignId=${campaignId}`)
      .then((r) => (r.ok ? r.json() : { activity: [] }))
      .then((j: { activity: ActivityRow[] }) => {
        if (!cancelled) setItems(j.activity ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (items.length === 0) return null;

  const badge = (status: string) =>
    status === "approved"
      ? "bg-jade-500/15 text-jade-400"
      : status === "rejected"
        ? "bg-ink-700 text-mist-500"
        : "bg-crimson-500/15 text-crimson-300";

  return (
    <div>
      <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
        Activity
      </p>
      <ul className="space-y-1">
        {items.slice(0, 20).map((a, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-xs text-mist-400">
            <span className="min-w-0 truncate">
              <span className="mr-1">{a.typeIcon}</span>
              {a.name ?? `${a.advocate.slice(0, 6)}…${a.advocate.slice(-4)}`}
              <span className="text-mist-500"> — {a.typeLabel}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {a.txHash ? (
                <a
                  href={txUrl(a.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-jade-400 hover:text-jade-300"
                  title="On-chain proof of this approval"
                >
                  proof ↗
                </a>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge(
                  a.status
                )}`}
              >
                {a.status}
              </span>
            </span>
          </li>
        ))}
        {items.length > 20 ? (
          <li className="text-[11px] text-mist-600">…and {items.length - 20} more</li>
        ) : null}
      </ul>
    </div>
  );
}
