import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendWaitlistToSheet } from "@/lib/waitlist-sheets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(160),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(40)
    .regex(/^[\d\s+().-]+$/, "Phone can only include digits and + ( ) . -"),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!process.env.GOOGLE_SHEETS_WAITLIST_URL?.trim()) {
    return NextResponse.json(
      { error: "Waitlist is not configured yet. Try again later." },
      { status: 503 }
    );
  }

  try {
    await appendWaitlistToSheet(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[waitlist]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save your details" },
      { status: 500 }
    );
  }
}
