/*
 * FILE    : packages/core/src/orientation.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2245 UTC
 * UPDATED : 2026-10-29_0655 UTC — lesson 5 is "On the job site" (was the customer's home or business).
 * UPDATED : 2026-11-10_0500 UTC — eight lessons: new "Your business: tools, area and schedule" and "Earn more" (Refer & earn,
 *           refer-a-pro bonus, show-up pay, insurance help, pay protection); insurance/license only "if your services
 *           need them"; a safety stop never counts against you.
 * PURPOSE : "Welcome to Handled": the orientation every new pro takes in their portal right after signing up. Eight short
 *           lessons (who we are, how jobs work, your business, pay, earning more, quality, conduct, the app), each with one question to check it
 *           landed. Finishing all of them is a required onboarding step (compliance.ts) before Handled can approve a pro.
 *           Every number comes from the live policy constants, so the lessons never drift from the rules.
 */
import { BRAND } from "./brand.ts";
import { BOARD } from "./board.ts";
import { CANCEL_POLICY } from "./coverage.ts";
import { DEACTIVATION_RULES } from "./pro-fairness.ts";
import { PROBATION } from "./vetting.ts";
import { PRO_REFERRAL } from "./pro-program.ts";
import { referralRange } from "./partners.ts";

type Text = { title: string; points: string[]; q: string; options: string[] };
export interface Lesson { id: string; icon: string; minutes: number; answer: number; en: Text; es: Text }

const g = BRAND.guaranteeDays;
const r = DEACTIVATION_RULES;

