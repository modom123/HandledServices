/*
 * FILE    : apps/web/app/pro/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2109 UTC — Pro tier, progress to the next tier, probation, referral bonus.
 * UPDATED : 2026-10-02_0255 UTC — On call switch (shares location while on call / on a job today), link to My calendar.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 * PURPOSE : Pro home — open offers, upcoming jobs, earnings.
 */
import Link from "next/link";
import { PROBATION, PRO_REFERRAL, benefitLines, whyNot, type Contractor, TIME_WINDOW_LABEL, getService, money, nextTierProgress, onboardingChecklist, proTier, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getPolicy } from "@/lib/pro-benefits";
import { OnCallToggle } from "@/components/Roster";
import { localDate, onCall, serviceText, t as tr, type ProPolicy } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { Empty, Stat, StatusBadge } from "@/components/ui";
import Link2 from "next/link";

/** whyNot() reason in Spanish (fixed reasons from the catalog; the ones with numbers by pattern). */
function whyNotText(l: string, no: string): string {
  if (l !== "es") return no;
  return no
    .replace(/^needs (\S+) tier$/, "requiere el nivel $1")
    .replace(/^needs (\d+) completed jobs$/, "requiere $1 trabajos completados")
    .replace(/^needs a ([\d.]+)★ rating$/, "requiere una calificación de $1★")
    .replace(/^.*$/, (m) => tr(l, m));
}

/** Next-tier to-do items (nextTierProgress) in Spanish. */
function todoText(l: string, s: string): string {
  if (l !== "es") return s;
  return s
    .replace(/^(\d+) more completed jobs$/, "$1 trabajos completados más")
    .replace(/^rating (.+)\+ \(now (.+)\)$/, "calificación de $1+ (ahora $2)")
    .replace(/^on time (\d+)%\+ \(now (\d+)%\)$/, "puntualidad de $1%+ (ahora $2%)")
    .replace(/^accept (\d+)%\+ of offers \(now (\d+)%\)$/, "aceptar $1%+ de las ofertas (ahora $2%)");
}

/** Benefit descriptions in Spanish (the English ones come from benefitLines). */
function benefitBodyEs(key: string, p: ProPolicy): string | null {
  switch (key) {
    case "payProtection": return "Si hizo bien el trabajo y aun así el cliente recibe un reembolso, sale de nuestra parte, no de su pago.";
    case "showUpPay": return `¿El cliente cancela tarde o no puede entrar? Recibe hasta ${money(p.showUpPay.amount)} por el viaje.`;
    case "instantPay": return `Cobre los pagos aprobados cuando quiera en su tarjeta de débito (cargo de ${(p.instantPay.feePct * 100).toFixed(1)}%), o espere el pago semanal gratuito.`;
    case "insurance": return `Cotizaciones rápidas con nuestros socios de seguros y un subsidio de seguro de ${money(p.insurance.stipend)} después de su trabajo número ${p.insurance.afterJobs}.`;
    case "materials": return "Las piezas, materiales y compras de mandados no incluidos en el precio se reembolsan al costo con recibo.";
    case "guarantee": return `En temporada alta, los mejores profesionales que se mantienen disponibles tienen garantizados ${money(p.guarantee.weeklyMinimum)} por semana.`;
    default: return null;
  }
}

