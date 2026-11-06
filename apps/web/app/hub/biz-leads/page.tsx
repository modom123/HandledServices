/*
 * FILE    : apps/web/app/hub/biz-leads/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Handled Hub → Business leads: the demand-side sales engine (property managers, brokerages,
 *           stagers, self-storage, stores). Settings and pilot offer, the funnel, warm replies to answer,
 *           the call list (phone-only leads — call by hand, never automated texts) and the top leads.
 * UPDATED : 2026-10-05_0130 UTC — job-posting leads: add a business that posted a job for work we do; open its letter.
 * UPDATED : 2026-10-05_2134 UTC — Teaming partners (public bids) section; partners kept out of the funnel, call list and stats.
 * UPDATED : 2026-10-05_2141 UTC — every lead opens its own page with the full note history; latest note shown in the lists.
 * UPDATED : 2026-10-07_2030 UTC — job-posting leads show the posted pay and state.
 * UPDATED : 2026-10-19_2330 UTC — today's Deal hunter plan (AI) at the top.
 * UPDATED : 2026-10-19_2345 UTC — the Instantly banner names exactly which Vercel variable is missing.
 * UPDATED : 2026-10-20_0015 UTC — Call desk button.
 * UPDATED : 2026-10-28_1935 UTC — Sales letters card: what the engine sends, plus the two one-page letter templates (PDF / Word).
 */
import Link from "next/link";
import { BIZ_PARTNER_LABEL, BIZ_PARTNER_SEGMENT, BIZ_SEGMENTS, type BizSegment } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getBizLeadSettings } from "@/lib/biz-leads";
import { noteSummaries } from "@/lib/notes";
import { instantlyBizReady } from "@/lib/instantly";
import { Stat } from "@/components/ui";
import { BizLeadSettingsForm, BizLeadStatus, JobPostLeadForm } from "@/components/BizLeadAdmin";

export const dynamic = "force-dynamic";
type Lead = { id: string; business_name: string; segment: BizSegment; city: string | null; email: string | null; phone: string | null; website: string | null; rating: number | null; review_count: number | null; score: number; status: string; account_id: string | null; created_at: string; job_title: string | null; posting_source: string | null; posting_url: string | null; notes: string | null; posting_pay?: string | null; state?: string | null };

