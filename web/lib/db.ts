import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Neon over HTTP rather than a pooled TCP client.
 *
 * The API routes run as Vercel serverless functions: each invocation is its own
 * short-lived process, so a connection pool has nothing to pool and a few hundred
 * concurrent invocations would exhaust Postgres' connection limit. The HTTP driver
 * makes one stateless request per query, which is the right shape for that.
 *
 * DATABASE_URL is deliberately not NEXT_PUBLIC_ — that prefix inlines a value into the
 * browser bundle, and this one is a database password.
 */
const url = process.env.DATABASE_URL;

if (!url) {
  console.warn(
    "[ubu-tangaza] DATABASE_URL is not set — the activity queue will fail. See web/.env.example"
  );
}

export const sql = neon(url ?? "postgresql://unset");

export const isDbConfigured = Boolean(url);
