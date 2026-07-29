"use client";

import { useEffect, useRef, useState } from "react";
import { useConnect } from "thirdweb/react";
import { preAuthenticate } from "thirdweb/wallets/in-app";
import { CHAIN } from "@/lib/chain";
import { client, wallets } from "@/lib/client";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";

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
  const { connect, isConnecting, error: connectError } = useConnect({ client });
  const { success, error: toastError } = useToast();
  const wasConnecting = useRef(false);

  // Email is a two-step OTP, so it needs somewhere to live. Google and X are one tap.
  const [emailStage, setEmailStage] = useState<"hidden" | "address" | "code">("hidden");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const busy = isConnecting || sending;
  const error = emailError ?? connectError?.message ?? null;

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
    <div className="space-y-3 text-left">
      <Button
        className="w-full"
        disabled={busy}
        onClick={() =>
          void connectWith({ client, chain: CHAIN, strategy: "google" })
        }
      >
        {isConnecting ? <Spinner /> : <GoogleLogo />}
        Continue with Google
      </Button>

      <Button
        variant="ghost"
        className="w-full"
        disabled={busy}
        onClick={() => void connectWith({ client, chain: CHAIN, strategy: "x" })}
      >
        <XLogo />
        Continue with 𝕏
      </Button>

      {emailStage === "hidden" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setEmailStage("address")}
          className="flex w-full items-center justify-center gap-2 py-1 text-center text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300 disabled:opacity-45"
        >
          <EmailLogo />
          Use my email instead
        </button>
      ) : null}

      {emailStage === "address" ? (
        <form onSubmit={sendCode} className="flex gap-2">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-full border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
          />
          <Button type="submit" variant="ghost" disabled={busy || !email}>
            {sending ? <Spinner /> : null}
            Send code
          </Button>
        </form>
      ) : null}

      {emailStage === "code" ? (
        <form onSubmit={verifyCode} className="space-y-2">
          <p className="text-xs text-mist-500">
            We sent a code to <span className="text-mist-300">{email}</span>.
          </p>
          <div className="flex gap-2">
            <input
              // Not type="number": leading zeros matter and phones show the wrong keypad.
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="tabular min-w-0 flex-1 rounded-full border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
            />
            <Button type="submit" disabled={busy || !code}>
              {isConnecting ? <Spinner /> : null}
              Sign in
            </Button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCode("");
              setEmailStage("address");
            }}
            className="text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300 disabled:opacity-45"
          >
            Use a different email
          </button>
        </form>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
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

function EmailLogo() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0 fill-none stroke-current"
      strokeWidth="1.8"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
