"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useConnect } from "thirdweb/react";
import { injectedProvider } from "thirdweb/wallets";
import { preAuthenticate } from "thirdweb/wallets/in-app";
import { CHAIN } from "@/lib/chain";
import { client, coreWallet, metamaskWallet, wallets } from "@/lib/client";
import { ErrorNote, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";

/**
 * The bring-your-own wallets, and where to get them.
 *
 * `id` is the EIP-6963 rdns, which is what makes "is this installed?" answerable when
 * somebody has both extensions — `window.ethereum` alone cannot tell them apart.
 */
const EXTERNAL_WALLETS = [
  {
    wallet: coreWallet,
    id: "app.core.extension",
    label: "Core",
    mark: "🔺",
    installUrl: "https://core.app",
    installHost: "core.app",
    hint: "Connect your Avalanche Core extension. You sign transactions in Core and pay gas from that wallet.",
    installHint: "Install Core for Avalanche — then connect here to use your browser wallet.",
  },
  {
    wallet: metamaskWallet,
    id: "io.metamask",
    label: "MetaMask",
    mark: "🦊",
    installUrl: "https://metamask.io/download",
    installHost: "metamask.io",
    hint: "Connect MetaMask as your browser wallet. You approve each action in the extension.",
    installHint: "Install MetaMask, then return here to connect your existing wallet.",
  },
] as const;

const SOCIAL_HINTS = {
  google: "One tap with your Google account. Nothing else to set up.",
  x: "Use your X account. Handy if you post a lot.",
} as const;

/**
 * Social sign-in. One tap, no seed phrase, no crypto homework — the whole point.
 *
 * This drives the in-app wallet directly instead of using thirdweb's <ConnectButton />.
 * ConnectButton statically imports its entire connect UI — 500+ wallet connectors, QR
 * screens, the on-ramp — so the welcome screen had to parse ~2.2MB of JavaScript before
 * the button would respond to a tap. Advocates open this on a phone, and that wait *is*
 * what "signing in is slow" feels like. Talking to the wallet ourselves costs ~717KB and
 * offers exactly the three options `lib/client.ts` actually configures.
 *
 * The tradeoff: <AutoConnect /> in app/providers.tsx now has to restore the session on
 * reload, because that came free with ConnectButton.
 */
export function SignIn({ kicker = "Ambassadors portal" }: { kicker?: string }) {
  /**
   * No accountAbstraction here, on purpose: a browser wallet connects as itself. The
   * address the app acts as is the extension's own, transactions pop the extension,
   * and gas comes from its balance. Only the in-app wallet (social login) is a smart
   * account, by its own config in lib/client.ts.
   */
  const { connect, isConnecting, error: connectError } = useConnect({ client });
  const { success, error: toastError } = useToast();
  const wasConnecting = useRef(false);

  // Email is a two-step OTP. Shown first in the portal layout; Google/X/wallets stay one tap below.
  const [emailStage, setEmailStage] = useState<"hidden" | "address" | "code">("address");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [moreWays, setMoreWays] = useState(false);

  const busy = isConnecting || sending;
  const error = emailError ?? connectError?.message ?? null;

  /**
   * Which extensions are actually here. Checking up front means a button can say
   * "get MetaMask" before the click instead of erroring after it.
   *
   * Extensions announce themselves over EIP-6963 at page load, which can land either
   * side of React mounting, so this re-checks a couple of times rather than trusting
   * one read on mount and permanently offering an install link to someone who has the
   * wallet installed.
   */
  const [installed, setInstalled] = useState<string[]>([]);
  useEffect(() => {
    const scan = () =>
      setInstalled(EXTERNAL_WALLETS.filter((w) => injectedProvider(w.id)).map((w) => w.id));
    scan();
    const timers = [250, 1000].map((ms) => setTimeout(scan, ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (isConnecting) {
      wasConnecting.current = true;
      return;
    }
    if (wasConnecting.current && connectError) {
      wasConnecting.current = false;
      toastError(connectError.message || "Could not sign in");
    }
  }, [isConnecting, connectError, toastError]);

  /**
   * `connect` wants a thunk that returns a connected wallet. `wallets[0]` is the
   * configured in-app wallet from lib/client.ts (embedded EOA — no smart account,
   * no sponsorship; it pays its own gas from the faucet drip).
   */
  const connectWith = (options: Parameters<(typeof wallets)[0]["connect"]>[0]) =>
    connect(async () => {
      const wallet = wallets[0];
      await wallet.connect(options);
      success("Signed in");
      return wallet;
    });

  /**
   * Connecting a browser wallet — as itself. What the extension shows is what the
   * app acts as, and what pays.
   */
  const connectExternal = useCallback(
    (entry: (typeof EXTERNAL_WALLETS)[number]) =>
      void connect(async () => {
        await entry.wallet.connect({ client, chain: CHAIN });
        success(`Signed in with ${entry.label}`);
        return entry.wallet;
      }).catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : `Could not connect ${entry.label}`;
        setEmailError(msg);
        toastError(msg);
      }),
    [connect, success, toastError]
  );

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setSending(true);
    try {
      await preAuthenticate({ client, strategy: "email", email });
      setEmailStage("code");
      success("Code sent — check your email");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send that code.";
      setEmailError(msg);
      toastError(msg);
    } finally {
      setSending(false);
    }
  }

  function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    void connectWith({
      client,
      chain: CHAIN,
      strategy: "email",
      email,
      verificationCode: code,
    });
  }

  return (
    <div className="text-left">
      {emailStage === "code" ? (
        <form onSubmit={verifyCode}>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCode("");
              setEmailStage("address");
            }}
            className="inline-flex items-center gap-2 text-[13px] text-mist-400 hover:text-mist-100 disabled:opacity-45"
          >
            <span aria-hidden>←</span> Use a different email
          </button>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">Check your email</p>
          <h2 className="poster mt-2 text-[2.4rem]">Enter your code</h2>
          <p className="mt-2 text-sm leading-relaxed text-mist-300">
            Enter the 6-digit code we sent to <span className="font-bold text-mist-100">{email}</span>. It
            can take a minute.
          </p>
          <label className="mt-4 block text-sm font-bold" htmlFor="signin-code">
            6-digit code
          </label>
          <div className="relative mt-2">
            <div className="grid grid-cols-6 gap-2" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className={`grid h-12 place-items-center rounded-xl border bg-ink-900 font-mono text-2xl font-bold sm:h-14 ${
                    code[i] ? "border-gold-line" : "border-ink-500"
                  }`}
                >
                  {code[i] ?? ""}
                </span>
              ))}
            </div>
            <input
              id="signin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-label="6-digit code"
              className="absolute inset-0 cursor-text opacity-0"
            />
          </div>
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-on-gold transition hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isConnecting ? <Spinner /> : null}
            Sign in
          </button>
          <p className="mt-3 text-center text-[13px] text-mist-500">
            Didn&apos;t get it? Check spam, or{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEmailError(null);
                setSending(true);
                void preAuthenticate({ client, strategy: "email", email })
                  .then(() => success("Code sent — check your email"))
                  .catch((err: unknown) => {
                    const msg = err instanceof Error ? err.message : "Could not send that code.";
                    setEmailError(msg);
                    toastError(msg);
                  })
                  .finally(() => setSending(false));
              }}
              className="font-semibold text-mist-100 underline underline-offset-4 disabled:opacity-45"
            >
              resend the code
            </button>
          </p>
        </form>
      ) : (
        <>
          {kicker ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-text">{kicker}</p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2.5">
            <ProviderRow
              mark={<GoogleMark />}
              title="Continue with Google"
              body={SOCIAL_HINTS.google}
              disabled={busy}
              emphasized
              onClick={() => void connectWith({ client, chain: CHAIN, strategy: "google" })}
            />
            <ProviderRow
              mark={<XMark />}
              title="Continue with X"
              body={SOCIAL_HINTS.x}
              disabled={busy}
              onClick={() => void connectWith({ client, chain: CHAIN, strategy: "x" })}
            />
          </div>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-700" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500">or use your email</span>
            <span className="h-px flex-1 bg-ink-700" />
          </div>

          <form onSubmit={sendCode}>
            <label htmlFor="signin-email" className="block text-sm font-bold">
              Email
            </label>
            <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-3">
              <MailIcon />
              <input
                id="signin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-mist-100 outline-none placeholder:text-mist-500"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-3.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-on-gold transition hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {sending ? <Spinner /> : null}
              Send me a code
            </button>
            <p className="mt-2.5 text-[13px] text-mist-500">
              We&apos;ll email you a 6-digit code. No password needed.
            </p>
          </form>

          <button
            type="button"
            onClick={() => setMoreWays((v) => !v)}
            aria-expanded={moreWays}
            className="mt-4 flex w-full items-center justify-between border-t border-ink-700 pt-3.5 text-[13.5px] text-mist-400"
          >
            More ways to sign in
            <span aria-hidden className={moreWays ? "rotate-180" : ""}>
              ▾
            </span>
          </button>
          {moreWays ? (
            <div className="mt-3 flex flex-col gap-2">
              {EXTERNAL_WALLETS.map((entry) =>
                installed.includes(entry.id) ? (
                  <ProviderRow
                    key={entry.id}
                    mark={<span className="text-base">{entry.mark}</span>}
                    title={entry.label}
                    body={entry.hint}
                    disabled={busy}
                    onClick={() => connectExternal(entry)}
                  />
                ) : (
                  <a
                    key={entry.id}
                    href={entry.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-mist-300 hover:border-ink-500"
                  >
                    <span className="font-bold text-mist-100">Get {entry.label}</span>
                    <span className="mt-0.5 block text-[12.5px] text-mist-500">{entry.installHint}</span>
                  </a>
                )
              )}
            </div>
          ) : null}
          <p className="mt-4 text-[13px] leading-relaxed text-mist-500">
            First time? Use your email, Google or X. We set up your account for you.
          </p>
        </>
      )}

      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
    </div>
  );
}

function ProviderRow({
  mark,
  title,
  body,
  disabled,
  emphasized,
  onClick,
}: {
  mark: ReactNode;
  title: string;
  body: string;
  disabled?: boolean;
  emphasized?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-2xl border bg-ink-900 px-4 py-3.5 text-left transition hover:border-gold-line disabled:cursor-not-allowed disabled:opacity-45 ${
        emphasized ? "border-gold/40" : "border-ink-700"
      }`}
    >
      {mark}
      <span className="min-w-0">
        <span className="block text-[15px] font-bold">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-mist-500">{body}</span>
      </span>
    </button>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-gold-text" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 5h18v14H3z" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <span className="grid size-[22px] shrink-0 place-items-center rounded-full border border-ink-600 bg-white font-[Arial] text-[13px] font-bold text-[#4285f4]">
      G
    </span>
  );
}

function XMark() {
  return (
    <span className="grid size-[22px] shrink-0 place-items-center rounded-full border border-[#555] bg-black font-[Arial] text-[12px] font-bold text-white">
      X
    </span>
  );
}
