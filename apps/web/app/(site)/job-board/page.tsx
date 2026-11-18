/*
 * FILE    : apps/web/app/(site)/job-board/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-12_2000 UTC
 * PURPOSE : /job-board — the public job board. Open jobs that every qualified pro can take right now (lib/board
 *           publicBoard): service, city and ZIP, what the pro earns, when, and the scope — never the address, the
 *           customer, their notes or photos. Top pay first. Three jobs at once:
 *             • recruit pros — "Take this job" signs a pro in (/pro); new pros apply (/pros, tagged job_board + the ref)
 *             • let homeowners post a job at their own price ($1 to post) — /book
 *             • let companies post — /book?for=business (accounts on invoice terms post free)
 *           Filter by category (?cat=). English / Spanish.
 * UPDATED : 2026-11-13_0730 UTC — public only, for everyone: the internal money line was removed (it lives in Hub → Jobs → Job board).
 * UPDATED : 2026-11-13_0745 UTC — public cards show only the type of job and the general area (city, state) and when it was
 *           posted; pay, scope, timing and posting terms are for signed-in pros ("Jobs near you") and the Hub.
 */
import Link from "next/link";
import { BRAND, CATEGORIES, OFFER_BOUNDS, BOARD_POST_FEE, categoryText, money } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { publicBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job board — open jobs for pros",
  description: `Prepaid home and business service jobs near you, open to background-checked pros on ${BRAND.name}. See the pay, take the job — or post your own job and name your price.`,
  alternates: { canonical: "/job-board" },
};

