"use client";

import { Card } from "@/components/ui";
import {
  formatAvax,
  MIN_ACTION_AVAX,
  type FundsGate as FundsGateState,
} from "@/lib/funds";

const FAUCET_URL = "https://core.app/tools/testnet-faucet/";

/**
 * What someone below the 0.005 AVAX requirement sees instead of a dead button.
 *
 * Says the three things that matter: how much is needed, exactly which address to
 * fund, and where the faucet is — then keeps checking on its own so the moment the
 * drip lands, the notice disappears and the button wakes up without a reload.
 */
export function FundsNotice({ funds }: { funds: FundsGateState }) {
  if (funds.loading || funds.ok) return null;

  return (
    <Card className="space-y-3 border-amber-500/30 bg-amber-500/5">
      <p className="text-sm font-semibold">
        You need {MIN_ACTION_AVAX} AVAX on Fuji to do this
      </p>
      <p className="text-xs leading-relaxed text-mist-500">
        This pays the tiny gas fee on each transaction you sign — fractions of a cent
        on Fuji, so 0.005 lasts a very long time. Grab free testnet AVAX from the{" "}
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
