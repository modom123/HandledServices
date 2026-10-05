/*
 * FILE    : apps/web/app/hub/talent/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : One Handled Talent search: the job order and fair-hiring check, terms, status, the client's review link,
 *           recruiters, the pipeline (add, submit, move, hire), hires with invoicing and the guarantee, retained payments,
 *           and the activity log.
 * UPDATED : 2026-10-05_2141 UTC — client notes & history (permanent, shared across the client's searches).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { SEARCH_STATUS_LABEL, money, type SearchStatus } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/notify";
import { timeline } from "@/lib/notes";
import { AddNote, Timeline } from "@/components/AccountNotes";
import { AddCandidateForm, Pipeline, PlacementActions, RecruiterPicker, RetainerInvoiceButton, SearchControls, type PipeRow } from "@/components/TalentUI";

export const dynamic = "force-dynamic";

export default async function SearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = adminClient();
  const { data: s } = await db.from("talent_searches").select("*, talent_clients(*)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: assigned }, { data: recs }, { data: subs }, { data: placements }, { data: retainer }, { data: events }] = await Promise.all([
    db.from("talent_search_recruiters").select("role, contractors(id, business_name)").eq("search_id", id),
    db.from("contractors").select("id, business_name").eq("status", "approved").contains("trades", ["recruiter"]).order("business_name"),
    db.from("talent_submissions").select("id, stage, pitch, submitted_at, client_feedback, client_decision, expected_salary, contractors:recruiter_id(business_name), talent_candidates(full_name, email, current_title, location, resume_path)").eq("search_id", id).order("updated_at", { ascending: false }),
    db.from("talent_placements").select("*, talent_candidates(full_name)").eq("search_id", id),
    db.from("talent_retainer_payments").select("*").eq("search_id", id).order("created_at"),
    db.from("talent_events").select("actor, kind, note, created_at").eq("search_id", id).order("created_at", { ascending: false }).limit(40),
  ]);
  const clientHistory = await timeline("talent_client", s.client_id);
  const c = s.talent_clients as { company: string; contact_name: string; email: string; phone: string | null; agreement_signed_at: string | null };
  const rows: PipeRow[] = (subs ?? []).map((x) => {
    const cand = x.talent_candidates as unknown as { full_name: string; email: string; current_title: string | null; location: string | null; resume_path: string | null };
    return { id: x.id, stage: x.stage, pitch: x.pitch, submitted_at: x.submitted_at, client_feedback: x.client_feedback, client_decision: x.client_decision, expected_salary: x.expected_salary, recruiter: (x.contractors as unknown as { business_name: string } | null)?.business_name ?? "Handled staff", candidate: { full_name: cand.full_name, email: cand.email, current_title: cand.current_title, location: cand.location, hasResume: Boolean(cand.resume_path) } };
  });
  const assignedList = (assigned ?? []).map((a) => ({ id: (a.contractors as unknown as { id: string }).id, business_name: (a.contractors as unknown as { business_name: string }).business_name, role: a.role }));
  return (
    <div className="space-y-5">
      <Link href="/hub/talent" className="text-sm text-brand">← Handled Talent</Link>
      <div>
        <div className="text-xs text-ink-soft">{s.type === "retained" ? "Retained" : "Contingency"} · {SEARCH_STATUS_LABEL[s.status as SearchStatus]} · fee {s.fee_pct}% (recruiter {s.recruiter_pct}%)</div>
        <h1 className="text-2xl font-bold">{s.title}</h1>
        <div className="text-sm text-ink-soft">{c.company} · {c.contact_name} · {c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
        <div className="text-sm text-ink-soft">{[s.location, s.workplace].filter(Boolean).join(" · ")}{s.salary_min || s.salary_max ? ` · ${s.salary_min ? money(Number(s.salary_min)) : "?"}–${s.salary_max ? money(Number(s.salary_max)) : "?"}` : ""} · {s.openings} opening{s.openings > 1 ? "s" : ""}</div>
        <div className="mt-1 text-xs">Client review link: <code className="break-all">{siteUrl()}/talent/review/{s.review_token}</code></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card text-sm">
          <h2 className="mb-2 text-lg font-bold">Job order</h2>
          {s.description && <p className="whitespace-pre-wrap">{s.description}</p>}
          {s.must_haves && <><div className="mt-2 font-semibold">Must-haves</div><p className="whitespace-pre-wrap">{s.must_haves}</p></>}
        </section>
        <section className="card"><h2 className="mb-2 text-lg font-bold">Terms & status</h2><SearchControls s={{ id: s.id, status: s.status, type: s.type, fee_pct: Number(s.fee_pct), recruiter_pct: Number(s.recruiter_pct), minimum_fee: Number(s.minimum_fee), estimated_salary: s.estimated_salary ? Number(s.estimated_salary) : null, fair_override: s.fair_override, fair_flags: (s.fair_flags ?? []) as { issue: string; fix: string; match: string }[], signed: Boolean(c.agreement_signed_at) }} /></section>
      </div>
      <section className="card"><h2 className="mb-2 text-lg font-bold">Recruiters</h2><RecruiterPicker searchId={id} assigned={assignedList} recruiters={recs ?? []} /></section>
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Pipeline ({rows.length})</h2>
        <Pipeline url="/api/hub/talent" rows={rows} who="staff" feePct={Number(s.fee_pct)} recruiterPct={Number(s.recruiter_pct)} minimumFee={Number(s.minimum_fee)} type={s.type} />
        {["open", "on_hold"].includes(s.status) ? <details><summary className="cursor-pointer text-sm font-semibold">+ Add a candidate</summary><div className="mt-2"><AddCandidateForm url="/api/hub/talent" searchId={id} recruiters={recs ?? []} /></div></details> : <p className="text-xs text-ink-soft">Open the search to add candidates.</p>}
      </section>
      {(placements ?? []).length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-lg font-bold">Hires</h2>
          <ul className="divide-y divide-line text-sm">{(placements ?? []).map((p) => (
            <li key={p.id} className="space-y-1 py-2">
              <div><b>{(p.talent_candidates as { full_name: string }).full_name}</b> · {money(Number(p.base_salary))} base · starts {p.start_date} · fee {money(Number(p.fee))} (recruiter {money(Number(p.recruiter_pay))}, Handled {money(Number(p.platform))}) · <span className="capitalize">{p.status.replace("_", " ")}</span>{p.invoice_number ? ` · ${p.invoice_number}, due ${p.invoice_due}` : ""} · guarantee to {p.guarantee_ends}</div>
              <PlacementActions p={{ id: p.id, status: p.status, start_date: p.start_date, payment_url: p.payment_url }} />
            </li>
          ))}</ul>
        </section>
      )}
      {(retainer ?? []).length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-lg font-bold">Retained payments</h2>
          <ul className="divide-y divide-line text-sm">{(retainer ?? []).map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="capitalize">{r.key} · {money(Number(r.amount))} (recruiter {money(Number(r.recruiter_pay))}) · {r.status}{r.invoice_number ? ` · ${r.invoice_number}` : ""}{r.due ? ` · due ${r.due}` : ""}</span>{r.status === "scheduled" && Number(r.amount) > 0 && <RetainerInvoiceButton id={r.id} />}</li>)}</ul>
        </section>
      )}
      {(events ?? []).length > 0 && (
        <section className="card"><h2 className="mb-2 text-lg font-bold">Activity</h2><ul className="text-xs">{(events ?? []).map((e, i) => <li key={i} className="py-0.5">{new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/Detroit" })} · {e.actor} · {e.kind}{e.note ? ` — ${e.note}` : ""}</li>)}</ul></section>
      )}
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Client notes &amp; history ({clientHistory.length})</h2>
        <p className="text-xs text-ink-soft">Shared across all of this client&apos;s searches. Permanent — add a new note to correct one.</p>
        <AddNote subjectType="talent_client" subjectId={s.client_id} />
        <Timeline items={clientHistory} />
      </section>
    </div>
  );
}
