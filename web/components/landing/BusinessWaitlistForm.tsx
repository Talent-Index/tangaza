"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { ErrorNote } from "@/components/ui";

const inputClass =
  "w-full rounded-lg border-0 bg-[#e8eef7] px-4 py-3.5 text-sm text-[#0a1428] outline-none placeholder:text-[#5a6b84] focus:ring-2 focus:ring-crimson-500/50";

type BusinessWaitlistFormProps = {
  className?: string;
  id?: string;
};

export function BusinessWaitlistForm({ className = "", id }: BusinessWaitlistFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { success, error: toastError } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not submit");

      setDone(true);
      success("You're on the waitlist — we'll be in touch.");
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
      <div
        className={`rounded-2xl border border-ink-700/80 bg-ink-850/95 p-6 text-center shadow-2xl backdrop-blur sm:p-8 ${className}`}
      >
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-jade-500/15 text-2xl">
          ✓
        </div>
        <p className="font-display text-xl font-bold uppercase tracking-tight text-white">
          You&rsquo;re on the list
        </p>
        <p className="mt-2 text-sm text-mist-400">
          We&rsquo;ll reach out at <span className="text-mist-200">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form
      id={id}
      onSubmit={submit}
      className={`rounded-2xl border border-ink-700/80 bg-ink-850/95 p-6 shadow-2xl backdrop-blur sm:p-8 ${className}`}
    >
      <p className="text-center text-sm text-mist-400">Express interest as a business</p>
      <h2 className="mt-2 text-center font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
        Business waitlist.
      </h2>

      <div className="mt-6 space-y-4 sm:mt-8">
        <PortalField label="Name" required>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Blockchain Centre Kenya"
            className={inputClass}
          />
        </PortalField>
        <PortalField label="Email address" required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.ke"
            className={inputClass}
          />
        </PortalField>
        <PortalField label="Phone number" required>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254 7XX XXX XXX"
            className={inputClass}
          />
        </PortalField>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/register"
          className="text-center text-sm text-mist-300 transition hover:text-white sm:text-left"
        >
          Ready now? Register on Avalanche
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-bold text-[#0a1428] transition hover:bg-[#e8eef7] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Join waitlist"}
        </button>
      </div>
    </form>
  );
}

function PortalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-mist-100">
        {label}
        {required ? <span className="text-mist-400"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
