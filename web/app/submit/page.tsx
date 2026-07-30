"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import type { Account } from "thirdweb/wallets";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, ErrorNote, Spinner, TxReceipt } from "@/components/ui";
import { ORG_ID } from "@/lib/chain";
import { useAdvocateProfile, useCampaign, useEngagementTypes } from "@/lib/hooks";
import { contract } from "@/lib/client";
import { proofHashOf } from "@/lib/proof";
import { awaitAccountDeployed, awaitSubmissionOnChain, findSubmissionOnChain } from "@/lib/recover-submission";
import { isDeploymentStall, isWarmingUp, waitForAccountReady } from "@/lib/warmup";
import { proofHint, type EngagementType } from "@/lib/types";

/* ------------------------------------------------------------------ screen 3 */

export default function SubmitPage() {
  const account = useActiveAccount();

  return (
    <CustomerShell>
      {account ? (
        <Suspense fallback={null}>
          <SubmitForm account={account} />
        </Suspense>
      ) : (
        <div className="pt-16 text-center">
          <p className="mb-6 text-mist-400">Sign in to submit an activity.</p>
          <SignIn />
        </div>
      )}
    </CustomerShell>
  );
}

/**
 * The form is built from whatever the business decided to reward — it reads
 * /api/engagement-types rather than a list baked into the app. That is the whole point
 * of engagement types: a new one appears here the moment the org adds it, and the proof
 * field changes shape to match what that engagement actually asks for.
 */
