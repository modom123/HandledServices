/*
 * FILE    : apps/web/app/hub/biz-leads/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2141 UTC
 * PURPOSE : One business lead (or teaming partner): who they are, contact details, status, the letter (sales leads),
 *           and the full conversation history — every note, call, email, meeting and text, plus automated events —
 *           newest first. Notes are permanent; the history is the account's story.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BIZ_PARTNER_LABEL, BIZ_PARTNER_SEGMENT, BIZ_SEGMENTS, type BizSegment } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { timeline } from "@/lib/notes";
import { BizLeadStatus } from "@/components/BizLeadAdmin";
import { AddNote, Timeline } from "@/components/AccountNotes";

export const dynamic = "force-dynamic";

export default async function BizLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: l } = await adminClient().from("biz_leads").select("*").eq("id", id).maybeSingle();
  if (!l) notFound();
  const partner = l.segment === BIZ_PARTNER_SEGMENT;
  const items = await timeline("biz_lead", id);
  return (
    <div className="space-y-5">
      <Link href="/hub/biz-leads" className="text-sm text-brand">← Business leads</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-ink-soft">{partner ? BIZ_PARTNER_LABEL : BIZ_SEGMENTS[l.segment as BizSegment]?.label ?? l.segment}{l.city ? ` · ${l.city}` : ""} · status: {l.status === "call" && partner ? "to contact" : String(l.status).replace("_", " ")}</div>
          <h1 className="text-2xl font-bold">{l.business_name}</h1>
          <div className="text-sm text-ink-soft">{[l.contact_name, l.email, l.phone].filter(Boolean).join(" · ")}{l.website && <> · <a href={l.website} target="_blank" rel="noreferrer" className="underline">website</a></>}</div>
          {l.account_id && <Link href={`/hub/business/${l.account_id}`} className="text-sm font-semibold text-brand underline">Business account →</Link>}
          {!partner && <Link href={`/hub/biz-leads/${id}/letter`} className="ml-3 text-sm text-brand underline">Letter</Link>}
        </div>
        <BizLeadStatus id={id} partner={partner} />
      </div>
      {l.notes && <section className="card text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">About</div><p className="mt-1 whitespace-pre-wrap">{l.notes}</p></section>}
      <section className="card"><h2 className="mb-2 text-lg font-bold">Add to the history</h2><AddNote subjectType="biz_lead" subjectId={id} /></section>
      <section className="card"><h2 className="mb-3 text-lg font-bold">History ({items.length})</h2><Timeline items={items} /></section>
    </div>
  );
}
