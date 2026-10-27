/*
 * FILE    : packages/core/src/brand.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0244 UTC — pitch mentions car detailing and grocery & medical deliveries.
 * UPDATED : 2026-10-02_0301 UTC — booking horizon 45 days.
 * UPDATED : 2026-10-02_2229 UTC — googleReviewUrl (NEXT_PUBLIC_ / EXPO_PUBLIC_GOOGLE_REVIEW_URL).
 * UPDATED : 2026-10-06_2105 UTC — real company contact: info@handledsvc.com · (313) 639-9373 (env vars still override).
 * PURPOSE : Single place to rename/rebrand the company. "Handled" is a working name —
 *           run a trademark search before launch and change it here.
 * UPDATED : 2026-10-15_0300 UTC — promise: "25% books your pro — pay the rest when it's done."
 * UPDATED : 2026-10-27_1500 UTC — BRAND_STORY: slogan ("Consider it Handled."), mission statement, who we are and our values,
 *           English and Spanish. Used by the About page, the home page, the footer and the side menu.
 *           BRAND_STORY.why: what customers get, what pros get, and why the model works for both.
 */

// Contact details come from env so going live needs no code change:
//   web: NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_SUPPORT_PHONE · mobile: EXPO_PUBLIC_SUPPORT_EMAIL / EXPO_PUBLIC_SUPPORT_PHONE
// (each referenced literally so Next.js and Expo can inline them at build time)
let supportEmail = "info@handledsvc.com";
let supportPhone = "(313) 639-9373";
// Google Business Profile → "Ask for reviews" link (https://g.page/r/…/review). Empty = not asked.
let googleReviewUrl = "";
try {
  supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.EXPO_PUBLIC_SUPPORT_EMAIL || supportEmail;
  supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || process.env.EXPO_PUBLIC_SUPPORT_PHONE || supportPhone;
  googleReviewUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || process.env.EXPO_PUBLIC_GOOGLE_REVIEW_URL || "";
} catch {
  // no `process` in this runtime — keep defaults
}
/** True while the placeholder contact details are still in use (flagged on the Hub setup page). */
export const BRAND_PLACEHOLDERS = supportEmail.endsWith(".example") || supportPhone.includes("555");

export const BRAND = {
  name: "Handled",
  legalName: "Handled Services LLC",
  tagline: "Home & business services. Handled.",
  pitch:
    "One app for everything your home or business needs — cleaning, repairs, painting, hauling, lawn and snow, pet care, car detailing, moving and delivery, same-day courier and medical deliveries, events and rides. Upfront prices, vetted pros, and an AI operations team that makes sure it's done right.",
  supportEmail,
  supportPhone,
  /** Where happy customers leave a public Google review. Asked of everyone who rates us (Google forbids asking only happy ones). */
  googleReviewUrl,
  serviceArea: "Launch market — set in the ops hub",
  partner: "Built and operated with IEBC — Integrated Efficiency Business Consultants",
  guaranteeDays: 30,
  /** Days we don't schedule work (0 = Sunday … 6 = Saturday). */
  closedWeekdays: [0] as number[],
  /** How far ahead customers can book on the calendar. */
  bookingHorizonDays: 45, // customers can book up to ~6 weeks out ("within a month" and beyond)
  /** 25% books the pro, the rest when it's done — made right with a free redo, a free extra service or a refund. */
  promise: "25% books your pro — pay the rest when it's done. Not right? Free redo or your money back within 30 days.",
} as const;

