"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { OrgShell, useIsApprover, useOrgAccessContext } from "@/components/org/Shell";
import { EMPTY_DRAFT, RewardStep, rewardPayload, type CampaignDraft } from "@/components/goal/CampaignWizard";
import { useGiveReward } from "@/components/org/RewardsDue";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import { shortAddress } from "@/lib/format";
import { useReferralBoards, useRewardsAvailable, type ReferralBoard } from "@/lib/hooks";
import { ORG_ACTIONS, signOrgAction } from "@/lib/org-action";
import { describeCampaignReward, describeRewardRule } from "@/lib/types";

/**
 * Referrals: the business creates one, shares it, and sees who did what.
 *
 * A referral is a campaign with kind "referral" that counts referral actions (a
 * "Brought a friend" action is created if the business has none). People share their
 * personal link; clicks and joins are counted on the link, and the referrals the
 * business approves earn the reward it set. No Till or payment setup is needed.
 */
export default function OrgReferralsPage() {
  return (
    <OrgShell>
      <Referrals />
    </OrgShell>
  );
}

const NEW_REFERRAL: CampaignDraft = {
  ...EMPTY_DRAFT,
  rewardKind: "cash",
  rewardRepeats: true,
};

function Referrals() {
  const isApprover = useIsApprover();
  const { orgId, orgName } = useOrgAccessContext();
  const boards = useReferralBoards(orgId);
  const [creating, setCreating] = useState(false);
  const list = boards.data ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Referrals</h1>
          <p className="mt-1 max-w-2xl text-sm text-mist-500">
            Reward the people who bring {orgName || "you"} new customers. Create a referral,
            share it, then see who did what.
          </p>
        </div>
        {isApprover && !creating ? (
          <Button type="button" onClick={() => setCreating(true)} className="shrink-0">
            Create referral
          </Button>
        ) : null}
      </header>

      {!isApprover ? (
        <ErrorNote>
          You can view referrals, but only the approver can create them or mark rewards.
        </ErrorNote>
      ) : null}

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["Create a referral", "Say what friends should do and what the referrer gets."],
          ["People share it", "Each person gets their own link. A friend joins through it and the referrer submits it."],
          ["See who did what", "Approve real referrals, then mark the reward as given."],
        ].map(([title, body], i) => (
          <li key={title} className="rounded-xl border border-ink-700 bg-ink-850 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-crimson-400">
              Step {i + 1}
            </p>
            <p className="mt-1 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-mist-500">{body}</p>
          </li>
        ))}
      </ol>

      {creating || (isApprover && !boards.loading && list.length === 0 && boards.data) ? (
        <CreateReferral
          orgId={orgId}
          onCancel={list.length ? () => setCreating(false) : undefined}
          onCreated={() => {
            setCreating(false);
            boards.refresh();
          }}
        />
      ) : null}

      {boards.error ? <ErrorNote>{boards.error}</ErrorNote> : null}
      {!boards.data && !boards.error ? (
        <Card className="grid place-items-center py-12">
          <Spinner />
        </Card>
      ) : null}

      {list.map((b) => (
        <Board key={b.campaign.id} board={b} orgId={orgId} isApprover={isApprover} onChange={boards.refresh} />
      ))}

      {boards.data && list.length === 0 && !isApprover ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-mist-500">No referrals yet.</p>
        </Card>
      ) : null}
    </div>
  );
}

