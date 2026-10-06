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
 * UPDATED : 2026-10-06_0802 UTC — tightened (about 30% shorter on desktop and phones): shorter hero with proof points and two CTAs, a sticky
 *           jump bar (Pay · How it works · What you get · Grow · Requirements · FAQ · Apply), a 3-step "How it works"
 *           (full vetting steps fold out), promises + pay benefits merged into one checklist, tiers + rewards + fast
 *           track / crew / referral in one "Grow" section, a one-dropdown trade picker instead of 20+ expanders, a
 *           Handled-vs-lead-sites table, FAQ accordion. FAQ fixed: tiers never depend on accepting offers.
 */
import { ApplyForm } from "@/components/forms";
import { TradeRequirements, type TradeReq } from "@/components/TradeRequirements";
import { getPolicy } from "@/lib/pro-benefits";
import { getLocale } from "@/lib/locale";
import { BRAND, CATALOG_SEED, COVERAGES, FAST_TRACK, PROBATION, PRO_PROMISES, REWARD_DEFAULTS, TENURE_TIERS, benefitLines, ruleText, PRO_REFERRAL, PRO_TIERS, TRADES, TRADE_PROFILES, VETTING_STEPS, earningsHeadline, earningsShowcase, money, serviceText, t as tr, type ProPolicy } from "@handled/core";

export const metadata = { title: "Become a Pro", description: "Prepaid, pre-priced jobs in your area. No lead fees, weekly pay, and we run the office." };

