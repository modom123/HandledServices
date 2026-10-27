/*
 * FILE    : apps/web/app/hub/recruiting/onboarding/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Hub → Recruiting → Onboarding: everyone between "invited" and "live", with their contracts and documents, in
 *           the order work needs doing:
 *             1 Waiting on us     — documents to verify (inline Open / Verify / Reject; the AI document checker reads them
 *                                   first), background results to review, pros ready to activate
 *             2 Waiting on the pro — the setup steps still missing (W-9, contractor agreement, insurance, license, ID,
 *                                   background consent, payout…), days since invite, reminders sent, one-click nudge
 *           Activation goes through activatePro (logged, and the pro is told they're live). Same checklist the pro sees
 *           (core onboardingChecklist); the daily sweep sends the reminders. Contracts: Hub → Recruiting → Contracts.
 *           New hires on our own team: their employee paperwork runs in payroll, listed at the bottom.
 */
import Link from "next/link";
import { onboardingChecklist, type Contractor } from "@handled/core";
import { getViewer, isAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { DocDecision, ProStatusControls, RecruitingRowActions } from "@/components/HubActions";

export const dynamic = "force-dynamic";

const days = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
const DOC_LABEL: Record<string, string> = { w9: "W-9", coi: "Insurance (COI)", license: "Trade license", background: "Background report", agreement: "Signed agreement", auto: "Commercial auto", workers_comp: "Workers' comp", bond: "Bond", liquor: "Liquor liability", passenger_auto: "Passenger auto", cargo: "Cargo insurance", certification: "Certification", skills: "Skills check", resume: "Résumé", photo: "Profile photo", other: "Other" };

export default async function Onboarding() {
  const v = await getViewer();
  if (!v) return null;
  const db = adminClient();
  const [{ data: pros }, { data: docs }, { data: hires }] = await Promise.all([
    db.from("contractors").select("*").eq("status", "vetting").is("dropped_at", null).order("invited_at", { ascending: true }).limit(500),
    db.from("contractor_documents").select("id, contractor_id, kind, status, created_at, notes, storage_path, ai_check").eq("status", "pending").not("storage_path", "is", null).order("created_at").limit(1000),
    db.from("talent_placements").select("id, start_date, created_at, talent_candidates(full_name), talent_searches(title), talent_clients!inner(internal)").eq("talent_clients.internal", true).order("created_at", { ascending: false }).limit(20),
  ]);
  type Doc = { id: string; contractor_id: string; kind: string; created_at: string; notes: string | null; ai_check: { meets_requirements?: boolean; expires_on?: string | null; problems?: string[] } | null };
  const docsOf = (id: string) => ((docs ?? []) as Doc[]).filter((d) => d.contractor_id === id);
  const rows = ((pros ?? []) as (Contractor & Record<string, unknown>)[]).map((c) => {
    const { steps, complete } = onboardingChecklist(c as never);
    const pending = docsOf(c.id);
    const bg = String(c.background_status ?? "");
    const onUs = pending.length > 0 || ["consider", "suspended"].includes(bg) || complete;
    return { c, steps, complete, pending, bg, onUs, left: steps.filter((s) => !s.done && !s.optional), done: steps.filter((s) => s.done).length };
  });
  const usRows = rows.filter((r) => r.onUs);
  const proRows = rows.filter((r) => !r.onUs);
  const admin = isAdmin(v);

  const Card = ({ r }: { r: (typeof rows)[number] }) => (
    <div className="card text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/hub/pros/${r.c.id}`} className="font-semibold underline decoration-dotted">{String(r.c.business_name)}</Link>
          <div className="text-xs text-ink-soft">{String(r.c.contact_name)} · {String(r.c.email)} · {(r.c.trades ?? []).join(", ")} · invited {days(r.c.invited_at as string) ?? "?"}d ago · {Number(r.c.onboarding_reminders ?? 0)} reminder(s)</div>
        </div>
        <div className="text-right text-xs"><div className="font-semibold">{r.done}/{r.steps.length} steps</div>{r.bg && <div className={["consider", "suspended"].includes(r.bg) ? "font-semibold text-rose-700" : "text-ink-soft"}>background: {r.bg}</div>}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full bg-brand" style={{ width: `${(r.done / Math.max(1, r.steps.length)) * 100}%` }} /></div>
      {r.pending.length > 0 && (
        <ul className="mt-3 space-y-2">
          {r.pending.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2">
              <span><b>{DOC_LABEL[d.kind] ?? d.kind}</b> uploaded {days(d.created_at)}d ago{d.ai_check ? <span className="text-xs text-ink-soft"> · AI read: {d.ai_check.meets_requirements ? "✓ meets requirements" : `⚠ ${d.ai_check.problems?.join("; ") || "check it"}`}{d.ai_check.expires_on ? ` · expires ${d.ai_check.expires_on}` : ""}</span> : null}</span>
              <DocDecision contractorId={r.c.id} docId={d.id} />
            </li>
          ))}
        </ul>
      )}
      {["consider", "suspended"].includes(r.bg) && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800">Background result needs review in your screening provider. Follow the adverse-action process before any decision.</p>}
      {r.left.length > 0 && <div className="mt-2 text-xs text-ink-soft">Still to do: {r.left.map((s) => s.label).join(" · ")}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.complete && admin && <div className="w-full"><ProStatusControls id={r.c.id} status={String(r.c.status)} complete={r.complete} /></div>}
        {!r.complete && <RecruitingRowActions appId={(r.c.application_id as string) ?? null} contractorId={r.c.id} stage="onboarding" />}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <p className="text-sm text-ink-soft">Everyone between “invited” and “live”: contracts, documents, background check and payout — the same checklist the pro sees. The AI reads every uploaded document first; a person verifies. Reminders go out automatically every day. Contract versions and who signed what: <Link href="/hub/contracts" className="font-semibold text-brand underline">Contracts</Link>.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">In setup</div><div className="mt-1 text-3xl font-extrabold">{rows.length}</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Documents to verify</div><div className={`mt-1 text-3xl font-extrabold ${(docs ?? []).length ? "text-amber-700" : ""}`}>{(docs ?? []).length}</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Ready to activate</div><div className={`mt-1 text-3xl font-extrabold ${rows.some((r) => r.complete) ? "text-brand" : ""}`}>{rows.filter((r) => r.complete).length}</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Stuck 7+ days</div><div className="mt-1 text-3xl font-extrabold">{proRows.filter((r) => (days(r.c.invited_at as string) ?? 0) >= 7).length}</div></div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">1 · Waiting on us <span className="text-sm font-normal text-ink-soft">({usRows.length})</span></h2>
        {!usRows.length && <p className="card text-sm text-ink-soft">Nothing waiting on us. 👍</p>}
        {usRows.map((r) => <Card key={r.c.id} r={r} />)}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">2 · Waiting on the pro <span className="text-sm font-normal text-ink-soft">({proRows.length})</span></h2>
        {!proRows.length && <p className="card text-sm text-ink-soft">Nobody mid-setup.</p>}
        {proRows.map((r) => <Card key={r.c.id} r={r} />)}
      </section>

      <section className="card text-sm">
        <h2 className="font-bold">New hires on our own team</h2>
        <p className="mt-1 text-ink-soft">People hired for Handled staff roles. Their employee paperwork (offer letter, W-4, I-9, direct deposit) runs in payroll, not in this system.</p>
        {!(hires ?? []).length && <p className="mt-2 text-ink-soft">None yet.</p>}
        <ul className="mt-2 space-y-1">{((hires ?? []) as unknown as { id: string; start_date: string; talent_candidates: { full_name: string } | null; talent_searches: { title: string } | null }[]).map((h) => <li key={h.id}>{h.talent_candidates?.full_name ?? "—"} · {h.talent_searches?.title ?? ""} · starts {h.start_date}</li>)}</ul>
      </section>
    </div>
  );
}
