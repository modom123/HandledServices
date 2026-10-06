/*
 * FILE    : apps/web/app/hub/coverage/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_2120 UTC
 * PURPOSE : Hub → Cancellations & coverage. Every job gets done:
 *             • right now — jobs in the next 3 days that are uncovered, being recovered after a hand-back, or short on
 *               backups, with each backup's status (asked / standing by / called / passed) and actions
 *             • the last 30 days — hand-backs by tier (free · short notice · late · excused), no-shows, customer
 *               cancellations, how many handed-off jobs a backup saved
 *             • every cancellation with the pro, job and reason (excuse an emergency in one click)
 *             • pros with the most cancellations
 */
import Link from "next/link";
import { CANCEL_POLICY, TIME_WINDOW_LABEL, getService } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { coverageReport } from "@/lib/coverage";
import { Badge, Empty, Stat } from "@/components/ui";
import { CoverActions, ExcuseButton } from "@/components/Coverage";

export const dynamic = "force-dynamic";

const KIND: Record<string, { label: string; tone: "slate" | "green" | "amber" | "red" | "brand" }> = {
  free_cancel: { label: `Free (${CANCEL_POLICY.freeHours}h+)`, tone: "slate" },
  short_notice_cancel: { label: `Short notice (${CANCEL_POLICY.lateHours}–${CANCEL_POLICY.freeHours}h)`, tone: "amber" },
  late_cancel: { label: `Late (<${CANCEL_POLICY.lateHours}h)`, tone: "red" },
  excused_cancel: { label: "Excused", tone: "green" },
  no_show: { label: "No-show", tone: "red" },
};
const STATE: Record<string, { label: string; tone: "slate" | "green" | "amber" | "red" | "brand" }> = {
  uncovered_urgent: { label: "NO PRO — under 6h", tone: "red" },
  uncovered: { label: "No pro yet", tone: "amber" },
  recovered: { label: "Backup took it", tone: "green" },
  thin_backups: { label: "Needs backups", tone: "amber" },
};
const BK: Record<string, string> = { asked: "asked", standby: "✓ standing by", called: "📞 called", passed: "passed", declined: "declined", promoted: "★ took it", released: "released" };

export default async function CoveragePage() {
  const v = await getViewer();
  if (!v) return null;
  const r = await coverageReport(30);
  const t = r.totals;
  const saved = t.handedOff ? Math.round((t.recovered / t.handedOff) * 100) : null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cancellations & coverage</h1>
        <p className="text-sm text-ink-soft">Every job gets done: each accepted job has backups #1–#3; when a pro hands it back or doesn’t show, the backups are called in order, then everyone. Pros: {CANCEL_POLICY.freeHours}h+ free · {CANCEL_POLICY.lateHours}–{CANCEL_POLICY.freeHours}h short notice (no penalty) · under {CANCEL_POLICY.lateHours}h late (counts toward a warning).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Pro hand-backs (30d)" value={t.free + t.shortNotice + t.late + t.excused} hint={`${t.free} free · ${t.shortNotice} short · ${t.late} late · ${t.excused} excused`} />
        <Stat label="Late cancels" value={t.late} hint="count toward a warning" />
        <Stat label="No-shows" value={t.noShows} hint="recorded by staff" />
        <Stat label="Customer cancels" value={t.customer} hint={`${t.otherCancelled} other (ops, weather, lockout)`} />
        <Stat label="Saved by a backup" value={saved == null ? "—" : `${saved}%`} hint={`${t.recovered} of ${t.handedOff} handed-off jobs`} />
        <Stat label="Next 3 days covered" value={r.coveredCount} hint={`${r.live.length} need attention`} />
      </div>

      <section className="card p-0">
        <div className="p-4 pb-2 font-semibold">Needs attention — next 3 days</div>
        {!r.live.length ? <div className="p-4 pt-0"><Empty>Every job in the next 3 days has a pro and 3 backups.</Empty></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Job</th><th className="p-3">When</th><th className="p-3">State</th><th className="p-3">Backups</th><th className="p-3">Do</th></tr></thead>
              <tbody>
                {r.live.map((j) => (
                  <tr key={j.id} className="border-t border-line align-top">
                    <td className="p-3"><Link href={`/hub/jobs/${j.id}`} className="font-semibold underline">{j.ref}</Link><div className="text-xs text-ink-soft">{getService(j.service_slug)?.name} · {j.city} {j.zip}{j.handoffs ? ` · ${j.handoffs} hand-off(s)` : ""}</div></td>
                    <td className="p-3 text-xs">{j.scheduled_date} · {TIME_WINDOW_LABEL[j.time_window]}<div className="text-ink-soft">{j.hours >= 0 ? `in ${j.hours}h` : "started"}</div></td>
                    <td className="p-3"><Badge tone={STATE[j.state].tone}>{STATE[j.state].label}</Badge></td>
                    <td className="p-3 text-xs">{j.backups.length ? j.backups.map((b) => <div key={b.rank}>#{b.rank} {b.name} — {BK[b.status] ?? b.status}</div>) : <span className="text-ink-soft">none yet</span>}</td>
                    <td className="p-3"><CoverActions jobId={j.id} open={!j.contractor_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-0">
          <div className="p-4 pb-2 font-semibold">Every cancellation — last 30 days</div>
          {!r.events.length ? <div className="p-4 pt-0"><Empty>No pro cancellations or no-shows.</Empty></div> : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {r.events.map((e) => (
                    <tr key={e.id} className="border-t border-line align-top">
                      <td className="p-3 text-xs text-ink-soft">{e.created_at.slice(0, 16).replace("T", " ")}</td>
                      <td className="p-3"><Badge tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Badge></td>
                      <td className="p-3"><Link href={`/hub/pros/${e.contractor_id}`} className="font-semibold underline">{e.contractors?.business_name ?? "—"}</Link>{e.jobs ? <> · <Link href={`/hub/jobs/${e.job_id}`} className="underline">{e.jobs.ref}</Link> <span className="text-xs text-ink-soft">({e.jobs.scheduled_date}{e.jobs.contractor_id && e.jobs.contractor_id !== e.contractor_id ? " · covered" : e.jobs.status === "cancelled" ? " · cancelled" : ""})</span></> : null}
                        {e.note && <div className="text-xs text-ink-soft">“{e.note}”</div>}</td>
                      <td className="p-3">{["late_cancel", "short_notice_cancel"].includes(e.kind) && <ExcuseButton eventId={e.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card text-sm">
          <div className="font-semibold">Pros with the most cancellations (30d)</div>
          {!r.pros.length ? <p className="mt-2 text-ink-soft">None.</p> : (
            <ul className="mt-2 space-y-1">{r.pros.map((p) => <li key={p.id} className="flex justify-between gap-2"><Link href={`/hub/pros/${p.id}`} className="underline">{p.name}</Link><span className="text-xs text-ink-soft">{p.late} late · {p.noShow} no-show · {p.short} short · {p.free} free</span></li>)}</ul>
          )}
          <p className="mt-3 text-xs text-ink-soft">3 late cancels or 2 no-shows in 90 days triggers an automatic written warning (never a deactivation). Free and short-notice hand-backs and excused ones never count.</p>
        </section>
      </div>
    </div>
  );
}
