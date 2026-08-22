/**
 * Authorising an off-chain business mutation with the approver's wallet.
 *
 * Campaign/level/engagement writes never touch the chain, so the contract's
 * `onlyApprover` gate cannot protect them — anyone who knew an orgId could POST.
 * Instead the approver signs a short canonical message and the server verifies both
 * that the signature is theirs (ERC-1271/6492, via verifySignedText) and that the
 * signer is the org's registered approver.
 *
 * Isomorphic: the browser builds this to sign and the server rebuilds it to verify,
 * so it must be byte-identical on both sides — keep it free of anything server-only.
 */

export const ORG_ACTIONS = {
  campaignSave: "campaign.save",
  campaignDelete: "campaign.delete",
  tierSave: "tier.save",
  tierDelete: "tier.delete",
  engagementSave: "engagement.save",
  engagementRetire: "engagement.retire",
} as const;

export type OrgAction = (typeof ORG_ACTIONS)[keyof typeof ORG_ACTIONS];

export function orgActionMessage(p: {
  orgId: string;
  address: string;
  action: string;
  ts: number;
}): string {
  return [
    "Ubu-Tangaza — approver action",
    "",
    `Org:       ${p.orgId}`,
    `Approver:  ${p.address.toLowerCase()}`,
    `Action:    ${p.action}`,
    `Signed at: ${new Date(p.ts).toISOString()}`,
  ].join("\n");
}

export interface OrgAuth {
  address: string;
  ts: number;
  signature: string;
}

/**
 * A thirdweb account, structurally typed so this module stays free of a thirdweb
 * import (the server rebuilds the message from the same file).
 */
export interface SigningAccount {
  address: string;
  signMessage: (args: { message: string }) => Promise<string>;
}

/** Sign an approver action in the browser; returns the fields to send with the request. */
export async function signOrgAction(
  account: SigningAccount,
  orgId: bigint | string,
  action: OrgAction
): Promise<OrgAuth> {
  const ts = Date.now();
  const address = account.address;
  const signature = await account.signMessage({
    message: orgActionMessage({ orgId: String(orgId), address, action, ts }),
  });
  return { address, ts, signature };
}
