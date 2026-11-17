/*
 * FILE    : apps/web/app/hub/office/[slug]/mail/[uid]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Front Office → an office's email: read one message from the office's own mailbox and reply from it (admins only).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminOnly } from "@/components/AdminOnly";
import { officeBySlug, officeMail } from "@/lib/offices";
import { readMessage } from "@/lib/mailbox";
import { OfficeReply } from "@/components/Office";

export const dynamic = "force-dynamic";

export default async function OfficeMessage({ params }: { params: Promise<{ slug: string; uid: string }> }) {
  const gate = await adminOnly();
  if (gate) return gate;
  const { slug, uid } = await params;
  const o = officeBySlug(slug);
  const acct = o ? officeMail(o) : null;
  if (!o || !acct || !/^\d+$/.test(uid)) notFound();
  const m = await readMessage(Number(uid), acct).catch(() => null);
  if (!m) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/hub/office/${o.slug}`} className="text-sm text-brand underline">← {o.name}&apos;s office</Link>
      <div className="card space-y-2">
        <h1 className="text-xl font-bold">{m.subject}</h1>
        <p className="text-sm text-ink-soft">From {m.fromName ? `${m.fromName} <${m.from}>` : m.from} · to {m.to} · {new Date(m.date).toLocaleString("en-US", { timeZone: "America/Detroit" })}</p>
        <pre className="whitespace-pre-wrap font-sans text-sm">{m.text}</pre>
      </div>
      {m.from && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Reply as {o.name}</h2>
          <OfficeReply office={o.slug} uid={m.uid} to={m.from} subject={m.subject} inReplyTo={m.messageId} references={m.references} />
        </div>
      )}
    </div>
  );
}
