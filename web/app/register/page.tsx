"use client";

import Link from "next/link";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { BrandMark, Button, Card, ErrorNote, SectionTitle } from "@/components/ui";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark />
        </Link>
        <Link href="/org" className="text-xs text-mist-500 hover:text-mist-300">
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
  const [done, setDone] = useState(false);

  const account = useActiveAccount();

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setError(null);
    setSubmitting(true);

    try {
      const ts = Date.now();
      const signature = await account.signMessage({
        message: pledgeMessage({
          name: name.trim(),
          approverAddress: address,
          emissionCapKes: cap,
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
          emissionCapKes: cap,
          pledge: pledge.trim(),
          ts,
          signature,
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not submit");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
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
        <p className="text-xl font-bold">Pledge signed</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
          We&rsquo;ll register {name} on Avalanche with a {kesLabel(cap)} budget and send
          you the contract address. Your signature is on file against the pledge.
        </p>
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

      <Field label="Reward budget (KES)">
        <input
          type="number"
          required
          min={500}
          step={500}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="tabular w-full rounded-full border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none focus:border-crimson-500"
        />
        <p className="mt-2 text-xs text-mist-500">
          {kesLabel(cap)} is {Math.floor(cap / 500)} rewards of KES 500. Written once
          on-chain — <span className="text-mist-300">it can never be raised</span>, only
          spent down. Set it to what you can genuinely honour.
        </p>
      </Field>

      <Field label="What you'll give the community">
        <textarea
          required
          rows={5}
          maxLength={2000}
          value={pledge}
          onChange={(e) => setPledge(e.target.value)}
          placeholder="e.g. Every 20 approved activities earns KES 500 in airtime, data or a Centre voucher. Regulars get 10% off the café; Champions get a free seat at any paid workshop."
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
