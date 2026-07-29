"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import type { Account } from "thirdweb/wallets";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { Button, Card, EmptyState, ErrorNote, Spinner, TxReceipt } from "@/components/ui";
import { ORG_ID } from "@/lib/chain";
import { useAdvocateProfile, useEngagementTypes } from "@/lib/hooks";
import { contract } from "@/lib/client";
import { proofHashOf } from "@/lib/proof";
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
  // Set when the advocate arrived from a shared campaign link.
  const campaignId = useSearchParams().get("campaign");
  // Only a name they actually chose travels with the submission. The UI's display
  // name falls back to a nickname built from the address, and sending that would
  // persist a pseudonym as though they had picked it.
  const me = useAdvocateProfile(address);
  const chosenName = me.data?.displayName;
  const engagements = useEngagementTypes();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");
  const { mutateAsync: sendTx, isPending: sending } = useSendAndConfirmTransaction();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // the submission tx hash

  const types = engagements.data ?? [];
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
      const receipt = await sendTx(
        prepareContractCall({
          contract,
          method: "submitActivity",
          params: [ORG_ID, selected.chainCategory, proofHashOf(proofUrl)],
        })
      );

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(ORG_ID),
          advocate: address,
          advocateLabel: chosenName,
          engagementTypeId: selected.id,
          proofUrl,
          note: note.trim() || undefined,
          campaignId: campaignId ?? undefined,
          submitTx: receipt.transactionHash,
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not submit");

      setDone(receipt.transactionHash);
      setTimeout(() => router.push("/"), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
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
          Your wallet wrote this submission on-chain. The Centre reviews it next —
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
        <h1 className="text-2xl font-black">Submit an activity</h1>
        <p className="mt-1 text-sm text-mist-500">
          Show us what you did. The Centre approves it, and it counts toward your next
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
        {sending ? "Recording on Avalanche…" : submitting ? "Sending…" : "Send for approval"}
      </Button>

      <Card className="bg-ink-850/60">
        <p className="text-xs leading-relaxed text-mist-500">
          Your proof stays with the Centre. Only their approval is written to Avalanche —
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
