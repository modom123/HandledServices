/*
 * FILE    : apps/web/app/hub/email/inbox/[uid]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Hub → Email Center → one inbox email: read it, see who they are (a business lead's reply marks the
 *           lead "replied" so the sales sequence stops), and reply from the company mailbox.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/server";
import { readMessage } from "@/lib/mailbox";
import { ReplyBox } from "@/components/EmailCenter";

export const dynamic = "force-dynamic";

export default async function InboxMessage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  if (!/^\d+$/.test(uid)) notFound();
  const m = await readMessage(Number(uid)).catch(() => null);
  if (!m) notFound();
  const db = adminClient();
  const { data: lead } = m.from ? await db.from("biz_leads").select("id, business_name, status").ilike("email", m.from.replace(/[\\%_]/g, "\\$&")).maybeSingle() : { data: null };
  if (lead && ["queued", "emailing", "clicked", "new"].includes(lead.status)) {
    const { setBizLeadStatus } = await import("@/lib/biz-leads");
    await setBizLeadStatus(lead.id, "replied", "Replied by email (Email Center inbox)", "email-center");
  }
  return (
    <div className="space-y-4">
      <Link href="/hub/email/inbox" className="text-sm text-brand underline">← Inbox</Link>
      <div className="card space-y-2">
        <h1 className="text-xl font-bold">{m.subject}</h1>
        <div className="text-sm text-ink-soft">From {m.fromName ? `${m.fromName} <${m.from}>` : m.from} · {new Date(m.date).toLocaleString("en-US", { timeZone: "America/Detroit" })}</div>
        {lead && <div className="text-sm">🤝 Business lead: <Link className="underline" href="/hub/biz-leads">{lead.business_name}</Link> — marked replied, their email sequence stopped.</div>}
        <pre className="whitespace-pre-wrap break-words font-sans text-sm">{m.text}</pre>
      </div>
      <div className="card"><h2 className="mb-2 font-bold">Reply</h2><ReplyBox uid={m.uid} to={m.from} subject={m.subject} inReplyTo={m.messageId} references={m.references} /></div>
    </div>
  );
}
