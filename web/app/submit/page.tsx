"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { Button, Card, ErrorNote } from "@/components/ui";
import { ORG_ID } from "@/lib/chain";
import { useDisplayName } from "@/lib/hooks";
import { ACTIVITY_TYPES } from "@/lib/types";

/* ------------------------------------------------------------------ screen 3 */

export default function SubmitPage() {
  const account = useActiveAccount();

  return (
    <CustomerShell>
      {account ? (
        <SubmitForm address={account.address} />
      ) : (
        <div className="pt-16 text-center">
          <p className="mb-6 text-mist-400">Sign in to submit an activity.</p>
          <SignIn />
        </div>
      )}
    </CustomerShell>
  );
}

function SubmitForm({ address }: { address: string }) {
  const router = useRouter();
  // Carried with the submission so the org's leaderboard can show a real person.
  const displayName = useDisplayName(address);
  const [activityType, setActivityType] = useState<number>(ACTIVITY_TYPES[0].id);
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(ORG_ID),
          advocate: address,
          advocateLabel: displayName,
          activityType,
          proofUrl: proofUrl.trim(),
          note: note.trim() || undefined,
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not submit");

      setDone(true);
      setTimeout(() => router.push("/"), 1600);
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
        <p className="text-xl font-bold">Sent for approval</p>
        <p className="mt-2 max-w-xs text-sm text-mist-500">
          The Centre will review your proof. You&rsquo;ll see it count as soon as they
          approve.
        </p>
      </div>
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
        {ACTIVITY_TYPES.map((type) => {
          const active = activityType === type.id;
          return (
            <label
              key={type.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                active
                  ? "border-crimson-500 bg-crimson-500/10"
                  : "border-ink-700 bg-ink-850 hover:border-ink-600"
              }`}
            >
              <input
                type="radio"
                name="activityType"
                value={type.id}
                checked={active}
                onChange={() => setActivityType(type.id)}
                className="sr-only"
              />
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
                {type.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{type.label}</span>
                <span className="block truncate text-xs text-mist-500">{type.blurb}</span>
              </span>
              <span
                className={`size-4 shrink-0 rounded-full border-2 ${
                  active ? "border-crimson-500 bg-crimson-500" : "border-ink-500"
                }`}
                aria-hidden
              />
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor="proofUrl"
          className="block text-xs font-semibold uppercase tracking-[0.14em] text-mist-500"
        >
          Link to your proof
        </label>
        <input
          id="proofUrl"
          type="url"
          required
          value={proofUrl}
          onChange={(e) => setProofUrl(e.target.value)}
          placeholder="https://x.com/you/status/…"
          className="w-full rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
        <p className="text-xs text-mist-500">
          A post link, a photo, a screenshot — whatever shows it happened.
        </p>
      </div>

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

      <Button type="submit" disabled={submitting || !proofUrl.trim()} className="w-full">
        {submitting ? "Sending…" : "Send for approval"}
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