function CreateReferral({
  orgId,
  onCancel,
  onCreated,
}: {
  orgId: bigint;
  onCancel?: () => void;
  onCreated: () => void;
}) {
  const account = useActiveAccount();
  const rewardsAvailable = useRewardsAvailable();
  const { success, error: toastError } = useToast();
  const [draft, setDraft] = useState<CampaignDraft>(NEW_REFERRAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!account) throw new Error("Connect your approver wallet first");
      const auth = await signOrgAction(account, orgId, ORG_ACTIONS.campaignSave);
      const res = await fetch("/api/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(orgId),
          kind: "referral",
          title: draft.title,
          blurb: draft.blurb.trim() || undefined,
          active: true,
          ...(rewardsAvailable === true ? rewardPayload(draft) : {}),
          ...auth,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not create the referral");
      success("Referral created — share its link");
      setDraft(NEW_REFERRAL);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create the referral";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  const input =
    "mt-1 w-full min-w-0 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-base outline-none placeholder:text-mist-500 focus:border-crimson-500 sm:text-sm";
  const label = "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500";

  return (
    <form onSubmit={create} className="card min-w-0 space-y-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">New referral</h2>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 px-2 text-sm text-mist-500 hover:text-mist-200"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className={label}>Name</span>
        <input
          required
          maxLength={120}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Bring a friend this month"
          className={input}
        />
      </label>
      <label className="block">
        <span className={label}>What should the friend do? (optional)</span>
        <textarea
          rows={2}
          maxLength={500}
          value={draft.blurb}
          onChange={(e) => setDraft({ ...draft, blurb: e.target.value })}
          placeholder="Visit the shop and mention who sent them, or book their first appointment."
          className={`${input} resize-none`}
        />
      </label>

      <div>
        <p className={label}>What the referrer gets</p>
        <div className="mt-2">
          <RewardStep draft={draft} setDraft={setDraft} available={rewardsAvailable} unit="approved referrals" />
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" disabled={saving || !draft.title.trim()} className="w-full sm:w-auto">
        {saving ? "Creating…" : "Create referral"}
      </Button>
    </form>
  );
}

function Board({
  board: { campaign: c, referrers, owed },
  orgId,
  isApprover,
  onChange,
}: {
  board: ReferralBoard;
  orgId: bigint;
  isApprover: boolean;
  onChange: () => void;
}) {
  const { give, isBusy } = useGiveReward(orgId, onChange);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/c/${c.slug}` : `/c/${c.slug}`;
  const reward = describeCampaignReward(c);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is shown for manual copy */
    }
  }

  return (
    <section>
      <SectionTitle
        action={
          <span className="text-xs text-mist-500">
            {c.active ? "Live" : "Closed"} · {owed} owed
          </span>
        }
      >
        {c.title}
      </SectionTitle>
      <Card className="space-y-4">
        {c.blurb ? <p className="text-sm text-mist-400">{c.blurb}</p> : null}
        <p className="text-sm text-mist-400">
          {reward ? (
            <>
              Referrer gets <span className="text-mist-100">{reward}</span>{" "}
              {describeRewardRule(c.rewardThreshold, c.rewardRepeats, "approved referral")}.
            </>
          ) : (
            "No reward set."
          )}
        </p>

        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-850 px-3 py-2 text-xs text-crimson-300">
            {url}
          </code>
          <Button type="button" variant="ghost" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </Button>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
            Who did what
          </p>
          {referrers.length === 0 ? (
            <p className="text-sm text-mist-500">
              Nobody has shared or submitted yet. Send the link above to your regulars.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-ink-700">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist-500">
                  <tr className="border-b border-ink-700">
                    <th className="px-3 py-2.5 font-medium">Person</th>
                    <th className="px-3 py-2.5 text-right font-medium">Link clicks</th>
                    <th className="px-3 py-2.5 text-right font-medium">Friends joined</th>
                    <th className="px-3 py-2.5 text-right font-medium">Referrals approved</th>
                    <th className="px-3 py-2.5 text-right font-medium">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {referrers.map((r) => (
                    <tr key={r.advocate}>
                      <td className="max-w-[12rem] truncate px-3 py-2.5 font-medium">
                        {r.displayName ?? shortAddress(r.advocate)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{r.clicks}</td>
                      <td className="tabular px-3 py-2.5 text-right">{r.friendsJoined}</td>
                      <td className="tabular px-3 py-2.5 text-right">
                        {r.approved}
                        {r.pending ? <span className="text-xs text-mist-500"> +{r.pending} waiting</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.owed > 0 ? (
                          isApprover ? (
                            <button
                              type="button"
                              disabled={isBusy(c.id, r.advocate)}
                              onClick={() => give(c.id, r.advocate, 1)}
                              className="min-h-9 rounded-full bg-crimson-500 px-3 text-xs font-semibold text-white transition hover:bg-crimson-400 disabled:opacity-50"
                            >
                              {isBusy(c.id, r.advocate)
                                ? "Saving…"
                                : `Mark rewarded${r.owed > 1 ? ` (${r.owed} owed)` : ""}`}
                            </button>
                          ) : (
                            <span className="text-xs text-amber-glow">{r.owed} owed</span>
                          )
                        ) : r.given > 0 ? (
                          <span className="text-xs text-jade-400">✓ rewarded{r.given > 1 ? ` ×${r.given}` : ""}</span>
                        ) : (
                          <span className="text-xs text-mist-500">
                            {r.toNext ? `${r.toNext} to go` : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
