/*
 * FILE    : apps/web/components/ProConversation.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_1800 UTC
 * PURPOSE : Hub → Pros → a pro's file: ONE "Conversation & activity" panel (owner, 2026-11-25: email them from their file
 *           so conversations are tracked; notes and AI alerts belong here; combine things to reduce bloat).
 *             • one composer: ✉️ Email (the same box as a candidate's file: starters, setup steps + sign-in link,
 *               send from the company or a Front Office mailbox) or 📝 Note (note / call / text / meeting)
 *             • one timeline, newest first: emails, notes, nudges and setup steps (recruiting_events), AI and system
 *               alerts about the pro or their jobs (ops_alerts, open ones can be resolved here), and the Legal &
 *               Compliance team's checks (agent_tasks for this pro)
 *           Server component; the composer is client-side (ProComposer).
 * UPDATED : 2026-11-25_1830 UTC — works for an applicant without a pro account too (pro.id null + application_id): the candidate
 *           file uses this same panel.
 */
import { adminClient } from "@/lib/supabase/server";
import { candidateSenders } from "@/lib/recruiting";
import { ProComposer } from "@/components/ProComposer";
import { ResolveAlert } from "@/components/HubActions";

type Item = { at: string; icon: string; title: string; body: string | null; by: string | null; alertId?: string | null; open?: boolean };

const EVENT: Record<string, [string, string]> = {
  emailed: ["✉️", "Email sent"], nudge: ["🔔", "Reminder sent (setup steps + sign-in link)"], note: ["📝", "Note"],
  activated: ["✅", "Activated"], activated_override: ["⚠️", "Activated with steps missing"], invited: ["📨", "Invited"],
  revived: ["♻️", "Revived"], dropped: ["⏸️", "Dropped out of setup"], screened: ["🤖", "AI screen"],
};
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** `pro.id` is the pro's id, or null for an applicant without a pro account yet (then `application_id` is required). */
export async function ProConversation({ pro }: { pro: { id: string | null; email: string | null; contact_name: string | null; status: string; phone?: string | null; application_id?: string | null } }) {
  const db = adminClient();
  const { data: jobRows } = pro.id ? await db.from("jobs").select("id").eq("contractor_id", pro.id).order("created_at", { ascending: false }).limit(200) : { data: [] };
  const jobIds = ((jobRows ?? []) as { id: string }[]).map((j) => j.id);
  const email = (pro.email ?? "").toLowerCase();
  const [{ data: events }, { data: alerts }, { data: jobAlerts }, { data: legal }, senders] = await Promise.all([
    db.from("recruiting_events").select("kind, note, actor, created_at").or([pro.id ? `contractor_id.eq.${pro.id}` : "", pro.application_id ? `application_id.eq.${pro.application_id}` : ""].filter(Boolean).join(",")).order("created_at", { ascending: false }).limit(150),
    pro.id ? db.from("ops_alerts").select("id, kind, severity, title, body, resolved, created_at").eq("contractor_id", pro.id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    jobIds.length ? db.from("ops_alerts").select("id, kind, severity, title, body, resolved, created_at").in("job_id", jobIds).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    email ? db.from("agent_tasks").select("title, note, status, created_at, closed_at").eq("agent", "legal").like("target", `pro:${email}#%`).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    candidateSenders().catch(() => [{ id: "company", label: "Handled Recruiting (company email)" }]),
  ]);
  type A = { id: string; kind: string; severity: string; title: string; body: string | null; resolved: boolean; created_at: string };
  const seen = new Set<string>();
  const alertItems: Item[] = [...((alerts ?? []) as A[]), ...((jobAlerts ?? []) as A[])].filter((a) => !seen.has(a.id) && seen.add(a.id)).map((a) => ({
    at: a.created_at, icon: a.severity === "critical" ? "🚨" : a.kind.startsWith("legal") ? "⚖️" : "🤖", title: a.title, body: a.body, by: "alert", alertId: a.id, open: !a.resolved,
  }));
  const items: Item[] = [
    ...((events ?? []) as { kind: string; note: string | null; actor: string; created_at: string }[]).map((e) => {
      const [icon, label] = EVENT[e.kind] ?? ["•", e.kind.replace(/_/g, " ")];
      return { at: e.created_at, icon, title: label, body: e.note, by: e.actor };
    }),
    ...alertItems,
    ...((legal ?? []) as { title: string; note: string | null; status: string; created_at: string }[]).map((t) => ({
      at: t.created_at, icon: "⚖️", title: `Compliance check: ${t.title}${t.status === "open" ? " (open)" : ` (${t.status})`}`, body: t.note, by: "Legal & Compliance team",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const openAlerts = alertItems.filter((a) => a.open).length;
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Conversation &amp; activity</h2>
        <span className="text-xs text-ink-soft">{items.length} item(s){openAlerts ? ` · ${openAlerts} open alert(s)` : ""}</span>
      </div>
      <ProComposer contractorId={pro.id} applicationId={pro.application_id ?? null} email={pro.email} firstName={String(pro.contact_name ?? "").split(" ")[0]} hasAccount={Boolean(pro.id) && pro.status !== "approved"} senders={senders} phone={pro.phone ?? null} />
      <ol className="divide-y divide-line text-sm">
        {items.slice(0, 80).map((it, i) => (
          <li key={i} className={`flex gap-2 py-2 ${it.open ? "rounded bg-amber-50 px-2" : ""}`}>
            <span aria-hidden className="w-5 shrink-0 text-center">{it.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{it.title}</span>
                <span className="text-xs text-ink-soft">{when(it.at)}{it.by && it.by !== "alert" ? ` · ${it.by}` : ""}</span>
              </div>
              {it.body && <p className="whitespace-pre-wrap text-ink-soft">{it.body.slice(0, 600)}</p>}
              {it.alertId && it.open && <ResolveAlert id={it.alertId} />}
            </div>
          </li>
        ))}
        {!items.length && <li className="py-2 text-ink-soft">Nothing yet. Emails, notes and alerts about this pro will show here.</li>}
      </ol>
    </section>
  );
}
