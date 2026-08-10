"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import {
  formatAvax,
  MIN_ACTION_AVAX,
  type FundsGate as FundsGateState,
} from "@/lib/funds";

const FAUCET_URL = "https://core.app/tools/testnet-faucet/";

type AutoFaucet =
  | { state: "requesting" }
  | { state: "dripped"; amountAvax: string }
  | { state: "manual" };

/**
 * Asks the in-app faucet to top up the acting address, once, the moment the gate
 * shows. "requesting" is the initial state on purpose: most people will never see
 * the manual instructions, so the first paint says "we're setting you up", and only
 * a refusal (faucet off, dry, already funded once) downgrades to the Core-faucet
 * card. The gate's own 6-second polling notices the drip landing; refresh() just
 * shortens the wait.
 */
function useAutoFaucet(funds: FundsGateState): AutoFaucet {
  const [result, setResult] = useState<AutoFaucet>({ state: "requesting" });
  const askedFor = useRef<string | null>(null);

  const address = funds.entries[0]?.address;
  const shouldAsk = !funds.loading && !funds.ok && Boolean(address);

  useEffect(() => {
    if (!shouldAsk || !address || askedFor.current === address) return;
    askedFor.current = address;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/faucet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          amountAvax?: string;
          reason?: string;
        };
        if (cancelled) return;
        if (data.ok) {
          setResult({ state: "dripped", amountAvax: data.amountAvax ?? "" });
          funds.refresh();
        } else {
          setResult({ state: "manual" });
        }
      } catch {
        if (!cancelled) setResult({ state: "manual" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAsk, address]);

  return result;
}

/**
 * What someone below the 0.005 AVAX requirement sees instead of a dead button.
 *
 * First it tries to make the problem disappear: the in-app faucet drips testnet AVAX
 * to the address automatically, and the card just narrates that. Only when no drip is
 * coming does it fall back to saying the three things that matter: how much is
 * needed, exactly which address to fund, and where the faucet is — then keeps
 * checking on its own so the moment AVAX lands, the notice disappears and the button
 * wakes up without a reload.
 */
export function FundsNotice({ funds }: { funds: FundsGateState }) {
  const faucet = useAutoFaucet(funds);

  if (funds.loading || funds.ok) return null;

  if (faucet.state === "requesting" || faucet.state === "dripped") {
    return (
      <Card className="space-y-2">
        <p className="text-sm font-semibold">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-crimson-300 align-middle" />
          {faucet.state === "dripped" ? "Almost there…" : "Setting up your account…"}
        </p>
        <p className="text-xs leading-relaxed text-mist-500">
          {faucet.state === "dripped"
            ? `You've been topped up with ${faucet.amountAvax || "free"} testnet AVAX to cover
               transaction fees. This page updates itself in a moment.`
            : `We're sending you a little free testnet AVAX to cover transaction fees —
               nothing to do on your side, this takes a few seconds.`}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 border-amber-500/30 bg-amber-500/5">
      <p className="text-sm font-semibold">
        You need {MIN_ACTION_AVAX} AVAX on Fuji to do this
      </p>
      <p className="text-xs leading-relaxed text-mist-500">
        This pays the tiny gas fee on each transaction you sign — fractions of a cent
        on Fuji, so {MIN_ACTION_AVAX} lasts a very long time. Grab free testnet AVAX from the{" "}
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-crimson-300 underline underline-offset-4 hover:text-crimson-400"
        >
          Core faucet
        </a>{" "}
        (pick <span className="text-mist-300">Avalanche Fuji C-Chain</span>) and send it
        to {funds.entries.length > 1 ? "either address below" : "this address"}. This
        page re-checks by itself.
      </p>
      <ul className="space-y-2">
        {funds.entries.map((entry) => (
          <li
            key={entry.address}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-[0.12em] text-mist-500">
                {entry.label}
              </span>
              <code className="tabular block truncate text-xs text-mist-300">
                {entry.address}
              </code>
            </span>
            <span className="tabular shrink-0 text-xs text-mist-400">
              {formatAvax(entry.wei)} AVAX
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
