/*
 * FILE    : apps/web/app/hub/schedule/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Hub → Schedule: one day as a grid — a row per pro (plus "Unassigned"), a column per time window. Drag a job
 *           card onto another pro or window to reassign or move it (on a phone: tap the card, then tap where it goes).
 *           Rows show pros booked that day plus approved pros who can do that day's open jobs (?all=1 for every pro).
 *           Same rules as everywhere: no pro on unpaid work; the new pro is notified (components/ScheduleBoard).
 * UPDATED : 2026-10-15_0300 UTC — "pay after" jobs with their 25% in can be dragged to a pro.
 */
import Link from "next/link";
import { dayOff, getService, localDate, paymentState, type BoardJobInput } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { fmtDate } from "@/components/ui";
import { ScheduleBoard, type BoardCard, type BoardPro } from "@/components/ScheduleBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule" };

const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
type J = BoardJobInput & { id: string; ref: string; service_slug: string; city: string | null; contact_name: string };
type C = { id: string; business_name: string; trades: string[]; daily_capacity: number | null; time_off: string[] | null; availability: { days: number[]; windows: string[] } | null };

export default async function Schedule({ searchParams }: { searchParams: Promise<{ date?: string; all?: string }> }) {
  const sp = await searchParams;
  const today = localDate(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const all = sp.all === "1";
  const db = adminClient();
  const [{ data: jobRows }, { data: proRows }] = await Promise.all([
    db.from("jobs").select("id, ref, service_slug, status, scheduled_date, time_window, zip, city, contact_name, contractor_id, price_final, paid_at, deposit_paid_at, payment_plan, balance_attempts, billed_on_terms, amount_paid, amount_refunded, remedy").eq("scheduled_date", date).neq("status", "cancelled").order("created_at").limit(400),
    db.from("contractors").select("id, business_name, trades, daily_capacity, time_off, availability").eq("status", "approved").order("business_name").limit(500),
  ]);
  const jobs = (jobRows ?? []) as unknown as J[];
  const allPros = (proRows ?? []) as unknown as C[];
  const openTrades = new Set(jobs.filter((j) => !j.contractor_id).flatMap((j) => getService(j.service_slug)?.trades ?? []));
  const booked = new Set(jobs.map((j) => j.contractor_id).filter(Boolean));
  const shown = allPros.filter((p) => all || booked.has(p.id) || (!dayOff(p, date) && p.trades?.some((t) => openTrades.has(t))));
  const pros: BoardPro[] = shown.slice(0, all ? 500 : 60).map((p) => ({ id: p.id, name: p.business_name, trades: p.trades ?? [], capacity: p.daily_capacity ?? 3, off: dayOff(p, date) }));
  const cards: BoardCard[] = jobs.map((j) => {
    const svc = getService(j.service_slug);
    return { id: j.id, ref: j.ref, icon: svc?.icon ?? "•", service: svc?.name ?? j.service_slug, trades: svc?.trades ?? [], city: j.city ?? "", customer: j.contact_name, window: j.time_window ?? "flexible", contractorId: j.contractor_id, status: j.status, payment: paymentState(j).key };
  });
  const missing = jobs.filter((j) => j.contractor_id && !pros.some((p) => p.id === j.contractor_id)).length;
  const nav = (d: string) => `/hub/schedule?date=${d}${all ? "&all=1" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-sm text-ink-soft">Drag a job to another pro or time window. On a phone, tap a job, then tap where it goes. Unpaid jobs can&apos;t be given to a pro. The new pro gets a push and a text; tell the customer in the job&apos;s messages if their window changed.</p></div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link className="btn-ghost" href={nav(addDays(date, -1))}>←</Link>
          <form className="flex gap-1" action="/hub/schedule"><input type="date" name="date" defaultValue={date} className="input h-9 w-auto py-0" />{all && <input type="hidden" name="all" value="1" />}<button className="btn-ghost">Go</button></form>
          <Link className="btn-ghost" href={nav(addDays(date, 1))}>→</Link>
          {date !== today && <Link className="underline" href={nav(today)}>Today</Link>}
          <Link className="underline" href={`/hub/schedule?date=${date}${all ? "" : "&all=1"}`}>{all ? "Only relevant pros" : "Show every pro"}</Link>
        </div>
      </div>
      <p className="font-semibold">{fmtDate(date)} · {jobs.length} job{jobs.length === 1 ? "" : "s"} · {jobs.filter((j) => !j.contractor_id).length} without a pro</p>
      <ScheduleBoard key={date} date={date} pros={pros} cards={cards} nextDay={addDays(date, 1)} />
      {missing > 0 && <p className="text-xs text-ink-soft">{missing} job(s) belong to a pro who isn&apos;t approved any more — they show under Unassigned&apos;s pro list on Dispatch.</p>}
      <p className="text-xs text-ink-soft">Jobs in progress, in QA or done are locked. For backups, offers and payment links use <Link className="underline" href="/hub/dispatch">Dispatch</Link>.</p>
    </div>
  );
}
