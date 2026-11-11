/*
 * FILE    : apps/web/lib/outreach-mail.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-11_0100 UTC
 * PURPOSE : Cold outreach from Handled's own outreach domain (replacing Instantly). A separate mailbox on a separate
 *           domain, so cold email can never hurt delivery of booking and receipt emails from handledsvc.com.
 *             sendOutreach     — one email over SMTP, with List-Unsubscribe headers
 *             outreachReplies  — new messages in the outreach inbox over IMAP (replies, bounces), after a UID
 *             verifyOutreach   — logs in to SMTP and IMAP (Hub → Business leads)
 *             outreachDns      — SPF / DKIM / DMARC on the outreach domain
 *           Settings (Vercel → Environment Variables, never pasted in chat or email):
 *             OUTREACH_SMTP_USER      e.g. mark@gethandledpros.com (the mailbox on the new domain)
 *             OUTREACH_SMTP_PASSWORD  its password
 *             OUTREACH_FROM_NAME      e.g. "Mark at Handled" (default "Handled")
 *             optional OUTREACH_SMTP_HOST / OUTREACH_SMTP_PORT / OUTREACH_IMAP_HOST / OUTREACH_IMAP_PORT
 *             (default: the same host as the company mailbox — Hostinger)
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { resolveTxt } from "node:dns/promises";

export const outreachUser = () => process.env.OUTREACH_SMTP_USER?.trim() || null;
export const outreachReady = () => Boolean(outreachUser() && process.env.OUTREACH_SMTP_PASSWORD);
export const outreachDomain = () => outreachUser()?.split("@")[1]?.toLowerCase() ?? null;
const fromName = () => process.env.OUTREACH_FROM_NAME?.trim() || "Handled";
const smtpHost = () => process.env.OUTREACH_SMTP_HOST || process.env.SMTP_HOST || "smtp.hostinger.com";
const imapHost = () => process.env.OUTREACH_IMAP_HOST || process.env.IMAP_HOST || "imap.hostinger.com";

let transport: Transporter | null = null;
function smtp() {
  if (!transport) {
    const port = Number(process.env.OUTREACH_SMTP_PORT || 465);
    transport = nodemailer.createTransport({ host: smtpHost(), port, secure: port === 465, auth: { user: outreachUser()!, pass: process.env.OUTREACH_SMTP_PASSWORD! }, pool: true, maxConnections: 1 });
  }
  return transport;
}
const imap = () => new ImapFlow({ host: imapHost(), port: Number(process.env.OUTREACH_IMAP_PORT || 993), secure: true, auth: { user: outreachUser()!, pass: process.env.OUTREACH_SMTP_PASSWORD! }, logger: false });

/** Send one outreach email (plain text, like a person writes). Returns the Message-ID. */
export async function sendOutreach(m: { to: string; subject: string; text: string; unsubscribeUrl: string }): Promise<string> {
  if (!outreachReady()) throw new Error("Outreach mailbox not set up (OUTREACH_SMTP_USER / OUTREACH_SMTP_PASSWORD)");
  const info = await smtp().sendMail({
    from: { name: fromName(), address: outreachUser()! }, to: m.to, subject: m.subject, text: m.text,
    headers: { "List-Unsubscribe": `<${m.unsubscribeUrl}>, <mailto:${outreachUser()}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  return info.messageId;
}

export interface OutreachInbound { uid: number; from: string; subject: string; text: string; date: string; bounce: boolean; bouncedTo: string | null }

/** Messages in the outreach inbox newer than `afterUid` (oldest first, at most `limit`). Bounces are flagged with the address that bounced. */
export async function outreachReplies(afterUid: number, limit = 50): Promise<OutreachInbound[]> {
  if (!outreachReady()) return [];
  const c = imap();
  await c.connect();
  const out: OutreachInbound[] = [];
  try {
    const lock = await c.getMailboxLock("INBOX");
    try {
      for await (const msg of c.fetch(`${afterUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (msg.uid <= afterUid || !msg.source) continue;
        const p = await simpleParser(msg.source);
        const from = p.from?.value?.[0]?.address?.toLowerCase() ?? "";
        const text = (p.text ?? (typeof p.html === "string" ? p.html.replace(/<[^>]+>/g, " ") : "")).slice(0, 20000);
        const bounce = /mailer-daemon|postmaster/i.test(from) || /undeliverable|delivery status notification|returned mail|failure notice/i.test(p.subject ?? "");
        const bouncedTo = bounce ? (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((x) => x.toLowerCase()).find((x) => !x.endsWith(`@${outreachDomain()}`) && !/mailer-daemon|postmaster/.test(x)) ?? null : null;
        out.push({ uid: msg.uid, from, subject: p.subject ?? "", text, date: (p.date ?? new Date()).toISOString(), bounce, bouncedTo });
        if (out.length >= limit) break;
      }
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
  return out;
}

/** Log in to SMTP and IMAP; what works and what doesn't. */
export async function verifyOutreach(): Promise<{ smtp: string; imap: string }> {
  if (!outreachReady()) return { smtp: "not set up", imap: "not set up" };
  const smtpRes = await smtp().verify().then(() => "ok").catch((e: Error) => e.message);
  const c = imap();
  const imapRes = await c.connect().then(async () => { await c.logout(); return "ok"; }).catch((e: Error) => e.message);
  return { smtp: smtpRes, imap: imapRes };
}

/** SPF / DKIM / DMARC on the outreach domain. All three are needed before sending. */
export async function outreachDns(): Promise<{ domain: string | null; spf: boolean; dkim: boolean; dmarc: boolean; notes: string[] }> {
  const domain = outreachDomain();
  if (!domain) return { domain: null, spf: false, dkim: false, dmarc: false, notes: ["Set OUTREACH_SMTP_USER first."] };
  const txt = async (name: string) => (await resolveTxt(name).catch(() => [] as string[][])).map((r) => r.join(""));
  const [root, dmarcRec, ...dkimRecs] = await Promise.all([
    txt(domain), txt(`_dmarc.${domain}`),
    ...["hostingermail-a", "hostingermail-b", "hostingermail-c", "default", "dkim", "google", "selector1", "selector2", "s1", "k1"].map((s) => txt(`${s}._domainkey.${domain}`)),
  ]);
  const spf = root.some((r) => /^v=spf1/i.test(r));
  const dkim = dkimRecs.some((list) => list.some((r) => /v=DKIM1|p=/i.test(r)));
  const dmarc = dmarcRec.some((r) => /^v=DMARC1/i.test(r));
  const notes: string[] = [];
  if (!spf) notes.push(`SPF: add the TXT record your email host gives you on ${domain} (Hostinger: v=spf1 include:_spf.mail.hostinger.com ~all).`);
  if (!dkim) notes.push(`DKIM: turn it on at your email host for ${domain} (it adds a ._domainkey record).`);
  if (!dmarc) notes.push(`DMARC: add a TXT record _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:${outreachUser()}`);
  return { domain, spf, dkim, dmarc, notes };
}
