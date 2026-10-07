import "server-only";
import { sql } from "./db";

/**
 * Created on first use. Migrations on this project are applied by hand against
 * production, and a booking page that 500s until someone remembers to run one is a
 * worse failure than a CREATE TABLE IF NOT EXISTS the first time it's needed.
 * The same SQL lives in db/016_bookings.sql.
 */
let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= (async () => {
    await sql`
      create table if not exists bookings (
        id          uuid        primary key default gen_random_uuid(),
        slot_start  timestamptz not null unique,
        name        text        not null,
        business    text        not null,
        contact     text        not null,
        email       text,
        notes       text,
        status      text        not null default 'requested',
        created_at  timestamptz not null default now()
      )`;
  })().catch((err) => {
    ready = null; // let the next request retry
    throw err;
  });
  return ready;
}

/**
 * The optional goal column arrived after the table did (db/018_booking_goal.sql). Same
 * lazy approach, but kept separate so a failed ALTER (e.g. the app's role can't alter
 * tables) never stops a booking: createBooking falls back to putting the goal in notes.
 */
let goalReady: Promise<void> | null = null;
function ensureGoalColumn(): Promise<void> {
  goalReady ??= (async () => {
    await ensureTable();
    const have = (await sql`
      select 1 as one from information_schema.columns
      where table_schema = current_schema() and table_name = 'bookings' and column_name = 'goal'`) as unknown[];
    if (have.length === 0) await sql`alter table bookings add column if not exists goal text`;
  })().catch((err) => {
    goalReady = null; // let the next request retry
    throw err;
  });
  return goalReady;
}

/** Slot starts already taken in a window. Times only — no personal details. */
export async function listTakenSlots(fromIso: string, toIso: string): Promise<string[]> {
  await ensureTable();
  const rows = (await sql`
    select slot_start from bookings
    where slot_start >= ${fromIso} and slot_start < ${toIso}
      and status <> 'cancelled'
    order by slot_start`) as Array<{ slot_start: string | Date }>;
  return rows.map((r) => new Date(r.slot_start).toISOString());
}

/** How many upcoming sessions one contact already holds (cheap abuse guard). */
export async function countUpcomingForContact(contact: string): Promise<number> {
  await ensureTable();
  const rows = (await sql`
    select count(*)::int as n from bookings
    where lower(contact) = lower(${contact}) and slot_start > now() and status <> 'cancelled'`) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

export interface NewBooking {
  slotStart: string;
  name: string;
  business: string;
  contact: string;
  email?: string;
  notes?: string;
  goal?: string;
}

/** Returns the new id, or null if someone else took the slot first. */
export async function createBooking(b: NewBooking): Promise<string | null> {
  await ensureTable();
  let hasGoalColumn = false;
  if (b.goal) {
    try {
      await ensureGoalColumn();
      hasGoalColumn = true;
    } catch (err) {
      console.error("[bookings] goal column unavailable, keeping the goal in notes", err);
    }
  }

  // Without the column the goal still reaches us, as a prefix on the notes.
  const goal = hasGoalColumn ? (b.goal ?? null) : null;
  const notes = !hasGoalColumn && b.goal ? `Goal: ${b.goal}${b.notes ? `\n${b.notes}` : ""}` : (b.notes ?? null);

  const rows = (hasGoalColumn
    ? await sql`
        insert into bookings (slot_start, name, business, contact, email, notes, goal)
        values (${b.slotStart}, ${b.name}, ${b.business}, ${b.contact}, ${b.email ?? null}, ${notes}, ${goal})
        on conflict (slot_start) do nothing
        returning id`
    : await sql`
        insert into bookings (slot_start, name, business, contact, email, notes)
        values (${b.slotStart}, ${b.name}, ${b.business}, ${b.contact}, ${b.email ?? null}, ${notes})
        on conflict (slot_start) do nothing
        returning id`) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}
