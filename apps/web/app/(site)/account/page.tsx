/*
 * FILE    : apps/web/app/(site)/account/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Customer portal — all jobs, recurring plans, quick rebook.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getService, money, moneyRange, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Empty, NotConfigured, StatusBadge, fmtDate } from "@/components/ui";

export const metadata = { title: "My bookings" };
export const dynamic = "force-dynamic";

export default async function Account() {
  if (!supabaseConfigured) return <NotConfigured />;
  const v = await getViewer();
  if (!v) redirect("/login?next=/account");
  const [{ data: jobs }, { data: plans }] = await Promise.all([
    v.db.from("jobs").select("*").order("created_at", { ascending: false }),
    v.db.from("recurring_plans").select("*").eq("active", true),
  ]);
  const list = (jobs ?? []) as Job[];
  return (
    <div className="wrap py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">My bookings</h1><p className="text-sm text-ink-soft">{v.email}</p></div>
        <div className="flex gap-2"><Link href="/book" className="btn-primary">Book a service</Link><form action="/auth/signout" method="post"><button className="btn-ghost">Sign out</button></form></div>
      </div>
      {(plans ?? []).length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(plans ?? []).map((p: { id: string; service_slug: string; frequency: string; price: number; next_date: string }) => (
            <div key={p.id} className="card bg-brand-tint"><div className="text-sm font-semibold">{getService(p.service_slug)?.name} · {p.frequency}</div><div className="text-sm text-ink-soft">Next visit {fmtDate(p.next_date)} · {money(p.price)}</div></div>
          ))}
        </div>
      )}
      <div className="mt-8 space-y-3">
        {list.length === 0 && <Empty>No bookings yet. Anything you book with {v.email} shows up here, with status, invoices, messages and photos.</Empty>}
        {list.map((j) => {
          const s = getService(j.service_slug);
          return (
            <Link key={j.id} href={`/account/jobs/${j.id}`} className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand">
              <div className="flex items-center gap-3"><span className="text-2xl">{s?.icon}</span><div><div className="font-semibold">{s?.name} <span className="text-xs text-ink-soft">{j.ref}</span></div><div className="text-sm text-ink-soft">{fmtDate(j.scheduled_date)} · {j.address}</div></div></div>
              <div className="flex items-center gap-3"><span className="text-sm font-semibold">{j.price_final ? money(j.price_final) : moneyRange(j.estimate_low, j.estimate_high)}</span><StatusBadge status={j.status} /></div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
