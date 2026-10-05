/*
 * FILE    : apps/web/app/hub/biz-leads/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Handled Hub → Business leads: the demand-side sales engine (property managers, brokerages,
 *           stagers, self-storage, stores). Settings and pilot offer, the funnel, warm replies to answer,
 *           the call list (phone-only leads — call by hand, never automated texts) and the top leads.
 * UPDATED : 2026-10-05_0130 UTC — job-posting leads: add a business that posted a job for work we do; open its letter.
 */
import Link from "next/link";
import { BIZ_SEGMENTS, type BizSegment } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getBizLeadSettings } from "@/lib/biz-leads";
import { instantlyBizReady } from "@/lib/instantly";
import { Stat } from "@/components/ui";
import { BizLeadSettingsForm, BizLeadStatus, JobPostLeadForm } from "@/components/BizLeadAdmin";

export const dynamic = "force-dynamic";
type Lead = { id: string; business_name: string; segment: BizSegment; city: string | null; email: string | null; phone: string | null; website: string | null; rating: number | null; review_count: number | null; score: number; status: string; account_id: string | null; created_at: string; job_title: string | null; posting_source: string | null; posting_url: string | null };

export default async function BizLeads() {
  const db = adminClient();
  const [s, { data }] = await Promise.all([getBizLeadSettings(), db.from("biz_leads").select("*").order("score", { ascending: false }).limit(2000)]);
  const leads = (data ?? []) as Lead[];
  const n = (st: string | string[]) => leads.filter((l) => (Array.isArray(st) ? st : [st]).includes(l.status)).length;
  const Row = ({ l }: { l: Lead }) => (
    <tr className="border-t border-line">
      <td className="p-3"><div className="font-semibold">{l.business_name}</div><div className="text-xs text-ink-soft">{BIZ_SEGMENTS[l.segment]?.label} · {l.city ?? "—"}{l.rating ? ` · ${l.rating}★ (${l.review_count})` : ""}</div>
        {l.job_title && <div className="text-xs">📋 Posted: {l.posting_url ? <a href={l.posting_url} target="_blank" className="underline">{l.job_title}</a> : l.job_title}{l.posting_source ? ` (${l.posting_source})` : ""} · <Link href={`/hub/biz-leads/${l.id}/letter`} className="font-semibold text-brand underline">letter</Link></div>}</td>
      <td className="p-3 text-xs">{l.email ?? "—"}<div>{l.phone ?? ""}</div>{l.website && <a href={l.website} target="_blank" className="underline">site</a>}</td>
      <td className="p-3 text-xs">{l.score}</td>
      <td className="p-3 text-xs">{l.status}{l.account_id && <> · <Link className="underline" href={`/hub/business/${l.account_id}`}>account</Link></>}</td>
      <td className="p-3"><BizLeadStatus id={l.id} /></td>
    </tr>
  );
  const table = (rows: Lead[]) => (
    <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Business</th><th className="p-3">Contact</th><th className="p-3">Score</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{rows.map((l) => <Row key={l.id} l={l} />)}</tbody></table></div>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Business leads</h1>
        <p className="max-w-3xl text-sm text-ink-soft">The demand side: we find property managers, real estate brokerages, home stagers, self-storage facilities and furniture & appliance stores, get the contact email from their own website, and send a 3-email sequence with a pilot offer through Instantly’s business campaign. When they set up an account from the link, the pilot is applied automatically. Answer replies the same day; call the phone-only list by hand (and send LinkedIn messages yourself; automating LinkedIn breaks its rules).</p>
        {!instantlyBizReady() && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">Sending isn’t set up: create a second Instantly campaign (steps {"{{subject_1}}/{{body_1}}"} … 3) and set INSTANTLY_BIZ_CAMPAIGN_ID in Vercel (plus INSTANTLY_API_KEY and BUSINESS_POSTAL_ADDRESS).</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <Stat label="Found" value={leads.length} />
        <Stat label="With email" value={leads.filter((l) => l.email).length} />
        <Stat label="Emailing" value={n(["queued", "emailing"])} />
        <Stat label="Clicked" value={n("clicked")} />
        <Stat label="Replied" value={n("replied")} hint="answer today" />
        <Stat label="Accounts" value={n("converted")} hint="set up from the email" />
      </div>
      <div className="card"><BizLeadSettingsForm s={s} /></div>
      <section className="card">
        <h2 className="text-lg font-bold">Add a business from a job posting</h2>
        <p className="mb-3 text-sm text-ink-soft">A business hiring a cleaner, handyman, maintenance tech, groundskeeper or mover is a business that needs that work done. They get the letter “book the work as a service instead of hiring for it” (cost comparison, upfront prices, vetted pros, guarantee, pilot offer) as a 3-email sequence, or print it / save it as a PDF from the letter page.</p>
        <JobPostLeadForm sendingReady={instantlyBizReady()} />
      </section>
      {leads.some((l) => l.job_title) && <section><h2 className="mb-2 text-lg font-bold">From job postings</h2>{table(leads.filter((l) => l.job_title).slice(0, 50))}</section>}
      {n("replied") > 0 && <section><h2 className="mb-2 text-lg font-bold">Replied: answer today</h2>{table(leads.filter((l) => l.status === "replied"))}</section>}
      {n("call") > 0 && <section><h2 className="mb-2 text-lg font-bold">Call list (no email found)</h2>{table(leads.filter((l) => l.status === "call").slice(0, 50))}</section>}
      <section><h2 className="mb-2 text-lg font-bold">Top leads</h2>{leads.length ? table(leads.filter((l) => !["call", "replied"].includes(l.status)).slice(0, 100)) : <p className="text-sm text-ink-soft">No leads yet. Turn the engine on (and set GOOGLE_PLACES_API_KEY) or wait for the next weekday run.</p>}</section>
    </div>
  );
}
