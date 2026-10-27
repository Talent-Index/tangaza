import "server-only";
import { sql } from "./db";
import { isObviouslyTestFeedback } from "./public-display";

/**
 * Public feedback: left on /feedback, shown on the homepage.
 *
 * Created on first use, same reasoning as lib/bookings-store.ts — migrations here are
 * applied by hand against production, and a feedback form that 500s until someone
 * remembers to run one is a worse failure than a CREATE TABLE IF NOT EXISTS.
 * The same SQL lives in db/020_feedback.sql.
 */
let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= (async () => {
    await sql`
      create table if not exists feedback (
        id          uuid        primary key default gen_random_uuid(),
        name        text,
        message     text        not null,
        hidden      boolean     not null default false,
        created_at  timestamptz not null default now()
      )`;
  })().catch((err) => {
    ready = null; // let the next request retry
    throw err;
  });
  return ready;
}

export interface FeedbackEntry {
  id: string;
  name: string | null;
  message: string;
  createdAt: string;
}

/** The homepage wall: visible entries only, newest first. */
export async function listFeedback(limit = 12): Promise<FeedbackEntry[]> {
  await ensureTable();
  const rows = (await sql`
    select id, name, message, created_at from feedback
    where hidden = false
    order by created_at desc
    limit ${limit}`) as Array<Record<string, unknown>>;
  return rows
    .map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? null,
      message: r.message as string,
      createdAt: new Date(r.created_at as string).toISOString(),
    }))
    .filter((entry) => !isObviouslyTestFeedback(entry));
}

export async function createFeedback(input: { name?: string; message: string }): Promise<FeedbackEntry> {
  await ensureTable();
  const rows = (await sql`
    insert into feedback (name, message)
    values (${input.name?.trim() || null}, ${input.message.trim()})
    returning id, name, message, created_at`) as Array<Record<string, unknown>>;
  const r = rows[0];
  return {
    id: r.id as string,
    name: (r.name as string) ?? null,
    message: r.message as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}
