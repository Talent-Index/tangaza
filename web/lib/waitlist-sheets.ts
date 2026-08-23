import "server-only";

export type WaitlistEntry = {
  name: string;
  email: string;
  phone: string;
};

/**
 * Appends a row via a Google Apps Script web-app URL bound to your sheet.
 *
 * Apps Script (paste in Extensions → Apps Script on your sheet):
 *
 * function doPost(e) {
 *   const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *   const row = JSON.parse(e.postData.contents);
 *   sheet.appendRow([row.timestamp, row.name, row.email, row.phone]);
 *   return ContentService.createTextOutput(JSON.stringify({ ok: true }))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 *
 * Deploy as web app: Execute as Me, access Anyone. Use the /exec URL in env.
 */
export async function appendWaitlistToSheet(entry: WaitlistEntry): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WAITLIST_URL?.trim();
  if (!url) {
    throw new Error("Waitlist is not configured on this deployment");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Could not save to Google Sheet (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }
}
