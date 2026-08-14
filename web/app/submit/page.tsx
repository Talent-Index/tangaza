"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { ReferralShareGuide } from "@/components/customer/CampaignShareCard";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, ErrorNote, Spinner, TxReceipt } from "@/components/ui";
import { ORG_ID } from "@/lib/chain";
import {
  useAdvocateProfile,
  useCampaign,
  useCredentialName,
  useEngagementTypes,
} from "@/lib/hooks";
import { contract } from "@/lib/client";
import { proofHashOf } from "@/lib/proof";
import { awaitAccountDeployed, awaitSubmissionOnChain, findSubmissionOnChain } from "@/lib/recover-submission";
import { FundsNotice } from "@/components/FundsGate";
import { useFundsGate } from "@/lib/funds";
import { useTwoPhaseSend } from "@/lib/send-two-phase";
import { isDeploymentStall, isWarmingUp, waitForAccountReady } from "@/lib/warmup";
import { proofHint, type EngagementType } from "@/lib/types";

/* ------------------------------------------------------------------ screen 3 */

export default function SubmitPage() {
  return (
    <CustomerShell>
      {/*
       * The form renders for everyone. Connection is asked for at the moment it is
       * needed — pressing Send — not as a toll at the door. Filling in what you did
       * requires no wallet; recording it on Avalanche does.
       */}
      <Suspense fallback={null}>
        <SubmitForm />
      </Suspense>
    </CustomerShell>
  );
}

/**
 * The form is built from whatever the business decided to reward — it reads
 * /api/engagement-types rather than a list baked into the app. That is the whole point
 * of engagement types: a new one appears here the moment the org adds it, and the proof
 * field changes shape to match what that engagement actually asks for.
 */