export const ORIENTATION: Lesson[] = [
  {
    id: "welcome", icon: "👋", minutes: 2, answer: 1,
    en: {
      title: `Who ${BRAND.name} is`,
      points: [
        `${BRAND.name} is one company for home and business services. Customers book with us online, and we send a vetted pro.`,
        "Customers pay up front, before you're sent. You never quote, invoice or chase money.",
        "We run the office: marketing, scheduling, reminders, payments, reviews and customer support. You do the work.",
        "You're an independent pro (1099): your own business, your own tools, your own schedule. You choose which jobs to take.",
        `Our promise to customers: a checked pro, a fixed price, and a ${g}-day make-it-right guarantee. That promise is why they book us, and why the work keeps coming to you.`,
      ],
      q: "Who collects payment from the customer?",
      options: ["You, when the job is done", `${BRAND.name}, before you're sent`, "The customer pays you in cash"],
    },
    es: {
      title: `Quién es ${BRAND.name}`,
      points: [
        `${BRAND.name} es una sola empresa para servicios del hogar y de negocios. Los clientes reservan en línea y nosotros enviamos a un profesional verificado.`,
        "Los clientes pagan por adelantado, antes de que usted vaya. Nunca cotiza, factura ni persigue pagos.",
        "Nosotros llevamos la oficina: marketing, agenda, recordatorios, pagos, reseñas y atención al cliente. Usted hace el trabajo.",
        "Usted es un profesional independiente (1099): su propio negocio, sus herramientas y su horario. Usted elige qué trabajos toma.",
        `Nuestra promesa a los clientes: un profesional verificado, un precio fijo y una garantía de ${g} días para corregir cualquier problema. Por esa promesa nos reservan, y por eso le sigue llegando trabajo.`,
      ],
      q: "¿Quién cobra al cliente?",
      options: ["Usted, al terminar el trabajo", `${BRAND.name}, antes de que usted vaya`, "El cliente le paga en efectivo"],
    },
  },
  {
    id: "jobs", icon: "🧰", minutes: 3, answer: 2,
    en: {
      title: "How a job works",
      points: [
        "Offers come to your phone with the scope, the date and your exact payout. Accept the ones you want; passing never hurts you.",
        "Recurring customers and redo visits are offered to their regular pro first.",
        `Jobs nobody takes go to the open board ("Jobs near you") after ${BOARD.afterMinutes} minutes. Claiming one holds it for ${BOARD.claimMinutes} minutes while you read the work order.`,
        "The street address shows after you accept. Arrive inside the arrival window, and follow the job's checklist.",
        "Take before photos of every area in scope, and after photos from the same angles. Then mark the job complete.",
      ],
      q: "When do you take before and after photos?",
      options: ["Only if the customer asks", "Only on big jobs", "On every job, for every area in scope"],
    },
    es: {
      title: "Cómo funciona un trabajo",
      points: [
        "Las ofertas llegan a su teléfono con el alcance, la fecha y su pago exacto. Acepte las que quiera; pasar nunca le perjudica.",
        "Los clientes recurrentes y las visitas para corregir se ofrecen primero a su profesional habitual.",
        `Los trabajos que nadie toma pasan al tablero abierto ("Trabajos cerca de usted") después de ${BOARD.afterMinutes} minutos. Al tomar uno, se le reserva ${BOARD.claimMinutes} minutos mientras lee la orden de trabajo.`,
        "La dirección aparece después de aceptar. Llegue dentro del horario de llegada y siga la lista de verificación del trabajo.",
        "Tome fotos de antes de cada área del trabajo y fotos de después desde los mismos ángulos. Luego marque el trabajo como terminado.",
      ],
      q: "¿Cuándo toma fotos de antes y después?",
      options: ["Solo si el cliente lo pide", "Solo en trabajos grandes", "En cada trabajo, de cada área del alcance"],
    },
  },
  {
    id: "business", icon: "🛠️", minutes: 2, answer: 0,
    en: {
      title: "Your business: tools, area and schedule",
      points: [
        "You bring your own tools, equipment, vehicle, phone and supplies, and you decide how to do the work.",
        "Parts and materials that aren't in the job price are paid back at cost: upload the itemized receipt in the app. Bigger purchases need our OK first. You never pay for a customer's materials out of your pay.",
        "You set your own service area: your home base, how far you'll drive (or only certain ZIP codes), your work days, hours and daily job limit.",
        `We never send an offer outside your area or hours. Want same-day work? Switch on "On call" and you'll get rush jobs near you.`,
        "Helpers are up to you. Add them in My crew first, so customers know who's coming and they pass the same checks.",
        `You can work for other companies and advertise your own business, too. ${BRAND.name} is a source of work, not a boss.`,
      ],
      q: "Who provides the tools and equipment for a job?",
      options: ["You do: it's your business", `${BRAND.name} ships them to you`, "The customer"],
    },
    es: {
      title: "Su negocio: herramientas, zona y horario",
      points: [
        "Usted trae sus propias herramientas, equipo, vehículo, teléfono y suministros, y decide cómo hacer el trabajo.",
        "Las piezas y materiales que no están en el precio del trabajo se le reembolsan al costo: suba el recibo detallado en la app. Las compras grandes necesitan nuestra aprobación antes. Nunca paga los materiales del cliente con su pago.",
        "Usted fija su zona de servicio: su base, cuánto maneja (o solo ciertos códigos postales), sus días, horas y límite diario de trabajos.",
        `Nunca le enviamos ofertas fuera de su zona u horario. ¿Quiere trabajo para hoy? Active "De guardia" y recibirá trabajos urgentes cerca de usted.`,
        "Los ayudantes son decisión suya. Agréguelos antes en Mi equipo, para que el cliente sepa quién va y pasen las mismas verificaciones.",
        `También puede trabajar para otras empresas y anunciar su propio negocio. ${BRAND.name} es una fuente de trabajo, no un jefe.`,
      ],
      q: "¿Quién pone las herramientas y el equipo para un trabajo?",
      options: ["Usted: es su negocio", `${BRAND.name} se los envía`, "El cliente"],
    },
  },
  {
    id: "pay", icon: "💵", minutes: 2, answer: 0,
    en: {
      title: "How you get paid",
      points: [
        "The payout on the offer is what you get. No lead fees, no subscription, nothing to join.",
        "Your pay is approved when the job passes photo review, and sent every Monday to your bank through Stripe, free.",
        "Want it sooner? Instant cash-out is optional, for a small fee, once you've done a few jobs.",
        "Tips are 100% yours.",
        "You're paid as an independent business: we send you a 1099 when the law requires it, using the W-9 you give us.",
      ],
      q: "When are weekly payouts sent?",
      options: ["Every Monday", "Once a month", "When the customer remembers"],
    },
    es: {
      title: "Cómo le pagamos",
      points: [
        "El pago que ve en la oferta es lo que recibe. Sin cargos por cliente potencial, sin suscripción y sin costo por unirse.",
        "Su pago se aprueba cuando el trabajo pasa la revisión de fotos y se envía cada lunes a su banco por Stripe, gratis.",
        "¿Lo quiere antes? El cobro instantáneo es opcional, con una pequeña comisión, después de algunos trabajos.",
        "Las propinas son 100% suyas.",
        "Se le paga como negocio independiente: le enviamos un 1099 cuando la ley lo exige, con el W-9 que nos da.",
      ],
      q: "¿Cuándo se envían los pagos semanales?",
      options: ["Cada lunes", "Una vez al mes", "Cuando el cliente se acuerde"],
    },
  },
  {
    id: "earn", icon: "🚀", minutes: 2, answer: 1,
    en: {
      title: "Earn more",
      points: [
        `Refer & earn: see someone who needs work done (a neighbor, a customer's friend, a business)? Snap photos and send a referral ticket from your portal. When their job is done, you earn ${referralRange()} of the job price, rising the more you refer, paid with your weekly payout.`,
        `Refer a pro: get $${PRO_REFERRAL.bonus} when a pro you refer finishes ${PRO_REFERRAL.afterJobs} jobs.`,
        "Show-up pay: if a customer cancels late or you're locked out, you're paid for the trip.",
        "Insurance help: quotes through our insurance partners, and a one-time insurance stipend once you've finished enough jobs with great ratings.",
        "Pay protection: a refund that isn't about your workmanship comes out of our share first, not your pay.",
      ],
      q: "You see a neighbor who needs their gutters cleaned. How can you earn from it?",
      options: ["You can't: only customers book", "Send a referral ticket from your portal and earn a share when the job is done", "Do it for cash on the side"],
    },
    es: {
      title: "Gane más",
      points: [
        `Refiera y gane: ¿ve a alguien que necesita un trabajo (un vecino, un amigo de un cliente, un negocio)? Tome fotos y envíe una referencia desde su portal. Cuando se termine su trabajo, gana ${referralRange()} del precio, y sube mientras más refiera; se paga con su pago semanal.`,
        `Refiera a un profesional: reciba $${PRO_REFERRAL.bonus} cuando un profesional que refirió termine ${PRO_REFERRAL.afterJobs} trabajos.`,
        "Pago por presentarse: si el cliente cancela tarde o no puede entrar, se le paga el viaje.",
        "Ayuda con el seguro: cotizaciones con nuestros socios de seguros y un apoyo único para el seguro después de terminar suficientes trabajos con buenas calificaciones.",
        "Protección de pago: un reembolso que no es por su trabajo sale primero de nuestra parte, no de su pago.",
      ],
      q: "Ve a un vecino que necesita limpiar sus canaletas. ¿Cómo puede ganar con eso?",
      options: ["No puede: solo los clientes reservan", "Envía una referencia desde su portal y gana una parte cuando se termine el trabajo", "Lo hace en efectivo por su cuenta"],
    },
  },
  {
    id: "quality", icon: "⭐", minutes: 3, answer: 0,
    en: {
      title: "Quality and your standing",
      points: [
        `Your first ${PROBATION.jobs} jobs are under $${PROBATION.maxJobPrice}, and each gets a photo review by our team.`,
        `If a customer reports a problem within ${g} days, you get the first chance to make it right.`,
        `Cancelling ${CANCEL_POLICY.freeHours}+ hours before the arrival window is free. ${CANCEL_POLICY.lateHours}–${CANCEL_POLICY.freeHours} hours is short notice (no penalty). Under ${CANCEL_POLICY.lateHours} hours is a late cancel.`,
        `What leads to a review: an average rating under ${r.minRating} over your last ${r.ratedJobs} rated jobs, ${r.lateCancels} late cancels or ${r.noShows} no-shows, or repeated failed photo reviews. You always get a written warning and ${r.improveDays} days to improve first.`,
        "Great ratings earn first pick of jobs, higher pay tiers and Pro Rewards points.",
      ],
      q: `You cancel a job ${CANCEL_POLICY.freeHours + 6} hours before the arrival window. What happens?`,
      options: ["Nothing: it's free", "It's a late cancel", "You're removed from the platform"],
    },
    es: {
      title: "Calidad y su reputación",
      points: [
        `Sus primeros ${PROBATION.jobs} trabajos son de menos de $${PROBATION.maxJobPrice}, y nuestro equipo revisa las fotos de cada uno.`,
        `Si un cliente reporta un problema dentro de ${g} días, usted tiene la primera oportunidad de corregirlo.`,
        `Cancelar ${CANCEL_POLICY.freeHours} horas o más antes del horario de llegada es gratis. De ${CANCEL_POLICY.lateHours} a ${CANCEL_POLICY.freeHours} horas es aviso corto (sin penalidad). Menos de ${CANCEL_POLICY.lateHours} horas es una cancelación tardía.`,
        `Qué lleva a una revisión: un promedio menor de ${r.minRating} en sus últimos ${r.ratedJobs} trabajos calificados, ${r.lateCancels} cancelaciones tardías o ${r.noShows} ausencias, o revisiones de fotos fallidas repetidas. Siempre recibe primero un aviso por escrito y ${r.improveDays} días para mejorar.`,
        "Las buenas calificaciones le dan prioridad en los trabajos, mejores niveles de pago y puntos de Pro Rewards.",
      ],
      q: `Cancela un trabajo ${CANCEL_POLICY.freeHours + 6} horas antes del horario de llegada. ¿Qué pasa?`,
      options: ["Nada: es gratis", "Es una cancelación tardía", "Lo sacan de la plataforma"],
    },
  },
  {
    id: "conduct", icon: "🏠", minutes: 2, answer: 1,
    en: {
      title: "On the job site",
      points: [
        `Introduce yourself by name as the ${BRAND.name} pro. Your profile photo helps the customer know who is at the door.`,
        "Treat the job site like your own: protect floors and surfaces, clean up, and leave it better than you found it.",
        "No alcohol, drugs or smoking on the job. Only bring crew members listed in My crew.",
        `Never ask a ${BRAND.name} customer to book you directly or pay you outside ${BRAND.name}. Send them back to us; it's in your agreement.`,
        "Damage, injury, or anything unsafe: stop, take photos and tell us right away in the app. You can stop or refuse any unsafe work; a safety stop never counts against you.",
      ],
      q: "A customer asks you to do their next job directly for cash. What do you do?",
      options: ["Agree and give them your number", `Ask them to book it through ${BRAND.name}`, "Do it but charge less"],
    },
    es: {
      title: "En el sitio de trabajo",
      points: [
        `Preséntese por su nombre como el profesional de ${BRAND.name}. Su foto de perfil ayuda al cliente a saber quién está en la puerta.`,
        "Trate el sitio de trabajo como si fuera suyo: proteja los pisos y las superficies, limpie y déjelo mejor de como lo encontró.",
        "Nada de alcohol, drogas ni fumar en el trabajo. Solo lleve a los miembros de su equipo registrados en Mi equipo.",
        `Nunca le pida a un cliente de ${BRAND.name} que lo contrate directamente o que le pague fuera de ${BRAND.name}. Envíelo de vuelta a nosotros; así lo dice su acuerdo.`,
        "Daños, lesiones o cualquier riesgo: deténgase, tome fotos y avísenos de inmediato en la app. Puede detener o rechazar cualquier trabajo inseguro; una parada por seguridad nunca cuenta en su contra.",
      ],
      q: "Un cliente le pide hacer su próximo trabajo directamente y en efectivo. ¿Qué hace?",
      options: ["Acepta y le da su número", `Le pide que lo reserve por ${BRAND.name}`, "Lo hace pero cobra menos"],
    },
  },
  {
    id: "app", icon: "📱", minutes: 2, answer: 2,
    en: {
      title: "Your portal and the app",
      points: [
        "Turn on notifications so you never miss an offer.",
        "Keep your calendar, days off, service area and daily job limit current. We never offer more jobs than your limit.",
        "My info shows your profile, documents, expiry dates and contracts in one place. Earnings shows every payout.",
        "If your services need insurance or a license and it expires, offers pause automatically until you upload the renewal.",
        `Questions? Reply to any ${BRAND.name} email or write to ${BRAND.supportEmail}.`,
      ],
      q: "Your services need insurance, and your policy expires. What happens?",
      options: ["Nothing", "You lose your rewards points", "Offers pause until you upload the renewal"],
    },
    es: {
      title: "Su portal y la app",
      points: [
        "Active las notificaciones para no perderse ninguna oferta.",
        "Mantenga al día su calendario, días libres, zona de servicio y límite diario de trabajos. Nunca le ofrecemos más trabajos que su límite.",
        "Mi información muestra su perfil, documentos, fechas de vencimiento y contratos en un solo lugar. Ganancias muestra cada pago.",
        "Si sus servicios necesitan seguro o licencia y vence, las ofertas se pausan automáticamente hasta que suba la renovación.",
        `¿Preguntas? Responda a cualquier correo de ${BRAND.name} o escriba a ${BRAND.supportEmail}.`,
      ],
      q: "Sus servicios necesitan seguro y su póliza vence. ¿Qué pasa?",
      options: ["Nada", "Pierde sus puntos de recompensa", "Las ofertas se pausan hasta que suba la renovación"],
    },
  },
];

export const ORIENTATION_MINUTES = ORIENTATION.reduce((n, l) => n + l.minutes, 0);

/** Lessons done (id → ISO time), from contractors.orientation. */
export type OrientationProgress = Record<string, string> | null | undefined;

export function orientationStatus(p: OrientationProgress) {
  const done = ORIENTATION.filter((l) => Boolean(p?.[l.id]));
  const next = ORIENTATION.find((l) => !p?.[l.id]) ?? null;
  return { done: done.length, total: ORIENTATION.length, complete: done.length === ORIENTATION.length, next };
}

/** Is this the right answer to the lesson's question? */
export function orientationAnswer(lessonId: string, choice: number): boolean {
  const l = ORIENTATION.find((x) => x.id === lessonId);
  return Boolean(l) && l!.answer === choice;
}
