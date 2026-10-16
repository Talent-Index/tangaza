import "server-only";
import { ImapFlow } from "imapflow";
import { createTransport, type Transporter } from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { notionHeaders, type OutreachRow } from "./outreach";

/**
 * Sending an outreach draft — the only place in the app that sends email, and it only
 * runs behind an owner wallet signature bound to one specific tracker row (see the
 * `detail` binding in lib/outreach-action.ts). Nothing here is automatic: no run, chat
 * instruction, or schedule can reach this without a per-row signed confirmation.
 *
 * Transport is plain SMTP against the business's own mailbox (e.g. the ubutangaza.biz
 * host), so replies land in the real inbox and SPF stays the mail host's problem.
 * All credentials are server-only environment variables; sending stays disabled until
 * they exist.
 */

const HOST = process.env.SMTP_HOST?.trim();
const PORT = Number(process.env.SMTP_PORT ?? 465);
const USER = process.env.SMTP_USER?.trim();
const PASS = process.env.SMTP_PASS?.trim();
const FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL?.trim() || USER;
const FROM_NAME = process.env.OUTREACH_FROM_NAME?.trim() || "Ubu-Tangaza";

export function sendStatus(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!HOST) missing.push("SMTP_HOST");
  if (!USER) missing.push("SMTP_USER");
  if (!PASS) missing.push("SMTP_PASS");
  return { ready: missing.length === 0, missing };
}

let transport: Transporter | null = null;
function smtp(): Transporter {
  transport ??= createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
    auth: { user: USER, pass: PASS },
  });
  return transport;
}

export type SendResult = { ok: true; to: string } | { ok: false; reason: string };

/**
 * Send one row's draft. The row is re-read by the caller from Notion just before this,
 * so what goes out is what the tracker holds — not whatever a browser posted.
 */
export async function sendRowDraft(row: OutreachRow): Promise<SendResult> {
  if (!sendStatus().ready) return { ok: false, reason: "Sending is not configured on this server" };
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return { ok: false, reason: "This row has no valid email address" };
  }
  if (!row.draftBody.trim()) return { ok: false, reason: "This row has no draft to send" };
  if (row.status === "sent") return { ok: false, reason: "Already sent — check the tracker" };

  // Build the message once so the bytes we send are the bytes we file in Sent.
  let raw: Buffer;
  try {
    raw = await new MailComposer({
      from: { name: FROM_NAME, address: FROM_EMAIL ?? "" },
      to: row.email,
      subject: row.draftSubject || `A note from ${FROM_NAME}`,
      text: row.draftBody,
    })
      .compile()
      .build();
    await smtp().sendMail({ envelope: { from: FROM_EMAIL, to: [row.email] }, raw });
  } catch (err) {
    const detail = err instanceof Error ? err.message.split("\n")[0].slice(0, 160) : "unknown error";
    return { ok: false, reason: `The mail server refused it: ${detail}` };
  }

  // SMTP submission does not file a copy in the mailbox's Sent folder (a mail app does
  // that itself over IMAP), so do the same — best-effort: the mail is already out.
  let sentCopy = true;
  try {
    const imap = new ImapFlow({
      host: HOST ?? "",
      port: 993,
      secure: true,
      auth: { user: USER ?? "", pass: PASS ?? "" },
      logger: false,
    });
    await imap.connect();
    try {
      const folders = await imap.list();
      const sent =
        folders.find((f) => f.specialUse === "\\Sent")?.path ??
        folders.find((f) => /^sent/i.test(f.name))?.path ??
        "Sent";
      await imap.append(sent, raw, ["\\Seen"]);
    } finally {
      await imap.logout();
    }
  } catch {
    sentCopy = false;
  }

  // Record the send on the tracker row. A failure here must not look like a failed
  // send — the mail is already gone — so report it in the reason instead of erroring.
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${row.id}`, {
      method: "PATCH",
      headers: notionHeaders(),
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "sent" } },
          "Sent at": { date: { start: new Date().toISOString().slice(0, 10) } },
          "Next action": {
            rich_text: [{ type: "text", text: { content: "Sent — watch for a reply" } }],
          },
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    return { ok: true, to: `${row.email} (sent, but the tracker row could not be updated — fix it in Notion)` };
  }
  return { ok: true, to: sentCopy ? row.email : `${row.email} (sent; no copy could be filed in the Sent folder)` };
}