export default async function JobBoardPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const l = await getLocale();
  const es = l === "es";
  const L = (en: string, sp: string) => (es ? sp : en);
  const { cat } = await searchParams;
  // the same public cards for everyone (signed in or not): no customer price, no Handled take — that lives in Hub → Jobs → Job board
  const all = await publicBoard(es ? "es" : "en");
  const jobs = cat ? all.filter((j) => j.category === cat) : all;
  const cats = CATEGORIES.filter((c) => all.some((j) => j.category === c.id));
  const cities = new Set(all.map((j) => `${j.city}, ${j.state}`)).size;
  const ago = (iso: string) => {
    const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
    return d === 0 ? L("Posted today", "Publicado hoy") : d === 1 ? L("Posted yesterday", "Publicado ayer") : L(`Posted ${d} days ago`, `Publicado hace ${d} días`);
  };
  const chip = (href: string, label: string, on: boolean) => <Link key={href} href={href} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand bg-brand-tint font-semibold" : "border-line bg-white"}`}>{label}</Link>;
  return (
    <div className="wrap space-y-8 py-12">
      <header className="max-w-3xl">
        <span className="inline-flex rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark">{L("Job board", "Tablero de trabajos")}</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{L("Open jobs near you.", "Trabajos abiertos cerca de usted.")} <span className="text-brand">{L("Pay shown upfront.", "Pago a la vista.")}</span></h1>
        <p className="mt-4 text-lg text-ink-soft">{L(
          `Real jobs from homeowners and companies, waiting for a pro. Background-checked pros on ${BRAND.name} take them — no lead fees, no bidding, paid weekly. Sign in as a pro to see the pay, the details and to take a job.`,
          `Trabajos reales de hogares y empresas esperando a un profesional. Los profesionales verificados de ${BRAND.name} los toman: sin cobro por clientes, sin pujas, pago semanal. Inicie sesión como profesional para ver el pago, los detalles y tomar un trabajo.`)}</p>
      </header>

      {all.length > 0 && <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card p-3 sm:p-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft sm:text-xs">{L("Open jobs", "Trabajos abiertos")}</div><div className="mt-1 text-xl font-extrabold sm:text-3xl">{all.length}</div></div>
        <div className="card p-3 sm:p-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft sm:text-xs">{L("Kinds of work", "Tipos de trabajo")}</div><div className="mt-1 text-xl font-extrabold sm:text-3xl">{new Set(all.map((j) => j.slug)).size}</div></div>
        <div className="card p-3 sm:p-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft sm:text-xs">{L("Cities", "Ciudades")}</div><div className="mt-1 text-xl font-extrabold sm:text-3xl">{cities}</div></div>
      </div>}

      {cats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {chip("/job-board", L("All", "Todos"), !cat)}
          {cats.map((c) => chip(`/job-board?cat=${c.id}`, `${c.icon} ${categoryText(l, c.id, c).short}`, cat === c.id))}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          {!jobs.length && (
            <div className="card text-center">
              <div className="font-semibold">{L("No open jobs here right now.", "No hay trabajos abiertos aquí en este momento.")}</div>
              <p className="mt-1 text-sm text-ink-soft">{L("New jobs are posted every day, and pros get them by text before they reach this board.", "Se publican trabajos nuevos cada día, y los profesionales los reciben por mensaje antes de que lleguen a este tablero.")}</p>
              <Link href="/pros?utm_source=job_board" className="btn-primary mt-4 inline-block">{L("Join as a pro", "Únase como profesional")} →</Link>
            </div>
          )}
          {jobs.map((j) => (
            <article key={j.ref} className="card">
              {/* public: the type of job and the general area only — pay, scope, timing and the customer are for signed-in pros and the Hub */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{j.icon} {j.service}</h2>
                    {j.business && <span className="rounded bg-paper px-2 py-0.5 text-xs">{L("Business", "Empresa")}</span>}
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">📍 {j.city}, {j.state} · {ago(j.postedAt)}</div>
                  <div className="mt-1 text-xs text-ink-soft">{L("Pros: sign in to see the pay, the details and the timing.", "Profesionales: inicien sesión para ver el pago, los detalles y el horario.")}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-sm">
                <Link href={`/pros?utm_source=job_board&utm_campaign=${encodeURIComponent(j.ref)}`} className="text-brand underline">{L("New to Handled? Apply to take jobs like this", "¿Nuevo en Handled? Aplique para tomar trabajos así")}</Link>
                <Link href="/pro" className="btn-primary px-5">{L("Pros: sign in to see it", "Profesionales: inicie sesión para verlo")} →</Link>
              </div>
            </article>
          ))}
          <p className="text-xs text-ink-soft">{L("Signed-in pros see the pay, scope and timing of the jobs that fit their trades, licenses, insurance and area. The street address and the customer go only to the pro who takes the job.", "Los profesionales que inician sesión ven el pago, el alcance y el horario de los trabajos que encajan con sus oficios, licencias, seguro y zona. La dirección y el cliente solo los ve el profesional que toma el trabajo.")}</p>
        </section>

        <aside className="space-y-4">
          <div className="card">
            <div className="font-bold">{L("For pros", "Para profesionales")}</div>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              <li>✓ {L("Jobs are paid for (or charged the moment you take them)", "Los trabajos están pagados (o se cobran en cuanto usted los toma)")}</li>
              <li>✓ {L("No lead fees, no bidding against five others", "Sin cobro por clientes ni pujas contra otros cinco")}</li>
              <li>✓ {L("Pick the jobs you want; paid weekly", "Elija los trabajos que quiera; pago semanal")}</li>
              <li>✓ {L("Top-pay jobs go out first", "Los trabajos con pago alto salen primero")}</li>
            </ul>
            <Link href="/pros?utm_source=job_board" className="btn-primary mt-4 block text-center">{L("Become a pro", "Hágase profesional")} →</Link>
            <Link href="/pro" className="mt-2 block text-center text-sm text-brand underline">{L("Already a pro? Sign in", "¿Ya es profesional? Inicie sesión")}</Link>
          </div>
          <div className="card">
            <div className="font-bold">{L("Need a job done?", "¿Necesita un trabajo?")}</div>
            <p className="mt-1 text-sm text-ink-soft">{L(
              `Post it here at your own price — ${money(BOARD_POST_FEE)} to post, up for ${OFFER_BOUNDS.boardDays} days. Your price is charged only when a pro takes it.`,
              `Publíquelo aquí a su propio precio: ${money(BOARD_POST_FEE)} para publicar, por ${OFFER_BOUNDS.boardDays} días. Su precio se cobra solo cuando un profesional lo tome.`)}</p>
            <Link href="/book?utm_source=job_board" className="btn-primary mt-3 block text-center">{L("Post a home job", "Publicar un trabajo del hogar")}</Link>
            <Link href="/book?for=business&utm_source=job_board" className="btn-ghost mt-2 block text-center">{L("Post for your company", "Publicar para su empresa")}</Link>
            <Link href="/post" className="mt-2 block text-center text-sm text-brand underline">{L("Not sure of the price? Describe it and we'll call", "¿No sabe el precio? Descríbalo y le llamamos")}</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
