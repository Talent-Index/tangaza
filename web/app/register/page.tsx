"use client";

import Link from "next/link";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { useToast } from "@/components/toast";
import { BrandMark, Button, Card, ErrorNote, SectionTitle, TxReceipt } from "@/components/ui";
import { kesLabel } from "@/lib/format";
import { pledgeMessage } from "@/lib/pledge";

/**
 * A business applying to run rewards.
 *
 * The pledge is signed rather than merely typed because the emission cap it names is
 * written once on-chain and no function can raise it afterwards. Signing is the
 * business saying what it is putting up, in a way it cannot later deny.
 *
 * It ends in "we'll be in touch" rather than a live contract because `registerOrg` is
 * `onlyOwner` — see the note at the bottom of the page, which says so plainly rather
 * than pretending the button did more than it did.
 */
export default function RegisterPage() {
  const account = useActiveAccount();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between gap-3 sm:mb-10">
        <Link href="/" className="min-w-0 shrink">
          <BrandMark className="text-base sm:text-lg" />
        </Link>
        <Link href="/org" className="shrink-0 text-xs text-mist-500 hover:text-mist-300">
          Already registered? →
        </Link>
      </header>

      <main className="flex-1">
        {account ? <ApplyForm address={account.address} /> : <SignedOut />}
      </main>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
          Reward the people who talk about you.
        </h1>
        <p className="mt-3 max-w-lg text-mist-400">
          Put up a budget, say what you&rsquo;ll give back, and let your community earn
          it. The budget is written once on Avalanche and can never be raised — not by
          us, not by you. That&rsquo;s the whole promise.
        </p>
      </div>
      <Card>
        <p className="mb-1 text-center text-sm text-mist-500">
          Sign in with the account that will approve activities
        </p>
        <h2 className="mb-6 text-center font-display text-2xl font-bold uppercase tracking-tight">
          Register portal.
        </h2>
        <SignIn />
      </Card>
    </div>
  );
}

function ApplyForm({ address }: { address: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cap, setCap] = useState(50000);
  const [pledge, setPledge] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Null until the pledge is filed. Then it carries what actually happened on-chain,
  // because "we'll register you" and "you are registered" are different promises.
  const [done, setDone] = useState<
    { registered: boolean; orgId?: string; txHash?: string } | null
  >(null);
  const { success, error: toastError } = useToast();

  const account = useActiveAccount();

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setError(null);
    setSubmitting(true);

    try {
      // Budget is optional for the business; the on-chain cap must still be > 0, so a
      // blank/zero entry falls back to a sensible default guardrail.
      const effectiveCap = cap > 0 ? cap : 50000;
      if (effectiveCap !== cap) setCap(effectiveCap);
      const ts = Date.now();
      const signature = await account.signMessage({
        message: pledgeMessage({
          name: name.trim(),
          approverAddress: address,
          emissionCapKes: effectiveCap,
          pledge: pledge.trim(),
          ts,
        }),
      });

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: email.trim() || undefined,
          approverAddress: address,
          emissionCapKes: effectiveCap,
          pledge: pledge.trim(),
          ts,
          signature,
        }),
      });

      const json = (await res.json()) as {
        error?: string;
        registered?: boolean;
        orgId?: string;
        txHash?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not submit");
      setDone({
        registered: Boolean(json.registered),
        orgId: json.orgId,
        txHash: json.txHash,
      });
      success(json.registered ? `Registered on Avalanche as org #${json.orgId}` : "Pledge signed");
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
      <div className="animate-pop py-16 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-jade-500/15 text-3xl">
          ✓
        </div>
        {done.registered ? (
          <>
            <p className="text-xl font-bold">{name} is live on Avalanche</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
              Registered as org #{done.orgId}, and your wallet is the approver. Next: set up
              your rewards — choose the activities you want people to do, and what each one
              earns (cash or an incentive like merch, a voucher or a discount).
            </p>
            {done.txHash ? (
              <div className="mt-5 flex justify-center">
                <TxReceipt hash={done.txHash} label="Registration" />
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/org/settings"
                className="inline-block rounded-full bg-crimson-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-crimson-400"
              >
                Set up your rewards →
              </Link>
              <Link
                href="/org"
                className="inline-block rounded-full border border-ink-600 px-5 py-3 text-sm font-medium text-mist-300 transition hover:border-ink-500"
              >
                Business portal
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-xl font-bold">Pledge signed</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
              We&rsquo;ll register {name} on Avalanche with a {kesLabel(cap)} budget and
              send you the contract address. Your signature is on file against the
              pledge, and your budget is exactly what you signed for.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={apply} className="animate-rise space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Register your business</h1>
        <p className="mt-1 text-sm text-mist-500">
          Signing in as{" "}
          <code className="tabular text-mist-300">
            {address.slice(0, 6)}…{address.slice(-4)}
          </code>{" "}
          — this account will approve activities.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Blockchain Centre Kenya"
            className="w-full rounded-full border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.ke"
            className="w-full rounded-full border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
        </Field>
      </div>

      <Field label="Reward budget (optional)">
        <input
          type="number"
          min={0}
          step={500}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="tabular w-full rounded-full border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none focus:border-crimson-500"
        />
        <p className="mt-2 text-xs text-mist-500">
          An on-chain spending guardrail — written once and{" "}
          <span className="text-mist-300">never raisable</span>, only spent down. Optional:
          leave the default if you&rsquo;re not sure. You decide the actual rewards,
          amounts and currencies later under Rewards.
        </p>
      </Field>

      <Field label="What you'll give the community">
        <textarea
          required
          rows={5}
          maxLength={2000}
          value={pledge}
          onChange={(e) => setPledge(e.target.value)}
          placeholder="e.g. Refer 5 friends → 500 KSh airtime. Post 3 times → a café voucher. Reach 10 approved activities → 10% off anything. Rewards can be cash or not, in any currency you choose."
          className="w-full resize-none rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
        <p className="mt-2 text-xs text-mist-500">
          This is the part you sign. Your community can read it, and you can&rsquo;t
          quietly change what you promised.
        </p>
      </Field>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Signing…" : "Sign the pledge"}
      </Button>

      <section>
        <SectionTitle>What happens next</SectionTitle>
        <Card className="bg-ink-850/60">
          <p className="text-xs leading-relaxed text-mist-500">
            We register you on Avalanche Fuji, because registering a business mints the
            right to issue rewards against a budget nobody can later raise — so it
            isn&rsquo;t a button anyone gets to press for themselves. Once your business
            is on-chain you define what you reward, what it&rsquo;s worth, and the levels
            people climb, all without touching the budget.
          </p>
        </Card>
      </section>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
        {label}
      </label>
      {children}
    </div>
  );
}