export default async function ProHome() {
  const v = await getViewer();
  if (!v) return null;
  const l = await getLocale();
  const es = l === "es";
  const t = (s: string) => tr(l, s);
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(es ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric" }) : t("Date TBD");
  const svcName = (slug: string) => { const s = getService(slug); return s ? serviceText(l, s.slug, s).name : undefined; };
  const stepLabel = (label: string) => {
    if (!es) return label;
    const full = t(label);
    if (full !== label) return full;
    const m = label.match(/^(.+) verified$/);
    return m ? `${t(m[1])} verificado` : label;
  };
  const [{ data: offers }, { data: jobs }, { data: payouts }, { data: me }] = await Promise.all([
    v.db.from("job_offers").select("id, payout, expires_at, job_id, jobs(ref, service_slug, city, zip, scheduled_date, time_window, answers, notes, status)").eq("status", "offered").order("offered_at", { ascending: false }),
    v.db.from("jobs").select("*").eq("contractor_id", v.contractorId!).order("scheduled_date"),
    v.db.from("payouts").select("amount, status, created_at"),
    v.db.from("contractors").select("*").eq("id", v.contractorId!).single(),
  ]);
  const policy = await getPolicy();
  const list = (jobs ?? []) as Job[];
  const upcoming = list.filter((j) => ["assigned", "in_progress", "qa_review", "site_visit"].includes(j.status));
  const month = new Date().toISOString().slice(0, 7);
  const earned = (payouts ?? []).filter((p: { created_at: string }) => p.created_at.startsWith(month)).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);
  type OfferRow = { id: string; payout: number; expires_at: string; jobs: { ref: string; service_slug: string; city: string; zip: string; scheduled_date: string | null; time_window: Job["time_window"]; notes: string | null } | null };
  const setup = me ? onboardingChecklist(me) : null;
  return (
    <div className="space-y-8">
      {setup && (!setup.complete || setup.steps.some((x) => x.expiring)) && (
        <Link href="/pro/onboarding" className="card block border-amber-300 bg-amber-50">
          <div className="font-semibold">{setup.complete ? t("A document expires soon") : es ? `Termine la configuración — falta(n) ${setup.steps.filter((x) => !x.done).length} paso(s)` : `Finish setup — ${setup.steps.filter((x) => !x.done).length} step(s) left`}</div>
          <div className="text-sm text-ink-soft">{setup.steps.filter((x) => !x.done || x.expiring).map((x) => stepLabel(x.label)).join(" · ")}</div>
        </Link>
      )}
      <div><h1 className="text-2xl font-bold">{me?.business_name}</h1><p className="text-sm text-ink-soft">{t("Status:")} {me?.status ? t(me.status) : ""}{me?.status !== "approved" ? t(" — offers start once insurance & background check are verified") : ""}</p></div>
      {me?.status === "approved" && (
        <OnCallToggle locale={l} onCall={onCall(me)} until={me.on_call_until ?? null} activeJob={list.some((j) => j.scheduled_date === localDate() && ["assigned", "in_progress"].includes(j.status))} />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("Earned this month")} value={money(earned)} />
        <Stat label={t("Rating")} value={`${me?.rating ?? "—"} ★`} />
        <Stat label={t("Jobs completed")} value={me?.jobs_completed ?? 0} />
      </div>
      {me && (() => {
        const tier = proTier(me), prog = nextTierProgress(me);
        return (
          <div className="card border-brand/40 bg-brand-tint">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{es
                ? <>{tier.badge} Profesional {tier.name}{tier.payoutBoost ? ` · +${Math.round(tier.payoutBoost * 100)}% del precio del trabajo en cada pago` : ""}</>
                : <>{tier.badge} {tier.name} pro{tier.payoutBoost ? ` · +${Math.round(tier.payoutBoost * 100)}% of the job price on every payout` : ""}</>}</div>
              {me.jobs_completed < PROBATION.jobs && <span className="text-xs text-ink-soft">{es
                ? `Periodo de prueba: falta(n) ${PROBATION.jobs - me.jobs_completed} trabajo(s) (trabajos de hasta ${money(PROBATION.maxJobPrice)})`
                : `Probation: ${PROBATION.jobs - me.jobs_completed} job(s) left (jobs up to ${money(PROBATION.maxJobPrice)})`}</span>}
            </div>
            <div className="text-sm text-ink-soft">{tier.perks.map(t).join(" · ")}</div>
            {prog.next && (es
              ? <div className="mt-2 text-sm">Siguiente: <b>{prog.next.badge} {prog.next.name}</b> (+{Math.round(prog.next.payoutBoost * 100)}% de pago, ofertas antes). Para llegar: {prog.todo.map((x) => todoText(l, x)).join(", ")}.</div>
              : <div className="mt-2 text-sm">Next: <b>{prog.next.badge} {prog.next.name}</b> (+{Math.round(prog.next.payoutBoost * 100)}% pay, earlier offers). To get there: {prog.todo.join(", ")}.</div>)}
            <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {benefitLines(policy).filter((b) => b.rule.enabled).map((b) => {
                const no = whyNot(b.rule, me as Contractor);
                return <div key={b.key} title={(es && benefitBodyEs(b.key, policy)) || b.body} className={no ? "text-ink-soft" : ""}>{no ? "○" : "✅"} {t(b.title)}{no ? ` — ${whyNotText(l, no)}` : ""}</div>;
              })}
            </div>
            <div className="mt-2 text-xs text-ink-soft">{es
              ? `¿Conoce a un gran profesional? Gane ${money(PRO_REFERRAL.bonus)} cuando termine su trabajo número ${PRO_REFERRAL.afterJobs}. Su enlace de referido: `
              : `Know a great pro? Earn ${money(PRO_REFERRAL.bonus)} when they finish their ${PRO_REFERRAL.afterJobs}th job. Your referral link: `}<span className="select-all font-mono text-ink">{`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pros?ref=${me.id}`}</span></div>
          </div>
        );
      })()}
      <section>
        <h2 className="mb-3 font-bold">{t("New offers")}</h2>
        {!(offers ?? []).length && <Empty>{t("No open offers right now. We’ll email you the moment one comes in.")}</Empty>}
        <div className="space-y-3">
          {((offers ?? []) as unknown as OfferRow[]).map((o) => {
            const s = getService(o.jobs?.service_slug ?? "");
            return (
              <div key={o.id} className="card flex flex-wrap items-center justify-between gap-4">
                <div><div className="font-semibold">{s?.icon} {s ? serviceText(l, s.slug, s).name : ""} · <span className="text-brand">{o.payout ? money(o.payout) : t("site visit")}</span></div>
                  <div className="text-sm text-ink-soft">{o.jobs?.city} {o.jobs?.zip} · {fmtDate(o.jobs?.scheduled_date)} · {o.jobs ? t(TIME_WINDOW_LABEL[o.jobs.time_window]) : ""}</div>
                  {o.jobs?.notes && <div className="mt-1 text-xs text-ink-soft">“{o.jobs.notes}”</div>}
                  <div className="text-xs text-ink-soft">{es ? "Vence a las" : "Expires"} {new Date(o.expires_at).toLocaleTimeString(es ? "es-US" : [], { hour: "numeric", minute: "2-digit" })}</div></div>
                <Link2 href={`/pro/offers/${o.id}`} className="btn-primary px-5">{t("View & accept →")}</Link2>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{t("Your schedule")}</h2><Link href="/pro/schedule" className="text-sm font-semibold text-brand">{t("My calendar & days off →")}</Link></div>
        {!upcoming.length && <Empty>{t("Nothing scheduled.")}</Empty>}
        <div className="space-y-3">
          {upcoming.map((j) => (
            <Link key={j.id} href={`/pro/jobs/${j.id}`} className="card flex items-center justify-between gap-3 hover:border-brand">
              <div><div className="font-semibold">{svcName(j.service_slug)} <span className="text-xs text-ink-soft">{j.ref}</span></div><div className="text-sm text-ink-soft">{fmtDate(j.scheduled_date)} · {j.address}, {j.city}</div></div>
              <div className="flex items-center gap-3"><span className="text-sm font-semibold">{money(j.contractor_payout)}</span><StatusBadge status={j.status} locale={l} /></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
