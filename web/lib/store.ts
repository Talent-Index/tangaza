import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PendingActivity, PendingStatus } from "./types";

/**
 * The off-chain half of Tangaza: the queue of submitted-but-not-yet-approved
 * activities. Proof lives here; the org's approval is what goes on-chain.
 *
 * A JSON file is deliberate for the jam — no native deps, no migrations, and the
 * whole queue is inspectable with `cat`. Swap for SQLite/Postgres for production;
 * every caller goes through the functions below, so the surface to change is small.
 */

const DB_PATH = process.env.TANGAZA_DB_PATH ?? join(process.cwd(), "data", "activities.json");

interface Db {
  activities: PendingActivity[];
}

function read(): Db {
  if (!existsSync(DB_PATH)) return { activities: [] };
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as Partial<Db>;
    return { activities: parsed.activities ?? [] };
  } catch {
    // A truncated file should not take the demo down.
    console.error(`[tangaza] ${DB_PATH} is unreadable; starting from an empty queue`);
    return { activities: [] };
  }
}

function write(db: Db) {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  // Write-then-rename so a crash mid-write cannot leave a half-written queue.
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2) + "\n");
  renameSync(tmp, DB_PATH);
}

export interface CreateActivityInput {
  orgId: string;
  advocate: string;
  advocateLabel?: string;
  activityType: number;
  proofUrl: string;
  note?: string;
}

export function createActivity(input: CreateActivityInput): PendingActivity {
  const db = read();
  const activity: PendingActivity = {
    id: randomUUID(),
    orgId: input.orgId,
    advocate: input.advocate.toLowerCase(),
    advocateLabel: input.advocateLabel,
    activityType: input.activityType,
    proofUrl: input.proofUrl,
    note: input.note,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };
  db.activities.unshift(activity);
  write(db);
  return activity;
}

export function listActivities(filter: {
  orgId?: string;
  advocate?: string;
  status?: PendingStatus;
}): PendingActivity[] {
  const { activities } = read();
  const advocate = filter.advocate?.toLowerCase();

  return activities.filter(
    (a) =>
      (!filter.orgId || a.orgId === filter.orgId) &&
      (!advocate || a.advocate === advocate) &&
      (!filter.status || a.status === filter.status)
  );
}

export function getActivity(id: string): PendingActivity | undefined {
  return read().activities.find((a) => a.id === id);
}

export interface DecideActivityInput {
  id: string;
  status: Exclude<PendingStatus, "pending">;
  txHash?: string;
  rejectionReason?: string;
}

/**
 * Called after the on-chain approval tx confirms (or when the org rejects).
 * Returns undefined when the id is unknown.
 */
export function decideActivity(input: DecideActivityInput): PendingActivity | undefined {
  const db = read();
  const activity = db.activities.find((a) => a.id === input.id);
  if (!activity) return undefined;

  activity.status = input.status;
  activity.decidedAt = new Date().toISOString();
  if (input.txHash) activity.txHash = input.txHash;
  if (input.rejectionReason) activity.rejectionReason = input.rejectionReason;

  write(db);
  return activity;
}