function SubmitForm({ account }: { account: Account }) {
  const address = account.address;
  const router = useRouter();
  /**
   * Arriving from a shared campaign link changes whose form this is: the submission —
   * the on-chain write included — targets the campaign's business, not the app's
   * default org. A FitTribe campaign submission belongs to FitTribe.
   */
  const params = useSearchParams();
  const campaignSlug = params.get("c");
  const orgParam = params.get("org");
  const campaignCtx = useCampaign(campaignSlug ?? "", address);
  const campaign = campaignSlug ? campaignCtx.data?.campaign : undefined;
  const orgId = campaign
    ? BigInt(campaign.orgId)
    : orgParam && /^\d+$/.test(orgParam)
      ? BigInt(orgParam)
      : ORG_ID;
  // Only a name they actually chose travels with the submission. The UI's display
  // name falls back to a nickname built from the address, and sending that would
  // persist a pseudonym as though they had picked it.
  const me = useAdvocateProfile(address, orgId);
  const chosenName = me.data?.displayName;
  const engagements = useEngagementTypes(
    campaignSlug && !campaign ? undefined : orgId
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");
  const { mutateAsync: sendTx, isPending: sending } = useSendAndConfirmTransaction();
  const [submitting, setSubmitting] = useState(false);
  // True while the userOp is out of our hands but not yet confirmed. The button stays
  // locked through this — re-sending while the first op is in flight is exactly what
  // produces AA25 "another deployment operation is already being processed".
  const [waitingChain, setWaitingChain] = useState(false);
  // True while we're waiting on the sign-in warmup to finish deploying this account.
  // Separate from waitingChain because the honest thing to say is different: nothing
  // of theirs is in flight yet, we're just not starting a race we'd lose.
  const [settingUp, setSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // the submission tx hash
  const { success, error: toastError } = useToast();

  // Inside a campaign, only the engagements that campaign counts are offered.
  const allTypes = engagements.data ?? [];
  const types =
    campaign && campaign.engagementTypeIds.length > 0
      ? allTypes.filter((t) => campaign.engagementTypeIds.includes(t.id))
      : allTypes;
  const selected = types.find((t) => t.id === selectedId) ?? null;

  // Preselect the first engagement once they arrive, without clobbering a real choice.
  useEffect(() => {
    if (!selectedId && types.length > 0) setSelectedId(types[0].id);
  }, [types, selectedId]);

  const needsProof = selected ? selected.proofKind !== "none" : true;
  const canSubmit = Boolean(selected) && (!needsProof || proof.trim().length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !account) return;
    setError(null);
    setSubmitting(true);

    try {
      /**
       * Your wallet writes the submission to Avalanche before anything else happens.
       *
       * This is a real transaction from your smart account — gas sponsored, so it
       * costs you nothing — and msg.sender inside the contract is you. The server
       * then verifies the receipt instead of trusting the request. The proof itself
       * stays off-chain; the chain records its fingerprint.
       */
      const proofUrl = proof.trim() || undefined;
      const proofHash = proofHashOf(proofUrl);
      const onChain = { orgId, advocate: address, proofHash };

      /**
       * A previous attempt may have made it on-chain after the client gave up: the
       * first tx from a smart account also deploys the account, and that op often
       * outlives the SDK's 120s wait. Check before sending a duplicate.
       */
      let txHash = await findSubmissionOnChain(onChain).catch(() => null);

      const call = () =>
        prepareContractCall({
          contract,
          method: "submitActivity",
          params: [orgId, selected.chainCategory, proofHash],
        });

      /**
       * Never race our own sign-in warmup.
       *
       * While the warmup's deployment op is in flight, thirdweb reports this account
       * as already deployed and then parks any second transaction on an in-memory
       * lock — for exactly 60 seconds, after which it throws "Account deployment is
       * taking too long" without ever having sent anything. Waiting for the warmup
       * costs the same wall clock, says so on the button, and leaves the account
       * existing, which makes this send a light op that lands in seconds.
       */
      if (!txHash && isWarmingUp(address)) {
        setSettingUp(true);
        try {
          await waitForAccountReady(address);
        } finally {
          setSettingUp(false);
        }
      }

      if (!txHash) {
        try {
          const receipt = await sendTx(call());
          txHash = receipt.transactionHash;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/AA10|already constructed/i.test(msg) || isDeploymentStall(msg)) {
            /**
             * Either a deployment op for this account is already in the bundler
             * mempool and this op's initCode conflicts with it (AA10), or thirdweb
             * timed out on a deployment it was tracking in memory and sent nothing at
             * all. Both clear the same way: once the account has code, a retry is a
             * light op with no initCode, so wait for that and send again.
             */
            setWaitingChain(true);
            try {
              const deployed = await awaitAccountDeployed(address);
              if (deployed) {
                const retry = await sendTx(call());
                txHash = retry.transactionHash;
              } else {
                throw new Error(
                  "Your account is still being set up on Avalanche and the network is slow. " +
                    "Leave this page open and press Send again in a minute — we'll pick up " +
                    "anything that already went through."
                );
              }
            } finally {
              setWaitingChain(false);
            }
          } else if (/Timeout waiting for userOp|AA25|already being processed/i.test(msg)) {
            /**
             * The op is out of our hands but very likely still in flight — a timed-out
             * userOp usually mines after the SDK gives up, and AA25 means the bundler
             * is literally telling us it still holds one. So do what the Builders Hub
             * guidance says: do not offer Send again until the first op has resolved.
             * Keep the button locked and watch the chain until the submission appears
             * or we're confident it was dropped.
             */
            setWaitingChain(true);
            try {
              txHash = await awaitSubmissionOnChain(onChain, 4 * 60_000, 6_000);
            } finally {
              setWaitingChain(false);
            }
            if (!txHash) {
              throw new Error(
                "Avalanche didn't confirm your submission — the network dropped it. " +
                  "Press Send again with the same proof; if it did land late, we'll " +
                  "find it rather than double-file it."
              );
            }
          } else {
            throw err;
          }
        }
      }

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(orgId),
          advocate: address,
          advocateLabel: chosenName,
          engagementTypeId: selected.id,
          proofUrl,
          note: note.trim() || undefined,
          campaignId: campaign?.id,
          submitTx: txHash,
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not submit");

      setDone(txHash);
      success("Activity submitted — waiting for approval");
      setTimeout(() => router.push("/"), 3200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit";
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="animate-pop grid place-items-center py-24 text-center">
        <div className="mb-5 grid size-16 place-items-center rounded-full bg-jade-500/15 text-3xl">
          ✓
        </div>
        <p className="text-xl font-bold">Recorded on Avalanche</p>
        <p className="mt-2 max-w-xs text-sm text-mist-500">
          Your wallet wrote this submission on-chain. The business reviews it next —
          it counts the moment they approve.
        </p>
        <div className="mt-5">
          <TxReceipt hash={done} label="Your submission" />
        </div>
      </div>
    );
  }

  if (engagements.loading && types.length === 0) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (engagements.error) {
    return <ErrorNote>{engagements.error}</ErrorNote>;
  }

  if (types.length === 0) {
    return (
      <EmptyState
        icon="🗒️"
        title="Nothing to submit yet"
        body="This business hasn't set up what it rewards. Check back once they have."
      />
    );
  }

  return (
    <form onSubmit={submit} className="animate-rise space-y-6">
      <div>
        {campaign ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-crimson-400">
            {campaign.title}
          </p>
        ) : null}
        <h1 className="text-2xl font-black">Submit an activity</h1>
        <p className="mt-1 text-sm text-mist-500">
          Show us what you did. The business approves it, and it counts toward your next
          reward.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          What did you do?
        </legend>
        {types.map((type) => (
          <EngagementOption
            key={type.id}
            type={type}
            active={type.id === selectedId}
            onSelect={() => {
              setSelectedId(type.id);
              setProof("");
            }}
          />
        ))}
      </fieldset>

      {needsProof && selected ? (
        <div className="space-y-2">
          <label
            htmlFor="proof"
            className="block text-xs font-semibold uppercase tracking-[0.14em] text-mist-500"
          >
            {selected.proofKind === "referral_code" ? "Your referral code" : "Link to your proof"}
          </label>
          <input
            id="proof"
            // Not type="url": a referral code is not a URL, and browser URL validation
            // would reject it before the form ever submits.
            type="text"
            inputMode={selected.proofKind === "referral_code" ? "text" : "url"}
            required
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder={proofHint(selected.proofKind)}
            className="w-full rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
          <p className="text-xs text-mist-500">{proofBlurb(selected)}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="note"
          className="block text-xs font-semibold uppercase tracking-[0.14em] text-mist-500"
        >
          Anything to add? <span className="normal-case text-mist-500">(optional)</span>
        </label>
        <textarea
          id="note"
          rows={3}
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Brought 12 people from my campus club…"
          className="w-full resize-none rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" disabled={submitting || sending || !canSubmit} className="w-full">
        {settingUp
          ? "Setting up your account…"
          : waitingChain
            ? "Waiting for Avalanche to confirm…"
            : sending
              ? /**
                 * Names the signature, not the write. This said "Recording on
                 * Avalanche…" from the instant the button was pressed — while the
                 * wallet prompt was still sitting there unanswered, claiming a write
                 * that could not happen until the user signed. Nothing is recorded
                 * until they do.
                 */
                "Confirm in your wallet…"
              : submitting
                ? "Preparing…"
                : "Send for approval"}
      </Button>

      {settingUp ? (
        <p className="text-center text-xs text-mist-500">
          Your account is being created on Avalanche — this happens once, on your first
          activity. We&rsquo;ll send your submission the moment it&rsquo;s ready.
        </p>
      ) : sending ? (
        <p className="text-center text-xs text-mist-500">
          Approve the request in your wallet. Nothing is written to Avalanche until you
          sign — once you do, this becomes your own transaction, and gas is covered.
        </p>
      ) : waitingChain ? (
        <p className="text-center text-xs text-mist-500">
          Your account&rsquo;s first transaction includes setting the account up
          on-chain, which can take a couple of minutes. Leave this page open —
          we&rsquo;ll pick it up the moment it lands.
        </p>
      ) : null}

      <Card className="bg-ink-850/60">
        <p className="text-xs leading-relaxed text-mist-500">
          Your proof stays with the business. Only their approval is written to Avalanche —
          that&rsquo;s what makes your reward real and impossible to quietly take back.
        </p>
      </Card>
    </form>
  );
}

function EngagementOption({
  type,
  active,
  onSelect,
}: {
  type: EngagementType;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
        active
          ? "border-crimson-500 bg-crimson-500/10"
          : "border-ink-700 bg-ink-850 hover:border-ink-600"
      }`}
    >
      <input
        type="radio"
        name="engagementType"
        value={type.id}
        checked={active}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
        {type.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{type.label}</span>
        {type.blurb ? (
          <span className="block truncate text-xs text-mist-500">{type.blurb}</span>
        ) : null}
      </span>
      {/* What it's worth, in the same units the progress ring counts in. */}
      <span className="shrink-0 rounded-full border border-ink-600 px-2 py-0.5 text-[11px] tabular text-mist-400">
        +{type.weight}
      </span>
      <span
        className={`size-4 shrink-0 rounded-full border-2 ${
          active ? "border-crimson-500 bg-crimson-500" : "border-ink-500"
        }`}
        aria-hidden
      />
    </label>
  );
}

function proofBlurb(type: EngagementType) {
  switch (type.proofKind) {
    case "x_link":
      return "Paste the link to your post on X.";
    case "social_link":
      return "Paste the link to your Instagram, TikTok or Facebook post.";
    case "screenshot":
      return "Upload the screenshot somewhere and paste the link.";
    case "referral_code":
      return "The code you gave out. Add their name in the note below.";
    default:
      return "A post link, a photo, a screenshot — whatever shows it happened.";
  }
}
