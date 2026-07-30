import "server-only";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { TANGAZA_ABI } from "./abi";
import { CONTRACT_ADDRESS } from "./client";

/**
 * Registers a business on-chain the moment it signs its pledge.
 *
 * `registerOrg` is `onlyOwner` on the contract, and that is deliberate: registering an
 * org mints the right to issue reward liabilities against a cap nobody can later raise,
 * so it cannot be open to anyone with a wallet. For a while that meant a signed pledge
 * landed in Postgres and stopped there, waiting for an operator to run a hardhat
 * script — from where the business stood, they signed something and nothing happened.
 *
 * The owner key lives here, server-side, and is never bundled: no `NEXT_PUBLIC_`
 * prefix, and `server-only` makes importing this from a client component a build error
 * rather than a leak. The contract's guarantee is unchanged — only the platform can
 * register — but the platform now answers in one request instead of one working day.
 *
 * Unconfigured is a supported state, not a failure. With no key the route falls back to
 * the manual queue on /admin exactly as before, so nothing breaks in a checkout that
 * hasn't been given one.
 */

const OWNER_KEY = process.env.PLATFORM_OWNER_KEY ?? "";
const RPC_URL = process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";

const ORG_REGISTERED = parseAbiItem(
  "event OrgRegistered(uint256 indexed orgId, string name, address indexed approver, uint256 emissionCapKES)"
);

/** Whether instant registration is available in this deployment. */
export function canAutoRegister(): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(OWNER_KEY) && Boolean(CONTRACT_ADDRESS);
}

export type RegistrationResult = { orgId: string; txHash: string };

/**
 * Calls registerOrg and reads the orgId back out of the receipt.
 *
 * The id comes from the `OrgRegistered` log rather than from `orgCount()` after the
 * fact: two businesses signing at once would both read the same count and the second
 * would be recorded against the first's org.
 */
export async function registerOrgOnChain(p: {
  name: string;
  approverAddress: string;
  emissionCapKes: number;
}): Promise<RegistrationResult> {
  if (!canAutoRegister()) {
    throw new Error("Instant registration is not configured on this deployment");
  }

  const account = privateKeyToAccount(OWNER_KEY as `0x${string}`);
  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport });
  const wallet = createWalletClient({ account, chain: avalancheFuji, transport });

  /**
   * Explicit gas, for the same reason contracts/scripts/deploy.ts sets it: Fuji's RPC
   * will not estimate against the pending tag, and left to guess, viem produced a limit
   * of ~7.1e13 — orders of magnitude past the block cap — which the node rejected at
   * eth_sendRawTransaction with a bare "missing or invalid parameters". registerOrg
   * writes one struct and emits one event; 400k is generous and you pay only what's used.
   */
  const txHash = await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: TANGAZA_ABI,
    functionName: "registerOrg",
    args: [p.name, p.approverAddress as `0x${string}`, BigInt(Math.floor(p.emissionCapKes))],
    gas: 400_000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });
  if (receipt.status !== "success") {
    throw new Error("registerOrg reverted on Avalanche");
  }

  const logs = parseEventLogs({ abi: [ORG_REGISTERED], logs: receipt.logs }).filter(
    (l) => l.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
  );
  const orgId = logs[0]?.args.orgId;
  if (orgId === undefined) {
    throw new Error("registerOrg mined but emitted no OrgRegistered log");
  }

  return { orgId: String(orgId), txHash };
}
