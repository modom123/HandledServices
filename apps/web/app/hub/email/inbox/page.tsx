/*
 * FILE    : apps/web/app/hub/email/inbox/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Hub → Email Center → Inbox: the latest emails in the company mailbox (IMAP), with who they are to us
 *           (customer, business lead, pro), and a one-off compose.
 */
import Link from "next/link";
import { adminClient } from "@/lib/supabase/server";
import { listInbox, mailboxReady, mailboxUser } from "@/lib/mailbox";
import { ComposeBox } from "@/components/EmailCenter";

export const dynamic = "force-dynamic";

export default async function Inbox() {
  let error: string | null = null;
  const items = mailboxReady() ? await listInbox(50).catch((e: Error) => { error = e.message; return []; }) : [];
  const emails = [...new Set(items.map((i) => i.from.toLowerCase()).filter(Boolean))];
  const db = adminClient();
  const [{ data: leads }, { data: pros }, { data: custs }] = emails.length ? await Promise.all([
    db.from("biz_leads").select("email").in("email", emails), db.from("contractors").select("email").in("email", emails), db.from("jobs").select("contact_email").in("contact_email", emails).limit(500),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const tag = (e: string) => {
    const x = e.toLowerCase();
    if ((leads ?? []).some((l: { email: string | null }) => l.email?.toLowerCase() === x)) return "business lead";
    if ((pros ?? []).some((l: { email: string | null }) => l.email?.toLowerCase() === x)) return "pro";
    if ((custs ?? []).some((l: { contact_email: string }) => l.contact_email.toLowerCase() === x)) return "customer";
    return null;
  };
  return (
    <div className="space-y-6">
      <div><Link href="/hub/email" className="text-sm text-brand underline">← Email Center</Link><h1 className="text-2xl font-bold">Inbox · {mailboxUser() ?? "mailbox not connected"}</h1></div>
      {!mailboxReady() && <p className="card bg-amber-50 text-sm">Connect the mailbox first (SMTP_USER and SMTP_PASSWORD in Vercel).</p>}
      {error && <p className="card bg-rose-50 text-sm">Couldn't open the inbox: {error}</p>}
      <div className="card divide-y divide-line p-0">
        {items.map((m) => (
          <Link key={m.uid} href={`/hub/email/inbox/${m.uid}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-paper">
            <div className={m.seen ? "" : "font-semibold"}>{m.fromName ?? m.from}{tag(m.from) && <span className="ml-2 rounded bg-brand-tint px-2 py-0.5 text-xs font-normal">{tag(m.from)}</span>}<div className="text-sm font-normal text-ink-soft">{m.subject}</div></div>
            <div className="text-xs text-ink-soft">{new Date(m.date).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
          </Link>
        ))}
        {mailboxReady() && !items.length && !error && <p className="p-3 text-sm text-ink-soft">No email yet.</p>}
      </div>
      <section className="card"><h2 className="mb-2 text-lg font-bold">New email</h2><ComposeBox /></section>
    </div>
  );
}
