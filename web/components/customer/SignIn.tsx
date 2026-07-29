"use client";

import { useState } from "react";
import { useConnect } from "thirdweb/react";
import { preAuthenticate } from "thirdweb/wallets/in-app";
import { CHAIN } from "@/lib/chain";
import { client, wallets } from "@/lib/client";
import { Button, ErrorNote, Spinner } from "@/components/ui";

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

  // Email is a two-step OTP, so it needs somewhere to live. Google and X are one tap.
  const [emailStage, setEmailStage] = useState<"hidden" | "address" | "code">("hidden");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const busy = isConnecting || sending;
  const error = emailError ?? connectError?.message ?? null;

  /**
   * `connect` wants a thunk that returns a connected wallet. `wallets[0]` is the
   * configured in-app wallet, so connecting it here is what applies the smart-account
   * + sponsored-gas wrapper from lib/client.ts.
   */
  const connectWith = (options: Parameters<(typeof wallets)[0]["connect"]>[0]) =>
    connect(async () => {
      const wallet = wallets[0];
      await wallet.connect(options);
      return wallet;
    });

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setSending(true);
    try {
      await preAuthenticate({ client, strategy: "email", email });
      setEmailStage("code");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Could not send that code.");
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
        {isConnecting ? <Spinner /> : null}
        Continue with Google
      </Button>

      <Button
        variant="ghost"
        className="w-full"
        disabled={busy}
        onClick={() => void connectWith({ client, chain: CHAIN, strategy: "x" })}
      >
        Continue with 𝕏
      </Button>

      {emailStage === "hidden" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setEmailStage("address")}
          className="w-full py-1 text-center text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300 disabled:opacity-45"
        >
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
