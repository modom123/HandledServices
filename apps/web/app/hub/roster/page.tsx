/*
 * FILE    : apps/web/app/hub/roster/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Live roster — where every active pro is and when they can work: status right now
 *           (on a job / on call / booked / open / off), live location while on call or on a job
 *           (with distance to their current job), today's jobs, and the next 7 days booked vs
 *           their daily limit. Refreshes every minute.
 */
import Link from "next/link";
import { getService, TIME_WINDOW_LABEL } from "@handled/core";
import { liveRoster } from "@/lib/roster";
import { AutoRefresh } from "@/components/Roster";
import { Badge, Empty, Stat } from "@/components/ui";

const TONE = { on_job: "brand", on_call: "green", booked: "amber", working: "slate", off: "slate" } as const;
const WD = ["S", "M", "T", "W", "T", "F", "S"];

export const dynamic = "force-dynamic";

export default async function Roster() {
  const pros = await liveRoster();
  const count = (s: string) => pros.filter((p) => p.status === s).length;
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={60} />
      <div>
        <h1 className="text-2xl font-bold">Live roster</h1>
        <p className="text-sm text-ink-soft">Where pros are and when they can work. Locations come from the pro app and are only shared while a pro is on call or on a job today. Refreshes every minute.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="On a job" value={count("on_job")} />
        <Stat label="On call" value={count("on_call")} />
        <Stat label="Booked today" value={count("booked")} />
        <Stat label="Open today" value={count("working")} />
        <Stat label="Off today" value={count("off")} />
      </div>
      {!pros.length && <Empty>No active pros yet.</Empty>}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr><th className="p-3">Pro</th><th className="p-3">Now</th><th className="p-3">Location</th><th className="p-3">Today</th><th className="p-3">Next 7 days (booked / limit)</th></tr>
          </thead>
          <tbody>
            {pros.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="p-3"><Link href={`/hub/pros/${p.id}`} className="font-semibold underline">{p.name}</Link><div className="text-xs text-ink-soft">{p.contact} · <a href={`tel:${p.phone}`} className="underline">{p.phone}</a></div></td>
                <td className="p-3"><Badge tone={TONE[p.status]}>{p.statusLabel}</Badge>{p.onCallUntil && <div className="mt-1 text-xs text-ink-soft">until {new Date(p.onCallUntil).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })}</div>}</td>
                <td className="p-3 text-xs">
                  {p.location
                    ? <><a className="font-semibold text-brand underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${p.location.lat},${p.location.lng}`}>📍 Live · {p.location.minutesAgo} min ago</a>{p.milesToJob != null && <div className="text-ink-soft">{p.milesToJob} mi from current job</div>}</>
                    : <span className="text-ink-soft">Base {p.baseZip ?? "?"} · drives {p.radius} mi</span>}
                </td>
                <td className="p-3 text-xs">
                  {p.today.length ? p.today.map((j) => <div key={j.id}><Link href={`/hub/jobs/${j.id}`} className="underline">{j.ref}</Link> {getService(j.service)?.icon} {TIME_WINDOW_LABEL[j.window as keyof typeof TIME_WINDOW_LABEL]?.split(" ")[0]} · {j.city} <span className="text-ink-soft">({j.status.replace("_", " ")})</span></div>) : <span className="text-ink-soft">—</span>}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {p.week.map((d) => (
                      <div key={d.date} title={`${d.date}${d.off ? ` — ${d.off}` : ` — ${d.booked}/${d.capacity}`}`} className={`w-9 rounded-md py-1 text-center text-xs ${d.off ? "bg-paper-deep text-ink-soft" : d.booked >= d.capacity ? "bg-amber-100 text-amber-800" : d.booked ? "bg-brand-tint text-brand-dark" : "bg-white ring-1 ring-line"}`}>
                        <div className="font-semibold">{WD[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}</div>
                        <div>{d.off ? "off" : `${d.booked}/${d.capacity}`}</div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