function SubmitForm() {
  const account = useActiveAccount();
  const address = account?.address;
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
  // Stored profile name wins; otherwise the login credential (email → "Dan").
  // Never the wallet nickname — that used to travel with submissions and then
  // stuck on the business queue as if the person had chosen "Wafula".
  const me = useAdvocateProfile(address, orgId);
  const credentialName = useCredentialName();
  const chosenName = me.data?.displayName ?? credentialName;
  const engagements = useEngagementTypes(
    campaignSlug && !campaign ? undefined : orgId
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");
  // Two phases, reported separately: "signing" while the wallet prompt may be open
  // (nothing sent), "confirming" once the signed op is with the bundler (a write is
  // now genuinely happening). See lib/send-two-phase.ts.
  const { send: sendTx, signing, confirming, phase, isPending: sending } = useTwoPhaseSend();
  // Skin in the game: submitting needs 0.005 AVAX across their account and wallet.
  // Gas itself is still sponsored — see lib/funds.ts.
  const funds = useFundsGate();
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
  // Pressing Send while disconnected opens the connect dialog and remembers the
  // intent, so the submission continues by itself the moment a wallet is connected.
  const [showConnect, setShowConnect] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const { success, error: toastError } = useToast();

  /**
   * Social sign-in is a full-page redirect (see lib/client.ts), so a form filled
   * before "Continue with X" must survive leaving the page. The draft lives in
   * sessionStorage keyed by URL — restored after the round trip (post-hydration, so
   * the server and first client render agree), cleared once the submission lands.
   */
  const draftKey = `submit-draft:${campaignSlug ?? orgId.toString()}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { selectedId?: string; proof?: string; note?: string };
      if (d.selectedId) setSelectedId(d.selectedId);
      if (d.proof) setProof(d.proof);
      if (d.note) setNote(d.note);
    } catch {
      /* a malformed draft is not worth an error — start blank */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (done || (!proof && !note)) sessionStorage.removeItem(draftKey);
      else sessionStorage.setItem(draftKey, JSON.stringify({ selectedId, proof, note }));
    } catch {
      /* storage full or blocked — the draft is a courtesy */
    }
  }, [draftKey, selectedId, proof, note, done]);

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

  // referral_code no longer asks for a typed code — tracking is the /s/ share link.
  const needsProof = selected
    ? selected.proofKind !== "none" && selected.proofKind !== "referral_code"
    : true;
  const isReferral = selected?.proofKind === "referral_code";
  // The note is required everywhere — it is what the approver reads. For a referral
  // it is just the person's name, so the floor drops to a name's length.
  const minNote = isReferral ? 2 : 10;
  /**
   * Only picking an engagement gates the button. Missing proof or description used
   * to keep it silently disabled, and "the button does nothing" is indistinguishable
   * from broken — people filled the proof, skipped the note, and gave up. Now the
   * click runs submit(), which names exactly what is missing.
   */
  const canSubmit = Boolean(selected);

  /**
   * Resumes a Send that was interrupted by the connect dialog. Waits for the funds
   * gate to answer first: if the freshly connected wallet is under 0.005 AVAX the
   * honest next step is the funding notice, not a transaction that the gate exists
   * to prevent.
   */
  useEffect(() => {
    if (!pendingSubmit || !account) return;
    if (funds.loading) return;
    setShowConnect(false);
    setPendingSubmit(false);
    if (!funds.ok) return;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSubmit, account, funds.loading, funds.ok]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selected) return;

    // Checked before the wallet signs anything: a transaction must never go
    // on-chain for a submission the API would then refuse.
    if (needsProof && proof.trim().length === 0) {
      setError(`Paste your proof first — ${proofBlurb(selected).toLowerCase()}`);
      return;
    }
    if (note.trim().length < minNote) {
      setError(
        isReferral
          ? "Add the name of the person you referred."
          : "Describe what you did — the business approves from that description."
      );
      return;
    }

    // Not connected yet: this click's job is the connection. The submission itself
    // resumes automatically once a wallet is in place — see the effect below.
    if (!account) {
      setPendingSubmit(true);
      setShowConnect(true);
      return;
    }
    const address = account.address;

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
          /**
           * Explicit, not estimated. Fuji's base fee has collapsed to ~10 wei, and
           * eth_estimateGas with a fee cap that tiny returns balance-derived garbage
           * (trillions), which the txpool then rejects as "exceeds block gas limit" —
           * every new account's first submit died on this. Real usage is ~75k; the
           * margin is free because unused gas is refunded.
           */
          gas: 300_000n,
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
    <form onSubmit={submit} className="animate-rise mx-auto w-full max-w-2xl space-y-6 md:max-w-none">
      <div className="md:max-w-2xl">
        {campaign ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-crimson-400">
            {campaign.title}
          </p>
        ) : null}
        <h1 className="text-2xl font-black md:text-3xl">Submit an activity</h1>
        <p className="mt-1 text-sm text-mist-500">
          Show us what you did. The business approves it, and it counts toward your next
          reward.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          What did you do?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        </div>
      </fieldset>

      <div className="space-y-6 md:max-w-xl">
      {isReferral ? (
        <ReferralShareGuide campaignSlug={campaignSlug} address={address} />
      ) : null}

      {needsProof && selected ? (
        <div className="space-y-2">
          <label
            htmlFor="proof"
            className="block text-xs font-semibold uppercase tracking-[0.14em] text-mist-500"
          >
            Link to your proof
          </label>
          <input
            id="proof"
            type="text"
            inputMode="url"
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
          {isReferral ? (
            <>
              Who did you refer?{" "}
              <span className="normal-case text-mist-500">(their name)</span>
            </>
          ) : (
            "What did you do?"
          )}
        </label>
        <textarea
          id="note"
          rows={3}
          required
          minLength={minNote}
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={noteHint(selected)}
          className="w-full resize-none rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
        <p className="text-xs text-mist-500">
          {isReferral
            ? "The business checks this against who actually arrived through your link."
            : "This is what the business reads next to your proof when deciding — say what you did, where, and who it reached."}
        </p>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {/* Meaningless before a wallet exists to fund — connection comes first. */}
      {account ? <FundsNotice funds={funds} /> : null}

      <Button
        type="submit"
        disabled={
          submitting ||
          sending ||
          !canSubmit ||
          (Boolean(account) && !funds.loading && !funds.ok)
        }
        className="w-full md:w-auto md:min-w-56"
      >
        {settingUp
          ? "Setting up your account…"
          : waitingChain
            ? "Waiting for Avalanche to confirm…"
            : signing
              ? "Confirm in your wallet…"
              : confirming
                ? // Truthful now: this label only appears after the signature exists
                  // and the op is with the bundler.
                  "Recording on Avalanche…"
                : phase === "sending"
                  ? "Sending…"
                  : submitting
                    ? "Preparing…"
                    : account
                      ? "Send for approval"
                      : "Connect wallet & send"}
      </Button>

      {!account ? (
        <p className="text-center text-xs text-mist-500">
          You&rsquo;ll be asked to connect Core or MetaMask (or a social login) — then
          your wallet signs, and the submission is recorded on Avalanche.
        </p>
      ) : null}

      {showConnect && !account ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Connect a wallet"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm animate-pop rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Connect to record this</p>
                <p className="mt-1 text-xs leading-relaxed text-mist-500">
                  Your own wallet signs the submission on Avalanche — that&rsquo;s what
                  makes it yours. Once connected, we&rsquo;ll continue right where you
                  left off.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setShowConnect(false);
                  setPendingSubmit(false);
                }}
                className="shrink-0 text-mist-500 transition hover:text-mist-300"
              >
                ✕
              </button>
            </div>
            <SignIn />
          </div>
        </div>
      ) : null}

      {settingUp ? (
        <p className="text-center text-xs text-mist-500">
          Your account is being created on Avalanche — this happens once, on your first
          activity. We&rsquo;ll send your submission the moment it&rsquo;s ready.
        </p>
      ) : signing ? (
        <p className="text-center text-xs text-mist-500">
          Approve the request in your wallet. Nothing is written to Avalanche until you
          sign — once you do, this becomes your own transaction, and gas is covered.
        </p>
      ) : confirming ? (
        <p className="text-center text-xs text-mist-500">
          Signed. Your transaction is with Avalanche now — usually a few seconds.
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
      </div>
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
      className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 transition sm:items-center sm:p-4 ${
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
        <span className="block break-words text-sm font-semibold">{type.label}</span>
        {type.blurb ? (
          <span className="mt-0.5 block line-clamp-2 break-words text-xs text-mist-500">
            {type.blurb}
          </span>
        ) : null}
      </span>
      {/* What it's worth, in the same units the progress ring counts in. */}
      <span className="shrink-0 rounded-full border border-ink-600 px-2 py-0.5 text-[11px] tabular text-mist-400">
        +{type.weight}
      </span>
      <span
        className={`mt-1 size-4 shrink-0 rounded-full border-2 sm:mt-0 ${
          active ? "border-crimson-500 bg-crimson-500" : "border-ink-500"
        }`}
        aria-hidden
      />
    </label>
  );
}

function noteHint(type: EngagementType | null) {
  switch (type?.proofKind) {
    case "x_link":
      return "e.g. Posted about the Founding 20 launch, tagged the studio — 40 likes so far";
    case "social_link":
      return "e.g. Reel of Tuesday's class with the studio tagged in the caption";
    case "screenshot":
      return "e.g. WhatsApp status about the open day, kept up the full 24 hours";
    case "referral_code":
      return "e.g. Signed up Wanjiku from my campus club with my share link";
    default:
      return "e.g. Brought 12 people from my campus club to the open day";
  }
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
      return "Share your /s/ campaign link with them — tracking is automatic.";
    default:
      return "A post link, a photo, a screenshot — whatever shows it happened.";
  }
}
