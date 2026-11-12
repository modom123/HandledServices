/*
 * FILE    : packages/core/src/pro-welcome.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_0800 UTC
 * PURPOSE : The "Welcome to the Handled Network" email a pro gets the moment staff activate them (lib/recruiting.ts
 *           activatePro). Pure function, English / Spanish:
 *             • what they told us: trades, specialties, area, days and hours, daily limit
 *             • the services they're cleared to take now, and the ones they have the trade for but aren't cleared yet
 *               (with the reason, same rules as the depth chart: clearedFor)
 *             • how the pro portal works, step by step (offers → the job → photos → payout)
 *             • how and when they're paid, with the live Pro Program settings (instant pay, show-up pay, insurance credit)
 *             • tiers, rewards, refer-a-pro and the Partner Program
 *             • good-to-know rules and where to get help, plus the PDF guide link
 *           Every number comes from the shared rules (PRO_TIERS, PRO_REFERRAL, REWARD_DEFAULTS, REFERRAL_LADDER,
 *           PARTNER_LADDER, PROBATION, the pro policy), so the email never drifts from what the portal does.
 * UPDATED : 2026-11-10_1340 UTC — Spanish emails use the Spanish trade and service names.
 * UPDATED : 2026-11-10_2000 UTC — points to the opt-in "Feature me on the website" (New pros in the Handled Network).
 * UPDATED : 2026-11-12_2300 UTC — honest about where we are: a new company growing market by market, so offers may be
 *           light at first (no "jobs from today" promise); why the home ZIP, driving distance and ZIP list decide which
 *           jobs and texts they get (a warning when the home ZIP is missing); how to get more work while we grow.
 */
import { BRAND } from "./brand.ts";
import { serviceText, t as tr } from "./i18n.ts";
import { clearedFor } from "./depth-chart.ts";
import { PARTNER_LADDER, PARTNER_PROGRAM, REFERRAL_LADDER } from "./partners.ts";
import { PRO_REFERRAL, PRO_TIERS } from "./pro-program.ts";
import type { ProPolicy } from "./pro-policy.ts";
import { REWARD_DEFAULTS } from "./rewards.ts";
import { SERVICES, TRADES } from "./services.ts";
import { TIME_WINDOW_LABEL, type Contractor } from "./types.ts";
import { PROBATION } from "./vetting.ts";

