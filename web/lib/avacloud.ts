import { CONTRACT_ADDRESS } from "./client";

/**
 * AvaCloud Data API (developers.avacloud.io) — Avalanche's own indexed view of the
 * chain, and the answer to a fragility we kept paying for: reading events by scanning
 * eth_getLogs block windows means O(chain-age) sequential RPC calls, a 1000-block
 * range cap on the public RPC, and total dependence on whichever indexer fronts it.
 *
 * The Data API instead returns the contract's transactions already indexed — one
 * paginated call, keyless on Fuji, CORS open, so it works straight from the browser.
 * From those tx hashes we fetch receipts (a bounded set: one per transaction that ever
 * touched the contract) and decode the logs ourselves. Work scales with the
 * contract's actual activity instead of with time passing.
 *
 * AVACLOUD_API_KEY is optional; set NEXT_PUBLIC_AVACLOUD_API_KEY for production rate
 * limits. Everything here degrades gracefully — callers fall back to window scanning
 * when this path fails, so an AvaCloud outage costs speed, not correctness.
 */

const DATA_API = "https://glacier-api.avax.network/v1";
const API_KEY = process.env.NEXT_PUBLIC_AVACLOUD_API_KEY;

interface NativeTx {
  txHash: string;
  blockNumber: string;
  txStatus: string;
}

/** Every transaction that ever touched the contract, newest first. */
export async function listContractTxHashes(chainId: number): Promise<string[]> {
  const hashes: string[] = [];
  let pageToken: string | undefined;

  // Page cap is a runaway guard, not a truncation you should ever hit at jam scale:
  // 10 pages × 100 txs before this contract needs a real indexer anyway.
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `${DATA_API}/chains/${chainId}/addresses/${CONTRACT_ADDRESS}/transactions?${params}`,
      { headers: API_KEY ? { "x-glacier-api-key": API_KEY } : undefined }
    );
    if (!res.ok) throw new Error(`Data API ${res.status}`);

    const json = (await res.json()) as {
      transactions: Array<{ nativeTransaction: NativeTx }>;
      nextPageToken?: string;
    };

    for (const t of json.transactions) {
      // Failed transactions have no logs worth reading.
      if (t.nativeTransaction.txStatus === "1") {
        hashes.push(t.nativeTransaction.txHash);
      }
    }

    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return hashes;
}
