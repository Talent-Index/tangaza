/**
 * Setup-session scheduling rules, shared by the booking page and the API so the two
 * can never disagree about what a valid slot is.
 *
 * Everything is defined in East Africa Time (UTC+3, no daylight saving) and stored as
 * UTC instants. Change the constants below to change availability.
 */
export const EAT_OFFSET_MIN = 180;
export const SESSION_MINUTES = 30;
export const OPEN_HOUR = 9; // first slot starts 09:00 EAT
export const CLOSE_HOUR = 17; // last slot ends 17:00 EAT
export const DAYS_AHEAD = 14;
export const LEAD_MINUTES = 120; // can't book something starting in under 2 hours
export const CLOSED_WEEKDAYS = [0]; // Sunday

const MIN = 60_000;

/** The EAT wall-clock parts of an instant. */
export function eatParts(d: Date) {
  const t = new Date(d.getTime() + EAT_OFFSET_MIN * MIN);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    min: t.getUTCMinutes(),
    weekday: t.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (p: { y: number; m: number; d: number }) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;

/** UTC instant for an EAT date + time. */
function eatToUtc(y: number, m: number, d: number, h: number, min: number) {
  return new Date(Date.UTC(y, m - 1, d, h, min) - EAT_OFFSET_MIN * MIN);
}

/** Every slot start on one EAT calendar day, as ISO strings. */
export function slotsForDay(day: string): string[] {
  const [y, m, d] = day.split("-").map(Number);
  const out: string[] = [];
  for (let mins = OPEN_HOUR * 60; mins + SESSION_MINUTES <= CLOSE_HOUR * 60; mins += SESSION_MINUTES) {
    out.push(eatToUtc(y, m, d, Math.floor(mins / 60), mins % 60).toISOString());
  }
  return out;
}

/** Bookable EAT calendar days starting today, skipping closed weekdays. */
export function bookableDays(now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const p = eatParts(new Date(now.getTime() + i * 24 * 60 * MIN));
    if (CLOSED_WEEKDAYS.includes(p.weekday)) continue;
    out.push(ymd(p));
  }
  return out;
}

/** Is this ISO instant exactly on the grid, on an open day, in range and not too soon? */
export function isBookableSlot(iso: string, now = new Date()): boolean {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return false;
  if (t.getTime() < now.getTime() + LEAD_MINUTES * MIN) return false;
  const day = ymd(eatParts(t));
  if (!bookableDays(now).includes(day)) return false;
  return slotsForDay(day).includes(t.toISOString());
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { weekday: WEEKDAYS[wd], date: d, month: MONTHS[m - 1] };
}

export function formatTime(iso: string) {
  const p = eatParts(new Date(iso));
  return `${pad(p.h)}:${pad(p.min)}`;
}

export function formatSlot(iso: string) {
  const p = eatParts(new Date(iso));
  return `${WEEKDAYS[p.weekday]} ${p.d} ${MONTHS[p.m - 1]} · ${formatTime(iso)} EAT`;
}

/** A calendar file for the requested session (client-side download). */
export function buildIcs(iso: string, summary: string, description: string) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(iso);
  const end = new Date(start.getTime() + SESSION_MINUTES * MIN);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ubu-Tangaza//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${fmt(start)}@ubutangaza.biz`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
