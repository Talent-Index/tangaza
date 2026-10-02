import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DAYS_AHEAD,
  bookableDays,
  formatSlot,
  isBookableSlot,
  slotsForDay,
} from "@/lib/booking";
import { countUpcomingForContact, createBooking, listTakenSlots } from "@/lib/bookings-store";

export const dynamic = "force-dynamic";

/** Slot starts that are already taken, for the days the page can offer. */
export async function GET() {
  try {
    const days = bookableDays();
    const first = slotsForDay(days[0])[0];
    const last = slotsForDay(days[days.length - 1]).at(-1)!;
    const taken = await listTakenSlots(first, new Date(new Date(last).getTime() + 1).toISOString());
    return NextResponse.json(
      { taken, daysAhead: DAYS_AHEAD },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[bookings:GET]", err);
    return NextResponse.json({ error: "Could not load availability" }, { status: 500 });
  }
}

const body = z.object({
  slot: z.string().min(10, "Pick a day and a time first.").max(40),
  name: z.string().trim().min(1, "Your name is required").max(120),
  business: z.string().trim().min(1, "Your business name is required").max(160),
  contact: z
    .string()
    .trim()
    .min(6, "Enter a phone or WhatsApp number we can reach you on")
    .max(40)
    .regex(/^[\d\s+().-]+$/, "Phone can only include digits and + ( ) . -"),
  email: z.union([z.string().trim().email("Enter a valid email").max(160), z.literal("")]).optional(),
  notes: z.string().trim().max(600).optional(),
  // Honeypot: real people never see or fill this.
  website: z.string().max(0, "Invalid request").optional(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const slotIso = new Date(b.slot).toISOString();
  if (!isBookableSlot(slotIso)) {
    return NextResponse.json(
      { error: "That time isn't available. Please pick another." },
      { status: 400 }
    );
  }

  try {
    if ((await countUpcomingForContact(b.contact)) >= 3) {
      return NextResponse.json(
        { error: "You already have upcoming sessions booked. Please contact us to change them." },
        { status: 429 }
      );
    }

    const id = await createBooking({
      slotStart: slotIso,
      name: b.name,
      business: b.business,
      contact: b.contact,
      email: b.email || undefined,
      notes: b.notes || undefined,
    });
    if (!id) {
      return NextResponse.json(
        { error: "Someone just took that time. Please pick another." },
        { status: 409 }
      );
    }

    // Best-effort heads-up in the sheet the waitlist already writes to, so a booking
    // is seen without anyone having to query the database. Never fails the booking.
    const sheet = process.env.GOOGLE_SHEETS_WAITLIST_URL?.trim();
    if (sheet) {
      fetch(sheet, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          name: `[BOOKING ${formatSlot(slotIso)}] ${b.name} · ${b.business}`,
          email: b.email || "",
          phone: b.contact,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, id, slot: slotIso }, { status: 201 });
  } catch (err) {
    console.error("[bookings:POST]", err);
    return NextResponse.json({ error: "Could not save your booking. Please try again." }, { status: 500 });
  }
}
