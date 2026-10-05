/*
 * FILE    : apps/web/app/hub/gov/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1441 UTC
 * PURPOSE : One government contract opportunity: the fit (reasons and red flags), key facts and contacts, the AI bid
 *           brief, the full notice text, pipeline status and notes, and the pros who could fill it (ask them, record
 *           their answers). Links to the notice on SAM.gov for attachments and submitting.
 * UPDATED : 2026-10-05_1954 UTC — Start a bid (bid engine workspace).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { GOV_NAICS_BY_CODE, SERVICE_BY_SLUG, SET_ASIDES, type GovFit } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { matchingPros, noticeTypeLabel, type GovSummary } from "@/lib/gov";
import { aiEnabled } from "@/lib/ai/client";
import { GovPros, GovReadButtons, GovStatus } from "@/components/GovAdmin";
import { StartBidButton } from "@/components/BidWorkspace";

export const dynamic = "force-dynamic";

export default async function GovNotice({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const { data: o } = await adminClient().from("gov_opportunities").select("*").eq("notice_id", id).maybeSingle();
  if (!o) notFound();
  const fit = (o.fit ?? { reasons: [], flags: [], services: [] }) as GovFit;
  const ai = o.ai_summary as GovSummary | null;
  const [pros, { data: bid }] = await Promise.all([matchingPros(id), adminClient().from("bids").select("id").eq("notice_id", id).not("status", "in", "(no_bid,cancelled)").maybeSingle()]);
  const contacts = (o.contacts ?? []) as { name: string | null; email: string | null; phone: string | null; type: string | null }[];
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" }) : "—");
  const fact = (label: string, value: React.ReactNode) => <div><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div><div className="text-sm">{value || "—"}</div></div>;
  const samLink = `https://sam.gov/opp/${encodeURIComponent(o.notice_id)}/view`;
  return (
    <div className="space-y-6">
      <Link href="/hub/gov" className="text-sm text-brand">← Government contracts</Link>
      <div>
        <div className="text-xs text-ink-soft">{noticeTypeLabel(o.ptype, o.notice_type)}{o.solicitation_number ? ` · ${o.solicitation_number}` : ""}</div>
        <h1 className="text-2xl font-bold">{o.title}</h1>
        <div className="text-sm text-ink-soft">{o.agency ?? "—"}{o.office ? ` / ${o.office}` : ""}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3"><StartBidButton noticeId={o.notice_id} bidId={bid?.id ?? null} /><a href={samLink} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand underline">Open on SAM.gov (attachments, Q&A, how to respond) ↗</a></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-3 lg:col-span-2">
          <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-sm font-bold ${o.fit_score >= 70 ? "bg-green-100 text-green-800" : o.fit_score >= 40 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>Fit {o.fit_score}</span>
            {fit.services?.length ? <span className="text-sm">Our services: {fit.services.map((s) => SERVICE_BY_SLUG[s]?.name ?? s).join(", ")}</span> : null}</div>
          {fit.reasons?.length > 0 && <ul className="text-sm">{fit.reasons.map((r) => <li key={r}>✓ {r}</li>)}</ul>}
          {fit.flags?.length > 0 && <ul className="text-sm text-amber-800">{fit.flags.map((r) => <li key={r}>⚠ {r}</li>)}</ul>}
          <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
            {fact("Respond by", fmt(o.response_deadline))}
            {fact("Posted", o.posted_date)}
            {fact("Place of work", [o.pop_city, o.pop_state, o.pop_zip].filter(Boolean).join(", "))}
            {fact("NAICS", o.naics ? `${o.naics}${GOV_NAICS_BY_CODE[o.naics] ? ` · ${GOV_NAICS_BY_CODE[o.naics].title}` : ""}` : null)}
            {fact("Set-aside", o.set_aside_code ? SET_ASIDES[o.set_aside_code]?.label ?? o.set_aside : "Open to all")}
            {fact("Product/service code", o.psc)}
            {o.award_amount ? fact("Award", `$${Number(o.award_amount).toLocaleString("en-US")}${o.awardee ? ` · ${o.awardee}` : ""}`) : null}
          </div>
          {contacts.length > 0 && <div className="border-t border-line pt-3 text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Contracting contacts</div>{contacts.map((c, i) => <div key={i}>{c.name ?? "—"}{c.type ? ` (${c.type})` : ""} · {c.email ? <a className="underline" href={`mailto:${c.email}`}>{c.email}</a> : ""} {c.phone ?? ""}</div>)}</div>}
        </section>
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Pipeline</h2>
          <GovStatus id={o.notice_id} status={o.status} notes={o.notes} />
        </section>
      </div>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Bid brief</h2><GovReadButtons id={o.notice_id} hasText={Boolean(o.description)} hasSummary={Boolean(ai)} aiReady={aiEnabled()} /></div>
        {ai ? (
          <div className="space-y-3 text-sm">
            <p className={`rounded-xl p-3 font-semibold ${ai.recommendation === "bid" ? "bg-green-50 text-green-900" : ai.recommendation === "pass" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"}`}>{ai.recommendation === "bid" ? "✓ Bid" : ai.recommendation === "pass" ? "✗ Pass" : "? Maybe"} — {ai.reason}</p>
            <p>{ai.summary}</p>
            {ai.scope.length > 0 && <div><b>Scope</b><ul className="list-disc pl-5">{ai.scope.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {fact("Period", ai.period)}{fact("Place", ai.place)}{fact("Wage rules", ai.wage_rules)}{fact("Insurance & bonds", ai.insurance_bonds)}{fact("Site visit", ai.site_visit)}{fact("Set-aside notes", ai.set_aside_notes)}{fact("Pros needed", ai.pros_needed)}
              {fact("Deadlines", ai.deadlines.length ? ai.deadlines.join(" · ") : null)}
            </div>
            {ai.risks.length > 0 && <div><b>Risks</b><ul className="list-disc pl-5 text-amber-900">{ai.risks.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            <p className="text-xs text-ink-soft">AI brief from the notice text: check it against the solicitation and its attachments on SAM.gov before bidding.</p>
          </div>
        ) : <p className="text-sm text-ink-soft">Get the AI bid brief (it loads the full notice first), or open the notice on SAM.gov.</p>}
        {o.description && <details className="border-t border-line pt-3 text-sm"><summary className="cursor-pointer font-semibold">Full notice text</summary><pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans text-sm">{o.description}</pre></details>}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Pros who could fill it</h2>
        <GovPros id={o.notice_id} pros={pros} />
      </section>
    </div>
  );
}
