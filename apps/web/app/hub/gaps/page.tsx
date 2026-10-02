/*
 * FILE    : apps/web/app/hub/gaps/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_2250 UTC
 * PURPOSE : Handled Hub → Supply gaps. Where customers want work and we're short of pros:
 *           bookings, bookings no pro could take, and waitlist sign-ups per service and ZIP,
 *           against the active pros who can do that work there and the applicants on the way.
 *           Tells recruiting exactly who to find, and where.
 */
import Link from "next/link";
import { getService, gapsByService, serviceGaps, type Contractor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/notify";
import { Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const LEVEL = {
  none: ["No pros", "bg-rose-100 text-rose-800"],
  thin: ["Too few", "bg-amber-100 text-amber-800"],
  ok: ["Covered", "bg-emerald-100 text-emerald-800"],
} as const;

export default async function GapsPage({ searchParams }: { searchParams: Promise<{ days?: string; all?: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const sp = await searchParams;
  const days = [30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const db = adminClient();
  const [{ data: jobs }, { data: alerts }, { data: wait }, { data: pros }, { data: apps }] = await Promise.all([
    db.from("jobs").select("id, service_slug, zip").gte("created_at", since).neq("status", "cancelled").limit(20000),
    db.from("ops_alerts").select("job_id").eq("kind", "no_pros").gte("created_at", since).not("job_id", "is", null).limit(5000),
    db.from("waitlist").select("service_slug, zip").is("notified_at", null).limit(20000),
    db.from("contractors").select("*").eq("status", "approved"),
    db.from("contractor_applications").select("trades, zips").not("stage", "in", "(active,rejected,dropped)").limit(2000),
  ]);
  const noPro = new Set((alerts ?? []).map((a: { job_id: string }) => a.job_id));
  const zips = [...new Set([...(jobs ?? []), ...(wait ?? [])].map((r: { zip: string }) => r.zip))].filter((z) => /^\d{5}$/.test(z));
  const { data: geoRows } = zips.length ? await db.from("zip_geo").select("zip, lat, lng").in("zip", zips.slice(0, 1000)) : { data: [] };
  const geo = Object.fromEntries((geoRows ?? []).map((g: { zip: string; lat: number; lng: number }) => [g.zip, { lat: g.lat, lng: g.lng }]));

  const rows = serviceGaps({
    jobs: (jobs ?? []).map((j: { id: string; service_slug: string; zip: string }) => ({ service_slug: j.service_slug, zip: j.zip, no_pro: noPro.has(j.id) })),
    waitlist: (wait ?? []) as { service_slug: string; zip: string }[],
    contractors: (pros ?? []) as Contractor[],
    geo,
    days,
  });
  // applicants on the way who could fill a row: right trade and they listed that ZIP (or its first 3 digits)
  const applicants = (apps ?? []) as { trades: string[]; zips: string | null }[];
  const onTheWay = (slug: string, zip: string) => {
    const trades = getService(slug)?.trades ?? [];
    return applicants.filter((a) => a.trades.some((t) => trades.includes(t)) && (!a.zips || a.zips.includes(zip) || a.zips.includes(zip.slice(0, 3)))).length;
  };
  const shown = sp.all ? rows : rows.filter((r) => r.level !== "ok");
  const services = gapsByService(rows).filter((s) => s.needed > 0);
  const name = (slug: string) => getService(slug)?.name ?? slug;
  const totalNeeded = rows.reduce((n, r) => n + r.needed, 0);
  const waiting = (wait ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Supply gaps</h1>
          <p className="text-sm text-ink-soft">Where customers want work and we don’t have enough pros. Recruit for the red rows first.</p>
        </div>
        <div className="flex gap-1 text-sm">{[30, 90, 365].map((d) => <Link key={d} href={`/hub/gaps?days=${d}${sp.all ? "&all=1" : ""}`} className={`rounded-lg px-3 py-1.5 ${d === days ? "bg-brand text-white" : "bg-white"}`}>{d === 365 ? "1 year" : `${d} days`}</Link>)}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Areas with no pro" value={rows.filter((r) => r.level === "none").length} hint="service × ZIP with demand and nobody eligible" />
        <Stat label="Too few pros" value={rows.filter((r) => r.level === "thin").length} hint="demand above what current pros can absorb" />
        <Stat label="Pros to recruit" value={totalNeeded} hint={`to cover the last ${days} days of demand`} />
        <Stat label="Waiting customers" value={waiting} hint="on the waitlist — told automatically when covered" />
      </div>

      {services.length > 0 && (
        <div className="card">
          <div className="font-semibold">Recruit by service</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 12).map((s) => (
              <div key={s.slug} className="rounded-xl bg-paper p-3 text-sm">
                <div className="font-semibold">{getService(s.slug)?.icon} {name(s.slug)}</div>
                <div className="text-ink-soft">Need ~{s.needed} pro{s.needed === 1 ? "" : "s"} · {s.bookings} bookings · {s.noPro} unfilled · {s.waitlist} waiting{s.zipsWithoutPros ? ` · ${s.zipsWithoutPros} ZIP${s.zipsWithoutPros === 1 ? "" : "s"} with no one` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between">
          <div className="font-semibold">By service and ZIP</div>
          <Link className="text-sm text-brand underline" href={`/hub/gaps?days=${days}${sp.all ? "" : "&all=1"}`}>{sp.all ? "Show gaps only" : "Show covered areas too"}</Link>
        </div>
        {!shown.length ? <p className="mt-3 text-sm text-ink-soft">No gaps in the last {days} days{rows.length ? " — every area with demand has enough pros" : " (no bookings or waitlist sign-ups yet)"}.</p> : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr><th className="py-2">Service</th><th>ZIP</th><th>Status</th><th className="text-right">Bookings</th><th className="text-right">Unfilled</th><th className="text-right">Waitlist</th><th className="text-right">Pros</th><th className="text-right">Applicants</th><th className="text-right">Recruit</th><th /></tr>
            </thead>
            <tbody>
              {shown.slice(0, 300).map((r) => {
                const post = `Now hiring: ${name(r.slug)} pros near ${r.zip}. Steady local jobs, upfront pay, weekly payouts. Apply in 5 minutes: ${siteUrl()}/pros`;
                return (
                  <tr key={`${r.slug}|${r.zip}`} className="border-t border-line align-top">
                    <td className="py-2">{getService(r.slug)?.icon} {name(r.slug)}</td>
                    <td>{r.zip}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[r.level][1]}`}>{LEVEL[r.level][0]}</span></td>
                    <td className="text-right">{r.bookings}</td>
                    <td className="text-right">{r.noPro || "—"}</td>
                    <td className="text-right">{r.waitlist || "—"}</td>
                    <td className="text-right">{r.pros}</td>
                    <td className="text-right">{onTheWay(r.slug, r.zip) || "—"}</td>
                    <td className="text-right font-semibold">{r.needed || "—"}</td>
                    <td className="pl-3">{r.needed > 0 && <details><summary className="cursor-pointer text-brand">Job post</summary><textarea readOnly className="input mt-1 min-h-20 w-64 text-xs" defaultValue={post} /></details>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-ink-soft">Pros = active pros who can take that service there today (trade, license, insurance, background check, driving radius). Unfilled = bookings where dispatch found nobody. Applicants = people in the recruiting pipeline with that trade who listed the area. One pro is assumed to cover about 20 bookings a month per service and area.</p>
      </div>
    </div>
  );
}
