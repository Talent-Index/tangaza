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
 * Social login -> embedded self-custodial EOA. No seed phrase, and no smart account.
 *
 * There WAS a smart account here — `smartAccount: { chain, sponsorGas: true }` — and
 * it is gone for an empirical reason, not a stylistic one: thirdweb's Fuji bundler
 * accepts sponsored userOps and then never mines them. Measured directly (2026-07-30,
 * headless, production client id, Origin set): gas estimation OK, paymaster signs,
 * eth_sendUserOperation returns a hash, and the op is still unmined minutes later.
 * Every stuck "Sending…", every AA25 lockout, every timeout this app has fought — and
 * the fact that not one smart-account submission has ever reached the contract — was
 * this. A plain transaction on Fuji mines in ~2 seconds.
 *
 * So every path is now bundler-free. The embedded key signs silently (no popup, no
 * seed phrase — that story survives) and pays its own gas from the 0.005 AVAX the
 * funds gate already requires. If sponsorship ever comes back, this is the one place
 * to restore it — and check the approver addresses before you do; see the note below.
 */
export const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "x", "email"],
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
