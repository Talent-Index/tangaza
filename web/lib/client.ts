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
 * Bring-your-own browser wallets, for people who already have one.
 *
 * Core is Avalanche's own, and does seedless accounts from social logins on its side,
 * so "sign in with Google" and "use my Core wallet" can be the same person on
 * different days. MetaMask is what most people arrive already holding.
 *
 * Both are discovered over EIP-6963 rather than by sniffing `window.ethereum`, which
 * is the only way to tell two extensions apart when both are installed.
 */
export const coreWallet = createWallet("app.core.extension");
export const metamaskWallet = createWallet("io.metamask");

/** The bring-your-own options the sign-in screen offers, in display order. */
export const externalWallets = [coreWallet, metamaskWallet];

/**
 * Wraps any non-smart wallet — Core's EOA, MetaMask's — in an ERC-4337 smart account
 * with sponsored gas, so a browser-wallet user gets the same no-AVAX experience as
 * somebody who signed in with Google. thirdweb's connection manager checks
 * isSmartWallet() first, so the in-app wallet — already a smart account by
 * construction — is never double-wrapped by this.
 *
 * This has to be handed to *every* entry point that establishes a connection —
 * `useConnect` and `<AutoConnect />` both. Exporting it is not enough: it was exported
 * and passed nowhere, which quietly connected Core as a bare EOA paying its own gas,
 * with a comment here insisting otherwise.
 *
 * Note the address a person gets is the smart account's, not their wallet's. Two
 * different people as far as the contract is concerned — see README on re-registering
 * an org's approver after changing this.
 */
export const accountAbstraction = {
  chain: CHAIN,
  sponsorGas: true,
};
