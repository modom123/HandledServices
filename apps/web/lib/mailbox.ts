/*
 * FILE    : apps/web/lib/mailbox.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : The company mailbox at Hostinger (info@handledsvc.com) for the Email Center.
 *             sendMail       — SMTP (smtp.hostinger.com:465, SSL) with List-Unsubscribe headers
 *             verifyMailbox  — logs in to SMTP and IMAP and reports what works (Hub → Email → Settings)
 *             listInbox / readMessage / markSeen — IMAP (imap.hostinger.com:993) for replies
 *             saveToSent     — one-off replies are copied to the Sent folder so webmail shows them
 *             checkDomainDns — SPF, DKIM and DMARC on the sending domain (deliverability)
 *           Settings (Vercel → Environment Variables, never pasted in chat or email):
 *             SMTP_USER=info@handledsvc.com, SMTP_PASSWORD=<mailbox password>
 *             optional SMTP_HOST / SMTP_PORT / IMAP_HOST / IMAP_PORT (Hostinger defaults)
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { resolveTxt } from "node:dns/promises";

export const mailboxUser = () => process.env.SMTP_USER?.trim() || null;
export const mailboxReady = () => Boolean(mailboxUser() && process.env.SMTP_PASSWORD);
const smtpHost = () => process.env.SMTP_HOST || "smtp.hostinger.com";
const imapHost = () => process.env.IMAP_HOST || "imap.hostinger.com";

let transport: Transporter | null = null;
function smtp() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({ host: smtpHost(), port, secure: port === 465, auth: { user: mailboxUser()!, pass: process.env.SMTP_PASSWORD! }, pool: true, maxConnections: 2 });
  }
  return transport;
}

export interface OutMail { to: string; subject: string; text: string; html?: string; fromName?: string; replyTo?: string | null; headers?: Record<string, string>; inReplyTo?: string | null; references?: string | null }

/** Send one email from the company mailbox. Returns the Message-ID. */
export async function sendMail(m: OutMail): Promise<string> {
  if (!mailboxReady()) throw new Error("Mailbox not set up (SMTP_USER / SMTP_PASSWORD)");
  const info = await smtp().sendMail({
    from: { name: m.fromName ?? "Handled", address: mailboxUser()! }, to: m.to, subject: m.subject, text: m.text, html: m.html,
    replyTo: m.replyTo || undefined, headers: m.headers, inReplyTo: m.inReplyTo || undefined, references: m.references || undefined,
  });
  return info.messageId;
}

function imap() {
  return new ImapFlow({ host: imapHost(), port: Number(process.env.IMAP_PORT || 993), secure: true, auth: { user: mailboxUser()!, pass: process.env.SMTP_PASSWORD! }, logger: false });
}

/** Log in to SMTP and IMAP; what works and what doesn't. */
export async function verifyMailbox(): Promise<{ smtp: string; imap: string }> {
  if (!mailboxReady()) return { smtp: "not set up", imap: "not set up" };
  const smtpRes = await smtp().verify().then(() => "ok").catch((e: Error) => e.message);
  const c = imap();
  const imapRes = await c.connect().then(async () => { await c.logout(); return "ok"; }).catch((e: Error) => e.message);
  return { smtp: smtpRes, imap: imapRes };
}

export interface InboxItem { uid: number; from: string; fromName: string | null; subject: string; date: string; seen: boolean; preview?: string }

