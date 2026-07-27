import { createThirdwebClient, getContract } from "thirdweb";
import { inAppWallet } from "thirdweb/wallets";
import { CHAIN } from "./chain";
import { TANGAZA_ABI } from "./abi";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  // Loud at boot rather than a confusing 401 on the first read.
  console.warn(
    "[tangaza] NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set — copy web/.env.example to web/.env.local"
  );
}

// A placeholder keeps `next build` working on a fresh clone with no .env.local —
// every screen checks `isConfigured` and shows the setup notice instead of calling out.
export const client = createThirdwebClient({
  clientId: clientId || "tangaza-unconfigured",
});

const ZERO = "0x0000000000000000000000000000000000000000";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "") as `0x${string}`;

export const isConfigured = Boolean(clientId && CONTRACT_ADDRESS);

// Falls back to the zero address so an unconfigured checkout still builds and
// renders the "not configured yet" notice instead of crashing at import time.
export const contract = getContract({
  client,
  chain: CHAIN,
  address: (CONTRACT_ADDRESS || ZERO) as `0x${string}`,
  abi: TANGAZA_ABI,
});

/**
 * Social login -> embedded self-custodial wallet -> ERC-4337 smart account with
 * sponsored gas. The user never sees a seed phrase and never holds AVAX.
 */
export const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "x", "email"],
    },
    smartAccount: {
      chain: CHAIN,
      sponsorGas: true,
    },
  }),
];
