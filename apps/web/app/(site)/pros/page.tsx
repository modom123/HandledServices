/*
 * FILE    : apps/web/app/(site)/pros/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2109 UTC — The Handled Pro Program: promises, real payouts from the
 *           pricing engine, tiers, how we compare, the vetting process and requirements
 *           by trade (license, insurance, skills check).
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro onboarding & recruiting)
 * UPDATED : 2026-10-03_1247 UTC — "What pros make" leads with the share pros keep (68–85%), a full day and the
 *           small-to-large job range per trade (core earnings.ts) instead of single small-job numbers.
 * UPDATED : 2026-10-03_1311 UTC — fast track to Pro+ and crew accounts on the recruiting page.
 * UPDATED : 2026-10-03_1413 UTC — earnings card clearly labeled as estimates (badge, "Est." headers, plain-language disclaimer).
 * PURPOSE : Subcontractor recruiting page + application.
 * UPDATED : 2026-10-05_0418 UTC — Handled Pro Rewards section (points on every job, tenure multipliers, catalog highlights).
 * UPDATED : 2026-10-06_0748 UTC — #rewards anchor (footer link "Pro Rewards & tiers").
 */
import { ApplyForm } from "@/components/forms";
import { getPolicy } from "@/lib/pro-benefits";
import { getLocale } from "@/lib/locale";
import { BRAND, CATALOG_SEED, COVERAGES, FAST_TRACK, PRO_PROMISES, REWARD_DEFAULTS, TENURE_TIERS, benefitLines, ruleText, PRO_REFERRAL, PRO_TIERS, TRADES, TRADE_PROFILES, VETTING_STEPS, earningsHeadline, earningsShowcase, money, serviceText, t as tr, type ProPolicy } from "@handled/core";

export const metadata = { title: "Become a Pro", description: "Prepaid, pre-priced jobs in your area. No lead fees, weekly pay, and we run the office." };

const COMPARE: [string, string, string, string][] = [
  ["What it costs you", "Nothing to join. We keep a share of each finished job.", "You pay for leads, whether you win the job or not.", "A monthly software subscription."],
  ["Who finds the customer", "We do, and the job is already sold.", "You compete with other pros for each lead.", "You do: your own marketing."],
  ["Price", "You see your pay before you accept. Too low? Counter with your number, or pass for free.", "You quote, chase and negotiate.", "You quote."],
  ["Getting paid", "The customer prepays us; you're paid weekly.", "You invoice and collect.", "You invoice and collect."],
  ["Office work", "Scheduling, reminders, support and reviews handled.", "Yours.", "Yours, with better tools."],
  ["Unhappy customer", "Our team handles it with you.", "Yours.", "Yours."],
];

export const revalidate = 300;

type Benefit = ReturnType<typeof benefitLines>[number];

/** Benefit bodies carry amounts from the live policy, so the Spanish is rebuilt from the same numbers. */
function benefitBodyEs(b: Benefit, p: ProPolicy): string {
  switch (b.key) {
    case "payProtection": return "Si hizo bien el trabajo y aun así el cliente recibe un reembolso, sale de nuestra parte, no de su pago.";
    case "showUpPay": return `¿El cliente cancela tarde o no puede entrar? Recibe hasta ${money(p.showUpPay.amount)} por el viaje.`;
    case "instantPay": return `Cobre los pagos aprobados cuando quiera en su tarjeta de débito (cargo de ${(p.instantPay.feePct * 100).toFixed(1)}%), o espere el pago semanal gratis.`;
    case "insurance": return `Cotizaciones rápidas con nuestros socios de seguros y un subsidio de seguro de ${money(p.insurance.stipend)} después de su ${p.insurance.afterJobs}.º trabajo.`;
    case "materials": return "Las piezas, los materiales y las compras de mandados que no están incluidos en el precio se reembolsan al costo con recibo.";
    case "guarantee": return `En temporada alta, los mejores profesionales que se mantienen disponibles tienen garantizados ${money(p.guarantee.weeklyMinimum)} a la semana.`;
  }
}

function ruleTextEs(r: Benefit["rule"]): string {
  if (!r.enabled) return "Desactivado";
  const bits = [r.minTier === "pro" ? "Todos los profesionales activos" : `Profesionales ${PRO_TIERS.find((x) => x.id === r.minTier)?.name}+`];
  if (r.minJobs) bits.push(`${r.minJobs}+ trabajos`);
  if (r.minRating) bits.push(`${r.minRating}★+`);
  if (r.trades.length) bits.push(`oficios: ${r.trades.map((id) => tr("es", TRADES.find((x) => x.id === id)?.label ?? id).toLowerCase()).join(", ")}`);
  return bits.join(" · ");
}

