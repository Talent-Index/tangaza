import { createThirdwebClient, getContract } from "thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { CHAIN } from "./chain";
import { TANGAZA_ABI } from "./abi";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  // Loud at boot rather than a confusing 401 on the first read.
  console.warn(
    "[ubu-tangaza] NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set — copy web/.env.example to web/.env.local"
  );
}

// A placeholder keeps `next build` working on a fresh clone with no .env.local —
// every screen checks `isConfigured` and shows the setup notice instead of calling out.
export const client = createThirdwebClient({
  clientId: clientId || "ubu-tangaza-unconfigured",
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

/**
 * Avalanche's own wallet, as a bring-your-own option. Core does seedless accounts
 * from social logins on its side, so "sign in with Google" and "use my Core wallet"
 * can be the same person on different days.
 */
export const coreWallet = createWallet("app.core.extension");

/**
 * Wraps any non-smart wallet (i.e. Core's EOA) in an ERC-4337 smart account with
 * sponsored gas, so a Core user gets the same no-AVAX experience as everyone else.
 * thirdweb's connection manager checks isSmartWallet() first, so the in-app wallet —
 * already a smart account by construction — is never double-wrapped by this.
 */
export const accountAbstraction = {
  chain: CHAIN,
  sponsorGas: true,
};
