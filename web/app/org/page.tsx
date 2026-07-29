"use client";

import { useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { OrgShell, useIsApprover } from "@/components/org/Shell";
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
import { ORG_ID } from "@/lib/chain";
import { proofHashOf } from "@/lib/proof";
import { contract, isConfigured } from "@/lib/client";
import { advocateName, kesLabel, timeAgo } from "@/lib/format";
import { useOrg, usePendingActivities } from "@/lib/hooks";
import type { PendingActivity } from "@/lib/types";

/* ------------------------------------------------------------------ screen 6 */

export default function OrgApprovalsPage() {
  return (
    <OrgShell>
      <Approvals />
    </OrgShell>
  );
}

function Approvals() {
  const org = useOrg();
  const isApprover = useIsApprover();
  const pending = usePendingActivities({ orgId: String(ORG_ID), status: "pending" });
  const [receipts, setReceipts] = useState<Record<string, string>>({});

  if (!isConfigured) return <ConfigWarning />;

  const items = pending.data ?? [];
  const remaining = org.data
    ? Number(org.data.emissionCapKES - org.data.issuedKES)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Approvals</h1>
          <p className="mt-1 text-sm text-mist-500">
            Approving writes to Avalanche. It costs you nothing — gas is sponsored.
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
          This account is not the approver for org #{String(ORG_ID)}. Approvals will be
          rejected by the contract.
        </ErrorNote>
      ) : null}

      <SectionTitle
        action={
          <span className="text-xs text-mist-500">
            {items.length} waiting
          </span>
        }
      >
        Pending queue
      </SectionTitle>

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
          body="Every submitted activity has been reviewed. New submissions land here instantly."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ApprovalRow
              key={item.id}
              item={item}
              receipt={receipts[item.id]}
              onDone={(hash) => {
                setReceipts((r) => ({ ...r, [item.id]: hash }));
                pending.refresh();
              }}
              onRejected={pending.refresh}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ApprovalRow({
  item,
  receipt,
  onDone,
  onRejected,
}: {
  item: PendingActivity;
  receipt?: string;
  onDone: (txHash: string) => void;
  onRejected: () => void;
}) {
  const { mutate: sendTx, isPending } = useSendAndConfirmTransaction();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const { success, error: toastError } = useToast();

  function approve() {
    setError(null);

    // The proof itself stays off-chain; only its fingerprint is recorded.
    const proofHash = proofHashOf(item.proofUrl);

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
    });

    sendTx(tx, {
      onSuccess: async (r) => {
        // Only mark the queue item approved once the chain write has confirmed.
        await fetch("/api/activities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            status: "approved",
            txHash: r.transactionHash,
          }),
        });
        success(`Approved ${item.typeLabel}`);
        onDone(r.transactionHash);
      },
      onError: (e) => {
        setError(e.message);
        toastError(e.message);
      },
    });
  }

  async function reject() {
    setRejecting(true);
    setError(null);
    try {
      await fetch("/api/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status: "rejected",
          rejectionReason: "Proof did not check out",
        }),
      });
      success("Activity rejected");
      onRejected();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reject";
      setError(msg);
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
              Approved {item.typeLabel} for{" "}
              {item.advocateLabel ?? advocateName(item.advocate)}
            </p>
            <p className="text-xs text-mist-500">Their count and streak just went up.</p>
          </div>
          <TxReceipt hash={receipt} />
        </Card>
      </li>
    );
  }

  return (
    <li>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-700 text-lg">
            {item.typeIcon}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">
                {item.advocateLabel ?? advocateName(item.advocate)}
              </p>
              <Pill>{item.typeLabel} · +{item.weight}</Pill>
              <span className="text-xs text-mist-500">
                {timeAgo(new Date(item.submittedAt).getTime())}
              </span>
            </div>

            {item.note ? (
              <p className="mt-2 text-sm text-mist-400">{item.note}</p>
            ) : null}

            <a
              href={item.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block max-w-full truncate text-xs text-crimson-300 underline underline-offset-4 hover:text-crimson-400"
            >
              {item.proofUrl}
            </a>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={reject} disabled={isPending || rejecting}>
              Reject
            </Button>
            <Button onClick={approve} disabled={isPending || rejecting}>
              {isPending ? (
                <>
                  <Spinner /> Approving…
                </>
              ) : (
                "Approve"
              )}
            </Button>
          </div>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </Card>
    </li>
  );
}
