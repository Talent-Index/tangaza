"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { SignIn } from "@/components/customer/SignIn";
import { BrandMark, Card, ErrorNote, Pill, SectionTitle, Spinner } from "@/components/ui";
import { OUTREACH_ACTIONS, signOutreachAction, type OutreachAction } from "@/lib/outreach-action";
import type { OutreachRow } from "@/lib/outreach";

/**
 * Platform-owner console for business outreach: see who the workflow has found and
 * drafted for, and start a new run.
 *
 * The workflow (.claude/workflows/business-outreach.js) lives in Claude Code and keeps its
 * state in a Notion database; this page reads that database and can fire the run
 * trigger. Every call is signed by the contract owner's wallet (lib/outreach-action.ts) —
 * the page shows business contact details and can spend agent time, so it is not open
 * to anyone who finds the URL. The workflow only drafts emails; nothing is sent.
 */

type FilterKey = "all" | "toSend" | "needsReply" | "noContact" | "waiting" | "closed";

const FILTERS: { key: FilterKey; label: string; statuses?: string[] }[] = [
  { key: "all", label: "All" },
  { key: "toSend", label: "To send", statuses: ["drafted", "whatsapp_ready", "needs_review"] },
  { key: "needsReply", label: "Needs reply", statuses: ["replied_interested", "replied_question"] },
  { key: "noContact", label: "No contact", statuses: ["needs_contact"] },
  { key: "waiting", label: "Waiting", statuses: ["sent", "no_reply"] },
  { key: "closed", label: "Closed", statuses: ["replied_not_now", "replied_declined", "booked", "bounced"] },
];

function tone(status: string): "neutral" | "good" | "warn" | "bad" {
  if (["replied_interested", "replied_question", "booked"].includes(status)) return "good";
  if (["drafted", "whatsapp_ready", "needs_review"].includes(status)) return "warn";
  if (["needs_contact", "bounced", "replied_declined"].includes(status)) return "bad";
  return "neutral";
}

const FIELD =
  "w-full min-w-0 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2.5 text-base outline-none placeholder:text-mist-500 focus:border-crimson-500 sm:text-sm";

export default function OutreachPage() {
  const account = useActiveAccount();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl min-w-0 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-sm text-mist-500">Outreach</span>
        </Link>
        <Link href="/admin" className="text-xs text-mist-500 hover:text-mist-300">
          ← Platform admin
        </Link>
      </header>

      <main className="min-w-0 flex-1">
        {account ? (
          <Console account={account} />
        ) : (
          <Card>
            <p className="mb-4 text-sm text-mist-400">Sign in with the platform owner account.</p>
            <SignIn />
          </Card>
        )}
      </main>
    </div>
  );
}

type Account = NonNullable<ReturnType<typeof useActiveAccount>>;

