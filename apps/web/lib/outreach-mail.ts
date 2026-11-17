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
 * UPDATED : 2026-11-17_2335 UTC — handledsvc.net is the outreach / marketing domain (core OUTREACH_DOMAIN). The mailbox is refused
 *           when it sits on the company domain (handledsvc.com) or a free mailbox (outreachProblem). Threaded sending
 *           (inReplyTo / references) for follow-ups and answers to replies; inbound messages carry their Message-ID;
 *           sent mail is saved to the outreach mailbox's Sent folder so staff see the whole thread in webmail.
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { resolveTxt } from "node:dns/promises";
import { COMPANY_DOMAIN, OUTREACH_DOMAIN, outreachDomainProblem } from "@handled/core";

export const outreachUser = () => process.env.OUTREACH_SMTP_USER?.trim() || null;
/** Domains that must never send cold email: handledsvc.com plus whatever EMAIL_FROM / SMTP_USER use. */
const companyDomains = () => [COMPANY_DOMAIN, ...[process.env.EMAIL_FROM, process.env.SMTP_USER, process.env.NEXT_PUBLIC_SUPPORT_EMAIL].map((x) => x?.match(/@([A-Za-z0-9.-]+)/)?.[1]?.toLowerCase()).filter((d): d is string => Boolean(d) && d !== OUTREACH_DOMAIN)];
/** Why the outreach mailbox can't send (null = ready). */
export const outreachProblem = () => process.env.OUTREACH_SMTP_PASSWORD ? outreachDomainProblem(outreachUser(), companyDomains()) : outreachUser() ? "OUTREACH_SMTP_PASSWORD is missing." : outreachDomainProblem(null);
export const outreachReady = () => !outreachProblem();
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

/** Send one outreach email (plain text, like a person writes). Threaded when inReplyTo is given. Returns the Message-ID. */
export async function sendOutreach(m: { to: string; subject: string; text: string; unsubscribeUrl?: string | null; inReplyTo?: string | null; references?: string | null }): Promise<string> {
  const problem = outreachProblem();
  if (problem) throw new Error(`Outreach mailbox not ready: ${problem}`);
  const mail = {
    from: { name: fromName(), address: outreachUser()! }, to: m.to, subject: m.subject, text: m.text,
    ...(m.inReplyTo ? { inReplyTo: m.inReplyTo, references: [m.references, m.inReplyTo].filter(Boolean).join(" ") } : {}),
    headers: m.unsubscribeUrl ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>, <mailto:${outreachUser()}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {},
  };
  const info = await smtp().sendMail(mail);
  void saveToOutreachSent({ ...mail, messageId: info.messageId }).catch(() => {}); // webmail shows the full thread; never blocks sending
  return info.messageId;
}

/** Keep a copy in the outreach mailbox's Sent folder (SMTP doesn't do it). */
async function saveToOutreachSent(mail: Record<string, unknown>) {
  const raw = await new Promise<Buffer>((ok, bad) => nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(mail, (e, info) => (e ? bad(e) : ok(info.message as Buffer))));
  const c = imap();
  await c.connect();
  try {
    const boxes = await c.list();
    const sent = boxes.find((b) => b.specialUse === "\\Sent")?.path ?? boxes.find((b) => /^(inbox\.)?sent( items| messages)?$/i.test(b.path))?.path ?? "Sent";
    await c.append(sent, raw, ["\\Seen"]);
  } finally { await c.logout().catch(() => {}); }
}

export interface OutreachInbound { uid: number; from: string; subject: string; text: string; date: string; bounce: boolean; bouncedTo: string | null; messageId: string | null; references: string | null }

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
        const refs = Array.isArray(p.references) ? p.references.join(" ") : p.references ?? null;
        out.push({ uid: msg.uid, from, subject: p.subject ?? "", text: stripQuoted(text), date: (p.date ?? new Date()).toISOString(), bounce, bouncedTo, messageId: p.messageId ?? null, references: refs });
        if (out.length >= limit) break;
      }
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
  return out;
}

/** Their words only: drop the quoted thread below "On … wrote:" / "-----Original Message-----" / "> " lines. */
export function stripQuoted(text: string): string {
  const cut = text.search(/^\s*(On .{5,200}wrote:|-{2,}\s*Original Message\s*-{2,}|From: .+@.+)$/im);
  return (cut > 0 ? text.slice(0, cut) : text).split(/\r?\n/).filter((l) => !/^\s*>/.test(l)).join("\n").trim() || text.slice(0, 4000);
}

/** Log in to SMTP and IMAP; what works and what doesn't. */
export async function verifyOutreach(): Promise<{ smtp: string; imap: string }> {
  const problem = outreachProblem();
  if (problem) return { smtp: problem, imap: "not checked" };
  const smtpRes = await smtp().verify().then(() => "ok").catch((e: Error) => e.message);
  const c = imap();
  const imapRes = await c.connect().then(async () => { await c.logout(); return "ok"; }).catch((e: Error) => e.message);
  return { smtp: smtpRes, imap: imapRes };
}

/** SPF / DKIM / DMARC on the outreach domain. All three are needed before sending. */
export async function outreachDns(): Promise<{ domain: string | null; spf: boolean; dkim: boolean; dmarc: boolean; notes: string[] }> {
  const domain = outreachDomain() ?? OUTREACH_DOMAIN; // check handledsvc.net even before the mailbox is set
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
  if (!dmarc) notes.push(`DMARC: add a TXT record _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:${outreachUser() ?? `dmarc@${domain}`}`);
  if (!outreachUser()) notes.push(`Mailbox: create one on ${domain} (e.g. mark@${domain}) and set OUTREACH_SMTP_USER / OUTREACH_SMTP_PASSWORD in Vercel.`);
  return { domain, spf, dkim, dmarc, notes };
}
