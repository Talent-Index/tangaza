/** Who the person said they were on the sign-in page. */
export type AuthRole = "ambassador" | "business";

/** Survives the full-page Google / X redirect. React state does not. */
export const AUTH_ROLE_KEY = "ubu-auth-role";

/**
 * Set when a sign-in button is pressed, cleared once we have sent them on.
 * An already-signed-in visit to /auth must not bounce them before they can
 * choose Business.
 */
export const AUTH_PENDING_KEY = "ubu-auth-pending";

export function parseAuthRole(value: string | null): AuthRole {
  return value === "business" ? "business" : "ambassador";
}

/** Where a finished sign-in should land. */
export function destinationFor(role: AuthRole): "/org/overview" | "/" {
  return role === "business" ? "/org/overview" : "/";
}