/** Who we are, in our own words (English / Spanish). Change the slogan, mission or story here; every page follows. */
export const BRAND_STORY = {
  slogan: { en: "Consider it Handled.", es: "Considérelo Handled." },
  mission: {
    en: "To make taking care of a home or business simple: one trusted company for every job, an honest price up front, vetted local pros who are paid fairly, and work we stand behind until it's right.",
    es: "Hacer que cuidar una casa o un negocio sea sencillo: una sola empresa de confianza para cada trabajo, un precio honesto por adelantado, profesionales locales verificados y bien pagados, y un trabajo que respaldamos hasta que quede bien.",
  },
  /** Short "who we are" — the footer and the home page. */
  short: {
    en: "Handled is one company for everything your home or business needs: 70+ services, done by insured, background-checked local pros, priced up front and checked with photos.",
    es: "Handled es una sola empresa para todo lo que su casa o negocio necesita: más de 70 servicios, hechos por profesionales locales asegurados y verificados, con precio por adelantado y revisados con fotos.",
  },
  /** Full "who we are" — the About page. */
  about: {
    en: [
      "Handled Services LLC is a home and business services company based in Michigan. We bring more than 70 services into one place — cleaning, repairs, carpentry, masonry, roofing, painting, lawn and snow, moving and hauling, pet care, events, rides and business technology — so you never have to search for, vet and chase a contractor again.",
      "Insured, background-checked local pros do the work. Our AI-powered operations team prices every job up front, sends the right pro, tracks it live, checks the finished work with photos and stands behind it. A small team of real people runs it all and steps in whenever it matters.",
      "We started in Metro Detroit, we serve Michigan and Washington, and we grow city by city — wherever we can find great pros and keep our promise.",
    ],
    es: [
      "Handled Services LLC es una empresa de servicios para hogares y negocios con sede en Michigan. Reunimos más de 70 servicios en un solo lugar — limpieza, reparaciones, carpintería, albañilería, techos, pintura, jardín y nieve, mudanzas y acarreos, mascotas, eventos, transporte y tecnología para negocios — para que nunca vuelva a buscar, verificar y perseguir a un contratista.",
      "El trabajo lo hacen profesionales locales asegurados y con verificación de antecedentes. Nuestro equipo de operaciones con inteligencia artificial pone precio a cada trabajo por adelantado, envía al profesional indicado, lo sigue en vivo, revisa el trabajo terminado con fotos y lo respalda. Un pequeño equipo de personas reales lo dirige todo e interviene cuando importa.",
      "Empezamos en el área metropolitana de Detroit, atendemos Michigan y Washington, y crecemos ciudad por ciudad, donde encontremos excelentes profesionales y podamos cumplir nuestra promesa.",
    ],
  },
  /** Why it works — for customers, for pros, and the model that makes both true. */
  why: {
    customers: {
      en: { t: "For customers", d: "The easiest way to get anything done at home or at work.", points: ["An exact price in 60 seconds — no estimate visits, no callbacks", "One insured, background-checked pro — not five sales calls", "Track it live, see photos when it's done, pay the rest when it's right", "Free redo or your money back within 30 days"] },
      es: { t: "Para clientes", d: "La forma más fácil de resolver cualquier cosa en casa o en el trabajo.", points: ["Un precio exacto en 60 segundos, sin visitas para cotizar ni llamadas de regreso", "Un profesional asegurado y verificado, no cinco llamadas de ventas", "Siga el trabajo en vivo, vea fotos al terminar y pague el resto cuando esté bien", "Lo rehacemos gratis o le devolvemos su dinero dentro de 30 días"] },
    },
    pros: {
      en: { t: "For pros", d: "Real, prepaid work — without buying leads or chasing customers.", points: ["Prepaid jobs on your phone — no lead fees, no quotes, no collecting", "See the pay before you accept; take only the jobs you want", "Keep about 75% of everyday jobs, paid weekly — instant pay for qualifying pros", "Great ratings earn first pick of jobs and higher pay"] },
      es: { t: "Para profesionales", d: "Trabajo real y pagado por adelantado, sin comprar clientes ni perseguir cobros.", points: ["Trabajos prepagados en su teléfono: sin cuotas por cliente, sin cotizar, sin cobrar", "Vea el pago antes de aceptar; tome solo los trabajos que quiera", "Quédese con cerca del 75% de los trabajos diarios, con pago semanal; pago al instante para profesionales que califican", "Las buenas calificaciones le dan prioridad en los trabajos y mejor pago"] },
    },
    model: {
      en: { t: "Why it works", d: "Lead sites sell the same job to five contractors and leave you to sort it out. We do the opposite: you book with us, and we own the job. Because customers pay up front, pros get real work instead of paying for leads — so the best pros want to work with us. Because the best pros work with us, jobs get done right, customers come back, and there's more work for every pro. Photos, two-way ratings and our guarantee keep everyone honest." },
      es: { t: "Por qué funciona", d: "Los sitios de clientes potenciales venden el mismo trabajo a cinco contratistas y lo dejan a usted resolverlo. Nosotros hacemos lo contrario: usted reserva con nosotros y nosotros nos hacemos cargo del trabajo. Como los clientes pagan por adelantado, los profesionales reciben trabajo real en vez de pagar por clientes, así que los mejores quieren trabajar con nosotros. Como los mejores trabajan con nosotros, los trabajos quedan bien, los clientes regresan y hay más trabajo para cada profesional. Las fotos, las calificaciones en ambos sentidos y nuestra garantía mantienen la honestidad de todos." },
    },
  },
  values: [
    { icon: "💵", en: { t: "Honest, upfront prices", d: "You see the price before you book. No callbacks, no surprise fees, no selling your number to five contractors." }, es: { t: "Precios honestos y por adelantado", d: "Ve el precio antes de reservar. Sin llamadas de regreso, sin cargos sorpresa, sin vender su número a cinco contratistas." } },
    { icon: "🛡️", en: { t: "Vetted pros, paid fairly", d: "Every pro is insured, background-checked and licensed where the trade needs it — and keeps most of every job." }, es: { t: "Profesionales verificados y bien pagados", d: "Cada profesional está asegurado, verificado y con licencia cuando el oficio lo exige, y se queda con la mayor parte de cada trabajo." } },
    { icon: "📸", en: { t: "Checked, then guaranteed", d: "Every job ends with photos we review. Not right? A free redo or your money back within 30 days." }, es: { t: "Revisado y garantizado", d: "Cada trabajo termina con fotos que revisamos. ¿No quedó bien? Lo rehacemos gratis o le devolvemos su dinero dentro de 30 días." } },
    { icon: "🏠", en: { t: "One company for everything", d: "One account, one app, one bill — from a deep clean to a new roof to your company's website." }, es: { t: "Una empresa para todo", d: "Una cuenta, una app, una factura: desde una limpieza profunda hasta un techo nuevo o el sitio web de su empresa." } },
  ],
} as const;