const COMPARE: [string, string, string][] = [
  ["What it costs you", "Nothing to join. We keep a share of each finished job.", "You pay for leads, whether you win the job or not."],
  ["Who finds the customer", "We do, and the job is already sold.", "You compete with other pros for each lead."],
  ["Price", "You see your pay before you accept. Too low? Counter with your number, or pass for free.", "You quote, chase and negotiate."],
  ["Getting paid", "The customer prepays us; you're paid weekly.", "You invoice and collect."],
  ["Office work", "Scheduling, reminders, support and reviews handled.", "Yours."],
  ["Unhappy customer", "Our team handles it with you.", "Yours."],
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
  const tradeName = (r: { slug: string; name: string }) => (t(r.name) === r.name ? serviceText(l, r.slug, { name: r.name, tagline: "" }).name : t(r.name));
  const JUMP: [string, string][] = es
    ? [["pay", "Ganancias"], ["how", "Cómo funciona"], ["get", "Lo que recibe"], ["grow", "Crecer"], ["requirements", "Requisitos"], ["faq", "Preguntas"]]
    : [["pay", "Pay"], ["how", "How it works"], ["get", "What you get"], ["grow", "Grow"], ["requirements", "Requirements"], ["faq", "FAQ"]];
  const STEPS = es
    ? [["Postúlese", "5 minutos: oficios, zona, seguro y dos referencias."], ["Verificación", "Llamada, prueba de habilidades, documentos y antecedentes. Respondemos en 2 días hábiles."], ["Acepte trabajos y cobre", "Ofertas prepagadas en su zona; pago cada lunes."]]
    : [["Apply", "5 minutes: your trades, area, insurance and two references."], ["Get vetted", "A call, a skills check, documents and a background check. We reply within 2 business days."], ["Take jobs, get paid", "Prepaid offers in your area; paid every Monday."]];
  const trades: TradeReq[] = TRADES.flatMap((trade) => {
    const p = TRADE_PROFILES[trade.id];
    if (!p) return [];
    const lines = [
      `${es ? "Responsabilidad civil general" : "General liability"}: ${money(p.glMin)} ${es ? "por incidente" : "per occurrence"}${p.requires.length ? (es ? `, más ${p.requires.map((k) => covLabel(k).toLowerCase()).join(" y ")}` : `, plus ${p.requires.map((k) => COVERAGES[k].label.toLowerCase()).join(" and ")}`) : ""}`,
      ...p.conditional.map((c) => `${covLabel(c.key)} ${es ? "si" : "when"} ${t(c.when)}`),
      `${es ? "Licencia" : "License"}: ${p.license ? t(p.license) : t("none required by the state")}`,
      ...(p.preferred.length ? [`${es ? "Preferible" : "Preferred"}: ${p.preferred.map(t).join("; ")}`] : []),
      `${es ? "Prueba de habilidades" : "Skills check"}: ${t(p.skillsCheck)}`,
      `${es ? "Especialidades" : "Specialties"}: ${p.specialties.map((x) => t(x.label)).join(", ")}`,
    ];
    return [{ id: trade.id, label: t(trade.label), does: t(p.does), lines }];
  });
  const FAQ: [string, string][] = [
    [t("Am I an employee?"), t("No. You’re an independent business (1099). You choose which jobs to accept, use your own tools and keep your other clients.")],
    [t("When do I get paid?"), t("Weekly, for every job that passed photo review. Each job has its own statement.")],
    [t("Can I turn down offers?"), es ? "Sí, cuando quiera y sin costo. Rechazar nunca afecta su nivel, sus puntos ni las ofertas futuras." : "Yes, anytime, for free. Passing never affects your tier, your points or future offers."],
    [es ? "¿Necesito todo el seguro antes de postularme?" : "Do I need every policy before I apply?", es ? "No. Postúlese primero; le decimos exactamente qué cobertura necesita su oficio y le conectamos con corredores." : "No. Apply first; we’ll tell you exactly what your trade needs and connect you with brokers."],
    [es ? "¿Qué tan rápido puedo empezar?" : "How fast can I start?", es ? `Respondemos en 2 días hábiles. Cuando sus documentos están aprobados, recibe ofertas de prueba (sus primeros ${PROBATION.jobs} trabajos, de menos de $${PROBATION.maxJobPrice}).` : `We reply within 2 business days. Once your documents clear, you get probation offers (your first ${PROBATION.jobs} jobs, each under $${PROBATION.maxJobPrice}).`],
    [t("What if a customer isn’t happy?"), t("Our team handles the customer. You get the first chance to fix it, and the rules are spelled out in your contractor agreement.")],
  ];
  return (
    <div className="wrap space-y-14 py-10 sm:py-14">
      <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">{es ? `Programa Pro de ${BRAND.name}` : `The ${BRAND.name} Pro Program`}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{es ? "Trabajos pagados, no clientes potenciales." : "Paid jobs, not leads."}</h1>
          <p className="mt-3 text-lg text-ink-soft">{t("Prepaid, pre-priced jobs in your area and your specialties. No lead fees, no bidding, no invoices. Accept a job like you’d accept a ride.")}</p>
          <ul className="mt-4 grid gap-2 text-[15px] font-semibold sm:grid-cols-2">
            {(es
              ? [`Se queda con ${head.keepLarge}–${head.keepSmall}% de cada trabajo`, "El cliente ya pagó", "Pago cada lunes, gratis", "Rechace cualquier oferta sin costo"]
              : [`Keep ${head.keepLarge}–${head.keepSmall}% of every job`, "The customer has already paid", "Paid every Monday, free", "Pass on any offer, no penalty"]
            ).map((x) => <li key={x} className="flex gap-2"><span className="text-brand">✓</span>{x}</li>)}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#apply" className="btn-primary px-6">{t("Apply in 5 minutes")}</a>
            <a href="#pay" className="btn-ghost px-6">{es ? "Vea cuánto puede ganar" : "See what you’d make"}</a>
          </div>
        </div>
        <div id="pay" className="card scroll-mt-28">
          <div className="text-sm font-semibold">{t("What pros can make")} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{t("Estimates")}</span></div>
          <p className="mt-1 text-sm text-ink-soft">{es ? `Mientras más pequeño el trabajo, mayor su parte. Pro+ y Elite ganan hasta ${head.topBoost}% más.` : `The smaller the job, the bigger your share. Pro+ and Elite earn up to ${head.topBoost}% more.`}</p>
          <table className="mt-3 w-full text-[13px] sm:text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-soft"><th className="pb-1 font-medium">{t("Trade")}</th><th className="pb-1 text-right font-medium">{t("Est. per job")}</th><th className="pb-1 text-right font-medium">{t("Est. full day")}</th></tr></thead>
            <tbody>
              {show.map((r, i) => (
                <tr key={r.slug} className={`border-t border-line ${i >= 6 ? "hidden sm:table-row" : ""}`}>
                  <td className="py-1.5">{r.icon} {tradeName(r)}</td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right text-ink-soft">{money(r.low)}–{money(r.high)}</td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right font-semibold text-brand">{r.day ? `~${money(r.day)}` : t("By project")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details className="mt-3 text-xs text-ink-soft"><summary className="cursor-pointer">{es ? "Cómo calculamos estos números" : "How these are estimated"}</summary><p className="mt-1">{t("Estimates only, not a promise of pay. They use today’s suggested prices for a small to a large job, and a full day assumes a typical day of average-size jobs. What you actually make depends on the jobs you choose, the final price, your tier and how much you work, and it’s before your own costs (supplies, gas, insurance and taxes). Every offer shows your exact pay before you accept, and you can counter if it isn’t right.")}</p></details>
        </div>
      </section>

      <nav aria-label={es ? "En esta página" : "On this page"} className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y border-line bg-paper/95 px-4 backdrop-blur">
        <div className="flex min-w-max items-center gap-1 py-2 text-sm font-semibold">
          {JUMP.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full px-3 py-1.5 text-ink hover:bg-white">{label}</a>)}
          <a href="#apply" className="ml-1 rounded-full bg-brand px-4 py-1.5 text-white">{es ? "Postúlese" : "Apply"}</a>
        </div>
      </nav>

      <section id="how" className="scroll-mt-32">
        <h2 className="text-2xl font-bold">{es ? "Cómo funciona" : "How it works"}</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map(([h, b], i) => (
            <li key={h} className="card flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</span><div><div className="font-semibold">{h}</div><p className="mt-0.5 text-sm text-ink-soft">{b}</p></div></li>
          ))}
        </ol>
        <details className="card mt-4">
          <summary className="cursor-pointer font-semibold">{t("How we vet, and why it matters to you")}</summary>
          <p className="mt-2 text-sm text-ink-soft">{t("Customers book us because every pro is checked. That’s what keeps the work coming.")}</p>
          <ol className="mt-3 space-y-2 text-sm">{VETTING_STEPS.map((x, i) => <li key={x.t}><b>{i + 1}. {t(x.t)}</b> <span className="text-ink-soft">{t(x.b)}</span></li>)}</ol>
        </details>
      </section>

      <section id="get" className="scroll-mt-32">
        <h2 className="text-2xl font-bold">{es ? "Lo que recibe" : "What you get"}</h2>
        <div className="mt-5 grid gap-x-8 gap-y-2 sm:gap-y-4 md:grid-cols-2">
          {PRO_PROMISES.map((p) => (
            <div key={p.t} className="flex gap-3"><span className="mt-0.5 text-brand">✓</span><div><div className="font-semibold">{t(p.t)}</div><p className="hidden text-sm text-ink-soft sm:block">{t(p.b)}</p></div></div>
          ))}
          {policy && benefitLines(policy).filter((b) => b.rule.enabled).map((b) => (
            <div key={b.key} className="flex gap-3"><span className="mt-0.5">🛡️</span><div><div className="font-semibold">{t(b.title)}</div><p className="hidden text-sm text-ink-soft sm:block">{es ? benefitBodyEs(b, policy) : b.body} <span className="text-brand-dark">({es ? ruleTextEs(b.rule) : ruleText(b.rule)})</span></p></div></div>
          ))}
        </div>
        {policy?.insurance.partners.some((x) => x.url || x.phone) && (
          <p className="mt-4 text-sm text-ink-soft">{t("Need insurance?")} {policy.insurance.partners.filter((x) => x.url || x.phone).map((x) => `${x.name}${x.phone ? ` (${x.phone})` : ""}${x.code ? `, ${es ? "código" : "code"} ${x.code}` : ""}`).join(" · ")}</p>
        )}
        <div className="mt-8 hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-3">{t("How we’re different")}</th><th className="p-3 text-brand">{BRAND.name}</th><th className="p-3">{t("Lead sites (Angi, Thumbtack)")}</th></tr></thead>
            <tbody>
              {COMPARE.map(([row, us, leads]) => (
                <tr key={row} className="border-t border-line align-top"><td className="p-3 font-semibold">{t(row)}</td><td className="bg-brand-tint p-3">{t(us)}</td><td className="p-3 text-ink-soft">{t(leads)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 sm:hidden">
          <div className="font-bold">{t("How we’re different")}</div>
          <div className="mt-2 space-y-2">
            {COMPARE.map(([row, us, leads]) => (
              <div key={row} className="card py-3 text-sm"><div className="font-semibold">{t(row)}</div><div className="mt-1"><b className="text-brand">{BRAND.name}:</b> {t(us)}</div><div className="mt-0.5 text-ink-soft"><b>{es ? "Sitios de clientes potenciales" : "Lead sites"}:</b> {t(leads)}</div></div>
            ))}
          </div>
        </div>
      </section>

      <section id="grow" className="scroll-mt-32">
        <h2 className="text-2xl font-bold">{t("Grow with us: Pro, Pro+ and Elite")}</h2>
        <p className="mt-2 text-ink-soft">{es ? "Los niveles se ganan con sus números reales (trabajos, calificación, puntualidad) y se actualizan solos. Rechazar trabajos nunca cuenta en su contra." : "Tiers are earned from your real numbers (jobs, rating, on time) and update automatically. Passing on jobs never counts against you."}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PRO_TIERS.map((tier) => (
            <div key={tier.id} className={`card py-3 sm:py-4 ${tier.id === "elite" ? "border-brand bg-brand-tint" : ""}`}>
              <div className="text-lg font-bold">{tier.badge} {tier.name}</div>
              <div className="text-xs text-ink-soft">{tier.min.jobs ? (es ? `${tier.min.jobs}+ trabajos · ${tier.min.rating}★+ · ${Math.round(tier.min.onTime * 100)}% puntual` : `${tier.min.jobs}+ jobs · ${tier.min.rating}★+ · ${Math.round(tier.min.onTime * 100)}% on time`) : t("Once you’re activated")}</div>
              <ul className="mt-2 space-y-1 text-sm">{tier.perks.map((p) => <li key={p}>✓ {t(p)}</li>)}</ul>
            </div>
          ))}
        </div>
        <div id="rewards" className="mt-4 scroll-mt-32 rounded-3xl bg-brand-tint p-5 sm:p-6">
          <div className="font-bold">🎁 {es ? "Recompensas Handled Pro" : "Handled Pro Rewards"}</div>
          <p className="mt-1 text-sm text-ink-soft">{es ? `${REWARD_DEFAULTS.earnRate} puntos por cada $1 que Handled gana en su trabajo, ×${REWARD_DEFAULTS.qualityMultiplier} por trabajo excelente, y más cada año que se queda (${TENURE_TIERS.map((x) => `×${x.multiplier}`).join(" → ")}). Bonos por 10, 50 y 100 trabajos. Cámbielos por herramientas, electrónicos y viajes, como ${CATALOG_SEED.filter((c) => ["drill-kit", "tv-55", "trip-for-two"].includes(c.slug)).map((c) => c.name_es.toLowerCase()).join(", ")}.` : `${REWARD_DEFAULTS.earnRate} points for every $1 Handled earns on your job, ×${REWARD_DEFAULTS.qualityMultiplier} for great work, and more every year you stay (${TENURE_TIERS.map((x) => `×${x.multiplier}`).join(" → ")}). Bonuses at 10, 50 and 100 jobs. Redeem for tools, electronics and trips, like a ${CATALOG_SEED.filter((c) => ["drill-kit", "tv-55", "trip-for-two"].includes(c.slug)).map((c) => c.name.toLowerCase()).join(", ")}.`}</p>
          <p className="mt-2 text-xs text-ink-soft">{es ? "Los puntos nuevos se liberan a los 90 días. Rechazar ofertas nunca le cuesta puntos. Los puntos no tienen valor en efectivo; los premios cuentan como ingreso (aparecen en su 1099). Sujeto a los Términos de Recompensas." : "New points unlock after 90 days. Passing on offers never costs points. Points have no cash value; rewards count as income (shown on your 1099). Subject to the Rewards Terms."}</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="card"><div className="font-semibold">{es ? "¿Ya es maestro? Empiece en Pro+" : "Already a master? Start at Pro+"}</div><p className="mt-1 text-sm text-ink-soft">{es ? `Con ${FAST_TRACK.minYears}+ años, envíe fotos de su trabajo y haga un trabajo de prueba pagado. Si pasa, empieza en Pro+ el primer día.` : `${FAST_TRACK.minYears}+ years in the trade? Send photos of your work and do one paid trial job. Pass, and you start at Pro+ on day one.`}</p></div>
          <div className="card"><div className="font-semibold">{es ? "¿Tiene un equipo? Tráigalo" : "Have a crew? Bring them"}</div><p className="mt-1 text-sm text-ink-soft">{es ? "Registre a su gente y envíelos a trabajos de su empresa. Cada persona pasa la verificación de antecedentes." : "List your people and send them on your company’s jobs. Each person passes the background check; your company directs and pays them."}</p></div>
          <div className="card"><div className="font-semibold">{es ? `Recomiende y gane ${money(PRO_REFERRAL.bonus)}` : `Refer a pro, earn ${money(PRO_REFERRAL.bonus)}`}</div><p className="mt-1 text-sm text-ink-soft">{es ? `Cuando el profesional que recomendó completa su ${PRO_REFERRAL.afterJobs}.º trabajo.` : `When the pro you refer finishes their ${PRO_REFERRAL.afterJobs}th job.`}</p></div>
        </div>
      </section>

      <section id="requirements" className="grid scroll-mt-32 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">{t("Requirements by trade")}</h2>
          <p className="mt-2 text-ink-soft">{es ? `Todos necesitan verificación de antecedentes, un formulario W-9, un teléfono inteligente y un seguro de responsabilidad civil general que nombre a ${BRAND.name} como asegurado adicional. El seguro de accidentes laborales es obligatorio si tiene empleados; quienes trabajan solos firman una declaración de que no tienen empleados.` : `Everyone needs a background check, a W-9, a smartphone and general liability insurance naming ${BRAND.name} as additional insured. Workers’ comp is required if you have employees; solo owners sign a no-employees statement.`}</p>
        </div>
        <TradeRequirements trades={trades} es={es} pick={es ? "Elija su oficio" : "Pick your trade"} />
      </section>

      <section id="faq" className="scroll-mt-32">
        <h2 className="text-2xl font-bold">{es ? "Preguntas frecuentes" : "Questions pros ask"}</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card py-3"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm text-ink-soft">{a}</p></details>
          ))}
        </div>
      </section>

      <section id="apply" className="grid scroll-mt-32 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">{es ? "Postúlese" : "Apply"}</h2>
          <p className="mt-2 text-ink-soft">{t("We review every application within 2 business days. Don’t have every policy yet? Apply anyway; we’ll tell you exactly what you need and point you to brokers.")}</p>
          <ul className="mt-4 space-y-1 text-sm text-ink-soft">{STEPS.map(([h, b], i) => <li key={h}><b className="text-ink">{i + 1}. {h}</b> — {b}</li>)}</ul>
        </div>
        <ApplyForm locale={l} />
      </section>
    </div>
  );
}
