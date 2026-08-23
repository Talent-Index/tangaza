"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  google:
    "One tap with Google. No seed phrase — we create a secure wallet tied to your Google account.",
  x: "Sign in with X. Good if you advocate on social — same account, no password to remember.",
} as const;

/**
 * Social sign-in. One tap, no seed phrase, no gas — the whole point of the demo.
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
export function SignIn() {
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
   * configured in-app wallet, so connecting it here is what applies the smart-account
   * + sponsored-gas wrapper from lib/client.ts.
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
    <div className="space-y-6 text-left">
      {emailStage === "address" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <PortalField label="Email address" required>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={portalInput}
            />
          </PortalField>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-bold text-[#0a1428] transition hover:bg-[#e8eef7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Spinner /> : null}
              Send code
            </button>
          </div>
        </form>
      ) : null}

      {emailStage === "code" ? (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm text-mist-400">
            Code sent to <span className="text-mist-200">{email}</span>
          </p>

          <PortalField label="Verification code" required>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className={`tabular ${portalInput}`}
            />
          </PortalField>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCode("");
                setEmailStage("address");
              }}
              className="text-sm text-mist-400 underline underline-offset-4 hover:text-mist-200 disabled:opacity-45"
            >
              Use a different email
            </button>
            <button
              type="submit"
              disabled={busy || !code}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-bold text-[#0a1428] transition hover:bg-[#e8eef7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting ? <Spinner /> : null}
              Sign in
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        <p className="text-center text-xs text-mist-500">Or continue with</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <IconAuthButton
            label="Google"
            hint={SOCIAL_HINTS.google}
            disabled={busy}
            onClick={() => void connectWith({ client, chain: CHAIN, strategy: "google" })}
          >
            {isConnecting ? <Spinner className="size-5" /> : <GoogleLogo />}
          </IconAuthButton>

          <IconAuthButton
            label="X"
            hint={SOCIAL_HINTS.x}
            disabled={busy}
            onClick={() => void connectWith({ client, chain: CHAIN, strategy: "x" })}
          >
            <XLogo />
          </IconAuthButton>

          {EXTERNAL_WALLETS.map((entry) =>
            installed.includes(entry.id) ? (
              <IconAuthButton
                key={entry.id}
                label={entry.label}
                hint={entry.hint}
                disabled={busy}
                onClick={() => connectExternal(entry)}
              >
                <span className="text-lg" aria-hidden>{entry.mark}</span>
              </IconAuthButton>
            ) : (
              <IconAuthButton
                key={entry.id}
                label={`Get ${entry.label}`}
                hint={entry.installHint}
                href={entry.installUrl}
              >
                <span className="text-lg opacity-60" aria-hidden>{entry.mark}</span>
              </IconAuthButton>
            )
          )}
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

const portalInput =
  "w-full rounded-lg border-0 bg-[#e8eef7] px-4 py-3.5 text-sm text-[#0a1428] outline-none placeholder:text-[#5a6b84] focus:ring-2 focus:ring-crimson-500/50";

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

function IconAuthButton({
  label,
  hint,
  disabled,
  onClick,
  href,
  children,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const buttonClass =
    "grid size-12 place-items-center rounded-full border border-ink-600 bg-ink-850/80 text-mist-100 transition hover:border-ink-500 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-45";

  const control = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={buttonClass}
    >
      {children}
    </a>
  ) : (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={buttonClass}
    >
      {children}
    </button>
  );

  return (
    <div className="group relative flex flex-col items-center">
      {control}
      {hint ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-[11.5rem] -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-center text-[11px] leading-snug text-mist-300 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:w-48"
        >
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-mist-100">
            {label}
          </span>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function XLogo() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4 shrink-0 fill-current"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.727-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
