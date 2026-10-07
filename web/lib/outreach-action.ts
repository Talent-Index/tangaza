import type { SigningAccount } from "./org-action";

/**
 * Authorising the platform-owner outreach console with the owner's wallet.
 *
 * Same scheme as lib/org-action.ts (sign a short canonical message, the server verifies
 * it ERC-1271/6492-aware), but the signer must be the contract *owner* rather than an
 * org's approver. The console shows business contact details and can start an agent
 * run, so it is not something a hidden URL or a shared password should protect.
 *
 * Isomorphic: the browser builds this to sign and the server rebuilds it to verify, so
 * keep it byte-identical on both sides and free of anything server-only.
 */

export const OUTREACH_ACTIONS = {
  read: "outreach.read",
  run: "outreach.run",
} as const;

export type OutreachAction = (typeof OUTREACH_ACTIONS)[keyof typeof OUTREACH_ACTIONS];

export function outreachActionMessage(p: { address: string; action: string; ts: number }): string {
  return [
    "Ubu-Tangaza — platform owner action",
    "",
    `Owner:     ${p.address.toLowerCase()}`,
    `Action:    ${p.action}`,
    `Signed at: ${new Date(p.ts).toISOString()}`,
  ].join("\n");
}

export interface OutreachAuth {
  address: string;
  ts: number;
  signature: string;
}

/** Sign an owner action in the browser; returns the fields to send with the request. */
export async function signOutreachAction(
  account: SigningAccount,
  action: OutreachAction
): Promise<OutreachAuth> {
  const ts = Date.now();
  const address = account.address;
  const signature = await account.signMessage({
    message: outreachActionMessage({ address, action, ts }),
  });
  return { address, ts, signature };
}
