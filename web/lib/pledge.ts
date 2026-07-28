/**
 * The text a business signs when it applies.
 *
 * Shared, unguarded, isomorphic — the browser builds this to sign and the server
 * rebuilds it to verify, and the two must be byte-identical.
 *
 * It reads as a commitment rather than a form submission because that is what it is:
 * the emission cap is written once at registration and no function in the contract can
 * raise it afterwards. Signing this is the business saying, in a way it cannot later
 * deny, what it is putting up and what it will give back.
 */
export function pledgeMessage(p: {
  name: string;
  approverAddress: string;
  emissionCapKes: number;
  pledge: string;
  ts: number;
}): string {
  return [
    "Ubu-Tangaza — business pledge",
    "",
    `Business:  ${p.name}`,
    `Approver:  ${p.approverAddress.toLowerCase()}`,
    `Budget:    KES ${p.emissionCapKes.toLocaleString("en-KE")}`,
    "",
    "We commit to the community:",
    p.pledge,
    "",
    "This budget is written once on Avalanche and can never be raised.",
    `Signed at: ${new Date(p.ts).toISOString()}`,
  ].join("\n");
}
