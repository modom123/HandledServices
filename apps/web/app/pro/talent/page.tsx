/*
 * FILE    : apps/web/app/pro/talent/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Pro portal → Talent (recruiters): the searches you're on with the job order and must-haves, your pipeline
 *           per search (add candidates with résumé, screen, submit with consent and a write-up), what clients said,
 *           and your hires and earnings (paid in the weekly payout once the client pays).
 */
import Link from "next/link";
import { TALENT_TERMS, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { recruiterFor } from "@/lib/talent";
import { AddCandidateForm, Pipeline, type PipeRow } from "@/components/TalentUI";
import { Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProTalent() {
  const v = await getViewer();
  const rec = await recruiterFor(v?.contractorId ?? null);
  if (!rec) return (
    <div className="card max-w-xl text-sm">
      <h1 className="text-xl font-bold">Handled Talent is for recruiters</h1>
      <p className="mt-2 text-ink-soft">Recruit for {"Handled"} Talent clients as an independent recruiter and earn {TALENT_TERMS.recruiterPct}% of the hire&apos;s first-year base salary. Add the trade “Recruiter (Handled Talent)” in <Link className="underline" href="/pro/onboarding">Setup &amp; documents</Link>; once approved, your searches show up here.</p>
    </div>
  );
  const db = adminClient();
  const { data: mine } = await db.from("talent_search_recruiters").select("role, talent_searches(id, title, status, type, location, workplace, salary_min, salary_max, description, must_haves, fee_pct, recruiter_pct, minimum_fee, talent_clients(company))").eq("contractor_id", rec.id);
  const searches = (mine ?? []).map((m) => ({ role: m.role, s: m.talent_searches as unknown as { id: string; title: string; status: string; type: string; location: string | null; workplace: string; salary_min: number | null; salary_max: number | null; description: string | null; must_haves: string | null; fee_pct: number; recruiter_pct: number; minimum_fee: number; talent_clients: { company: string } } })).filter((x) => x.s);
  const ids = searches.map((x) => x.s.id);
  const [{ data: subs }, { data: placements }, { data: pays }] = await Promise.all([
    ids.length ? db.from("talent_submissions").select("id, search_id, stage, pitch, submitted_at, client_feedback, client_decision, expected_salary, recruiter_id, talent_candidates(full_name, email, current_title, location, resume_path)").in("search_id", ids).eq("recruiter_id", rec.id).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] as never[] }),
    db.from("talent_placements").select("id, fee, recruiter_pay, status, start_date, talent_searches(title), talent_candidates(full_name)").eq("recruiter_id", rec.id).order("start_date", { ascending: false }),
    db.from("payouts").select("amount, status").eq("contractor_id", rec.id).eq("kind", "placement"),
  ]);
  const earned = (pays ?? []).filter((p) => p.status === "paid").reduce((t, p) => t + Number(p.amount), 0);
  const pending = (pays ?? []).filter((p) => p.status === "approved").reduce((t, p) => t + Number(p.amount), 0);
  const expected = (placements ?? []).filter((p) => ["pending_start", "invoiced"].includes(p.status)).reduce((t, p) => t + Number(p.recruiter_pay), 0);
  const rowsFor = (sid: string): PipeRow[] => ((subs ?? []) as { id: string; search_id: string; stage: string; pitch: string | null; submitted_at: string | null; client_feedback: string | null; client_decision: string | null; expected_salary: number | null; talent_candidates: unknown }[]).filter((x) => x.search_id === sid).map((x) => {
    const c = x.talent_candidates as { full_name: string; email: string; current_title: string | null; location: string | null; resume_path: string | null };
    return { id: x.id, stage: x.stage, pitch: x.pitch, submitted_at: x.submitted_at, client_feedback: x.client_feedback, client_decision: x.client_decision, expected_salary: x.expected_salary, recruiter: null, mine: true, candidate: { full_name: c.full_name, email: c.email, current_title: c.current_title, location: c.location, hasResume: Boolean(c.resume_path) } };
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Handled Talent</h1>
        <p className="text-sm text-ink-soft">You earn {TALENT_TERMS.recruiterPct}% of first-year base salary on contingency hires and {Math.round(TALENT_TERMS.retainedRecruiterShare * 100)}% of retained payments, paid in the weekly payout once the client pays. Get written consent before every submission; candidates never pay a fee.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Searches" value={searches.filter((x) => x.s.status === "open").length} />
        <Stat label="Hires" value={(placements ?? []).length} />
        <Stat label="Coming when clients pay" value={money(expected + pending)} />
        <Stat label="Paid to you" value={money(earned)} />
      </div>
      {searches.length === 0 && <p className="card text-sm text-ink-soft">No searches assigned yet. We&apos;ll email you when you&apos;re added to one.</p>}
      {searches.map(({ role, s }) => (
        <section key={s.id} className="card space-y-3">
          <div>
            <div className="text-xs text-ink-soft">{s.talent_clients.company} · {s.type === "retained" ? "Retained" : "Contingency"} · {role === "lead" ? "You're lead" : "Support"} · {s.status.replace("_", " ")}</div>
            <h2 className="text-lg font-bold">{s.title}</h2>
            <div className="text-sm text-ink-soft">{[s.location, s.workplace].filter(Boolean).join(" · ")}{s.salary_min || s.salary_max ? ` · ${s.salary_min ? money(Number(s.salary_min)) : "?"}–${s.salary_max ? money(Number(s.salary_max)) : "?"}` : ""}</div>
          </div>
          <details className="text-sm"><summary className="cursor-pointer font-semibold">Job order & must-haves</summary>{s.description && <p className="mt-2 whitespace-pre-wrap">{s.description}</p>}{s.must_haves && <p className="mt-2 whitespace-pre-wrap"><b>Must-haves:</b> {s.must_haves}</p>}</details>
          <Pipeline url="/api/pro/talent" rows={rowsFor(s.id)} who="recruiter" feePct={Number(s.fee_pct)} recruiterPct={Number(s.recruiter_pct)} minimumFee={Number(s.minimum_fee)} type={s.type} />
          {s.status === "open" && <details><summary className="cursor-pointer text-sm font-semibold">+ Add a candidate</summary><div className="mt-2"><AddCandidateForm url="/api/pro/talent" searchId={s.id} /></div></details>}
        </section>
      ))}
      {(placements ?? []).length > 0 && (
        <section className="card text-sm">
          <h2 className="mb-2 text-lg font-bold">Your hires</h2>
          <ul className="divide-y divide-line">{(placements ?? []).map((p) => <li key={p.id} className="py-1">{(p.talent_candidates as unknown as { full_name: string }).full_name} · {(p.talent_searches as unknown as { title: string }).title} · starts {p.start_date} · your share {money(Number(p.recruiter_pay))} · {p.status === "paid" ? "client paid" : p.status.replace("_", " ")}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
