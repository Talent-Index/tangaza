"use client";

import Link from "next/link";
import { txUrl } from "@/lib/chain";
import { shortHash } from "@/lib/format";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card min-w-0 overflow-hidden p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  href,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
  variant?: "primary" | "ghost" | "danger" | "light";
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 sm:px-6";
  const styles = {
    primary:
      "bg-crimson-500 text-white hover:bg-crimson-400 shadow-[0_8px_24px_-8px_rgb(30_122_239/0.65)]",
    light: "bg-white text-[#050b18] hover:bg-[#e8eef7]",
    ghost: "border border-ink-600 text-mist-300 hover:border-ink-500 hover:text-mist-100",
    danger: "border border-crimson-600 text-crimson-300 hover:bg-crimson-600/15",
  }[variant];

  if (href && !disabled) {
    return (
      <Link href={href} className={`${base} ${styles} ${className}`}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-ink-600 text-mist-400",
    good: "border-jade-500/40 text-jade-400 bg-jade-500/10",
    warn: "border-amber-glow/40 text-amber-glow bg-amber-glow/10",
    bad: "border-crimson-500/40 text-crimson-300 bg-crimson-500/10",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "crimson" | "jade";
}) {
  const valueTone = {
    default: "text-mist-100",
    crimson: "text-crimson-400",
    jade: "text-jade-400",
  }[tone];

  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500">
        {label}
      </p>
      <p className={`tabular mt-2 text-2xl font-bold ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-mist-500">{hint}</p> : null}
    </Card>
  );
}

/** The proof that this really happened on Avalanche. Small, but never hidden. */
export function TxReceipt({ hash, label = "Recorded on Avalanche" }: { hash: string; label?: string }) {
  return (
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3 py-2 text-xs text-mist-400 transition hover:border-crimson-500/50 hover:text-mist-100"
    >
      <span className="size-1.5 rounded-full bg-jade-400" />
      <span>{label}</span>
      <code className="tabular text-mist-500 group-hover:text-crimson-300">
        {shortHash(hash)}
      </code>
      <span aria-hidden>↗</span>
    </a>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-white/25 border-t-white ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center py-12 text-center">
      <div className="mb-3 text-3xl opacity-70" aria-hidden>
        {icon}
      </div>
      <p className="font-semibold text-mist-100">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-mist-500">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-crimson-500/40 bg-crimson-500/10 px-3 py-2 text-sm text-crimson-300">
      {children}
    </p>
  );
}

/** Shown when .env.local has not been filled in yet. */
export function ConfigWarning() {
  return (
    <Card className="border-amber-glow/40 bg-amber-glow/5">
      <p className="font-semibold text-amber-glow">Not configured yet</p>
      <p className="mt-2 text-sm text-mist-400">
        Copy <code className="text-mist-300">web/.env.example</code> to{" "}
        <code className="text-mist-300">web/.env.local</code> and set{" "}
        <code className="text-mist-300">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</code> and{" "}
        <code className="text-mist-300">NEXT_PUBLIC_CONTRACT_ADDRESS</code>.
      </p>
    </Card>
  );
}

/** Split-color wordmark in the MetroPorter style. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-lg font-bold tracking-tight ${className}`}>
      <span className="text-white">ubu</span>
      <span className="text-crimson-400">tangaza</span>
    </span>
  );
}
