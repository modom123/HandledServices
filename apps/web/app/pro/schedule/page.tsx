/*
 * FILE    : apps/web/app/pro/schedule/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Pro calendar — the next five weeks: jobs booked, open slots against your daily limit,
 *           and days off (take a day off or reopen it in one tap). Customers can only book you
 *           on days you're open, so keeping this current is how future work finds you.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 */
import Link from "next/link";
import { TIME_WINDOW_LABEL, getService, t as tr } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { getViewer } from "@/lib/auth";
import { proSchedule } from "@/lib/roster";
import { DayOffButton, OnCallToggle } from "@/components/Roster";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function ProSchedule() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const l = await getLocale();
  const es = l === "es";
  const t = (x: string) => tr(l, x);
  const s = await proSchedule(v.contractorId, 35);
  if (!s) return null;
  const booked = s.days.reduce((sum, d) => sum + d.jobs.length, 0);
  const openDays = s.days.filter((d) => !d.off).length;
  const lead = s.days[0]?.weekday ?? 0; // blanks before the first day so columns line up by weekday
  const today = s.days[0];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("My calendar")}</h1>
          <p className="text-sm text-ink-soft">{es
            ? `Próximas 5 semanas · ${booked} trabajo${booked === 1 ? "" : "s"} reservado${booked === 1 ? "" : "s"} · ${openDays} días de trabajo · hasta ${s.capacity} trabajo${s.capacity === 1 ? "" : "s"} al día`
            : `Next 5 weeks · ${booked} job${booked === 1 ? "" : "s"} booked · ${openDays} working days · up to ${s.capacity} job${s.capacity === 1 ? "" : "s"} a day`}</p>
        </div>
        <Link href="/pro/onboarding" className="text-sm font-semibold text-brand">{t("Change usual days, hours, area or daily limit →")}</Link>
      </div>
      <OnCallToggle locale={l} onCall={s.onCall} until={s.onCallUntil} activeJob={Boolean(today?.jobs.some((j) => ["assigned", "in_progress"].includes(j.status)))} />
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-ink-soft">{(es ? WD_ES : WD).map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
        {s.days.map((d, i) => {
          const full = !d.off && d.open === 0;
          return (
            <div key={d.date} className={`min-h-24 rounded-xl border p-1.5 text-left text-xs sm:p-2 ${d.off ? "border-line bg-paper-deep text-ink-soft" : full ? "border-amber-300 bg-amber-50" : d.jobs.length ? "border-brand bg-brand-tint" : "border-line bg-white"}`}>
              <div className="flex items-center justify-between font-semibold"><span>{i === 0 ? t("Today") : Number(d.date.slice(8))}</span>{!d.off && <span className="hidden text-ink-soft sm:inline">{d.jobs.length}/{d.capacity}</span>}</div>
              {d.off ? <div className="mt-1">{t(d.off)}</div> : (
                <ul className="mt-1 space-y-0.5">
                  {d.jobs.slice(0, 3).map((j) => <li key={j.id} className="truncate"><Link href={`/pro/jobs/${j.id}`} className="hover:underline">{getService(j.service_slug)?.icon} <span className="hidden sm:inline">{t(TIME_WINDOW_LABEL[j.time_window]).split(" ")[0]}</span></Link></li>)}
                  {d.jobs.length > 3 && <li>+{d.jobs.length - 3} {es ? "más" : "more"}</li>}
                  {!d.jobs.length && <li className="text-ink-soft">{t("Open")}</li>}
                </ul>
              )}
              {(!d.off || d.off === "Day off") && <div className="mt-1"><DayOffButton locale={l} date={d.date} off={d.off === "Day off"} hasJobs={d.jobs.length > 0} /></div>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-ink-soft">{t("Green: you have work. Amber: full for the day. Grey: off. Days you don’t usually work are set in Setup → Work area & hours. Need to drop a booked job? Message support from the job.")}</p>
    </div>
  );
}
