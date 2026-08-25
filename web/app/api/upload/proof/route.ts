import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/lib/upload";

/**
 * Image proof for an activity — a photo of a receipt, the items bought, a visit.
 * The advocate uploads it here; we return a URL that gets stored as the submission's
 * proof, and the business opens it from the approval queue.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const result = await uploadImage(form.get("file"), "proofs");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