async function callApi<T>(account: Account, action: OutreachAction, extra: Record<string, unknown> = {}): Promise<T> {
  const auth = await signOutreachAction(account, action);
  const res = await fetch("/api/admin/outreach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: action === OUTREACH_ACTIONS.read ? "read" : "run", ...auth, ...extra }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

interface ReadResponse {
  rows: OutreachRow[];
  notionConfigured: boolean;
  runConfigured: boolean;
  /** Whether this deployment can run searches itself, and which env vars are missing if not. */
  inApp: { ready: boolean; missing: string[] };
  notionUrl: string;
  error?: string;
}

interface StepResult {
  business: string;
  ok: boolean;
  skipped?: boolean;
  status?: string;
  email?: string;
  note?: string;
  error?: string;
}

interface PlanResponse {
  plan: {
    ticket: string;
    candidates: { id: string; business: string; location: string; website: string }[];
    warnings: string[];
    found: number;
    deferred: number;
  };
}

/** Process one business from a signed plan. No wallet prompt: the ticket is the authority. */
async function postStep(ticket: string, index: number): Promise<StepResult> {
  const res = await fetch("/api/admin/outreach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "step", ticket, index }),
  });
  const json = (await res.json().catch(() => ({}))) as { result?: StepResult; error?: string };
  if (!res.ok || !json.result) throw Object.assign(new Error(json.error ?? `Request failed (${res.status})`), { status: res.status });
  return json.result;
}

function Console({ account }: { account: Account }) {
  // Access is decided by the server (OUTREACH_ADMINS or the contract owner), not here.
  return <Outreach account={account} />;
}

function Outreach({ account }: { account: Account }) {
  const [data, setData] = useState<ReadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await callApi<ReadResponse>(account, OUTREACH_ACTIONS.read));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the tracker");
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const f = FILTERS.find((x) => x.key === filter);
    return f?.statuses ? all.filter((r) => f.statuses!.includes(r.status)) : all;
  }, [data, filter]);

  const counts = useMemo(() => {
    const all = data?.rows ?? [];
    return Object.fromEntries(
      FILTERS.map((f) => [f.key, f.statuses ? all.filter((r) => f.statuses!.includes(r.status)).length : all.length])
    ) as Record<FilterKey, number>;
  }, [data]);

  return (
    <div className="min-w-0 space-y-8">
      <RunPanel
        account={account}
        runConfigured={data?.runConfigured ?? false}
        inApp={data?.inApp ?? { ready: false, missing: [] }}
        onStarted={load}
      />

      <section className="min-w-0">
        <SectionTitle
          action={
            <div className="flex items-center gap-4 text-xs">
              <button type="button" onClick={load} disabled={loading} className="text-mist-400 hover:text-mist-100 disabled:opacity-50">
                {loading ? "Loading…" : "Refresh"}
              </button>
              {data?.notionUrl ? (
                <a href={data.notionUrl} target="_blank" rel="noreferrer" className="text-crimson-400 hover:text-crimson-300">
                  Open in Notion ↗
                </a>
              ) : null}
            </div>
          }
        >
          Businesses
        </SectionTitle>

        {error ? (
          <div className="space-y-2">
            <ErrorNote>{error}</ErrorNote>
            {error.includes("OUTREACH_ADMINS") ? (
              <p className="text-xs text-mist-500">
                Signed in as <span className="break-all font-mono">{account.address}</span>. Add this address to
                OUTREACH_ADMINS on the server, redeploy, then refresh.
              </p>
            ) : null}
          </div>
        ) : null}
        {data && !data.notionConfigured ? <NotionSetup /> : null}
        {data?.error ? <ErrorNote>{data.error}</ErrorNote> : null}

        {data?.notionConfigured ? (
          <>
            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                    filter === f.key
                      ? "border-crimson-500 bg-crimson-500 text-white"
                      : "border-ink-600 text-mist-400 hover:border-mist-400"
                  }`}
                >
                  {f.label} <span className="opacity-70">{counts[f.key]}</span>
                </button>
              ))}
            </div>

            {loading && !data.rows.length ? (
              <div className="grid place-items-center py-16">
                <Spinner className="size-6" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-mist-500">Nothing here yet.</p>
            ) : (
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {rows.map((r) => (
                  <BusinessCard key={r.id} row={r} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

function BusinessCard({ row }: { row: OutreachRow }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-base font-bold">{row.business || "Untitled"}</h3>
        <Pill tone={tone(row.status)}>{row.status.replace(/_/g, " ") || "new"}</Pill>
      </div>

      {row.location ? <p className="mt-1 break-words text-sm text-mist-400">{row.location}</p> : null}

      <dl className="mt-3 space-y-1 text-sm">
        {row.email ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-mist-500">Email</dt>
            <dd className="min-w-0 break-all">
              <a href={`mailto:${row.email}`} className="underline underline-offset-2 hover:text-mist-100">
                {row.email}
              </a>
            </dd>
          </div>
        ) : null}
        {row.phone ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-mist-500">Phone</dt>
            <dd className="min-w-0 break-all">
              <a href={`tel:${row.phone}`} className="hover:text-mist-100">
                {row.phone}
              </a>
            </dd>
          </div>
        ) : null}
        {row.website ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-mist-500">Web</dt>
            <dd className="min-w-0 break-all">
              <a href={row.website} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-mist-100">
                {row.website.replace(/^https?:\/\//, "")}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {row.vision ? (
        <p className="mt-3 line-clamp-3 text-xs text-mist-400">
          <span className="text-mist-500">Goal: </span>
          {row.vision}
        </p>
      ) : null}
      {row.campaigns ? <p className="mt-2 line-clamp-3 text-xs text-mist-500">{row.campaigns}</p> : null}
      {row.draftBody ? <DraftBlock row={row} /> : null}
      {row.lastReply ? <p className="mt-3 text-sm text-mist-300">“{row.lastReply}”</p> : null}
      {row.nextAction ? (
        <p className="mt-3 text-xs">
          <span className="text-mist-500">Next: </span>
          {row.nextAction}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 pt-3 text-xs text-mist-500">
        <span>{row.kind ? `${row.kind} · ` : ""}{row.firstDrafted || "not drafted"}</span>
        <a href={row.url} target="_blank" rel="noreferrer" className="hover:text-mist-200">
          Notion ↗
        </a>
      </div>
    </Card>
  );
}

function DraftBlock({ row }: { row: OutreachRow }) {
  const [copied, setCopied] = useState(false);
  const full = row.draftSubject ? `${row.draftSubject}\n\n${row.draftBody}` : row.draftBody;
  const mailto = row.email
    ? `mailto:${row.email}?subject=${encodeURIComponent(row.draftSubject)}&body=${encodeURIComponent(row.draftBody)}`
    : null;
  return (
    <details className="mt-3 rounded-lg border border-ink-700 px-3 py-2">
      <summary className="cursor-pointer text-xs text-mist-400">Draft message</summary>
      {row.draftSubject ? <p className="mt-2 text-sm font-semibold">{row.draftSubject}</p> : null}
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-mist-300">{row.draftBody}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {mailto ? (
          <a href={mailto} className="rounded-lg border border-ink-600 px-3 py-2 hover:border-mist-400">
            Open in mail
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(full).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="rounded-lg border border-ink-600 px-3 py-2 hover:border-mist-400"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </details>
  );
}

function NotionSetup() {
  return (
    <Card>
      <p className="text-sm font-semibold">Connect Notion to see results here</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-mist-400">
        <li>Create an internal integration at notion.so/profile/integrations.</li>
        <li>Open the “Business Outreach Tracker” database, then … → Connections → add the integration.</li>
        <li>
          Set <code className="font-mono text-xs">NOTION_API_KEY</code> in the server environment and redeploy.
        </li>
      </ol>
    </Card>
  );
}

function RunPanel({
  account,
  runConfigured,
  inApp,
  onStarted,
}: {
  account: Account;
  runConfigured: boolean;
  inApp: { ready: boolean; missing: string[] };
  onStarted: () => void;
}) {
  // An external trigger wins if configured; otherwise the app runs the search itself.
  const inAppMode = !runConfigured && inApp.ready;
  const canRun = runConfigured || inApp.ready;

  const [mode, setMode] = useState<"full" | "outreach" | "replies">("outreach");
  const [useSearch, setUseSearch] = useState(true);
  const [queries, setQueries] = useState("coffee shop, salon, boutique, barbershop");
  const [location, setLocation] = useState("Nairobi, Kenya");
  const [country, setCountry] = useState("ke");
  const [perQuery, setPerQuery] = useState(10);
  const [maxNew, setMaxNew] = useState(15);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<{ total: number; done: number; current: string } | null>(null);
  const [results, setResults] = useState<StepResult[]>([]);
  const stop = useRef(false);

  async function startInApp(searchParams: { queries: string[]; location: string; country: string; perQuery: number }) {
    setResults([]);
    setProgress({ total: 0, done: 0, current: "Searching Google Maps…" });
    const { plan } = await callApi<PlanResponse>(account, OUTREACH_ACTIONS.run, {
      params: { mode: "outreach", maxNew, search: searchParams },
    });
    const warn = plan.warnings.length ? ` ${plan.warnings.join(" ")}` : "";
    if (plan.candidates.length === 0) {
      setMsg({
        ok: plan.warnings.length === 0,
        text: `Found ${plan.found} businesses, none new to the tracker.${warn}`,
      });
      return;
    }

    const done: StepResult[] = [];
    for (let i = 0; i < plan.candidates.length; i++) {
      if (stop.current) break;
      const c = plan.candidates[i];
      setProgress({ total: plan.candidates.length, done: i, current: c.business });
      try {
        done.push(await postStep(plan.ticket, i));
      } catch (err) {
        const e = err as Error & { status?: number };
        done.push({ business: c.business, ok: false, error: e.message });
        if (e.status === 401) break; // the run expired; the rest would fail the same way
      }
      setResults([...done]);
    }
    const added = done.filter((r) => r.ok && !r.skipped).length;
    const failed = done.filter((r) => !r.ok).length;
    setMsg({
      ok: failed === 0,
      text:
        `Added ${added} of ${plan.candidates.length} to the tracker${failed ? `, ${failed} failed` : ""}` +
        `${stop.current ? " (stopped early)" : ""}.` +
        `${plan.deferred ? ` ${plan.deferred} more found, run again to continue.` : ""}${warn}`,
    });
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    stop.current = false;
    try {
      const list = queries.split(",").map((q) => q.trim()).filter(Boolean);
      const searchParams = { queries: list, location: location.trim(), country: country.trim().toLowerCase(), perQuery };
      if (inAppMode) {
        await startInApp(searchParams);
      } else {
        await callApi(account, OUTREACH_ACTIONS.run, {
          params: { mode, maxNew, ...(useSearch && mode !== "replies" ? { search: searchParams } : {}) },
        });
        setMsg({ ok: true, text: "Run started. New businesses appear below as the workflow finishes — refresh in a few minutes." });
      }
      onStarted();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not start the run" });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Card>
      <SectionTitle>Start a run</SectionTitle>
      <form onSubmit={start} className="min-w-0 space-y-4">
        {!inAppMode ? (
          <label className="block text-sm">
            <span className="mb-1 block text-mist-400">What to do</span>
            <select className={FIELD} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="full">Find new businesses and check replies</option>
              <option value="outreach">Find new businesses only</option>
              <option value="replies">Check replies only</option>
            </select>
          </label>
        ) : (
          <p className="text-sm text-mist-400">
            Searches Google Maps (SerpApi), researches each business and writes a draft message (Gemini), and adds
            it to the tracker. Replies are checked from Claude Code, since that needs your Gmail.
          </p>
        )}

        {mode !== "replies" || inAppMode ? (
          <>
            {!inAppMode ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} />
                Search Google Maps for new businesses (SerpApi)
              </label>
            ) : null}
            {useSearch || inAppMode ? (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-sm sm:col-span-2">
                  <span className="mb-1 block text-mist-400">Business types (comma separated)</span>
                  <input className={FIELD} value={queries} onChange={(e) => setQueries(e.target.value)} maxLength={400} />
                </label>
                <label className="block min-w-0 text-sm">
                  <span className="mb-1 block text-mist-400">Where</span>
                  <input className={FIELD} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} />
                </label>
                <label className="block min-w-0 text-sm">
                  <span className="mb-1 block text-mist-400">Country code</span>
                  <input className={FIELD} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} />
                </label>
                <label className="block min-w-0 text-sm">
                  <span className="mb-1 block text-mist-400">Results per type</span>
                  <input className={FIELD} type="number" min={1} max={20} value={perQuery} onChange={(e) => setPerQuery(Number(e.target.value))} />
                </label>
                <label className="block min-w-0 text-sm">
                  <span className="mb-1 block text-mist-400">Max new businesses</span>
                  <input className={FIELD} type="number" min={1} max={30} value={maxNew} onChange={(e) => setMaxNew(Number(e.target.value))} />
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        <p className="text-xs text-mist-500">
          Messages are drafts stored on each row. Nothing is sent — you review each one and send it yourself.
        </p>

        {!canRun ? (
          <p className="rounded-lg border border-amber-glow/40 px-3 py-2 text-xs text-amber-glow">
            {inApp.missing.length
              ? `Set ${inApp.missing.join(", ")} on the server and redeploy to run from here.`
              : "Run trigger not configured."}{" "}
            Until then, start runs from Claude Code.
          </p>
        ) : null}

        {progress ? (
          <div role="status" className="space-y-2">
            <p className="text-sm text-mist-300">
              {progress.total ? `Researching ${progress.done + 1} of ${progress.total}: ${progress.current}` : progress.current}
            </p>
            {progress.total ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full bg-crimson-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            ) : null}
            <button type="button" onClick={() => (stop.current = true)} className="text-xs text-mist-400 underline underline-offset-2">
              Stop after this one
            </button>
          </div>
        ) : null}

        {results.length ? (
          <ul className="space-y-1 text-xs">
            {results.map((r, i) => (
              <li key={i} className={`break-words ${r.ok ? "text-mist-400" : "text-crimson-300"}`}>
                {r.ok ? (r.skipped ? "• " : "✓ ") : "✗ "}
                {r.business}
                {r.ok ? (r.skipped ? ` — ${r.note}` : r.email ? ` — ${r.email}` : " — no public email") : ` — ${r.error}`}
              </li>
            ))}
          </ul>
        ) : null}

        {msg ? (
          msg.ok ? (
            <p className="rounded-lg border border-jade-500/40 bg-jade-500/10 px-3 py-2 text-sm text-jade-400">{msg.text}</p>
          ) : (
            <ErrorNote>{msg.text}</ErrorNote>
          )
        ) : null}

        <button
          type="submit"
          disabled={busy || !canRun}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-crimson-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-crimson-400 disabled:opacity-50 sm:w-auto"
        >
          {busy ? <Spinner className="size-4" /> : null} {busy ? "Running…" : "Start run"}
        </button>
      </form>
    </Card>
  );
}
