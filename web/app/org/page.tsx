"use client";

import { useEffect, useRef, useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { OrgShell, useIsApprover, useOrgAccessContext, useOrgPendingQueue } from "@/components/org/Shell";
import { RejectDialog } from "@/components/org/RejectDialog";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  ConfigWarning,
  EmptyState,
  ErrorNote,
  Pill,
  SectionTitle,
  Spinner,
  TxReceipt,
} from "@/components/ui";

import { FundsNotice } from "@/components/FundsGate";
import { ProofPreview } from "@/components/ProofPreview";
import { useFundsGate } from "@/lib/funds";
import { proofHashOf } from "@/lib/proof";
import { awaitAccountDeployed, awaitApprovalOnChain, findApprovalOnChain } from "@/lib/recover-submission";
import { useTwoPhaseSend } from "@/lib/send-two-phase";
import { isDeploymentStall, isWarmingUp, waitForAccountReady } from "@/lib/warmup";
import { contract, isConfigured } from "@/lib/client";
import { advocateName, kesLabel } from "@/lib/format";
import { useCampaigns, useOrg } from "@/lib/hooks";
import type { PendingActivity } from "@/lib/types";

/* ------------------------------------------------------------------ screen 6 */

export default function OrgApprovalsPage() {
  return (
    <OrgShell>
      <Approvals />
    </OrgShell>
  );
}

/** What one row's approve() reports back, so a bulk run can decide whether to go on. */
type ApproveResult = { ok: true; txHash: string } | { ok: false; error: string };

const whoOf = (item: PendingActivity) =>
  item.advocateCurrentName ?? item.advocateLabel ?? advocateName(item.advocate);

/**
 * How long a submission has been sitting in the queue. Past two days it turns amber:
 * the advocate is waiting on a business they were told would reward them.
 */
function waitingFor(submittedAt: string): { label: string; late: boolean } {
  const ms = Math.max(0, Date.now() - new Date(submittedAt).getTime());
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const late = ms > 2 * 86_400_000;
  if (hours < 1) return { label: "waiting under an hour", late };
  if (days < 1) return { label: `waiting ${hours} hour${hours === 1 ? "" : "s"}`, late };
  return { label: `waiting ${days} day${days === 1 ? "" : "s"}`, late };
}

/**
 * Where a bulk approval stands. It is a plain sequential loop over the same one-tap
 * approve each row uses — one on-chain approval, one wallet signature, at a time — and it
 * stops at the first failure rather than pushing on and prompting the wallet again.
 */
interface BulkState {
  running: boolean;
  /** Ids still to do, in order, including the one in flight. */
  queued: string[];
  total: number;
  approved: number;
  /** The one in flight, by name. */
  current?: string;
  /** The submission that stopped the run. */
  failure?: { who: string; error: string };
  /** Decided elsewhere while the run was going — nothing to approve any more. */
  skipped: number;
  /** The approver pressed Stop after the one in flight. */
  stopped: boolean;
}

