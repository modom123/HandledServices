/*
 * FILE    : apps/web/app/hub/gov/awards/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-19_2015 UTC
 * PURPOSE : Handled Hub → Gov contracts → Awards & recompetes: federal contracts already awarded (SAM.gov Contract
 *           Awards API) for the work our pros do. Best recompete leads first (ending in 3–18 months, in Michigan /
 *           metro Detroit, our NAICS), who the incumbents are, and what the work is worth — so we're ready before
 *           the follow-on solicitation posts.
 * UPDATED : 2026-10-19_2140 UTC — Subcontract targets first: primes doing our focus work now (landscaping, painting,
 *           AI automation), best to subcontract under (large business + subcontracting plan + time left + local or
 *           remote), with phone, address and a copy-ready pitch.
 */
import Link from "next/link";
import { BRAND, GOV_NAICS_BY_CODE, SET_ASIDES, incumbents, monthsToEnd, primeTargets, subPitch, type GovAward } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { callsToday, getGovSettings, govReady } from "@/lib/gov";
import { Stat } from "@/components/ui";
import { AwardStatus, CopyText, GovAwardsForm } from "@/components/GovAdmin";

export const dynamic = "force-dynamic";

type Row = GovAward & { fit_score: number; fit: { flags?: string[]; reasons?: string[] } | null; sub_score: number; sub_fit: { flags?: string[]; reasons?: string[] } | null; status: string };

