/*
 * FILE    : apps/web/app/hub/biz-leads/[id]/letter/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0130 UTC
 * PURPOSE : Hub → Business leads → the job-posting letter for one lead, signed by the staff member: print or save
 *           as PDF, or copy into a job site's message or your own email. Also shows the 3 emails the sequence sends.
 */
import { notFound } from "next/navigation";
import { BIZ_LEAD_SEQUENCE, bizCoverLetter, bizLeadEmail, type BizSegment } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getBizLeadSettings } from "@/lib/biz-leads";
import { siteUrl } from "@/lib/notify";
import { unsubscribeUrl } from "@/lib/reminders";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function Letter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [v, s, { data: l }] = await Promise.all([getViewer(), getBizLeadSettings(), adminClient().from("biz_leads").select("*").eq("id", id).maybeSingle()]);
  if (!l) notFound();
  const ctx = {
    businessName: l.business_name as string, firstName: (l.contact_name as string | null)?.split(" ")[0] ?? null, segment: l.segment as BizSegment, city: l.city as string | null,
    pilotPct: s.pilot_pct, pilotJobs: s.pilot_jobs, signupUrl: `${siteUrl()}/b/${l.token}`, unsubscribeUrl: l.email ? unsubscribeUrl(l.email) : `${siteUrl()}/unsubscribe`,
    postalAddress: process.env.BUSINESS_POSTAL_ADDRESS ?? "[BUSINESS_POSTAL_ADDRESS not set]", jobTitle: (l.job_title as string | null) ?? "Maintenance Technician", postingSource: l.posting_source as string | null,
  };
  const letter = bizCoverLetter({ ...ctx, step: 0, senderName: v?.fullName ?? "Your name", senderTitle: null, phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? null, email: v?.email ?? null, site: `${siteUrl()}/business` });
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div><h1 className="text-2xl font-bold">Letter to {l.business_name}</h1><p className="text-sm text-ink-soft">{l.job_title ? `For their ${l.job_title} posting${l.posting_source ? ` on ${l.posting_source}` : ""}.` : "No job title on this lead — showing the letter for a maintenance posting."} Signed by you; the link credits this lead and applies the pilot offer when they set up an account.</p></div>
        <PrintButton />
      </div>
      <article className="card mx-auto max-w-2xl whitespace-pre-line text-[15px] leading-relaxed print:border-0 print:shadow-none">
        <div className="text-sm text-ink-soft">{today}</div>
        <div className="mt-2 font-semibold print:hidden">Subject: {letter.subject}</div>
        <div className="mt-4">{letter.text}</div>
      </article>
      <section className="space-y-3 print:hidden">
        <h2 className="text-lg font-bold">The email sequence ({BIZ_LEAD_SEQUENCE.map((d) => `day ${d}`).join(", ")})</h2>
        {BIZ_LEAD_SEQUENCE.map((d, i) => { const m = bizLeadEmail({ ...ctx, step: i }); return (
          <details key={d} className="card"><summary className="cursor-pointer font-semibold">Day {d}: {m.subject}</summary><div className="mt-3 whitespace-pre-line text-sm">{m.text}</div></details>
        ); })}
      </section>
    </div>
  );
}
