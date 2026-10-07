/*
 * FILE    : apps/web/app/hub/gov/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_1441 UTC
 * PURPOSE : Handled Hub → Gov contracts: federal contract opportunities from SAM.gov for work our pros do. The saved
 *           daily search and "search now" (inside the daily call budget), the pipeline (new → reviewing → bidding →
 *           submitted → won / lost, or passed), best fits first with deadlines, and the bid checklist.
 */
import Link from "next/link";
import { GOV_BID_CHECKLIST, GOV_NAICS_BY_CODE, SET_ASIDES } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { callsToday, getGovSettings, govReady, noticeTypeLabel } from "@/lib/gov";
import { Stat } from "@/components/ui";
import { GovSearchForm } from "@/components/GovAdmin";

export const dynamic = "force-dynamic";

type Row = { notice_id: string; title: string; agency: string | null; office: string | null; ptype: string | null; notice_type: string | null; set_aside_code: string | null; set_aside: string | null; naics: string | null; response_deadline: string | null; pop_city: string | null; pop_state: string | null; fit_score: number; fit: { flags?: string[]; biddable?: boolean } | null; status: string; posted_date: string | null };

function due(d: string | null) {
  if (!d) return "—";
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  const date = new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Detroit" });
  return days < 0 ? `closed ${date}` : days === 0 ? `today` : `${date} (${days}d)`;
}

export default async function GovContracts({ searchParams }: { searchParams: Promise<{ status?: string; all?: string }> }) {
  const { status, all } = await searchParams;
  const db = adminClient();
  const [s, used, { data }] = await Promise.all([
    getGovSettings(),
    callsToday(),
    db.from("gov_opportunities").select("notice_id, title, agency, office, ptype, notice_type, set_aside_code, set_aside, naics, response_deadline, pop_city, pop_state, fit_score, fit, status, posted_date").order("fit_score", { ascending: false }).order("response_deadline", { ascending: true, nullsFirst: false }).limit(1000),
  ]);
  const rows = (data ?? []) as Row[];
  const open = (r: Row) => !r.response_deadline || new Date(r.response_deadline).getTime() > Date.now();
  const active = rows.filter((r) => ["reviewing", "bidding", "submitted"].includes(r.status));
  const list = rows.filter((r) => (status ? r.status === status : r.status === "new" && (all ? true : open(r) && r.fit?.biddable !== false)));
  const n = (st: string) => rows.filter((r) => r.status === st).length;
  const table = (items: Row[]) => (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Fit</th><th className="p-3">Opportunity</th><th className="p-3">Where</th><th className="p-3">Respond by</th><th className="p-3">Status</th></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.notice_id} className="border-t border-line align-top">
              <td className="p-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${r.fit_score >= 70 ? "bg-green-100 text-green-800" : r.fit_score >= 40 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{r.fit_score}</span></td>
              <td className="p-3">
                <Link href={`/hub/gov/${encodeURIComponent(r.notice_id)}`} className="font-semibold text-brand hover:underline">{r.title}</Link>
                <div className="text-xs text-ink-soft">{noticeTypeLabel(r.ptype, r.notice_type)} · {r.agency ?? "—"}{r.office ? ` / ${r.office}` : ""}</div>
                <div className="text-xs text-ink-soft">NAICS {r.naics ?? "—"}{r.naics && GOV_NAICS_BY_CODE[r.naics] ? ` · ${GOV_NAICS_BY_CODE[r.naics].title}` : ""}{r.set_aside_code ? ` · ${SET_ASIDES[r.set_aside_code]?.label ?? r.set_aside ?? r.set_aside_code}` : " · open to all"}</div>
                {r.fit?.flags?.[0] && <div className="text-xs text-amber-800">⚠ {r.fit.flags[0]}</div>}
              </td>
              <td className="p-3 text-xs">{[r.pop_city, r.pop_state].filter(Boolean).join(", ") || "—"}</td>
              <td className="p-3 text-xs">{due(r.response_deadline)}</td>
              <td className="p-3 text-xs capitalize">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const tab = (href: string, label: string, on: boolean) => <Link href={href} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{label}</Link>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Government contracts</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Federal contract opportunities from SAM.gov for the work our pros do: janitorial, grounds and snow, security, hauling, moves, trades, couriers, rides and catering. Every notice is scored for fit (our NAICS codes, Michigan and metro Detroit, set-asides we can claim, time to respond). Open one to read it, get an AI bid brief, and ask matching pros whether they want the work before you bid.</p>
        {!govReady() && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">Searching isn’t set up: sign in at SAM.gov → your Workspace → profile → <b>Public API Key</b> → copy it into Vercel as <code>SAM_API_KEY</code> (type it there, never in chat or email). A personal key allows about 10 calls a day; once Handled is registered in SAM.gov and your account has a role at the entity, it’s about 1,000.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <Stat label="New, open" value={rows.filter((r) => r.status === "new" && open(r) && r.fit?.biddable !== false).length} hint="to review" />
        <Stat label="Good fit (70+)" value={rows.filter((r) => r.status === "new" && open(r) && r.fit_score >= 70).length} />
        <Stat label="Reviewing" value={n("reviewing")} />
        <Stat label="Bidding" value={n("bidding")} />
        <Stat label="Submitted" value={n("submitted")} />
        <Stat label="Won" value={n("won")} />
      </div>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Search SAM.gov</h2>
        <GovSearchForm s={{ enabled: s.enabled, naics: s.naics, state: s.state, keywords: s.keywords, ptypes: s.ptypes, days_back: s.days_back, daily_call_budget: s.daily_call_budget, certifications: s.certifications }} ready={govReady()} callsLeft={Math.max(0, s.daily_call_budget - used)} />
        {s.last_run_at && <p className="mt-2 text-xs text-ink-soft">Last daily run: {new Date(s.last_run_at).toLocaleString("en-US", { timeZone: "America/Detroit" })}</p>}
      </section>
      {active.length > 0 && <section><h2 className="mb-2 text-lg font-bold">In progress</h2>{table(active)}</section>}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-bold">Opportunities</h2>
          {tab("/hub/gov", "New & open", !status && !all)}
          {tab("/hub/gov?all=1", "All new", !status && Boolean(all))}
          {["won", "lost", "passed"].map((x) => tab(`/hub/gov?status=${x}`, x[0].toUpperCase() + x.slice(1), status === x))}
        </div>
        {list.length ? table(list.slice(0, 200)) : <p className="text-sm text-ink-soft">Nothing here yet. Pick the work we can fill above and search, or switch on the daily search.</p>}
      </section>
      <section className="card">
        <h2 className="text-lg font-bold">Before we bid</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {GOV_BID_CHECKLIST.map((c) => <li key={c.id}><b>{c.title}.</b> <span className="text-ink-soft">{c.detail}</span>{c.counsel && <span className="ml-1 text-xs text-amber-800">(check with counsel / a contracts adviser)</span>}</li>)}
        </ol>
        <p className="mt-3 text-xs text-ink-soft">SAM.gov covers federal work. Michigan state bids are on SIGMA VSS, and many cities, counties and school districts post on BidNet Direct (MITN) — search those by hand.</p>
      </section>
    </div>
  );
}
