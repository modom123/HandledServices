/*
 * FILE    : apps/web/app/(site)/pros/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2109 UTC — The Handled Pro Program: promises, real payouts from the
 *           pricing engine, tiers, how we compare, the vetting process and requirements
 *           by trade (license, insurance, skills check).
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro onboarding & recruiting)
 * PURPOSE : Subcontractor recruiting page + application.
 */
import { ApplyForm } from "@/components/forms";
import { getPolicy } from "@/lib/pro-benefits";
import { getLocale } from "@/lib/locale";
import { BRAND, COVERAGES, PRO_PROMISES, benefitLines, ruleText, PRO_REFERRAL, PRO_TIERS, TRADES, TRADE_PROFILES, VETTING_STEPS, money, samplePayouts, serviceText, t as tr, type ProPolicy } from "@handled/core";

export const metadata = { title: "Become a Pro", description: "Prepaid, pre-priced jobs in your area. No lead fees, weekly pay, and we run the office." };

const SAMPLES = ["house-cleaning", "lawn-care", "junk-removal", "handyman", "gutter-cleaning", "carpet-cleaning", "dog-walking", "water-heater", "snow-removal", "tree-removal"];

const COMPARE: [string, string, string, string][] = [
  ["What it costs you", "Nothing to join. We keep a share of each finished job.", "You pay for leads, whether you win the job or not.", "A monthly software subscription."],
  ["Who finds the customer", "We do, and the job is already sold.", "You compete with other pros for each lead.", "You do: your own marketing."],
  ["Price", "Set upfront. You see your payout before you accept.", "You quote, chase and negotiate.", "You quote."],
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
  const pays = samplePayouts(SAMPLES);
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
          <div className="text-sm font-semibold">{t("What pros earn per job")}</div>
          <p className="text-xs text-ink-soft">{t("Typical job size, from our live pricing. Higher tiers earn up to the higher number.")}</p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {pays.map((p) => (
                <tr key={p.slug} className="border-t border-line"><td className="py-2">{p.icon} {serviceText(l, p.slug, { name: p.name, tagline: "" }).name}</td><td className="py-2 text-right font-semibold text-brand">{p.label}</td></tr>
              ))}
            </tbody>
          </table>
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

      <section>
        <h2 className="text-2xl font-bold">{t("Grow with us: Pro, Pro+ and Elite")}</h2>
        <p className="mt-2 text-ink-soft">{t("Tiers are earned from your real numbers (jobs, rating, on time, offers accepted) and update automatically.")}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PRO_TIERS.map((tier) => (
            <div key={tier.id} className={`card ${tier.id === "elite" ? "border-brand bg-brand-tint" : ""}`}>
              <div className="text-lg font-bold">{tier.badge} {tier.name}</div>
              <div className="text-xs text-ink-soft">{tier.min.jobs ? (es ? `${tier.min.jobs}+ trabajos · ${tier.min.rating}★+ · ${Math.round(tier.min.onTime * 100)}% puntual · ${Math.round(tier.min.acceptance * 100)}% aceptadas` : `${tier.min.jobs}+ jobs · ${tier.min.rating}★+ · ${Math.round(tier.min.onTime * 100)}% on time · ${Math.round(tier.min.acceptance * 100)}% accepted`) : t("Once you’re activated")}</div>
              <ul className="mt-3 space-y-1 text-sm">{tier.perks.map((p) => <li key={p}>✓ {t(p)}</li>)}</ul>
            </div>
          ))}
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
