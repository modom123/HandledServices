/*
 * FILE    : apps/web/app/pro/refer/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2300 UTC
 * PURPOSE : Pro portal → Refer & earn. "Make money while you wait": a new pro (or any pro) snaps photos of a job someone
 *           needs, fills out the referral ticket and earns the Partner Program share when it's done (25% one-time /
 *           10% repeat / 15% account, core partners.ts). One click makes them a partner; the full history stays on /partner.
 */
import Link from "next/link";
import { PARTNER_PROGRAM, PARTNER_TIERS, PRO_REFERRAL, SERVICES, TICKET_CONTACT, TICKET_JOB_TYPES, TICKET_RELATIONSHIPS, TICKET_TIMING, money, partnerTerms, tierPct, type PartnerTier } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/notify";
import { partnerFor, partnerLink, partnerStats, payoutsReady } from "@/lib/partners";
import { Badge, Stat } from "@/components/ui";
import { CopyButton, PartnerPayoutButton, ReferralTicket } from "@/components/PartnerUI";
import { StartEarning } from "@/components/ProWelcome";

export const dynamic = "force-dynamic";

export default async function Refer() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  const partner = await partnerFor(v);
  const example = 300;
  const steps = es
    ? [["📷", "Tome fotos", "¿Ve un patio descuidado, canaletas tapadas, un montón de basura o un vecino que se muda? Tome fotos del trabajo."], ["📝", "Llene un ticket", "El nombre y el contacto del cliente (con su permiso), dónde es y qué necesita. Toma 2 minutos."], ["💵", "Cobre", "Nosotros llamamos, cotizamos, reservamos y enviamos al profesional. Usted cobra cuando el trabajo se termina."]]
    : [["📷", "Snap photos", "See an overgrown yard, clogged gutters, a junk pile or a neighbor moving out? Take photos of the job."], ["📝", "Fill out a ticket", "The customer's name and contact (with their OK), where it is and what they need. Takes 2 minutes."], ["💵", "Get paid", "We call, price, book and send the pro. You get paid when the job is done."]];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">💸 {es ? "Gane dinero mientras espera" : "Make money while you wait"}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">{es
          ? "No necesita estar aprobado para empezar. Envíenos clientes y gane una parte de cada trabajo que hagan con nosotros, hasta por 12 meses."
          : "You don't need to be approved to start. Send us customers and earn a share of every job they book with us, for up to 12 months."}</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">{steps.map(([icon, h, b], i) => (
        <li key={h} className="card"><div className="text-2xl">{icon}</div><div className="mt-1 font-semibold">{i + 1}. {h}</div><p className="mt-1 text-sm text-ink-soft">{b}</p></li>
      ))}</ol>

      <div className="grid gap-3 sm:grid-cols-3">{(Object.keys(PARTNER_TIERS) as PartnerTier[]).map((t) => (
        <div key={t} className="card border-t-4 border-t-gold"><div className="text-3xl font-extrabold">{tierPct(t)}</div><div className="font-semibold">{PARTNER_TIERS[t].label}</div><p className="text-xs text-ink-soft">{PARTNER_TIERS[t].detail}</p></div>
      ))}</div>
      <p className="text-sm">{es
        ? <>Ejemplo: un cliente que refiere reserva una limpieza de {money(example)}. Usted gana <b>{money(example * PARTNER_TIERS.one_time.rate)}</b>. Si luego reserva cada mes, gana {money(example * PARTNER_TIERS.repeat.rate)} por visita durante un año. Pagado cada lunes después de la garantía de {PARTNER_PROGRAM.holdDays} días.</>
        : <>Example: a customer you refer books a {money(example)} clean. You earn <b>{money(example * PARTNER_TIERS.one_time.rate)}</b>. If they then book monthly, you earn {money(example * PARTNER_TIERS.repeat.rate)} a visit for a year. Paid Mondays once each job is past our {PARTNER_PROGRAM.holdDays}-day guarantee.</>}</p>

      {!partner ? (
        <section className="card space-y-3">
          <h2 className="font-bold">{es ? "Empiece en un clic" : "Start in one click"}</h2>
          <p className="text-sm text-ink-soft">{es ? "Usamos los datos de su cuenta de profesional. Recibirá su código y su enlace para compartir." : "We use your pro account details. You'll get your own code and a link to share."}</p>
          <details className="text-sm"><summary className="cursor-pointer font-semibold">{es ? "Términos del programa de referidos (en inglés)" : "Referral partner terms"}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{partnerTerms().map((x) => <li key={x}>{x}</li>)}</ul></details>
          <StartEarning es={es} />
        </section>
      ) : await (async () => {
        const [stats, ready] = await Promise.all([partnerStats(partner.id), payoutsReady(partner)]);
        const link = partnerLink(partner.code);
        const services = SERVICES.map((s) => [s.slug, s.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label={es ? "Clientes referidos" : "Customers referred"} value={stats.customers} />
              <Stat label={es ? "Pagado" : "Paid to you"} value={money(stats.paid)} />
              <Stat label={es ? "Listo para el lunes" : "Ready Monday"} value={money(stats.ready)} />
              <Stat label={es ? "Próximo" : "Upcoming"} value={money(stats.upcoming)} hint={es ? `en la garantía de ${PARTNER_PROGRAM.holdDays} días` : `in the ${PARTNER_PROGRAM.holdDays}-day guarantee`} />
            </div>
            <section className="grid gap-4 md:grid-cols-2">
              <div className="card">
                <h2 className="font-bold">{es ? "Su enlace" : "Your link"}</h2>
                <p className="mt-1 text-sm text-ink-soft">{es ? `Quien reserve dentro de ${PARTNER_PROGRAM.cookieDays} días de abrirlo es su cliente.` : `Anyone new who books within ${PARTNER_PROGRAM.cookieDays} days of opening it is your customer.`}</p>
                <p className="mt-3 select-all break-all rounded-lg bg-paper p-2 font-mono text-sm">{link}</p>
                <CopyButton text={link} />
                <p className="mt-2 text-sm">{es ? "Enlace corto" : "Short link"}: <span className="select-all font-mono">{siteUrl()}/r/{partner.code}</span> · {es ? "código" : "code"} <b className="font-mono">{partner.code}</b></p>
              </div>
              <div className="card">
                <h2 className="font-bold">{es ? "Cobros de referidos" : "Referral payouts"}</h2>
                <p className="mt-1 text-sm text-ink-soft">{es ? "Configúrelo una vez con Stripe (cuenta bancaria o tarjeta de débito)." : "Set it up once through Stripe (bank account or debit card)."}</p>
                <div className="mt-3 flex items-center gap-3">{ready ? <Badge tone="green">{es ? "Listo" : "Ready"}</Badge> : <Badge tone="amber">{es ? "Sin configurar" : "Not set up"}</Badge>}<PartnerPayoutButton ready={ready} /></div>
                <Link href="/partner" className="mt-3 inline-block text-sm text-brand underline">{es ? "Todos sus tickets y comisiones →" : "All your tickets and commissions →"}</Link>
              </div>
            </section>
            <section className="card">
              <h2 className="font-bold">{es ? "Nuevo ticket de referido" : "New referral ticket"}</h2>
              <p className="mb-4 mt-1 text-sm text-ink-soft">{es ? "Fotos primero, luego los datos del cliente. Solo envíe a alguien que aceptó que lo contactemos." : "Photos first, then the customer's details. Only send someone who agreed to be contacted by us."}</p>
              <ReferralTicket photosFirst services={services} jobTypes={Object.entries(TICKET_JOB_TYPES).map(([k, x]) => [k, x.label, x.earns])} timings={Object.entries(TICKET_TIMING)} contacts={Object.entries(TICKET_CONTACT)} relationships={Object.entries(TICKET_RELATIONSHIPS)} />
            </section>
          </>
        );
      })()}

      <div className="card text-sm">
        <b>👷 {es ? "¿Conoce a otro buen profesional?" : "Know another great pro?"}</b> {es
          ? `Gane ${money(PRO_REFERRAL.bonus)} cuando un profesional que refiera termine ${PRO_REFERRAL.afterJobs} trabajos. Su enlace:`
          : `Earn ${money(PRO_REFERRAL.bonus)} when a pro you refer finishes ${PRO_REFERRAL.afterJobs} jobs. Your link:`} <span className="select-all break-all font-mono">{`${siteUrl()}/pros?ref=${v.contractorId}`}</span>
      </div>
    </div>
  );
}