export default async function ProsPage() {
  const l = await getLocale();
  const es = l === "es";
  const t = (s: string) => tr(l, s);
  const show = earningsShowcase();
  const head = earningsHeadline();
  const policy = await getPolicy().catch(() => null);
  const covLabel = (k: keyof typeof COVERAGES) => t(COVERAGES[k].label);
  return (
    <div className="wrap space-y-16 py-14">
      <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">{es ? `Programa Pro de ${BRAND.name}` : `The ${BRAND.name} Pro Program`}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t("Do the work you’re great at. We fill your calendar and you never chase a payment.")}</h1>
          <p className="mt-4 text-lg text-ink-soft">{t("Prepaid, pre-priced jobs in your area and your specialties. No lead fees, no bidding, no invoices. Accept a job like you’d accept a ride.")}</p>
          <a href="#apply" className="btn-primary mt-6 inline-block px-6">{t("Apply in 5 minutes")}</a>
        </div>
        <div className="card">
          <div className="text-sm font-semibold">{t("What pros can make")} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{t("Estimates")}</span></div>
          <div className="mt-1 text-3xl font-extrabold text-brand">{es ? `Usted se queda con ${head.keepLarge}–${head.keepSmall}% de cada trabajo` : `Keep ${head.keepLarge}–${head.keepSmall}% of every job`}</div>
          <p className="mt-1 text-sm text-ink-soft">{es ? `Mientras más pequeño el trabajo, mayor su parte. Pro+ y Elite ganan hasta ${head.topBoost}% más.` : `The smaller the job, the bigger your share. Pro+ and Elite earn up to ${head.topBoost}% more.`}</p>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-soft"><th className="pb-1 font-medium">{t("Trade")}</th><th className="pb-1 text-right font-medium">{t("Est. per job")}</th><th className="pb-1 text-right font-medium">{t("Est. full day")}</th></tr></thead>
            <tbody>
              {show.map((r) => (
                <tr key={r.slug} className="border-t border-line">
                  <td className="py-2">{r.icon} {t(r.name) === r.name ? serviceText(l, r.slug, { name: r.name, tagline: "" }).name : t(r.name)}</td>
                  <td className="py-2 text-right text-ink-soft">{money(r.low)}–{money(r.high)}</td>
                  <td className="py-2 text-right font-semibold text-brand">{r.day ? `~${money(r.day)}` : t("By project")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-soft">{t("Estimates only, not a promise of pay. They use today’s suggested prices for a small to a large job, and a full day assumes a typical day of average-size jobs. What you actually make depends on the jobs you choose, the final price, your tier and how much you work, and it’s before your own costs (supplies, gas, insurance and taxes). Every offer shows your exact pay before you accept, and you can counter if it isn’t right.")}</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">{t("Our promises to pros")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRO_PROMISES.map((p) => (
            <div key={p.t} className="card"><div className="font-semibold">✓ {t(p.t)}</div><p className="mt-1 text-sm text-ink-soft">{t(p.b)}</p></div>
          ))}
        </div>
      </section>

      {policy && (
        <section>
          <h2 className="text-2xl font-bold">{t("Benefits that protect your pay")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefitLines(policy).filter((b) => b.rule.enabled).map((b) => (
              <div key={b.key} className="card"><div className="font-semibold">🛡️ {t(b.title)}</div><p className="mt-1 text-sm text-ink-soft">{es ? benefitBodyEs(b, policy) : b.body}</p><p className="mt-2 text-xs text-brand-dark">{es ? ruleTextEs(b.rule) : ruleText(b.rule)}</p></div>
            ))}
          </div>
          {policy.insurance.partners.some((x) => x.url || x.phone) && (
            <p className="mt-4 text-sm text-ink-soft">{t("Need insurance?")} {policy.insurance.partners.filter((x) => x.url || x.phone).map((x) => `${x.name}${x.phone ? ` (${x.phone})` : ""}${x.code ? `, ${es ? "código" : "code"} ${x.code}` : ""}`).join(" · ")}</p>
          )}
        </section>
      )}

      <section id="rewards" className="scroll-mt-20 rounded-3xl bg-brand-tint p-6 sm:p-8">
        <h2 className="text-2xl font-bold">🎁 {es ? "Recompensas Handled Pro" : "Handled Pro Rewards"}</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">{es ? "Cada trabajo le da puntos según lo que genera para Handled: más por un gran trabajo, y más cada año que se queda. Cámbielos por artículos, herramientas, electrónicos y viajes." : "Every job earns points based on the business you bring in: more for great work, and more every year you stay. Redeem them for gear, tools, electronics and trips."}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="card"><div className="font-semibold">{es ? "Gane en cada trabajo" : "Earn on every job"}</div><p className="mt-1 text-sm text-ink-soft">{es ? `${REWARD_DEFAULTS.earnRate} puntos por cada $1 que Handled gana en su trabajo, ×${REWARD_DEFAULTS.qualityMultiplier} cuando pasa la revisión a la primera con ${REWARD_DEFAULTS.minRatingForQuality}★+. Bonos por metas: 10, 50, 100 trabajos, aniversarios y reseñas de cinco estrellas.` : `${REWARD_DEFAULTS.earnRate} points for every $1 Handled earns on your job, ×${REWARD_DEFAULTS.qualityMultiplier} when it passes review the first time with a ${REWARD_DEFAULTS.minRatingForQuality}★+ rating. Milestone bonuses at 10, 50, 100 jobs, anniversaries and five-star reviews.`}</p></div>
          <div className="card"><div className="font-semibold">{es ? "Quedarse paga más" : "Staying pays more"}</div><ul className="mt-1 space-y-0.5 text-sm text-ink-soft">{TENURE_TIERS.map((x) => <li key={x.months}>×{x.multiplier} · {es ? x.es : x.en}</li>)}</ul></div>
          <div className="card"><div className="font-semibold">{es ? "Lo que puede canjear" : "What you can redeem"}</div><ul className="mt-1 space-y-0.5 text-sm text-ink-soft">{CATALOG_SEED.filter((c) => ["hoodie", "tools-100", "drill-kit", "tv-55", "weekend-trip", "trip-for-two"].includes(c.slug)).map((c) => <li key={c.slug}>{es ? c.name_es : c.name} · {c.points.toLocaleString("en-US")} pts</li>)}</ul></div>
        </div>
        <p className="mt-4 text-xs text-ink-soft">{es ? "Los puntos nuevos se liberan a los 90 días. Rechazar ofertas nunca le cuesta puntos. Los puntos no tienen valor en efectivo; los premios cuentan como ingreso (aparecen en su 1099). Sujeto a los Términos de Recompensas." : "New points unlock after 90 days. Passing on offers never costs points. Points have no cash value; rewards count as income (shown on your 1099). Subject to the Rewards Terms."}</p>
      </section>

      <section>
        <h2 className="text-2xl font-bold">{t("Grow with us: Pro, Pro+ and Elite")}</h2>
        <p className="mt-2 text-ink-soft">{t("Tiers are earned from your real numbers (jobs, rating, on time) and update automatically. Passing on jobs never counts against you.")}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PRO_TIERS.map((tier) => (
            <div key={tier.id} className={`card ${tier.id === "elite" ? "border-brand bg-brand-tint" : ""}`}>
              <div className="text-lg font-bold">{tier.badge} {tier.name}</div>
              <div className="text-xs text-ink-soft">{tier.min.jobs ? (es ? `${tier.min.jobs}+ trabajos · ${tier.min.rating}★+ · ${Math.round(tier.min.onTime * 100)}% puntual` : `${tier.min.jobs}+ jobs · ${tier.min.rating}★+ · ${Math.round(tier.min.onTime * 100)}% on time`) : t("Once you’re activated")}</div>
              <ul className="mt-3 space-y-1 text-sm">{tier.perks.map((p) => <li key={p}>✓ {t(p)}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card"><div className="font-semibold">{es ? "¿Ya es maestro en su oficio? Empiece en Pro+" : "Already a master at your trade? Start at Pro+"}</div><p className="mt-1 text-sm text-ink-soft">{es ? `Con ${FAST_TRACK.minYears}+ años de experiencia, envíe fotos de su trabajo y haga un trabajo de prueba pagado que revisamos personalmente. Si pasa, empieza en Pro+ desde el primer día, sin esperar ${PRO_TIERS[1].min.jobs} trabajos.` : `With ${FAST_TRACK.minYears}+ years in the trade, send photos of your work and do one paid trial job we review by hand. Pass, and you start at Pro+ from day one instead of waiting ${PRO_TIERS[1].min.jobs} jobs.`}</p></div>
          <div className="card"><div className="font-semibold">{es ? "¿Tiene un equipo? Tráigalo" : "Have a crew? Bring them"}</div><p className="mt-1 text-sm text-ink-soft">{es ? "Registre a su gente (jefes de cuadrilla, técnicos con licencia, aprendices, ayudantes) y envíelos a trabajos de su empresa. Cada persona pasa la verificación de antecedentes; su empresa los dirige y les paga." : "List your people (crew leads, licensed techs, apprentices, helpers) and send them on your company’s jobs. Each person passes the background check; your company directs and pays them."}</p></div>
        </div>
        <p className="mt-4 text-sm text-ink-soft">{es ? `Recomiende a un gran profesional y gane ${money(PRO_REFERRAL.bonus)} cuando complete su ${PRO_REFERRAL.afterJobs}.º trabajo.` : `Refer a great pro and earn ${money(PRO_REFERRAL.bonus)} when they finish their ${PRO_REFERRAL.afterJobs}th job.`}</p>
      </section>

      <section>
        <h2 className="text-2xl font-bold">{t("How we’re different")}</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left"><th className="p-3"></th><th className="p-3 text-brand">{BRAND.name}</th><th className="p-3">{t("Lead sites (Angi, Thumbtack)")}</th><th className="p-3">{t("Field-service software (ServiceTitan)")}</th></tr></thead>
            <tbody>
              {COMPARE.map(([row, us, leads, soft]) => (
                <tr key={row} className="border-t border-line align-top"><td className="p-3 font-semibold">{t(row)}</td><td className="bg-brand-tint p-3">{t(us)}</td><td className="p-3 text-ink-soft">{t(leads)}</td><td className="p-3 text-ink-soft">{t(soft)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">{t("How we vet, and why it matters to you")}</h2>
          <p className="mt-2 text-ink-soft">{t("Customers book us because every pro is checked. That’s what keeps the work coming.")}</p>
          <ol className="mt-6 space-y-4">
            {VETTING_STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span><div><div className="font-semibold">{t(s.t)}</div><div className="text-sm text-ink-soft">{t(s.b)}</div></div></li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{t("Requirements by trade")}</h2>
          <p className="mt-2 text-sm text-ink-soft">{es ? `Todos necesitan verificación de antecedentes, un formulario W-9, un teléfono inteligente y un seguro de responsabilidad civil general que nombre a ${BRAND.name} como asegurado adicional. El seguro de accidentes laborales es obligatorio si tiene empleados; quienes trabajan solos firman una declaración de que no tienen empleados.` : `Everyone needs a background check, a W-9, a smartphone and general liability insurance naming ${BRAND.name} as additional insured. Workers’ comp is required if you have employees; solo owners sign a no-employees statement.`}</p>
          <div className="mt-4 space-y-2">
            {TRADES.map((trade) => {
              const p = TRADE_PROFILES[trade.id];
              if (!p) return null;
              return (
                <details key={trade.id} className="card py-3">
                  <summary className="cursor-pointer font-semibold">{t(trade.label)}</summary>
                  <p className="mt-2 text-sm text-ink-soft">{t(p.does)}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    <li>{es ? "Responsabilidad civil general" : "General liability"}: {money(p.glMin)} {es ? "por incidente" : "per occurrence"}{p.requires.length ? (es ? `, más ${p.requires.map((k) => covLabel(k).toLowerCase()).join(" y ")}` : `, plus ${p.requires.map((k) => COVERAGES[k].label.toLowerCase()).join(" and ")}`) : ""}</li>
                    {p.conditional.map((c) => <li key={c.key}>{covLabel(c.key)} {es ? "si" : "when"} {t(c.when)}</li>)}
                    <li>{es ? "Licencia" : "License"}: {p.license ? t(p.license) : t("none required by the state")}</li>
                    {p.preferred.length > 0 && <li>{es ? "Preferible" : "Preferred"}: {p.preferred.map(t).join("; ")}</li>}
                    <li>{es ? "Prueba de habilidades" : "Skills check"}: {t(p.skillsCheck)}</li>
                    <li>{es ? "Especialidades" : "Specialties"}: {p.specialties.map((s) => t(s.label)).join(", ")}</li>
                  </ul>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section id="apply" className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">{es ? "Postúlese" : "Apply"}</h2>
          <p className="mt-2 text-ink-soft">{t("We review every application within 2 business days. Don’t have every policy yet? Apply anyway; we’ll tell you exactly what you need and point you to brokers.")}</p>
          <div className="mt-6 space-y-3 text-sm">
            <div><b>{t("Am I an employee?")}</b> <span className="text-ink-soft">{t("No. You’re an independent business (1099). You choose which jobs to accept, use your own tools and keep your other clients.")}</span></div>
            <div><b>{t("When do I get paid?")}</b> <span className="text-ink-soft">{t("Weekly, for every job that passed photo review. Each job has its own statement.")}</span></div>
            <div><b>{t("Can I turn down offers?")}</b> <span className="text-ink-soft">{t("Yes, anytime. Accepting more often helps you move up a tier.")}</span></div>
            <div><b>{t("What if a customer isn’t happy?")}</b> <span className="text-ink-soft">{t("Our team handles the customer. You get the first chance to fix it, and the rules are spelled out in your contractor agreement.")}</span></div>
          </div>
        </div>
        <ApplyForm locale={l} />
      </section>
    </div>
  );
}
