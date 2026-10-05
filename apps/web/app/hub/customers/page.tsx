/*
 * FILE    : apps/web/app/hub/customers/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-03_0042 UTC — link to each customer's signed contracts.
 * PURPOSE : Customers (rolled up from jobs), commercial accounts and AI-chat leads.
 * UPDATED : 2026-10-04_1934 UTC — commercial accounts open their Hub account page (billing, properties, members, dedicated pros).
 * UPDATED : 2026-10-05_2146 UTC — each customer opens their page (bookings + permanent notes history); latest note shown.
 */
import Link from "next/link";
import { getService, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { customerSubjectId, noteSummaries } from "@/lib/notes";
import { Badge, Empty } from "@/components/ui";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function Customers() {
  const v = await getViewer();
  if (!v) return null;
  const [{ data: jobs }, { data: biz }, { data: leads }] = await Promise.all([
    v.db.from("jobs").select("contact_name, contact_email, contact_phone, customer_type, company_name, price_final, status, frequency, created_at").order("created_at", { ascending: false }).limit(2000),
    v.db.from("business_accounts").select("*").order("created_at", { ascending: false }),
    v.db.from("leads").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const map = new Map<string, Rec>();
  for (const j of (jobs ?? []) as Rec[]) {
    const k = String(j.contact_email).toLowerCase();
    const c = map.get(k) ?? { name: j.company_name ?? j.contact_name, email: k, phone: j.contact_phone, type: j.customer_type, jobs: 0, spend: 0, recurring: false, last: j.created_at };
    c.jobs++;
    if (j.status === "completed") c.spend += Number(j.price_final ?? 0);
    if (j.frequency !== "once") c.recurring = true;
    map.set(k, c);
  }
  const customers = [...map.values()].sort((a, b) => b.spend - a.spend);
  const shown: Rec[] = customers.slice(0, 200).map((c) => ({ ...c, sid: customerSubjectId(String(c.email)) }));
  const notes = await noteSummaries("customer", shown.map((c) => c.sid));
  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Customers <span className="text-base font-normal text-ink-soft">({customers.length})</span></h1>
        <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Customer</th><th className="p-3">Type</th><th className="p-3">Jobs</th><th className="p-3">Lifetime spend</th><th className="p-3">Plan</th><th className="p-3">Last booking</th></tr></thead>
          <tbody>{shown.map((c) => (
            <tr key={c.email} className="border-t border-line"><td className="p-3"><Link href={`/hub/customers/${encodeURIComponent(c.email)}`} className="font-semibold text-brand hover:underline">{c.name}</Link><div className="text-xs text-ink-soft">{c.email} · {c.phone} · <Link className="text-brand underline" href={`/hub/contracts?q=${encodeURIComponent(c.email)}`}>contracts</Link></div>{notes[c.sid] && <div className="mt-1 line-clamp-1 text-xs text-ink-soft">📝 {notes[c.sid].count} · {new Date(notes[c.sid].last.at).toLocaleDateString()}: {notes[c.sid].last.body}</div>}</td><td className="p-3">{c.type}</td><td className="p-3">{c.jobs}</td><td className="p-3">{money(c.spend)}</td><td className="p-3">{c.recurring ? <Badge tone="green">recurring</Badge> : "—"}</td><td className="p-3 text-xs">{new Date(c.last).toLocaleDateString()}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <section>
        <h2 className="mb-4 text-xl font-bold">Commercial accounts</h2>
        {!(biz ?? []).length && <Empty>No business accounts yet.</Empty>}
        <div className="grid gap-3 md:grid-cols-2">{(biz ?? []).map((b: Rec) => (
          <Link key={b.id} href={`/hub/business/${b.id}`} className="card block text-sm transition hover:border-brand"><div className="flex justify-between"><span className="font-semibold">{b.company}</span><Badge tone={b.status === "active" ? "green" : "amber"}>{b.status}</Badge></div>
            <div className="text-ink-soft">{b.contact_name} · {b.email} · {b.locations} location(s)</div>
            <div className="mt-1">{(b.services_needed as string[]).map((s) => getService(s)?.name ?? s).join(", ")}</div>
            {b.monthly_value && <div className="mt-1 font-semibold">{money(b.monthly_value)}/mo</div>}
            <div className="mt-1 text-xs text-ink-soft">{b.billing_mode === "terms" ? `Invoiced · Net ${b.terms_days}${b.terms_hold ? " · ON HOLD" : ""}` : b.terms_requested_at ? "Prepay · asked for invoicing" : "Prepay"}{b.priority ? " · priority" : ""}{b.pilot_jobs_left > 0 ? ` · pilot ${b.pilot_discount_pct}% × ${b.pilot_jobs_left}` : ""}</div></Link>
        ))}</div>
      </section>
      <section>
        <h2 className="mb-4 text-xl font-bold">Callback leads (AI concierge)</h2>
        {!(leads ?? []).length && <Empty>No leads yet.</Empty>}
        <div className="space-y-2">{(leads ?? []).map((l: Rec) => (
          <div key={l.id} className="card p-4 text-sm"><span className="font-semibold">{l.name}</span> · {l.phone ?? l.email} · {l.zip} · {getService(l.service_slug ?? "")?.name ?? "general"}<div className="text-ink-soft">{l.message}</div></div>
        ))}</div>
      </section>
    </div>
  );
}