const money = (n: number | null) => (n == null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const day = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—");

export default async function GovAwards({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const [s, used, { data }] = await Promise.all([
    getGovSettings(),
    callsToday(),
    adminClient().from("gov_awards").select("*").order("fit_score", { ascending: false }).order("ultimate_end", { ascending: true, nullsFirst: false }).limit(1000),
  ]);
  const rows = (data ?? []) as Row[];
  const ending = (r: Row) => { const m = monthsToEnd(r); return m != null && m >= 0 && m <= 18; };
  const list = rows.filter((r) => (status ? r.status === status : r.status === "new"));
  const inc = incumbents(rows.filter((r) => r.status !== "ignored")).slice(0, 15);
  const primes = primeTargets(rows.filter((r) => r.status !== "ignored")).slice(0, 25);
  const sizeLabel = (x: string | null) => (x === "O" ? "Large business" : x === "S" ? "Small business" : "Size not listed");
  const tab = (href: string, label: string, on: boolean) => <Link href={href} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{label}</Link>;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/hub/bids?view=gov" className="text-sm text-brand hover:underline">← Gov contracts</Link>
        <h1 className="text-2xl font-bold">Awards &amp; recompetes</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Federal contracts already awarded for the work our pros do (SAM.gov Contract Awards — the old FPDS data). Each one shows who holds it, what it’s worth and when it ends. Agencies usually post the follow-on 3–12 months before the end, so a contract ending in the next 18 months is a lead: learn the incumbent’s price, meet the contracting office, and watch for the sources-sought notice.</p>
        {!govReady() && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">Set <code>SAM_API_KEY</code> in Vercel first (the same key as opportunities — see Gov contracts).</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Primes to call" value={primes.filter((p) => p.best_score >= 50).length} hint="subcontract score 50+" />
        <Stat label="Ending ≤ 18 months" value={rows.filter((r) => r.status !== "ignored" && ending(r)).length} hint="recompete window" />
        <Stat label="Good leads (60+)" value={rows.filter((r) => r.status === "new" && r.fit_score >= 60).length} />
        <Stat label="Watching" value={rows.filter((r) => r.status === "watching").length} />
      </div>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Search contract awards</h2>
        <GovAwardsForm s={{ awards_naics: s.awards_naics, state: s.state, awards_enabled: s.awards_enabled, awards_months_back: s.awards_months_back, awards_pages: s.awards_pages }} ready={govReady()} callsLeft={Math.max(0, s.daily_call_budget - used)} />
      </section>
      <section>
        <h2 className="text-lg font-bold">Subcontract targets</h2>
        <p className="mb-2 max-w-3xl text-sm text-ink-soft">Prime contractors doing our focus work right now. Best first: large businesses (they count small-business subcontracts toward their goals), with a subcontracting plan, time left on the contract, and work in Michigan, or remote for AI automation. Call the prime’s small-business liaison or project manager. Have our SAM.gov registration, capability statement and insurance certificates ready.</p>
        {primes.length ? (
          <div className="space-y-3">
            {primes.map((t) => (
              <details key={t.uei ?? t.awardee} className="card">
                <summary className="flex cursor-pointer flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${t.best_score >= 70 ? "bg-green-100 text-green-800" : t.best_score >= 45 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{t.best_score}</span>
                    <b>{t.awardee}</b> <span className="text-xs text-ink-soft">{sizeLabel(t.size)}{t.sub_plan ? " · has a subcontracting plan" : ""}</span>
                    <div className="text-xs text-ink-soft">{t.contracts} active contract{t.contracts === 1 ? "" : "s"} · {money(t.active_value)} · {t.naics.map((c) => GOV_NAICS_BY_CODE[c]?.title ?? c).join(", ")} · {t.agencies.slice(0, 2).join(", ")}</div>
                    <div className="text-xs text-ink-soft">{t.places.slice(0, 3).join("; ")}{t.next_end ? ` · next ends ${day(t.next_end)}` : ""}</div>
                  </div>
                  <div className="text-right text-xs">{t.phone && <a className="text-brand hover:underline" href={`tel:${t.phone.replace(/[^\d+]/g, "")}`}>{t.phone}</a>}<div className="text-ink-soft">{t.address ?? ""}</div><div className="text-ink-soft">{t.uei ? `UEI ${t.uei}` : ""}</div></div>
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="text-xs">
                    <div className="font-semibold">Their contracts</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {rows.filter((r) => t.keys.includes(r.award_key)).map((r) => (
                        <li key={r.award_key}>{r.description ?? r.psc_title ?? r.award_key} <span className="text-ink-soft">({r.award_key} · {[r.pop_city, r.pop_state].filter(Boolean).join(", ") || "—"} · ends {day(r.ultimate_end ?? r.current_end)})</span>{r.sub_fit?.flags?.[0] && <div className="text-amber-800">⚠ {r.sub_fit.flags[0]}</div>}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-ink-soft">Look them up on SAM.gov (Entity Information → search the UEI) for their small-business liaison and contacts.</p>
                  </div>
                  <div><div className="mb-1 text-xs font-semibold">Pitch (call or email)</div><CopyText text={subPitch(t, { company: BRAND.name, city: "Detroit" })} /></div>
                </div>
              </details>
            ))}
          </div>
        ) : <p className="text-sm text-ink-soft">No active primes yet. Search awards above (★ focus codes are picked for you).</p>}
      </section>
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-bold">Recompete leads</h2>
          {tab("/hub/gov/awards", "New", !status)}
          {tab("/hub/gov/awards?status=watching", "Watching", status === "watching")}
          {tab("/hub/gov/awards?status=ignored", "Ignored", status === "ignored")}
        </div>
        {list.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Fit</th><th className="p-3">Contract</th><th className="p-3">Incumbent</th><th className="p-3">Value</th><th className="p-3">Ends</th><th className="p-3"></th></tr></thead>
              <tbody>
                {list.slice(0, 200).map((r) => {
                  const m = monthsToEnd(r);
                  return (
                    <tr key={r.award_key} className="border-t border-line align-top">
                      <td className="p-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${r.fit_score >= 60 ? "bg-green-100 text-green-800" : r.fit_score >= 35 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{r.fit_score}</span></td>
                      <td className="p-3">
                        <div className="font-semibold">{r.description ?? r.psc_title ?? "Contract"}</div>
                        <div className="text-xs text-ink-soft">{r.award_key} · {r.subtier ?? r.agency ?? "—"}{r.office ? ` / ${r.office}` : ""}</div>
                        <div className="text-xs text-ink-soft">NAICS {r.naics ?? "—"}{r.naics && GOV_NAICS_BY_CODE[r.naics] ? ` · ${GOV_NAICS_BY_CODE[r.naics].title}` : ""} · {[r.pop_city, r.pop_state].filter(Boolean).join(", ") || "place not listed"}{r.set_aside_code ? ` · ${SET_ASIDES[r.set_aside_code]?.label ?? r.set_aside ?? r.set_aside_code}` : ""}{r.offers_received != null ? ` · ${r.offers_received} offer${r.offers_received === 1 ? "" : "s"}` : ""}</div>
                        {r.fit?.flags?.[0] && <div className="text-xs text-amber-800">⚠ {r.fit.flags[0]}</div>}
                      </td>
                      <td className="p-3 text-xs">{r.awardee ?? "—"}<div className="text-ink-soft">{r.awardee_uei ?? ""}</div></td>
                      <td className="p-3 text-xs">{money(r.total_value)}<div className="text-ink-soft">obligated {money(r.obligated)}</div></td>
                      <td className="p-3 text-xs">{day(r.ultimate_end ?? r.current_end)}<div className="text-ink-soft">{m == null ? "" : m < 0 ? "ended" : `${m} mo`}</div></td>
                      <td className="p-3"><AwardStatus awardKey={r.award_key} status={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-ink-soft">Nothing here yet. Pick the work above and search awards.</p>}
      </section>
      {inc.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Who holds this work now</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Incumbent</th><th className="p-3">Contracts</th><th className="p-3">Total value</th><th className="p-3">NAICS</th><th className="p-3">Next ends</th></tr></thead>
              <tbody>
                {inc.map((i) => (
                  <tr key={i.uei ?? i.awardee} className="border-t border-line">
                    <td className="p-3 font-semibold">{i.awardee}<div className="text-xs font-normal text-ink-soft">{i.uei ?? ""}</div></td>
                    <td className="p-3 text-xs">{i.contracts}</td>
                    <td className="p-3 text-xs">{money(i.total_value)}</td>
                    <td className="p-3 text-xs">{i.naics.join(", ")}</td>
                    <td className="p-3 text-xs">{day(i.next_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Big incumbents are also subcontracting prospects: their small-business liaison may want local pros for the next term.</p>
        </section>
      )}
    </div>
  );
}
