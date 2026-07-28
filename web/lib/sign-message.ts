/**
 * The exact text an advocate signs to register an activity.
 *
 * Deliberately in its own module with no server-only guard: the browser builds this to
 * sign it and the server rebuilds it to check the signature, and those two strings have
 * to be byte-identical. One shared function is the only way to guarantee that — two
 * copies drift the moment either side is edited.
 *
 * Everything the signature is meant to protect has to appear here. A field left out
 * could be swapped after signing and the signature would still verify.
 *
 * Readable rather than a hash, because a wallet shows this to a person, and "sign this
 * opaque blob" is how people get robbed.
 */
export function activityMessage(p: {
  orgId: string;
  advocate: string;
  engagementTypeId: string;
  proofUrl?: string;
  ts: number;
}): string {
  return [
    "Ubu-Tangaza — register an activity",
    "",
    `Business:   ${p.orgId}`,
    `Account:    ${p.advocate.toLowerCase()}`,
    `Engagement: ${p.engagementTypeId}`,
    `Proof:      ${p.proofUrl?.trim() || "(none)"}`,
    `Signed at:  ${new Date(p.ts).toISOString()}`,
  ].join("\n");
}
