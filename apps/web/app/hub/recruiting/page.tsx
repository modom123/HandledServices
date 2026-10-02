/*
 * FILE    : apps/web/app/hub/recruiting/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0006 UTC
 * PURPOSE : Handled Hub → Recruiting. Every applicant from first contact to active pro: the
 *           funnel, where they came from, how far along setup they are, every email/reminder/
 *           step in their history, and one-click invite, decline, nudge and revive. The daily
 *           sweep does the follow-up automatically; this page is for watching and stepping in.
 */
import Link from "next/link";
import { PIPELINE, STAGE_LABEL, TRADES, type PipelineStage } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getRecruitingSettings, pipeline } from "@/lib/recruiting";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";
import { RecruitingRowActions, RecruitingSettingsForm } from "@/components/HubActions";

export const dynamic = "force-dynamic";

const days = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
const trade = (t: string) => TRADES.find((x) => x.id === t)?.label ?? t;

export default async function RecruitingPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const { stage: filter } = await searchParams;
  const [rows, settings, { data: events }] = await Promise.all([
    pipeline(),
    getRecruitingSettings(),
    adminClient().from("recruiting_events").select("application_id, contractor_id, kind, note, actor, created_at").order("created_at", { ascending: false }).limit(3000),
  ]);
  const history = (appId: unknown, proId: unknown) => (events ?? []).filter((e: { application_id: string | null; contractor_id: string | null }) => (appId && e.application_id === appId) || (proId && e.contractor_id === proId));
  const count = (s: PipelineStage) => rows.filter((r) => r.stage === s).length;
  const total = rows.length;
  const active = count("active");
  const since30 = rows.filter((r) => (days(r.app.created_at as string) ?? 99) <= 30);
  // time to activate: first event to "activated"
  const activations = (events ?? []).filter((e: { kind: string }) => e.kind === "activated") as { contractor_id: string; created_at: string }[];
  const durations = activations.map((a) => {
    const row = rows.find((r) => r.pro?.id === a.contractor_id);
    const start = row?.app.created_at as string | undefined;
    return start ? (new Date(a.created_at).getTime() - new Date(start).getTime()) / 86400000 : null;
  }).filter((x): x is number => x != null).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  const sources = new Map<string, number>();
  for (const r of rows) { const s = String(r.app.source ?? "not given"); sources.set(s, (sources.get(s) ?? 0) + 1); }
  const shown = filter ? rows.filter((r) => r.stage === filter) : rows.filter((r) => !["active", "rejected"].includes(r.stage));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recruiting</h1>
        <p className="text-sm text-ink-soft">Applicants are screened, invited, reminded and activated automatically. Share <code>/pros</code> — each pro’s dashboard has a referral link too.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="In the pipeline" value={total - active - count("rejected") - count("dropped")} hint={`${since30.length} applied in the last 30 days`} />
        <Stat label="Active pros from applicants" value={active} hint={total ? `${Math.round((active / total) * 100)}% of everyone who applied` : "—"} />
        <Stat label="Median days to go live" value={median != null ? median.toFixed(1) : "—"} hint="application → activated" />
        <Stat label="Need you" value={count("applied") + count("screened")} hint="waiting for an invite decision" />
      </div>
      <div className="card overflow-x-auto">
        <div className="flex min-w-max gap-2 text-sm">
          <Link href="/hub/recruiting" className={`rounded-full border px-3 py-1 ${!filter ? "border-brand bg-brand-tint" : "border-line"}`}>Open ({rows.filter((r) => !["active", "rejected"].includes(r.stage)).length})</Link>
          {[...PIPELINE, "dropped" as PipelineStage, "rejected" as PipelineStage].map((s) => (
            <Link key={s} href={`/hub/recruiting?stage=${s}`} className={`rounded-full border px-3 py-1 ${filter === s ? "border-brand bg-brand-tint" : "border-line"}`}>{STAGE_LABEL[s]} ({count(s)})</Link>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {!shown.length && <p className="card text-sm text-ink-soft">Nobody here. Share /pros to recruit.</p>}
        {shown.map((r) => {
          const a = r.app as Record<string, unknown>;
          const ev = history(a.id, r.pro?.id);
          const last = ev[0] as { kind: string; created_at: string } | undefined;
          const screen = a.ai_screen as { score?: number; recommendation?: string; concerns?: string[] } | null;
          return (
            <div key={String(a.id ?? r.pro?.id)} className="card text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{String(a.business_name)} <span className="font-normal text-ink-soft">· {String(a.contact_name)} · {String(a.phone ?? "")} · {String(a.email)}</span></div>
                  <div className="text-xs text-ink-soft">{((a.trades as string[]) ?? []).map(trade).join(", ")} · source: {String(a.source ?? "not given")}{a.referred_by ? " (referral)" : ""} · applied {days(a.created_at as string)}d ago{screen?.score != null ? ` · AI ${screen.score} (${screen.recommendation})` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{r.label}</div>
                  {r.total > 0 && <div className="text-xs text-ink-soft">setup {r.done}/{r.total}{r.pro ? ` · ${Number(r.pro.onboarding_reminders ?? 0)} reminder(s)` : ""}</div>}
                </div>
              </div>
              {r.total > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full bg-brand" style={{ width: `${(r.done / r.total) * 100}%` }} /></div>}
              {r.left.length > 0 && r.stage !== "active" && <div className="mt-1 text-xs text-ink-soft">Left: {r.left.join(" · ")}</div>}
              {screen?.concerns?.length ? <div className="mt-1 text-xs text-amber-800">AI concerns: {screen.concerns.join("; ")}</div> : null}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <RecruitingRowActions appId={(a.id as string) ?? null} contractorId={r.pro?.id ?? null} stage={r.stage} />
                <span className="text-xs text-ink-soft">{last ? `Last: ${last.kind.replace(/_/g, " ")} ${days(last.created_at)}d ago` : ""}{r.pro ? <> · <Link className="underline" href={`/hub/pros/${r.pro.id}`}>pro record</Link></> : null}</span>
              </div>
              {ev.length > 0 && (
                <details className="mt-2 text-xs"><summary className="cursor-pointer text-ink-soft">History ({ev.length})</summary>
                  <ul className="mt-1 space-y-0.5">{(ev as { kind: string; note: string | null; actor: string; created_at: string }[]).map((e, i) => <li key={i}><span className="text-ink-soft">{e.created_at.slice(0, 16).replace("T", " ")}</span> · {e.kind.replace(/_/g, " ")}{e.note ? ` — ${e.note}` : ""} <span className="text-ink-soft">({e.actor})</span></li>)}</ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecruitingSettingsForm initial={settings} canEdit={v.role === "admin"} />
        <div className="card text-sm">
          <div className="font-semibold">Where applicants come from</div>
          <ul className="mt-2 space-y-1">{[...sources.entries()].sort((x, y) => y[1] - x[1]).map(([s, n]) => <li key={s} className="flex justify-between"><span>{s}</span><span className="text-ink-soft">{n}</span></li>)}</ul>
        </div>
      </div>
    </div>
  );
}