function Approvals() {
  const access = useOrgAccessContext();
  const org = useOrg(access.orgId);
  const isApprover = useIsApprover();
  // The queue is polled once, in the Shell, and shared with the nav badge.
  const pending = useOrgPendingQueue();
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  // Approving carries the same 0.005 AVAX requirement as submitting — it is also
  // what pays the (near-zero) gas on each approval the org signs.
  const funds = useFundsGate();
  // So a submission that came through a campaign says which one, right in the queue —
  // the approver shouldn't have to guess which push produced which proof.
  const campaigns = useCampaigns(access.orgId);
  const campaignTitles = new Map(
    (campaigns.data ?? []).map((c) => [c.id, c.title] as const)
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkState | null>(null);
  // Each row hands the page its own approve(), so a bulk run drives exactly the flow a
  // single tap does — same signing, same on-chain checks — rather than a second copy.
  const handles = useRef(new Map<string, () => Promise<ApproveResult>>());
  const stopRef = useRef(false);
  const register = useRef((id: string, fn: (() => Promise<ApproveResult>) | null) => {
    if (fn) handles.current.set(id, fn);
    else handles.current.delete(id);
  }).current;

  if (!isConfigured) return <ConfigWarning />;

  const items = pending.data ?? [];
  const remaining = org.data
    ? Number(org.data.emissionCapKES - org.data.issuedKES)
    : null;
  const canApprove = isApprover && (funds.loading || funds.ok);
  const running = bulk?.running ?? false;

  // Only what is still in the queue can be selected — a decided item drops out by itself.
  const picked = items.filter((i) => selected.has(i.id));
  const allPicked = items.length > 0 && picked.length === items.length;

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approveSelected() {
    const queue = picked.map((i) => ({ id: i.id, who: whoOf(i) }));
    if (queue.length === 0 || running) return;
    stopRef.current = false;
    let state: BulkState = {
      running: true,
      queued: queue.map((q) => q.id),
      total: queue.length,
      approved: 0,
      skipped: 0,
      stopped: false,
    };
    setBulk(state);

    for (const q of queue) {
      if (stopRef.current) {
        state = { ...state, stopped: true };
        break;
      }
      const approve = handles.current.get(q.id);
      if (!approve) {
        // Decided elsewhere (another tab, another approver) since it was selected.
        state = { ...state, queued: state.queued.filter((id) => id !== q.id), skipped: state.skipped + 1 };
        continue;
      }
      state = { ...state, current: q.who };
      setBulk({ ...state, stopped: stopRef.current });

      const result = await approve();
      state = { ...state, queued: state.queued.filter((id) => id !== q.id) };
      if (result.ok) {
        state = { ...state, approved: state.approved + 1 };
        setSelected((cur) => {
          const next = new Set(cur);
          next.delete(q.id);
          return next;
        });
      } else {
        state = { ...state, failure: { who: q.who, error: result.error } };
        break;
      }
      setBulk({ ...state, stopped: stopRef.current });
    }

    setBulk({
      ...state,
      running: false,
      current: undefined,
      stopped: state.stopped && state.queued.length > 0,
    });
  }

  const notAttempted = bulk && !bulk.running ? bulk.queued.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black">Approvals</h1>
          <p className="mt-1 text-sm text-mist-500">
            You sign each approval in your wallet, and that signature is what writes it
            to Avalanche. Gas comes from your balance — fractions of a cent each.
          </p>
        </div>
        {remaining !== null ? (
          <Pill tone={remaining > 0 ? "neutral" : "bad"}>
            {remaining > 0
              ? `${kesLabel(remaining)} of budget left to award`
              : "Budget fully committed"}
          </Pill>
        ) : null}
      </div>

      {!isApprover ? (
        <ErrorNote>
          You&rsquo;re signed in with an account that can&rsquo;t approve for{" "}
          {access.orgName || "this business"}. Approvals are signed by{" "}
          <code className="tabular">{access.approver.slice(0, 6)}…{access.approver.slice(-4)}</code>{" "}
          — sign out and sign back in with the login that owns that account. Every
          social login has its own account, so the same person can hold several.
        </ErrorNote>
      ) : null}

      <FundsNotice funds={funds} />

      <SectionTitle
        action={
          <span className="text-xs text-mist-500">
            {items.length} waiting
          </span>
        }
      >
        Pending queue
      </SectionTitle>

      {bulk && !bulk.running ? (
        <BulkResult
          bulk={bulk}
          notAttempted={notAttempted}
          onDismiss={() => setBulk(null)}
        />
      ) : null}

      {pending.loading && !pending.data ? (
        <Card className="grid place-items-center py-16">
          <Spinner className="size-6" />
        </Card>
      ) : pending.error ? (
        <ErrorNote>{pending.error}</ErrorNote>
      ) : items.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Queue is clear"
          body="Every submitted action has been reviewed. New submissions land here instantly."
        />
      ) : (
        <div className="space-y-3">
          {isApprover && items.length > 1 ? (
            <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-medium text-mist-300">
              <input
                type="checkbox"
                checked={allPicked}
                disabled={running}
                onChange={() =>
                  setSelected(allPicked ? new Set() : new Set(items.map((i) => i.id)))
                }
                className="size-5 accent-crimson-500"
              />
              Select all ({items.length})
            </label>
          ) : null}

          <ul className="space-y-3">
            {items.map((item) => (
              <ApprovalRow
                key={item.id}
                item={item}
                campaignTitle={item.campaignId ? campaignTitles.get(item.campaignId) : undefined}
                canApprove={canApprove}
                selectable={isApprover && items.length > 1}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
                locked={running}
                queued={Boolean(bulk?.running && bulk.queued.includes(item.id))}
                register={register}
                receipt={receipts[item.id]}
                onDone={(hash) => {
                  setReceipts((r) => ({ ...r, [item.id]: hash }));
                  pending.refresh();
                }}
                onRejected={pending.refresh}
              />
            ))}
          </ul>

          {/* Last in the list so, on a long queue, it stays pinned above the phone tab bar. */}
          {isApprover && (picked.length > 0 || running) ? (
            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
              <div className="card flex flex-col gap-3 border-crimson-500/40 p-3 shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
                {running && bulk ? (
                  <>
                    <p className="min-w-0 text-sm" role="status" aria-live="polite">
                      <Spinner className="mr-2 align-[-3px]" />
                      Approving {bulk.total - bulk.queued.length + 1} of {bulk.total}
                      {bulk.current ? ` — ${bulk.current}` : ""}
                    </p>
                    <Button
                      variant="ghost"
                      className="w-full sm:w-auto"
                      disabled={bulk.stopped}
                      onClick={() => {
                        stopRef.current = true;
                        setBulk((b) => (b ? { ...b, stopped: true } : b));
                      }}
                    >
                      {bulk.stopped ? "Stopping after this one…" : "Stop after this one"}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      {picked.length} selected
                      <span className="block text-xs font-normal text-mist-500">
                        Each is approved one at a time — you sign each in your wallet.
                      </span>
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="ghost"
                        className="w-full sm:w-auto"
                        onClick={() => setSelected(new Set())}
                      >
                        Clear
                      </Button>
                      <Button
                        className="w-full sm:w-auto"
                        disabled={!canApprove}
                        onClick={() => void approveSelected()}
                      >
                        Approve selected ({picked.length})
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** The outcome of a bulk run: how many landed, and exactly where and why it stopped. */
function BulkResult({
  bulk,
  notAttempted,
  onDismiss,
}: {
  bulk: BulkState;
  notAttempted: number;
  onDismiss: () => void;
}) {
  const clean = !bulk.failure && !bulk.stopped && notAttempted === 0;
  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm ${
        clean
          ? "border-jade-500/40 bg-jade-500/10 text-jade-400"
          : "border-amber-glow/40 bg-amber-glow/10 text-amber-glow"
      }`}
    >
      <p className="font-semibold">
        Approved {bulk.approved} of {bulk.total}
        {bulk.skipped > 0 ? ` (${bulk.skipped} already decided)` : ""}.
      </p>
      {bulk.failure ? (
        <p className="mt-1 break-words text-mist-200">
          Stopped at {bulk.failure.who}: {bulk.failure.error}
        </p>
      ) : null}
      {bulk.stopped && !bulk.failure ? <p className="mt-1 text-mist-200">You stopped the run.</p> : null}
      {notAttempted > 0 ? (
        <p className="mt-1 text-mist-200">
          {notAttempted} not attempted — they&rsquo;re still selected below and still waiting.
        </p>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4"
      >
        Dismiss
      </button>
    </div>
  );
}

function ApprovalRow({
  item,
  campaignTitle,
  canApprove,
  selectable,
  selected,
  onToggle,
  locked,
  queued,
  register,
  receipt,
  onDone,
  onRejected,
}: {
  item: PendingActivity;
  campaignTitle?: string;
  canApprove: boolean;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  /** A bulk run is going — single actions wait their turn. */
  locked: boolean;
  /** Selected for the bulk run and not reached yet. */
  queued: boolean;
  register: (id: string, fn: (() => Promise<ApproveResult>) | null) => void;
  receipt?: string;
  onDone: (txHash: string) => void;
  onRejected: () => void;
}) {
  // Two phases so the button can tell the truth: "sign" while the wallet prompt is
  // open, "writing" only after the signed op is with the bundler.
  const { send: sendTx, signing, confirming, isPending } = useTwoPhaseSend();
  // Locked while a userOp is out of our hands but unconfirmed — clicking Approve
  // again during that window is exactly what creates duplicates and AA25 lockouts.
  const [waitingChain, setWaitingChain] = useState(false);
  // Locked while the approver's account is still being deployed by the sign-in warmup.
  const [settingUp, setSettingUp] = useState(false);
  // Recorded with every decision, so the queue knows which wallet approved what —
  // the chain already enforces it, this makes it visible in the database too.
  const approverAccount = useActiveAccount();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  const who = whoOf(item);

  async function approve(): Promise<ApproveResult> {
    setError(null);

    const fail = (msg: string): ApproveResult => {
      setError(msg);
      toastError(msg);
      return { ok: false, error: msg };
    };

    try {
      // The proof itself stays off-chain; only its fingerprint is recorded.
      const proofHash = proofHashOf(item.proofUrl);
      const onChain = { orgId: BigInt(item.orgId), advocate: item.advocate, proofHash };

      async function finish(txHash: string): Promise<ApproveResult> {
        // Only mark the queue item approved once the chain write has confirmed.
        await fetch("/api/activities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            status: "approved",
            txHash,
            decidedBy: approverAccount?.address,
          }),
        });
        success(`Approved ${item.typeLabel}`);
        onDone(txHash);
        return { ok: true, txHash };
      }

      // A previous click may have landed after the client gave up — check before
      // sending the same approval twice.
      const already = await findApprovalOnChain(onChain).catch(() => null);
      if (already) return await finish(already);

      /**
       * Weight is what the business priced this engagement at, and the chain has to
       * record it or the numbers stop agreeing: the submit form advertises +5, the
       * leaderboard counts 5, and a singular approveActivity would write 1.
       *
       * The contract has no notion of weight — ActivityType is a bare enum — so the
       * batch call repeats the same entry `weight` times, which is precisely what
       * "worth 5 activities" means. Repeating the proof hash is safe: the contract
       * records it, it does not enforce uniqueness. Crossing the 20-activity milestone
       * mid-batch mints the credit as normal.
       */
      const count = Math.max(1, Math.min(item.weight || 1, 20));

      const tx = prepareContractCall({
        contract,
        method: "approveActivityBatch",
        params: [
          BigInt(item.orgId),
          Array.from({ length: count }, () => item.advocate as `0x${string}`),
          Array.from({ length: count }, () => item.activityType),
          Array.from({ length: count }, () => proofHash),
        ],
        // Explicit, not estimated — see the submit page's note: near-zero Fuji base
        // fees make eth_estimateGas return garbage. Measured ~150k per entry on the
        // current fee accounting, 20 entries max; unused gas is refunded.
        gas: 5_000_000n,
      });

      /**
       * Don't race the sign-in warmup. While its deployment op is in flight thirdweb
       * reports the approver's account as deployed and then parks this transaction on an
       * in-memory lock for 60 seconds before failing it — without ever sending it. An
       * approval that silently never reaches the bundler is the worst failure this screen
       * has, so wait for the warmup rather than start a race. See web/lib/warmup.ts.
       */
      if (approverAccount && isWarmingUp(approverAccount.address)) {
        setSettingUp(true);
        try {
          await waitForAccountReady(approverAccount.address);
        } finally {
          setSettingUp(false);
        }
      }

      try {
        const r = await sendTx(tx);
        return await finish(r.transactionHash);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if ((/AA10|already constructed/i.test(msg) || isDeploymentStall(msg)) && approverAccount) {
          // Either a deployment op for the approver is already in the mempool (the
          // warmup) and this op's initCode collides with it, or thirdweb timed out on a
          // deployment it was tracking and sent nothing. Both clear once the account has
          // code, after which retrying is a light op. See the submit flow's twin branch.
          setWaitingChain(true);
          try {
            const deployed = await awaitAccountDeployed(approverAccount.address);
            if (deployed) {
              const retry = await sendTx(tx);
              return await finish(retry.transactionHash);
            }
            return fail(
              "Your approver account is still being set up on Avalanche. Give it a " +
                "minute and press Approve again — a landed approval will be picked up, " +
                "never duplicated."
            );
          } finally {
            setWaitingChain(false);
          }
        } else if (/Timeout waiting for userOp|AA25|already being processed/i.test(msg)) {
          // The op is usually still in flight — the bundler literally says so for
          // AA25. Hold the button and watch the chain rather than inviting a re-send.
          setWaitingChain(true);
          try {
            const landed = await awaitApprovalOnChain(onChain);
            if (landed) return await finish(landed);
            return fail(
              "Avalanche didn't confirm the approval — the network dropped it. " +
                "Press Approve again; if it landed late, we'll pick it up instead of approving twice."
            );
          } finally {
            setWaitingChain(false);
          }
        }
        return fail(msg);
      }
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  }

  // Let the page drive this row's approve() for a bulk run. Re-registered every render
  // so the handle is never a stale closure; dropped when the row goes away.
  useEffect(() => {
    register(item.id, approve);
  });
  useEffect(() => () => register(item.id, null), [item.id, register]);

  async function reject(reason: string) {
    setRejecting(true);
    setRejectError(null);
    try {
      const res = await fetch("/api/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status: "rejected",
          rejectionReason: reason,
          decidedBy: approverAccount?.address,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Could not reject (${res.status})`);
      }
      success("Activity rejected");
      setRejectOpen(false);
      onRejected();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reject";
      setRejectError(msg);
      toastError(msg);
    } finally {
      setRejecting(false);
    }
  }

  if (receipt) {
    return (
      <li>
        <Card className="flex flex-wrap items-center gap-4 border-jade-500/40">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-jade-500/15 text-lg">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Approved {item.typeLabel} for {who}
            </p>
            <p className="text-xs text-mist-500">Their count and streak just went up.</p>
          </div>
          <TxReceipt hash={receipt} />
        </Card>
      </li>
    );
  }

  const waiting = waitingFor(item.submittedAt);
  const proofIsLink = /^https?:\/\//i.test(item.proofUrl);
  const busy = isPending || waitingChain || settingUp;

  return (
    <li>
      <Card className={`space-y-3 ${selected ? "border-crimson-500/50" : ""}`}>
        <div className="flex items-start gap-3">
          {selectable ? (
            <label className="-ml-2 -mt-1 grid size-11 shrink-0 cursor-pointer place-items-center">
              <input
                type="checkbox"
                checked={selected}
                disabled={locked || busy || rejecting}
                onChange={onToggle}
                aria-label={`Select ${item.typeLabel} from ${who}`}
                className="size-5 accent-crimson-500"
              />
            </label>
          ) : null}
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-700 text-lg">
            {item.typeIcon}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{who}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Pill>
                {item.typeLabel} · +{item.weight}
              </Pill>
              {campaignTitle ? <Pill tone="neutral">📣 {campaignTitle}</Pill> : null}
              <Pill tone={waiting.late ? "warn" : "neutral"}>{waiting.label}</Pill>
              {queued ? <Pill tone="warn">Queued</Pill> : null}
            </div>
          </div>
        </div>

        {/* The proof comes first: it is the thing an approval is actually about. */}
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mist-500">
            Proof
          </p>
          <ProofPreview url={item.proofUrl} />
          {proofIsLink ? (
            <a
              href={item.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-8 max-w-full items-center truncate text-xs text-crimson-300 underline underline-offset-4 hover:text-crimson-400"
            >
              <span className="truncate">{item.proofUrl}</span>
            </a>
          ) : (
            <p className="mt-2 break-all text-sm text-mist-200">{item.proofUrl}</p>
          )}
          {item.submitTx ? (
            <div className="mt-2">
              <TxReceipt hash={item.submitTx} label="Submitted on-chain by their wallet" />
            </div>
          ) : null}
        </div>

        {/* What they say they did. */}
        {item.note ? (
          <p className="border-l-2 border-ink-700 pl-3 text-sm text-mist-200">{item.note}</p>
        ) : (
          <p className="text-xs italic text-mist-500">
            No description given — judge from the proof above.
          </p>
        )}

        <p className="text-xs text-mist-400">
          {campaignTitle ? (
            <>
              Approving this counts toward{" "}
              <span className="font-semibold text-mist-200">{campaignTitle}</span>.
            </>
          ) : (
            <>Approving this adds +{item.weight} to {who}&rsquo;s count.</>
          )}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => {
              setRejectError(null);
              setRejectOpen(true);
            }}
            disabled={busy || rejecting || locked}
          >
            Reject
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => void approve()}
            disabled={!canApprove || busy || rejecting || locked}
          >
            {settingUp ? (
              <>
                <Spinner /> Setting up your account…
              </>
            ) : waitingChain ? (
              <>
                <Spinner /> Waiting for Avalanche…
              </>
            ) : signing ? (
              <>
                <Spinner /> Sign in your wallet…
              </>
            ) : confirming ? (
              <>
                <Spinner /> Writing to Avalanche…
              </>
            ) : isPending ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              "Approve"
            )}
          </Button>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </Card>

      {rejectOpen ? (
        <RejectDialog
          subject={`${item.typeLabel} from ${who}`}
          busy={rejecting}
          error={rejectError}
          onCancel={() => setRejectOpen(false)}
          onConfirm={(reason) => void reject(reason)}
        />
      ) : null}
    </li>
  );
}
