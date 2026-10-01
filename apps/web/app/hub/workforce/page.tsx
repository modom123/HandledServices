/*
 * FILE    : apps/web/app/hub/workforce/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : IEBC Workforce desk — which IEBC AI employees run which departments here,
 *           their autonomy, the approval queue for their proposed actions, and the
 *           full activity log.
 */
import { getViewer } from "@/lib/auth";
import { Badge, Empty } from "@/components/ui";
import { ActionDecision, AgentControls } from "@/components/HubActions";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const short = (v: unknown) => {
  const s = JSON.stringify(v ?? {});
  return s.length > 220 ? `${s.slice(0, 220)}…` : s;
};

export default async function Workforce() {
  const v = await getViewer();
  if (!v) return null;
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const [{ data: agents }, { data: pending }, { data: log }, { data: usage }] = await Promise.all([
    v.db.from("iebc_agents").select("*").order("iebc_dept"),
    v.db.from("agent_actions").select("*, iebc_agents(name, title)").eq("status", "pending_approval").order("created_at"),
    v.db.from("agent_actions").select("*, iebc_agents(name)").neq("status", "pending_approval").order("created_at", { ascending: false }).limit(60),
    v.db.from("agent_actions").select("agent_id, status").gte("created_at", monthStart).limit(20000),
  ]);
  const meter = new Map<string, { total: number; executed: number }>();
  for (const u of (usage ?? []) as Rec[]) {
    const m = meter.get(u.agent_id) ?? { total: 0, executed: 0 };
    m.total++;
    if (u.status === "executed") m.executed++;
    meter.set(u.agent_id, m);
  }
  const activeSeats = (agents ?? []).filter((a: Rec) => a.active).length;
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">IEBC Workforce</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          IEBC’s AI employees run parts of this business through the IEBC Workforce API. Reads always run; writes run immediately only for
          autonomous agents on low-risk actions. Everything else waits here for a human. Every call is logged.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-bold">Approval queue {pending?.length ? <Badge tone="amber">{pending.length}</Badge> : null}</h2>
        {!(pending ?? []).length && <Empty>Nothing waiting for approval.</Empty>}
        <div className="space-y-2">
          {(pending ?? []).map((a: Rec) => (
            <div key={a.id} className="card flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <div><b>{a.iebc_agents?.name}</b> <span className="text-ink-soft">({a.iebc_agents?.title})</span> wants to run <code className="rounded bg-paper px-1.5">{a.action}</code></div>
                {a.reason && <p className="mt-1">“{a.reason}”</p>}
                <p className="mt-1 break-all font-mono text-xs text-ink-soft">{short(a.params)}</p>
              </div>
              <ActionDecision id={a.id} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Assignments</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(agents ?? []).map((a: Rec) => (
            <div key={a.id} className={`card space-y-2 text-sm ${a.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{a.name}</div><div className="text-xs text-ink-soft">{a.title} · IEBC {a.iebc_dept}</div></div>
                <Badge tone={a.autonomy === "autonomous" ? "green" : a.autonomy === "approval" ? "amber" : "slate"}>{a.autonomy}</Badge>
              </div>
              <div><span className="text-ink-soft">Runs:</span> {a.role_here}</div>
              <div className="flex flex-wrap gap-1">{(a.scopes as string[]).map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div>
              <div className="text-xs text-ink-soft">Agent id <code>{a.iebc_employee_id}</code> · last active {a.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : "never"}</div>
              <AgentControls id={a.id} autonomy={a.autonomy} active={a.active} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-bold">Usage this month <span className="text-sm font-normal text-ink-soft">— for IEBC invoicing</span></h2>
        <p className="mb-3 text-sm text-ink-soft">{activeSeats} active agent seats · {(usage ?? []).length} calls · {[...meter.values()].reduce((t, m) => t + m.executed, 0)} executed actions</p>
        <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">IEBC employee</th><th className="p-3">Department here</th><th className="p-3">Calls</th><th className="p-3">Executed</th></tr></thead>
          <tbody>{(agents ?? []).map((a: Rec) => (
            <tr key={a.id} className="border-t border-line"><td className="p-3 font-medium">{a.name}</td><td className="p-3">{a.role_here}</td><td className="p-3">{meter.get(a.id)?.total ?? 0}</td><td className="p-3">{meter.get(a.id)?.executed ?? 0}</td></tr>
          ))}</tbody>
        </table></div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Activity log</h2>
        {!(log ?? []).length && <Empty>No IEBC activity yet. Connect the MasterHub with IEBC_API_KEY (see README).</Empty>}
        <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><tbody>
          {(log ?? []).map((a: Rec) => (
            <tr key={a.id} className="border-t border-line align-top first:border-0">
              <td className="whitespace-nowrap p-3 text-xs text-ink-soft">{new Date(a.created_at).toLocaleString()}</td>
              <td className="p-3 font-medium">{a.iebc_agents?.name}</td>
              <td className="p-3"><code>{a.action}</code></td>
              <td className="p-3"><Badge tone={a.status === "executed" ? "green" : a.status === "rejected" || a.status === "denied" ? "red" : "amber"}>{a.status}</Badge>{a.decided_by && <div className="mt-1 text-xs text-ink-soft">by {a.decided_by}</div>}</td>
              <td className="max-w-md break-all p-3 font-mono text-xs text-ink-soft">{short(a.result)}</td>
            </tr>
          ))}
        </tbody></table></div>
      </section>
    </div>
  );
}
