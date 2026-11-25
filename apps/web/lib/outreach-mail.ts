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
 * UPDATED : 2026-11-20_0030 UTC — mail servers found from the domain's MX record when OUTREACH_SMTP_HOST / OUTREACH_IMAP_HOST
 *           aren't set (Hosted Email / OpenSRS, Hostinger, Google, Microsoft), never borrowed from the company mailbox;
 *           send and login errors explained in plain words; DKIM check knows more selectors (dkim_key, mail, …) and
 *           OUTREACH_DKIM_SELECTOR.
 * UPDATED : 2026-11-24_1600 UTC — mailHostFor(domain): the mail servers for any mailbox's domain (office mailboxes on handledsvc.net).
 * UPDATED : 2026-11-25_0100 UTC — mailHostFor doesn't remember a failed lookup (it retries on the next send).
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { resolveMx, resolveTxt } from "node:dns/promises";
import { COMPANY_DOMAIN, OUTREACH_DOMAIN, outreachDomainProblem } from "@handled/core";

export const outreachUser = () => process.env.OUTREACH_SMTP_USER?.trim() || null;
/** Domains that must never send cold email: handledsvc.com plus whatever EMAIL_FROM / SMTP_USER use. */
const companyDomains = () => [COMPANY_DOMAIN, ...[process.env.EMAIL_FROM, process.env.SMTP_USER, process.env.NEXT_PUBLIC_SUPPORT_EMAIL].map((x) => x?.match(/@([A-Za-z0-9.-]+)/)?.[1]?.toLowerCase()).filter((d): d is string => Boolean(d) && d !== OUTREACH_DOMAIN)];
/** Why the outreach mailbox can't send (null = ready). */
export const outreachProblem = () => process.env.OUTREACH_SMTP_PASSWORD ? outreachDomainProblem(outreachUser(), companyDomains()) : outreachUser() ? "OUTREACH_SMTP_PASSWORD is missing." : outreachDomainProblem(null);
export const outreachReady = () => !outreachProblem();
export const outreachDomain = () => outreachUser()?.split("@")[1]?.toLowerCase() ?? null;
const fromName = () => process.env.OUTREACH_FROM_NAME?.trim() || "Handled";
/** The mail servers for a domain's email host, read from its MX record (who hosts the mailbox). */
const KNOWN_HOSTS: { mx: RegExp; smtp: string; smtpPort: number; imap: string; name: string }[] = [
  { mx: /hostedemail\.com$/i, smtp: "mail.hostedemail.com", smtpPort: 465, imap: "mail.hostedemail.com", name: "Hosted Email" },
  { mx: /hostinger\.com$/i, smtp: "smtp.hostinger.com", smtpPort: 465, imap: "imap.hostinger.com", name: "Hostinger" },
  { mx: /(google|googlemail)\.com$/i, smtp: "smtp.gmail.com", smtpPort: 465, imap: "imap.gmail.com", name: "Google Workspace" },
  { mx: /outlook\.com$/i, smtp: "smtp.office365.com", smtpPort: 587, imap: "outlook.office365.com", name: "Microsoft 365" },
  { mx: /(secureserver\.net)$/i, smtp: "smtpout.secureserver.net", smtpPort: 465, imap: "imap.secureserver.net", name: "GoDaddy" },
  { mx: /zoho\.(com|eu)$/i, smtp: "smtp.zoho.com", smtpPort: 465, imap: "imap.zoho.com", name: "Zoho" },
];
const hostCache = new Map<string, Promise<(typeof KNOWN_HOSTS)[number] | null>>();
/** Who hosts a domain's mailboxes (from its MX record), or null if it isn't a host we know. Cached per domain. */
export function mailHostFor(domain: string) {
  const d = domain.toLowerCase();
  if (!hostCache.has(d)) {
    const p = resolveMx(d).then((mx) => KNOWN_HOSTS.find((h) => mx.some((m) => h.mx.test(m.exchange.replace(/\.$/, "")))) ?? null).catch(() => null);
    hostCache.set(d, p);
    // a failed lookup isn't remembered: the next send asks DNS again
    void p.then((h) => { if (!h) hostCache.delete(d); });
  }
  return hostCache.get(d)!;
}
let servers: Promise<{ smtp: string; smtpPort: number; imap: string; imapPort: number; how: string }> | null = null;
/** OUTREACH_* settings win; otherwise the host is found from the outreach domain's MX (never the company mailbox's host). */
export function outreachServers() {
  servers ??= (async () => {
    const set = { smtp: process.env.OUTREACH_SMTP_HOST?.trim(), imap: process.env.OUTREACH_IMAP_HOST?.trim() };
    let found: (typeof KNOWN_HOSTS)[number] | undefined;
    if (!set.smtp || !set.imap) {
      const mx = await resolveMx(outreachDomain() ?? OUTREACH_DOMAIN).catch(() => []);
      found = KNOWN_HOSTS.find((h) => mx.some((m) => h.mx.test(m.exchange.replace(/\.$/, ""))));
    }
    const smtpPort = Number(process.env.OUTREACH_SMTP_PORT || found?.smtpPort || 465);
    return {
      smtp: set.smtp || found?.smtp || "smtp.hostinger.com", smtpPort,
      imap: set.imap || found?.imap || "imap.hostinger.com", imapPort: Number(process.env.OUTREACH_IMAP_PORT || 993),
      how: set.smtp ? "from OUTREACH_SMTP_HOST" : found ? `found from the domain's MX (${found.name})` : "default (Hostinger) — set OUTREACH_SMTP_HOST / OUTREACH_IMAP_HOST",
    };
  })();
  return servers;
}

