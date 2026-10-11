/*
 * FILE    : apps/web/app/hub/dispatch/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2242 UTC
 * PURPOSE : Hub → Dispatch: the dispatcher's board. Today / Tomorrow / This week, every job in time order with its pro,
 *           backups (#1–#3), offers out, payment state and when we last contacted anyone about it; jobs that need a
 *           dispatcher (no pro inside 6 hours, unpaid, no backups, pro running late) are pulled to the top. Each row has
 *           one-click actions (components/DispatchActions). Staff (admins and dispatchers).
 */
import Link from "next/link";
import { TIME_WINDOW_LABEL, dispatchFlags, getService, localDate, money, paymentState, type BoardJobInput, type TimeWindow } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Badge, fmtDate } from "@/components/ui";
import { DispatchActions } from "@/components/DispatchActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dispatch" };

type J = BoardJobInput & { id: string; ref: string; service_slug: string; city: string | null; contact_name: string; contact_phone: string | null; contractors: { business_name: string; phone: string | null } | null };
const WINDOW_ORDER: Record<string, number> = { morning: 0, midday: 1, afternoon: 2, flexible: 3 };
const TABS = [["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"]] as const;
const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

function ago(iso: string | undefined) {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}

export default async function Dispatch({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const asked = (await searchParams).tab;
  const tab = TABS.some(([k]) => k === asked) ? asked! : "today";
  const today = localDate(new Date());
  const [from, to] = tab === "tomorrow" ? [addDays(today, 1), addDays(today, 1)] : tab === "week" ? [today, addDays(today, 6)] : [today, today];
  const db = adminClient();
  const cols = "id, ref, service_slug, status, scheduled_date, time_window, zip, city, contact_name, contact_phone, contractor_id, price_final, paid_at, deposit_paid_at, billed_on_terms, amount_paid, amount_refunded, remedy, contractors(business_name, phone)";
  const [{ data: inRange }, { data: loose }, { data: pros }] = await Promise.all([
    db.from("jobs").select(cols).gte("scheduled_date", from).lte("scheduled_date", to).neq("status", "cancelled").order("scheduled_date").limit(400),
    // past-due (still open) and not-yet-dated jobs always show, whatever the tab
    db.from("jobs").select(cols).or(`scheduled_date.lt.${today},scheduled_date.is.null`).in("status", ["requested", "quoted", "scheduled", "dispatched", "assigned", "site_visit", "in_progress"]).order("created_at", { ascending: false }).limit(100),
    db.from("contractors").select("id, business_name, trades").eq("status", "approved").order("business_name").limit(500),
  ]);
  const jobs = [...((inRange ?? []) as unknown as J[]), ...((loose ?? []) as unknown as J[]).filter((x) => !(inRange ?? []).some((y: { id: string }) => y.id === x.id))];
  const ids = jobs.map((j) => j.id), refs = jobs.map((j) => j.ref);
  const [{ data: offers }, { data: backups }, logRes] = await Promise.all([
    ids.length ? db.from("job_offers").select("job_id, status, expires_at").in("job_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from("job_backups").select("job_id, rank, status, contractors(business_name)").in("job_id", ids).order("rank") : Promise.resolve({ data: [] }),
    refs.length ? db.from("notification_log").select("job_ref, created_at").in("job_ref", refs).order("created_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [], error: null }),
  ]);
  const lastContact = new Map<string, string>();
  for (const r of ((logRes.error ? [] : logRes.data) ?? []) as { job_ref: string; created_at: string }[]) if (!lastContact.has(r.job_ref)) lastContact.set(r.job_ref, r.created_at);
  const offersBy = new Map<string, { pending: number; passed: number; soonest: string | null }>();
  for (const o of (offers ?? []) as { job_id: string; status: string; expires_at: string }[]) {
    const e = offersBy.get(o.job_id) ?? { pending: 0, passed: 0, soonest: null };
    if (o.status === "pending" && new Date(o.expires_at) > new Date()) { e.pending++; if (!e.soonest || o.expires_at < e.soonest) e.soonest = o.expires_at; }
    if (["declined", "expired"].includes(o.status)) e.passed++;
    offersBy.set(o.job_id, e);
  }
  const backupsBy = new Map<string, { rank: number; status: string; name: string }[]>();
  for (const b of (backups ?? []) as unknown as { job_id: string; rank: number; status: string; contractors: { business_name: string } | null }[])
    backupsBy.set(b.job_id, [...(backupsBy.get(b.job_id) ?? []), { rank: b.rank, status: b.status, name: b.contractors?.business_name ?? "?" }]);
  const proList = (pros ?? []) as { id: string; business_name: string; trades: string[] }[];

  const rows = jobs.map((j) => {
    const off = offersBy.get(j.id) ?? { pending: 0, passed: 0, soonest: null };
    const bk = backupsBy.get(j.id) ?? [];
    const standby = bk.filter((b) => b.status === "standby").length;
    const flags = dispatchFlags(j, { standby, pendingOffers: off.pending });
    const svc = getService(j.service_slug);
    return { j, off, bk, standby, flags, svc, pay: paymentState(j), eligible: proList.filter((p) => (svc?.trades ?? []).some((t) => p.trades?.includes(t))).slice(0, 40).map((p) => ({ id: p.id, name: p.business_name })) };
  });
  const attention = rows.filter((r) => r.flags.length).sort((a, b) => (a.flags[0].tone === b.flags[0].tone ? 0 : a.flags[0].tone === "red" ? -1 : 1));
  const count = (k: string) => rows.filter((r) => r.flags.some((f) => f.key === k)).length;
  const byDay = new Map<string, typeof rows>();
  for (const r of rows.filter((r) => r.j.scheduled_date && r.j.scheduled_date >= from && r.j.scheduled_date <= to)) byDay.set(r.j.scheduled_date!, [...(byDay.get(r.j.scheduled_date!) ?? []), r]);

  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <tr className="align-top">
      <td className="py-2 pr-3 text-xs">{r.j.scheduled_date ? <>{fmtDate(r.j.scheduled_date)}<br /></> : <span className="text-ink-soft">no date<br /></span>}<span className="text-ink-soft">{TIME_WINDOW_LABEL[(r.j.time_window ?? "flexible") as TimeWindow]}</span></td>
      <td className="py-2 pr-3"><Link href={`/hub/jobs/${r.j.id}`} className="font-semibold text-brand underline">{r.j.ref}</Link><div className="text-xs">{r.svc?.icon} {r.svc?.name ?? r.j.service_slug}</div><div className="text-xs text-ink-soft">{r.j.contact_name} · {r.j.city ?? ""} {r.j.zip ?? ""}</div></td>
      <td className="py-2 pr-3 text-xs">{r.j.contractors ? <><b>{r.j.contractors.business_name}</b>{r.j.contractors.phone && <><br /><a className="underline" href={`tel:${r.j.contractors.phone}`}>{r.j.contractors.phone}</a></>}</> : <span className="text-rose-700">No pro</span>}
        <div className="mt-1 text-ink-soft">{r.j.status.replace("_", " ")}</div></td>
      <td className="py-2 pr-3 text-xs">{[1, 2, 3].map((n) => { const b = r.bk.find((x) => x.rank === n); return <div key={n}>#{n} {b ? `${b.status === "standby" ? "✅" : b.status === "asked" ? "⏳" : b.status === "called" ? "📞" : "—"} ${b.name}` : "—"}</div>; })}</td>
      <td className="py-2 pr-3 text-xs">{r.off.pending ? <>{r.off.pending} out<br /><span className="text-ink-soft">next expires in {Math.max(1, Math.round((new Date(r.off.soonest!).getTime() - Date.now()) / 60000))} min</span></> : r.j.contractor_id ? "—" : <span className="text-ink-soft">none out</span>}{r.off.passed ? <div className="text-ink-soft">{r.off.passed} passed</div> : null}</td>
      <td className="py-2 pr-3 text-xs"><Badge tone={r.pay.tone}>{r.pay.label}</Badge>{r.j.price_final ? <div className="mt-1 text-ink-soft">{money(r.j.price_final)}</div> : null}</td>
      <td className="py-2 pr-3 text-xs text-ink-soft">{ago(lastContact.get(r.j.ref))}</td>
      <td className="py-2 pr-3"><div className="mb-1 flex flex-wrap gap-1">{r.flags.map((f) => <Badge key={f.key} tone={f.tone}>{f.label}</Badge>)}</div>
        <DispatchActions job={{ id: r.j.id, contractorId: r.j.contractor_id, status: r.j.status, date: r.j.scheduled_date, window: r.j.time_window, standby: r.standby, payment: r.pay.key, siteVisit: r.j.status === "site_visit" }} pros={r.eligible} /></td>
    </tr>
  );
  const Table = ({ list }: { list: typeof rows }) => (
    <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-soft"><th className="pb-2">When</th><th className="pb-2">Job</th><th className="pb-2">Pro</th><th className="pb-2">Backups</th><th className="pb-2">Offers</th><th className="pb-2">Payment</th><th className="pb-2">Last contact</th><th className="pb-2">Needs / actions</th></tr></thead>
      <tbody className="divide-y divide-line">{list.map((r) => <Row key={r.j.id} r={r} />)}</tbody>
    </table></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Dispatch</h1><p className="text-sm text-ink-soft">Every job, its pro, backups, offers and payment — and what needs you now. Offers expire and move on by themselves every 10 minutes; use the buttons to step in.</p></div>
        <div className="flex gap-1">{TABS.map(([k, label]) => <Link key={k} href={`?tab=${k}`} className={`rounded-full border px-3 py-1 text-sm ${tab === k ? "border-brand bg-brand text-white" : "border-line"}`}>{label}</Link>)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Jobs", rows.filter((r) => r.j.scheduled_date && r.j.scheduled_date >= from && r.j.scheduled_date <= to).length, "slate"], ["No pro inside 6h", count("no_pro_soon"), "red"], ["No pro yet", count("no_pro"), "amber"], ["Unpaid / balance due", count("unpaid") + count("balance"), "amber"], ["No backups", count("no_backups"), "amber"]].map(([label, n, tone]) => (
          <div key={label as string} className={`card ${Number(n) && tone === "red" ? "border-rose-300 bg-rose-50" : ""}`}><div className="text-xs text-ink-soft">{label}</div><div className="text-2xl font-bold">{n}</div></div>
        ))}
      </div>
      <section className="card"><h2 className="mb-2 font-bold">Needs attention {attention.length ? `(${attention.length})` : ""}</h2>
        {attention.length ? <Table list={attention} /> : <p className="text-sm text-ink-soft">Nothing needs you right now — every job has a pro, backups and payment.</p>}</section>
      {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => (
        <section key={day} className="card"><h2 className="mb-2 font-bold">{fmtDate(day)} <span className="text-sm font-normal text-ink-soft">· {list.length} job{list.length === 1 ? "" : "s"}</span></h2>
          <Table list={[...list].sort((a, b) => (WINDOW_ORDER[a.j.time_window ?? "flexible"] ?? 3) - (WINDOW_ORDER[b.j.time_window ?? "flexible"] ?? 3))} /></section>
      ))}
      {!byDay.size && <p className="text-sm text-ink-soft">No jobs scheduled {tab === "today" ? "today" : tab === "tomorrow" ? "tomorrow" : "this week"}.</p>}
      <p className="text-xs text-ink-soft">Backups: ✅ standing by · ⏳ asked · 📞 called · — none. Last contact comes from the notification log (texts, emails and push about the job).</p>
    </div>
  );
}