export default async function BizLeads() {
  const db = adminClient();
  const [s, { data }, { data: dealPlan }] = await Promise.all([getBizLeadSettings(), db.from("biz_leads").select("*").order("score", { ascending: false }).limit(2000),
    db.from("ops_alerts").select("title, body, created_at").eq("kind", "deal_plan").order("created_at", { ascending: false }).limit(1).maybeSingle()]);
  const everyone = (data ?? []) as Lead[];
  // which setting is missing, by name only (never the values)
  const missingInstantly = ["INSTANTLY_API_KEY", "INSTANTLY_BIZ_CAMPAIGN_ID", "BUSINESS_POSTAL_ADDRESS"].filter((k) => !process.env[k]?.trim());
  // teaming partners are tracked here but kept out of the sales funnel, call list and stats
  const partners = everyone.filter((l) => (l.segment as string) === BIZ_PARTNER_SEGMENT);
  const leads = everyone.filter((l) => (l.segment as string) !== BIZ_PARTNER_SEGMENT);
  const notes = await noteSummaries("biz_lead", everyone.map((l) => l.id));
  const lastNote = (id: string) => { const s = notes[id]; return s ? <div className="mt-1 text-xs text-ink-soft">📝 {new Date(s.last.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: {s.last.body.slice(0, 90)}{s.last.body.length > 90 ? "…" : ""}{s.count > 1 ? ` (+${s.count - 1} more)` : ""}</div> : null; };
  const n = (st: string | string[]) => leads.filter((l) => (Array.isArray(st) ? st : [st]).includes(l.status)).length;
  const Row = ({ l }: { l: Lead }) => (
    <tr className="border-t border-line">
      <td className="p-3"><Link href={`/hub/biz-leads/${l.id}`} className="font-semibold text-brand hover:underline">{l.business_name}</Link><div className="text-xs text-ink-soft">{BIZ_SEGMENTS[l.segment]?.label} · {l.city ?? "—"}{l.rating ? ` · ${l.rating}★ (${l.review_count})` : ""}</div>{lastNote(l.id)}
        {l.job_title && <div className="text-xs">📋 Posted: {l.posting_url ? <a href={l.posting_url} target="_blank" className="underline">{l.job_title}</a> : l.job_title}{l.posting_pay ? ` · pays ${l.posting_pay}` : ""}{l.posting_source ? ` (${l.posting_source})` : ""}{l.state ? ` · ${l.state}` : ""} · <Link href={`/hub/biz-leads/${l.id}/letter`} className="font-semibold text-brand underline">letter</Link></div>}</td>
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
        <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Business leads</h1><Link href="/hub/biz-leads/calls" className="btn-primary text-sm">📞 Call desk</Link></div>
        <p className="max-w-3xl text-sm text-ink-soft">The demand side: we find property managers, real estate brokerages, home stagers, self-storage facilities and furniture & appliance stores, get the contact email from their own website, and send a 3-email sequence with a pilot offer through Instantly’s business campaign. When they set up an account from the link, the pilot is applied automatically. Answer replies the same day; call the phone-only list by hand (and send LinkedIn messages yourself; automating LinkedIn breaks its rules).</p>
        {dealPlan && <details className="card mt-3" open={Date.now() - new Date(dealPlan.created_at).getTime() < 86400000}><summary className="cursor-pointer font-semibold">🎯 {dealPlan.title} <span className="text-xs font-normal text-ink-soft">({new Date(dealPlan.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Detroit" })}, Deal hunter)</span></summary><pre className="mt-2 whitespace-pre-wrap text-sm">{dealPlan.body}</pre></details>}
        {!instantlyBizReady() && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">Instantly isn’t connected yet. Missing in Vercel (Production): <b>{missingInstantly.join(", ")}</b>. Add {missingInstantly.length === 1 ? "it" : "them"} in Vercel → your project → Settings → Environment Variables, then <b>redeploy</b> (new variables only reach the site after a redeploy). The campaign id for 1ST OUTREACH DETROIT is <code>3de836a0-4845-4350-80af-db9725831b43</code>.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <Stat label="Found" value={leads.length} />
        <Stat label="With email" value={leads.filter((l) => l.email).length} />
        <Stat label="Emailing" value={n(["queued", "emailing"])} />
        <Stat label="Clicked" value={n("clicked")} />
        <Stat label="Replied" value={n("replied")} hint="answer today" />
        <Stat label="Accounts" value={n("converted")} hint="set up from the email" />
      </div>
      {partners.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-bold">Teaming partners (public bids)</h2>
          <p className="mb-2 text-sm text-ink-soft">Firms we're approaching to bid City and public contracts together. Contact them by hand from your own mailbox. They never get the automated sales emails or Email Center blasts. Update the status as they reply.</p>
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Firm</th><th className="p-3">Why them</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
            <tbody>{partners.map((l) => (
              <tr key={l.id} className="border-t border-line align-top">
                <td className="p-3"><Link href={`/hub/biz-leads/${l.id}`} className="font-semibold text-brand hover:underline">{l.business_name}</Link><div className="text-xs text-ink-soft">{BIZ_PARTNER_LABEL}{l.city ? ` · ${l.city}` : ""}</div>{l.website && <a href={l.website} target="_blank" className="text-xs underline">website</a>}{l.email && <div className="text-xs">{l.email}</div>}{l.phone && <div className="text-xs">{l.phone}</div>}</td>
                <td className="p-3 text-xs whitespace-pre-wrap">{l.notes ?? ""}{lastNote(l.id)}</td>
                <td className="p-3 text-xs">{l.status === "call" ? "to contact" : l.status.replace("_", " ")}</td>
                <td className="p-3"><BizLeadStatus id={l.id} partner /></td>
              </tr>
            ))}</tbody></table></div>
        </section>
      )}
      <div className="card"><BizLeadSettingsForm s={s} /></div>
      <section className="card">
        <h2 className="text-lg font-bold">Add a business from a job posting</h2>
        <p className="mb-3 text-sm text-ink-soft">A business hiring a cleaner, handyman, maintenance tech, groundskeeper or mover is a business that needs that work done. They get the letter “book the work as a service instead of hiring for it” (cost comparison, upfront prices, vetted pros, guarantee, pilot offer) as a 3-email sequence, or print it / save it as a PDF from the letter page.</p>
        <JobPostLeadForm sendingReady={instantlyBizReady()} />
      </section>
      <section className="card">
        <h2 className="text-lg font-bold">Sales letters</h2>
        <p className="mt-1 text-sm text-ink-soft">The engine's day-0 email to each lead is the matching letter: employers hiring for cleaning or maintenance get "Before you hire — get it covered this week", property managers get "Rent-ready turnovers. One booking." Open a lead → Letter to print it for that business. One-page templates on the letterhead for mail or attachments (fill in the [brackets]):</p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <li>Employers hiring: <a className="font-semibold text-brand underline" href="/sales/HANDLED_LETTER_EMPLOYERS_2026-10-28_1925.pdf" target="_blank">PDF</a> · <a className="font-semibold text-brand underline" href="/sales/HANDLED_LETTER_EMPLOYERS_2026-10-28_1925.docx">Word</a></li>
          <li>Property managers: <a className="font-semibold text-brand underline" href="/sales/HANDLED_LETTER_PROPERTY_MANAGERS_2026-10-28_1925.pdf" target="_blank">PDF</a> · <a className="font-semibold text-brand underline" href="/sales/HANDLED_LETTER_PROPERTY_MANAGERS_2026-10-28_1925.docx">Word</a></li>
        </ul>
      </section>
      {leads.some((l) => l.job_title) && <section><h2 className="mb-2 text-lg font-bold">From job postings</h2>{table(leads.filter((l) => l.job_title).slice(0, 50))}</section>}
      {n("replied") > 0 && <section><h2 className="mb-2 text-lg font-bold">Replied: answer today</h2>{table(leads.filter((l) => l.status === "replied"))}</section>}
      {n("call") > 0 && <section><h2 className="mb-2 text-lg font-bold">Call list (no email found)</h2>{table(leads.filter((l) => l.status === "call").slice(0, 50))}</section>}
      <section><h2 className="mb-2 text-lg font-bold">Top leads</h2>{leads.length ? table(leads.filter((l) => !["call", "replied"].includes(l.status)).slice(0, 100)) : <p className="text-sm text-ink-soft">No leads yet. Turn the engine on (and set GOOGLE_PLACES_API_KEY) or wait for the next weekday run.</p>}</section>
    </div>
  );
}