/** Latest messages in INBOX (newest first). */
export async function listInbox(limit = 40): Promise<InboxItem[]> {
  if (!mailboxReady()) return [];
  const c = imap();
  await c.connect();
  const items: InboxItem[] = [];
  try {
    const lock = await c.getMailboxLock("INBOX");
    try {
      const status = c.mailbox && typeof c.mailbox === "object" ? c.mailbox.exists : 0;
      if (status > 0) {
        const from = Math.max(1, status - limit + 1);
        for await (const m of c.fetch(`${from}:*`, { uid: true, envelope: true, flags: true })) {
          const f = m.envelope?.from?.[0];
          items.push({ uid: m.uid, from: f?.address ?? "", fromName: f?.name || null, subject: m.envelope?.subject ?? "(no subject)", date: new Date(m.envelope?.date ?? Date.now()).toISOString(), seen: Boolean(m.flags?.has("\\Seen")) });
        }
      }
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
  return items.reverse();
}

export interface FullMessage { uid: number; from: string; fromName: string | null; to: string; subject: string; date: string; text: string; messageId: string | null; references: string | null }

export async function readMessage(uid: number): Promise<FullMessage | null> {
  if (!mailboxReady()) return null;
  const c = imap();
  await c.connect();
  try {
    const lock = await c.getMailboxLock("INBOX");
    try {
      const msg = await c.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const p = await simpleParser(msg.source);
      await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      const from = p.from?.value?.[0];
      const to = Array.isArray(p.to) ? p.to.map((x) => x.text).join(", ") : p.to?.text ?? "";
      const refs = Array.isArray(p.references) ? p.references.join(" ") : p.references ?? null;
      return { uid, from: from?.address ?? "", fromName: from?.name || null, to, subject: p.subject ?? "(no subject)", date: (p.date ?? new Date()).toISOString(),
        text: (p.text ?? (typeof p.html === "string" ? p.html.replace(/<[^>]+>/g, " ") : "")).slice(0, 50000), messageId: p.messageId ?? null, references: refs };
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
}

/** Copy a one-off reply into the Sent folder (Hostinger doesn't keep SMTP sends there). */
export async function saveToSent(raw: { to: string; subject: string; text: string; fromName: string; messageId: string; inReplyTo?: string | null }) {
  if (!mailboxReady()) return;
  const source = [`From: ${raw.fromName} <${mailboxUser()}>`, `To: ${raw.to}`, `Subject: ${raw.subject}`, `Date: ${new Date().toUTCString()}`, `Message-ID: ${raw.messageId}`,
    ...(raw.inReplyTo ? [`In-Reply-To: ${raw.inReplyTo}`] : []), "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "", raw.text].join("\r\n");
  const c = imap();
  await c.connect();
  try {
    const boxes = await c.list();
    const sent = boxes.find((b) => b.specialUse === "\\Sent")?.path ?? boxes.find((b) => /^(INBOX\.)?Sent$/i.test(b.path))?.path ?? "INBOX.Sent";
    await c.append(sent, source, ["\\Seen"]);
  } finally { await c.logout().catch(() => {}); }
}

/** SPF / DKIM / DMARC on the mailbox's domain. Missing records send marketing to spam. */
export async function checkDomainDns(): Promise<{ domain: string | null; spf: boolean; dkim: boolean; dmarc: boolean; notes: string[] }> {
  const user = mailboxUser();
  const domain = user?.split("@")[1] ?? null;
  if (!domain) return { domain: null, spf: false, dkim: false, dmarc: false, notes: ["Set SMTP_USER first."] };
  const txt = async (name: string) => (await resolveTxt(name).catch(() => [] as string[][])).map((r) => r.join(""));
  const [root, dmarcRec, ...dkimRecs] = await Promise.all([
    txt(domain), txt(`_dmarc.${domain}`),
    ...["hostingermail-a", "hostingermail-b", "hostingermail-c", "default", "dkim"].map((s) => txt(`${s}._domainkey.${domain}`)),
  ]);
  const spf = root.some((r) => /^v=spf1/i.test(r) && /hostinger/i.test(r));
  const dkim = dkimRecs.some((list) => list.some((r) => /v=DKIM1|p=/i.test(r)));
  const dmarc = dmarcRec.some((r) => /^v=DMARC1/i.test(r));
  const notes: string[] = [];
  if (!spf) notes.push(`SPF: add a TXT record on ${domain}: v=spf1 include:_spf.mail.hostinger.com ~all (Hostinger → Emails → DNS settings sets this up).`);
  if (!dkim) notes.push("DKIM: turn it on in Hostinger → Emails → Email settings (DNS); it adds the hostingermail-*._domainkey records.");
  if (!dmarc) notes.push(`DMARC: add a TXT record _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:${user}`);
  return { domain, spf, dkim, dmarc, notes };
}