type Lang = "en" | "es";
const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
const usd = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toLocaleString("en-US")}`;
const DAYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] };
const WINDOW_ES: Record<string, string> = { morning: "Mañana (8–11am)", midday: "Mediodía (11am–2pm)", afternoon: "Tarde (2–5pm)", flexible: "Cualquier hora del día" };
const REASON_ES: Record<string, string> = {
  "license needed": "falta la licencia", "license expired": "licencia vencida", "insurance missing or expired": "falta el seguro o está vencido",
  "background check pending": "verificación de antecedentes pendiente",
};
const reasonText = (r: string, l: Lang) => (l === "es" ? REASON_ES[r] ?? r.replace(/ coverage missing$/, ": falta la cobertura") : r);
const tradeName = (id: string, l: Lang = "en") => tr(l, TRADES.find((t) => t.id === id)?.label ?? id);

/** The services a pro can take now and the ones they have the trade for but aren't cleared yet (and why). */
export function proServiceSummary(c: Contractor, today = new Date(), lang: Lang = "en") {
  const cleared: { slug: string; name: string }[] = [];
  const notYet: { slug: string; name: string; reason: string }[] = [];
  for (const s of SERVICES) {
    const why = clearedFor(c, s, today);
    if (why === "trade mismatch") continue;
    const name = serviceText(lang, s.slug, s).name;
    if (why === null) cleared.push({ slug: s.slug, name });
    else notYet.push({ slug: s.slug, name, reason: why });
  }
  return { cleared, notYet };
}

export function proWelcomeEmail(c: Contractor, o: { site: string; policy: ProPolicy; lang?: Lang; guideUrl?: string; today?: Date }): { subject: string; text: string } {
  const l: Lang = o.lang === "es" ? "es" : "en";
  const es = l === "es";
  const site = o.site.replace(/\/$/, "");
  const guide = o.guideUrl ?? `${site}/docs/handled-pro-network-welcome.pdf`;
  const first = String(c.contact_name ?? c.business_name ?? "").split(" ")[0] || (es ? "profesional" : "there");
  const { cleared, notYet } = proServiceSummary(c, o.today, l);
  const P = o.policy;
  const tierPlus = PRO_TIERS.find((t) => t.id === "pro_plus")!;
  const tierElite = PRO_TIERS.find((t) => t.id === "elite")!;
  const R = REWARD_DEFAULTS;

  // ── what they told us ──
  const area = [c.base_city, [c.base_state, c.base_zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const radius = c.service_radius_mi ?? 25;
  const days = c.availability?.days?.length ? c.availability.days.slice().sort().map((d) => DAYS[l][d] ?? String(d)).join(", ") : null;
  const windows = c.availability?.windows?.length ? c.availability.windows.map((w) => (es ? WINDOW_ES[w] : TIME_WINDOW_LABEL[w as keyof typeof TIME_WINDOW_LABEL]) ?? w).join(", ") : null;
  const trades = (c.trades ?? []).map((t) => tradeName(t, l)).join(", ");
  const specialties = (c.specialties ?? []).filter(Boolean).join(", ");
  const listCap = 25;
  const list = (xs: { name: string }[]) => xs.slice(0, listCap).map((x) => `  • ${x.name}`).join("\n") + (xs.length > listCap ? `\n  • ${es ? `y ${xs.length - listCap} más` : `and ${xs.length - listCap} more`}` : "");
  const notYetList = notYet.slice(0, 12).map((x) => `  • ${x.name} (${reasonText(x.reason, l)})`).join("\n") + (notYet.length > 12 ? `\n  • ${es ? `y ${notYet.length - 12} más` : `and ${notYet.length - 12} more`}` : "");

  const yourInfo = es ? [
    "1. LO QUE NOS DIJO (SU PERFIL)",
    `Oficios: ${trades || "—"}`,
    specialties ? `Especialidades: ${specialties}` : null,
    `Zona: ${area || "—"}, hasta ${radius} millas${c.service_zips?.length ? ` (${c.service_zips.length} códigos postales)` : ""}`,
    days ? `Días: ${days}${windows ? ` · Horarios: ${windows}` : ""}` : null,
    c.daily_capacity ? `Máximo por día: ${c.daily_capacity} trabajo${c.daily_capacity === 1 ? "" : "s"} (nunca le ofrecemos más)` : null,
    "",
    cleared.length ? `Servicios que ya puede tomar (${cleared.length}):\n${list(cleared)}` : "Todavía no hay servicios aprobados para usted. Revise los puntos de abajo.",
    notYet.length ? `\nTiene el oficio, pero aún no está aprobado para (${notYet.length}):\n${notYetList}\nResuélvalo en Portal → Configuración y documentos, y esos trabajos se abren solos.` : null,
    `\n¿Algo no está bien? Cámbielo en Portal → Mi información: ${site}/pro/info`,
    `¿Quiere más clientes? En Mi información active "Aparecer en el sitio web": su foto, su nombre, su ciudad y hasta 5 servicios en "Nuevos profesionales" (nunca su dirección ni su teléfono).`,
  ] : [
    "1. WHAT YOU TOLD US (YOUR PROFILE)",
    `Trades: ${trades || "—"}`,
    specialties ? `Specialties: ${specialties}` : null,
    `Area: ${area || "—"}, up to ${radius} miles${c.service_zips?.length ? ` (${c.service_zips.length} ZIP codes)` : ""}`,
    days ? `Days: ${days}${windows ? ` · Hours: ${windows}` : ""}` : null,
    c.daily_capacity ? `Daily limit: ${c.daily_capacity} job${c.daily_capacity === 1 ? "" : "s"} (we never offer you more)` : null,
    "",
    cleared.length ? `Services you can take now (${cleared.length}):\n${list(cleared)}` : "No services are cleared for you yet. See the items below.",
    notYet.length ? `\nYou have the trade but aren't cleared yet for (${notYet.length}):\n${notYetList}\nFix it in Pro portal → Setup & documents and those jobs open up on their own.` : null,
    `\nSomething wrong? Change it in Pro portal → My info: ${site}/pro/info`,
    `Want more customers? Turn on "Feature me on the website" in My info: your photo, name, city and up to 5 services in "New pros in the Handled Network" (never your address or phone).`,
  ];

  // ── your area: it decides which jobs (and texts) reach them ──
  const noArea = !c.base_zip && !c.service_zips?.length;
  const areaWhy = es ? [
    "2. SU ZONA DECIDE QUÉ TRABAJOS LE LLEGAN",
    noArea ? "  ⚠ Todavía no tenemos su código postal base. Sin él no podemos enviarle ofertas ni mensajes de trabajos cerca de usted: agréguelo hoy." : null,
    "Le ofrecemos un trabajo solo si está dentro de su zona, y solo le mandamos mensajes de texto por trabajos en su zona. Revise tres cosas en Portal → Configuración y documentos:",
    "  • Código postal (su base): de ahí medimos la distancia a cada trabajo. Use el lugar desde donde sale a trabajar.",
    "  • Hasta dónde maneja (millas): una distancia realista. Más millas, más ofertas; pero solo acepte lo que de verdad va a atender.",
    "  • Códigos postales que quiere cubrir (opcional): estos reciben ofertas aunque estén más lejos. Marque “Solo enviarme trabajos en estos códigos postales” si no quiere salir de ellos.",
    `  Cámbielo cuando quiera: ${site}/pro/onboarding`,
  ] : [
    "2. YOUR AREA DECIDES WHICH JOBS REACH YOU",
    noArea ? "  ⚠ We don't have your home ZIP code yet. Without it we can't send you offers or texts about jobs near you — please add it today." : null,
    "We only offer you a job when it's inside your area, and we only text you about jobs in your area. Check three things in Pro portal → Setup & documents:",
    "  • ZIP (your home base): we measure the distance to every job from here. Use the place you head out to work from.",
    "  • How far you'll drive (miles): pick a realistic distance. More miles means more offers, but only take what you'll really show up for.",
    "  • ZIP codes you want to cover (optional): listed ZIPs get offers even past your driving distance. Tick \"Only send me jobs in these ZIP codes\" to stay inside them.",
    `  Change it any time: ${site}/pro/onboarding`,
  ];

  // ── getting more work while we grow ──
  const more = es ? [
    "7. MÁS TRABAJO MIENTRAS CRECEMOS",
    "  • Tenga su zona, sus días y sus horarios completos y al día: es lo que más ofertas le trae.",
    "  • Revise “Trabajos cerca de usted” en su portal: trabajos sin tomar que le encajan, incluidos los que publican los clientes a su propio precio.",
    "  • Deje los avisos de trabajos en “Todos” para enterarse primero de los trabajos de pago alto en su zona.",
    "  • Conteste rápido: el primero que acepta se lo lleva, y aceptar a tiempo sube su posición.",
    "  • Envíenos clientes (sección 6): gana por cada trabajo y además le trae trabajo a su zona.",
    "  • Active “Aparecer en el sitio web” en Mi información para que los clientes lo vean.",
  ] : [
    "7. MORE WORK WHILE WE GROW",
    "  • Keep your area, days and hours complete and current: it's what brings you the most offers.",
    "  • Check \"Jobs near you\" in your portal: untaken jobs that fit you, including jobs customers post at their own price.",
    "  • Keep job alerts on \"All\" to hear first about top-pay jobs in your area.",
    "  • Answer fast: the first pro to accept gets the job, and accepting on time moves you up the line.",
    "  • Send us customers (section 6): you earn on every job, and it brings work to your area.",
    "  • Turn on \"Feature me on the website\" in My info so customers can find you.",
  ];

  // ── how the portal works ──
  const portal = es ? [
    "3. CÓMO FUNCIONA SU PORTAL DE PROFESIONAL",
    `Entre en ${site}/pro (o en la app de ${BRAND.name}). Todo está en tres menús:`,
    "Trabajo",
    "  • Trabajos: aquí llegan las ofertas. Cada una muestra el servicio, el alcance, la fecha, la zona y su pago exacto ANTES de aceptar. Toque Aceptar o Pasar; pasar nunca le cuesta nada.",
    "  • Calendario: sus trabajos de las próximas semanas, los espacios libres y sus días libres (tome un día libre con un toque). Sincronícelo con Google, Apple u Outlook.",
    "  • Listas: lo que incluye cada tipo de trabajo, para que sepa qué significa \"terminado\" antes de aceptar.",
    "  • Mi equipo: si trabaja con ayudantes, agréguelos aquí (cada uno pasa su propia verificación).",
    "Dinero",
    "  • Mis precios: fije su propio precio por servicio. Los clientes lo ven junto a su calificación.",
    "  • Ganancias: cada pago, el pago instantáneo y su total para el 1099.",
    "  • Recompensas: sus puntos y el catálogo para canjearlos.",
    "  • Referir y ganar: su enlace y sus comisiones del Programa de Socios.",
    "Cuenta",
    "  • Bienvenida a Handled: la orientación corta (hágala primero).",
    "  • Mi información, Configuración y documentos, Mis contratos.",
    "",
    "El día del trabajo:",
    "  1. Toque Iniciar al llegar (el cliente ve que va en camino y que llegó).",
    "  2. Tome las fotos de antes que pide el trabajo.",
    "  3. Haga el trabajo siguiendo la lista. Si el alcance cambia, actualícelo en la app: el cliente aprueba y paga el extra ANTES de que lo haga.",
    "  4. Tome las fotos de después y toque Terminar.",
    "  5. Revisamos las fotos y su pago se aprueba.",
  ] : [
    "3. HOW YOUR PRO PORTAL WORKS",
    `Sign in at ${site}/pro (or the ${BRAND.name} app). Everything is in three menus:`,
    "Work",
    "  • Jobs: your offers land here. Each shows the service, scope, date, area and your exact pay BEFORE you accept. Tap Accept or Pass. Passing never costs you anything.",
    "  • Calendar: your jobs for the coming weeks, open slots and days off (take a day off in one tap). Sync it to Google, Apple or Outlook.",
    "  • Checklists: what each kind of job includes, so you know what \"done\" means before you take it.",
    "  • My crew: if you work with helpers, add them here (each gets their own background check).",
    "Money",
    "  • My prices: set your own price for each service. Customers see it next to your rating.",
    "  • Earnings: every payout, instant pay, and your running 1099 total.",
    "  • Rewards: your points and the catalog to redeem them.",
    "  • Refer & earn: your link and your Partner Program commissions.",
    "Account",
    "  • Welcome to Handled: the short orientation (do this first).",
    "  • My info, Setup & documents, My contracts.",
    "",
    "On the day of a job:",
    "  1. Tap Start when you head out (the customer sees you're on the way and when you arrive).",
    "  2. Take the before photos the job asks for.",
    "  3. Do the work from the checklist. If the scope changes, update it in the app: the customer approves and pays for the extra BEFORE you do it.",
    "  4. Take the after photos and tap Complete.",
    "  5. We review the photos and your pay is approved.",
  ];

  // ── pay ──
  const instant = P.instantPay;
  const pay = es ? [
    "4. CÓMO Y CUÁNDO LE PAGAMOS",
    "  • El cliente paga antes de que usted vaya. Nunca cobra, nunca factura, nunca espera un cheque.",
    "  • El pago que ve en la oferta es el que recibe. Sin cuotas por clientes ni suscripción.",
    "  • Los pagos se envían automáticamente cada lunes a su banco por Stripe, con un detalle de cada trabajo.",
    instant.enabled ? `  • Pago instantáneo: después de ${instant.minJobs ?? 0} trabajos, retire el mismo día por ${pct(instant.feePct)} (mínimo ${usd(instant.minFee)}). El pago semanal siempre es gratis.` : null,
    P.showUpPay.enabled ? `  • Pago por presentarse: si el cliente cancela tarde o no puede entrar, recibe hasta ${usd(P.showUpPay.amount)}.` : null,
    "  • Protección del pago: un reembolso que no fue causado por su trabajo sale primero de nuestra parte.",
    "  • Los materiales que no están en el precio se le reembolsan al costo con el recibo.",
    `  • Sus primeros ${PROBATION.jobs} trabajos son de menos de ${usd(PROBATION.maxJobPrice)} y cada uno tiene revisión de fotos.`,
  ] : [
    "4. HOW AND WHEN YOU'RE PAID",
    "  • The customer pays before you go. You never collect, invoice or wait on a check.",
    "  • The pay you see on the offer is the pay you get. No lead fees, no subscription.",
    "  • Payouts go out automatically every Monday to your bank through Stripe, with a statement for every job.",
    instant.enabled ? `  • Instant pay: after ${instant.minJobs ?? 0} jobs, cash out the same day for ${pct(instant.feePct)} (minimum ${usd(instant.minFee)}). The weekly payout is always free.` : null,
    P.showUpPay.enabled ? `  • Show-up pay: if a customer cancels late or locks you out, you get up to ${usd(P.showUpPay.amount)}.` : null,
    "  • Pay protection: a refund that wasn't caused by your work comes out of our share first.",
    "  • Materials that aren't in the price are reimbursed at cost with a receipt.",
    `  • Your first ${PROBATION.jobs} jobs are under ${usd(PROBATION.maxJobPrice)}, and each gets a photo review.`,
  ];

  // ── grow ──
  const ins = P.insurance;
  const grow = es ? [
    "5. CÓMO CRECER CON NOSOTROS",
    `  • Niveles: Pro+ a los ${tierPlus.min.jobs} trabajos, ${tierPlus.min.rating}★ y ${pct(tierPlus.min.onTime)} puntual: +${pct(tierPlus.payoutBoost)} del precio en cada pago y primero en la fila para las ofertas. Elite a los ${tierElite.min.jobs} trabajos, ${tierElite.min.rating}★ y ${pct(tierElite.min.onTime)} puntual: +${pct(tierElite.payoutBoost)} y lo primero de todo, incluidos trabajos grandes y comerciales.`,
    "  • Clientes recurrentes: cuando un cliente que atendió se inscribe en un plan, cada visita se le ofrece primero a usted, un día antes que a nadie.",
    R.enabled ? `  • Recompensas Handled Pro: ${R.earnRate} puntos por cada $1 que Handled gana en sus trabajos, ×${R.qualityMultiplier} por trabajos perfectos (${R.minRatingForQuality}★+, sin repetir) y más cada año con nosotros. Canjéelos por equipo, herramientas, electrónica y viajes. Pasar una oferta nunca le quita puntos.` : null,
    ins.enabled && ins.stipend ? `  • Crédito para seguro: ${usd(ins.stipend)} después de su trabajo número ${ins.afterJobs}.` : null,
  ] : [
    "5. HOW YOU GROW WITH US",
    `  • Tiers: Pro+ at ${tierPlus.min.jobs} jobs, ${tierPlus.min.rating}★ and ${pct(tierPlus.min.onTime)} on time: +${pct(tierPlus.payoutBoost)} of the job price on every payout and ahead of the line for offers. Elite at ${tierElite.min.jobs} jobs, ${tierElite.min.rating}★ and ${pct(tierElite.min.onTime)} on time: +${pct(tierElite.payoutBoost)} and first in line for everything, including large and commercial jobs.`,
    "  • Recurring customers: when a customer you served signs up for a plan, every visit is offered to you first, a full day before anyone else.",
    R.enabled ? `  • Handled Pro Rewards: ${R.earnRate} points for every $1 Handled earns on your jobs, ×${R.qualityMultiplier} for perfect jobs (${R.minRatingForQuality}★+, no redo) and more every year you stay. Redeem them for gear, tools, electronics and trips. Passing on an offer never costs you points.` : null,
    ins.enabled && ins.stipend ? `  • Insurance credit: ${usd(ins.stipend)} after your ${ins.afterJobs}th job.` : null,
  ];

  // ── earn more ──
  const refRange = `${pct(REFERRAL_LADDER.baseRate)}–${pct(REFERRAL_LADDER.topRate)}`;
  const saleRange = `${pct(PARTNER_LADDER.baseRate)}–${pct(PARTNER_LADDER.topRate)}`;
  const earn = es ? [
    "6. GANE MÁS: REFERIDOS Y PROGRAMA DE SOCIOS",
    `  • Recomiende a un profesional: ${usd(PRO_REFERRAL.bonus)} cuando un profesional que usted refirió complete ${PRO_REFERRAL.afterJobs} trabajos.`,
    `  • Refiera clientes: gane del ${refRange} del precio de cada trabajo de ese cliente durante ${PARTNER_PROGRAM.months} meses. ¿Ve un trabajo que no es de su oficio? Tome fotos y envíenos un ticket de referido.`,
    `  • Ventas directas: venda un trabajo con un ticket de venta y el cliente paga en el momento: del ${saleRange} de nuestra ganancia.`,
    "  • Su tasa sube un punto a la vez mientras crece y nunca baja. Las comisiones llegan con su pago semanal.",
    `  Empiece en Portal → Referir y ganar: ${site}/pro/refer`,
  ] : [
    "6. EARN MORE: REFERRALS AND THE PARTNER PROGRAM",
    `  • Refer a pro: ${usd(PRO_REFERRAL.bonus)} when a pro you referred finishes ${PRO_REFERRAL.afterJobs} jobs.`,
    `  • Refer customers: earn ${refRange} of the price of every job from that customer for ${PARTNER_PROGRAM.months} months. See a job that isn't your trade? Snap photos and send us a referral ticket.`,
    `  • Direct sales: sell a job on a sales ticket and the customer pays on the spot: ${saleRange} of our profit.`,
    "  • Your rate climbs one point at a time as you grow, and never goes down. Commissions arrive with your weekly payout.",
    `  Start in Pro portal → Refer & earn: ${site}/pro/refer`,
  ];

  // ── good to know + help ──
  const know = es ? [
    "8. BUENO SABERLO",
    "  • Usted es un profesional independiente (1099): elige sus trabajos, su zona y sus horarios, y conserva sus propios clientes.",
    "  • Calificaciones y fotos: cada trabajo se revisa por fotos. Si algo falta, el cliente recibe una corrección gratis; hágala bien a la primera y gana más.",
    "  • Clientes que conoció por Handled: atiéndalos siempre por la plataforma durante 12 meses (es parte de su acuerdo). Sus propios clientes son suyos.",
    "  • Mantenga vigentes su seguro y licencias: le avisamos antes de que venzan.",
    "  • Active las notificaciones de la app para no perderse ninguna oferta. Todo está disponible en español.",
    "",
    "AYUDA",
    `  • ${BRAND.supportPhone} · ${BRAND.supportEmail ?? "info@handledsvc.com"}`,
    `  • Su guía completa (PDF): ${guide}`,
    `  • Su portal: ${site}/pro`,
  ] : [
    "8. GOOD TO KNOW",
    "  • You're an independent pro (1099): you choose your jobs, your area and your hours, and you keep your own customers.",
    "  • Ratings and photos: every job is photo-reviewed. If something's missed, the customer gets a free redo; get it right the first time and you earn more.",
    "  • Customers you met through Handled: keep working with them through the platform for 12 months (it's in your agreement). Your own customers stay yours.",
    "  • Keep your insurance and licenses current: we remind you before anything expires.",
    "  • Turn on notifications in the app so you never miss an offer. Everything is available in Spanish too.",
    "",
    "HELP",
    `  • ${BRAND.supportPhone} · ${BRAND.supportEmail ?? "info@handledsvc.com"}`,
    `  • Your full guide (PDF): ${guide}`,
    `  • Your portal: ${site}/pro`,
  ];

  const intro = es
    ? [`Hola ${first}:`, "", `¡Bienvenido a la Red ${BRAND.name}! Su cuenta está activa y verificada, y puede tomar trabajos en cuanto lleguen.`, "",
      `Le hablamos claro sobre dónde estamos: ${BRAND.name} es una empresa nueva. Estamos creciendo zona por zona, así que al principio las ofertas pueden llegar de a pocas, y algunas semanas puede no haber ninguna en sus oficios y su zona. Preferimos decírselo ahora que prometerle una agenda llena. Cada trabajo que le enviamos está prepagado, con precio fijo, y usted decide si lo toma. A medida que crecemos, los profesionales que ya están listos y responden rápido son los primeros en la fila.`, "",
      "Aquí tiene todo en un solo lugar: lo que nos dijo, por qué su zona importa, cómo funciona el portal, cómo le pagamos y cómo conseguir más trabajo. La guía completa en PDF está al final.", ""]
    : [`Hi ${first},`, "", `Welcome to the ${BRAND.name} Network! Your account is active and verified, and you can take jobs as soon as they come in.`, "",
      `A straight answer about where we are: ${BRAND.name} is a new company. We're growing market by market, so at first offers may come a few at a time, and some weeks there may be none in your trades and area. We'd rather tell you that now than promise you a full calendar. Every job we do send is prepaid, pre-priced and yours to take or pass, and as we grow, the pros who are set up and quick to respond are first in line.`, "",
      "Here's everything in one place: what you told us, why your area matters, how the portal works, how you're paid and how to get more work. The full PDF guide is at the end.", ""];
  const sign = es ? ["", `Nos alegra tenerle en el equipo.`, `— ${BRAND.name}`] : ["", "Glad to have you on the team.", `— ${BRAND.name}`];
  const text = [...intro, ...yourInfo, "", ...areaWhy, "", ...portal, "", ...pay, "", ...grow, "", ...earn, "", ...more, "", ...know, ...sign].filter((x): x is string => x !== null).join("\n");
  return { subject: es ? `Bienvenido a la Red ${BRAND.name}, ${first}` : `Welcome to the ${BRAND.name} Network, ${first}`, text };
}
