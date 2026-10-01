/*
 * FILE    : apps/web/app/hub/pros/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Subcontractor network — applications with AI screening, vetting queue,
 *           active pros with performance and compliance (insurance expiry).
 */
import { TRADES } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Badge, Empty } from "@/components/ui";
import { ActivatePro, ApplicationButtons } from "@/components/HubActions";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const tradeLabel = (id: string) => TRADES.find((t) => t.id === id)?.label ?? id;

export default async function Pros() {
  const v = await getViewer();
  if (!v) return null;
  const [{ data: apps }, { data: pros }] = await Promise.all([
    v.db.from("contractor_applications").select("*").in("status", ["new", "reviewing"]).order("created_at", { ascending: false }),
    v.db.from("contractors").select("*").order("status").order("rating", { ascending: false }),
  ]);
  const soon = new Date(Date.now() + 30 * 86400000);
  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Applications</h1>
        {!(apps ?? []).length && <Empty>No new applications. Share /pros to recruit.</Empty>}
        <div className="grid gap-3 lg:grid-cols-2">
          {(apps ?? []).map((a: Rec) => (
            <div key={a.id} className="card space-y-2 text-sm">
              <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{a.business_name}</div><div className="text-ink-soft">{a.contact_name} · {a.email} · {a.phone}</div></div>
                {a.ai_screen && <Badge tone={a.ai_screen.recommendation === "decline" ? "red" : a.ai_screen.recommendation === "interview" ? "amber" : "green"}>AI {a.ai_screen.score} · {a.ai_screen.recommendation.replaceAll("_", " ")}</Badge>}</div>
              <div>{(a.trades as string[]).map(tradeLabel).join(", ")} · {a.years_experience ?? "?"} yrs · crew {a.crew_size ?? "?"} · {a.insured ? "insured" : "not insured"}</div>
              {a.message && <p className="text-ink-soft">“{a.message}”</p>}
              {a.ai_screen && <div className="rounded-xl bg-paper p-3 text-xs"><b>Strengths:</b> {a.ai_screen.strengths.join("; ")}<br /><b>Concerns:</b> {a.ai_screen.concerns.join("; ") || "none"}<br /><b>Verify:</b> {a.ai_screen.verify.join("; ")}</div>}
              <ApplicationButtons id={a.id} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-xl font-bold">Network</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Pro</th><th className="p-3">Trades</th><th className="p-3">Rating</th><th className="p-3">Jobs</th><th className="p-3">Accept / on-time</th><th className="p-3">Insurance</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {(pros ?? []).map((p: Rec) => {
                const ins = p.insured_until ? new Date(p.insured_until) : null;
                return (
                  <tr key={p.id} className="border-t border-line align-top">
                    <td className="p-3"><div className="font-semibold">{p.business_name}</div><div className="text-xs text-ink-soft">{p.contact_name} · {p.phone}</div></td>
                    <td className="p-3 text-xs">{(p.trades as string[]).map(tradeLabel).join(", ")}</td>
                    <td className="p-3">{p.rating} ★</td>
                    <td className="p-3">{p.jobs_completed}</td>
                    <td className="p-3">{Math.round(p.acceptance_rate * 100)}% / {Math.round(p.on_time_rate * 100)}%</td>
                    <td className="p-3">{ins ? <Badge tone={ins < new Date() ? "red" : ins < soon ? "amber" : "green"}>{p.insured_until}</Badge> : <Badge tone="red">missing</Badge>}</td>
                    <td className="p-3"><div className="mb-1"><Badge tone={p.status === "approved" ? "green" : p.status === "suspended" ? "red" : "amber"}>{p.status}</Badge></div><ActivatePro id={p.id} status={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
