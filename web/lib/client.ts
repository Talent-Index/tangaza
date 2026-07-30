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
 * Browser wallets are deliberately NOT wrapped in a smart account.
 *
 * They were, briefly — an `accountAbstraction` option handed to every connection made
 * Core and MetaMask the admin key of a sponsored ERC-4337 account. It kept the no-AVAX
 * story uniform, and it made the product lie about who was acting: the address on
 * screen wasn't the user's wallet, the wallet never showed a plain transaction, and an
 * approver who funded their own address had funded the wrong account.
 *
 * The model now matches what a wallet owner expects: connect Core or MetaMask and you
 * ARE that address. Every submit and approve is an ordinary transaction — the
 * extension pops, you sign, gas comes out of your balance, msg.sender is you, and the
 * hash on Snowtrace is yours. The in-app wallet keeps its own smart-account +
 * sponsored-gas config above, because a Google user has no extension to pop and no way
 * to hold gas.
 *
 * If this flips again, remember the sharp edge both directions: the contract's
 * registered approver must match the address the connection actually produces, or
 * every approval reverts NotApprover.
 */