let transport: Transporter | null = null;
async function smtp() {
  if (!transport) {
    const s = await outreachServers();
    transport = nodemailer.createTransport({ host: s.smtp, port: s.smtpPort, secure: s.smtpPort === 465, auth: { user: outreachUser()!, pass: process.env.OUTREACH_SMTP_PASSWORD! }, pool: true, maxConnections: 1 });
  }
  return transport;
}
const imap = async () => { const s = await outreachServers(); return new ImapFlow({ host: s.imap, port: s.imapPort, secure: true, auth: { user: outreachUser()!, pass: process.env.OUTREACH_SMTP_PASSWORD! }, logger: false }); };

/** A mail-server error in plain words (what to fix in Vercel). */
export function explainMailError(e: unknown, server?: string): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  const m = String(err?.message ?? e);
  if (err?.code === "EAUTH" || err?.responseCode === 535 || /auth|credentials|login|password/i.test(m))
    return `The mail server refused the login for ${outreachUser()}: check OUTREACH_SMTP_PASSWORD (the mailbox password, typed only into Vercel) and that this mailbox exists. (${m.slice(0, 120)})`;
  if (["ENOTFOUND", "EDNS", "ECONNREFUSED", "ETIMEDOUT", "ESOCKET", "ECONNECTION"].includes(err?.code ?? "") || /getaddrinfo|timed? ?out|connect/i.test(m))
    return `Couldn't reach the mail server${server ? ` ${server}` : ""}: set OUTREACH_SMTP_HOST / OUTREACH_SMTP_PORT (and OUTREACH_IMAP_HOST) to your email host's settings, then redeploy. (${m.slice(0, 120)})`;
  if (/relay|sender|not owned|not allowed to send|553|550/i.test(m)) return `The mail server won't send as ${outreachUser()}: the From address must be the mailbox you log in with. (${m.slice(0, 160)})`;
  return m.slice(0, 300);
}

/** Send one outreach email (plain text, like a person writes). Threaded when inReplyTo is given. Returns the Message-ID. */
export async function sendOutreach(m: { to: string; subject: string; text: string; unsubscribeUrl?: string | null; inReplyTo?: string | null; references?: string | null }): Promise<string> {
  const problem = outreachProblem();
  if (problem) throw new Error(`Outreach mailbox not ready: ${problem}`);
  const mail = {
    from: { name: fromName(), address: outreachUser()! }, to: m.to, subject: m.subject, text: m.text,
    ...(m.inReplyTo ? { inReplyTo: m.inReplyTo, references: [m.references, m.inReplyTo].filter(Boolean).join(" ") } : {}),
    headers: m.unsubscribeUrl ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>, <mailto:${outreachUser()}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {},
  };
  const info = await (await smtp()).sendMail(mail).catch(async (e) => { throw new Error(explainMailError(e, (await outreachServers()).smtp)); });
  void saveToOutreachSent({ ...mail, messageId: info.messageId }).catch(() => {}); // webmail shows the full thread; never blocks sending
  return info.messageId;
}

/** A marketing email (Email Center campaign, HTML + text) from the handledsvc.net mailbox. Returns the Message-ID. */
export async function sendMarketingFromOutreach(m: { to: string; subject: string; text: string; html?: string; fromName?: string | null; replyTo?: string | null; headers?: Record<string, string> }): Promise<string> {
  const problem = outreachProblem();
  if (problem) throw new Error(`Outreach mailbox not ready: ${problem}`);
  const info = await (await smtp()).sendMail({ from: { name: m.fromName?.trim() || fromName(), address: outreachUser()! }, to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: m.replyTo || undefined, headers: m.headers })
    .catch(async (e) => { throw new Error(explainMailError(e, (await outreachServers()).smtp)); });
  return info.messageId;
}

/** Keep a copy in the outreach mailbox's Sent folder (SMTP doesn't do it). */
async function saveToOutreachSent(mail: Record<string, unknown>) {
  const raw = await new Promise<Buffer>((ok, bad) => nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(mail, (e, info) => (e ? bad(e) : ok(info.message as Buffer))));
  const c = await imap();
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
  const c = await imap();
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
export async function verifyOutreach(): Promise<{ smtp: string; imap: string; servers?: string }> {
  const problem = outreachProblem();
  if (problem) return { smtp: problem, imap: "not checked" };
  const s = await outreachServers();
  const smtpRes = await (await smtp()).verify().then(() => "ok").catch((e: Error) => explainMailError(e, s.smtp));
  const c = await imap();
  const imapRes = await c.connect().then(async () => { await c.logout(); return "ok"; }).catch((e: Error) => explainMailError(e, s.imap));
  return { smtp: smtpRes, imap: imapRes, servers: `${s.smtp}:${s.smtpPort} / ${s.imap}:${s.imapPort} (${s.how})` };
}

/** SPF / DKIM / DMARC on the outreach domain. All three are needed before sending. */
export async function outreachDns(): Promise<{ domain: string | null; spf: boolean; dkim: boolean; dmarc: boolean; notes: string[] }> {
  const domain = outreachDomain() ?? OUTREACH_DOMAIN; // check handledsvc.net even before the mailbox is set
  const txt = async (name: string) => (await resolveTxt(name).catch(() => [] as string[][])).map((r) => r.join(""));
  const [root, dmarcRec, ...dkimRecs] = await Promise.all([
    txt(domain), txt(`_dmarc.${domain}`),
    ...[...new Set([process.env.OUTREACH_DKIM_SELECTOR?.trim(), "dkim_key", "hostingermail-a", "hostingermail-b", "hostingermail-c", "default", "dkim", "mail", "x", "google", "selector1", "selector2", "s1", "s2", "k1"].filter((x): x is string => Boolean(x)))].map((s) => txt(`${s}._domainkey.${domain}`)),
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
