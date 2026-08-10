/**
 * Names from the sign-in provider (thirdweb profiles).
 *
 * Google / email login expose an email, not a display name. We turn the local part
 * into something a business can read ("dan.mwangi@…" → "Dan Mwangi"). Wallet
 * nicknames like "Wafula" live in format.advocateName and must never be persisted
 * as if the person chose them.
 */

type ProfileLike = {
  details?: {
    email?: string;
    name?: string;
  } | null;
};

/** Pretty-print an email local-part for CRM / approvals. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "";
  return local
    .split(/[._+\-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Best name the connected login itself exposes — never a wallet pseudonym.
 * Returns undefined when the provider gave us nothing useful (common for X-only).
 */
export function credentialNameFromProfiles(
  profiles: ProfileLike[] | undefined | null
): string | undefined {
  if (!profiles?.length) return undefined;

  for (const p of profiles) {
    const name = p.details?.name?.trim();
    if (name) return name.slice(0, 60);
  }

  for (const p of profiles) {
    const email = p.details?.email?.trim();
    if (email) {
      const fromEmail = nameFromEmail(email);
      if (fromEmail) return fromEmail.slice(0, 60);
    }
  }

  return undefined;
}
