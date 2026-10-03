/*
 * FILE    : packages/core/src/seasonal.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0010 UTC
 * PURPOSE : Seasonal reminders and quote follow-ups — the rules, kept pure so they're tested.
 *             SEASONAL       — which services come around again, in which months (Michigan
 *                              seasons), and how long after the last visit to remind
 *             seasonalDue    — for one customer's history: what's due now
 *             followupDue    — which follow-up (if any) is due for an unpaid booking or a
 *                              saved price, from its schedule
 */

export interface SeasonRule {
  slug: string;
  /** Months (1–12) the reminder goes out. */
  months: number[];
  /** Only if the last visit was at least this many days ago. */
  minGapDays: number;
  /** Why now — spring (Jan–Jun) and fall (Jul–Dec) wording. */
  spring: { en: string; es: string };
  fall: { en: string; es: string };
}

const both = (en: string, es: string) => ({ en, es });

export const SEASONAL: SeasonRule[] = [
  { slug: "gutter-cleaning", months: [4, 5, 10, 11], minGapDays: 150,
    spring: both("Spring storms are coming — clear gutters keep water out of your basement.", "Llegan las tormentas de primavera: las canaletas limpias mantienen el agua fuera de su sótano."),
    fall: both("The leaves are down — clear your gutters before the first freeze.", "Ya cayeron las hojas: limpie sus canaletas antes de la primera helada.") },
  { slug: "leaf-removal", months: [10, 11], minGapDays: 300,
    spring: both("", ""), fall: both("Leaf season is here — we'll clear the yard before the snow.", "Llegó la temporada de hojas: limpiamos el jardín antes de la nieve.") },
  { slug: "snow-removal", months: [10, 11], minGapDays: 300,
    spring: both("", ""), fall: both("Winter's close — book snow removal now and never shovel at 6 a.m.", "Se acerca el invierno: reserve la remoción de nieve ahora y olvídese de palear a las 6 a. m.") },
  { slug: "lawn-care", months: [3, 4], minGapDays: 300,
    spring: both("The grass is waking up — start the season with a fresh cut.", "El césped está despertando: empiece la temporada con un buen corte."), fall: both("", "") },
  { slug: "power-washing", months: [4, 5, 6], minGapDays: 300,
    spring: both("Winter left its mark — a power wash makes the house, deck and driveway look new.", "El invierno dejó su huella: un lavado a presión deja la casa, la terraza y la entrada como nuevas."), fall: both("", "") },
  { slug: "window-cleaning", months: [4, 5, 9, 10], minGapDays: 150,
    spring: both("Let the spring light in — streak-free windows, inside and out.", "Deje entrar la luz de primavera: ventanas sin manchas, por dentro y por fuera."),
    fall: both("Clean windows before winter — you'll be looking through them for months.", "Ventanas limpias antes del invierno: las verá durante meses.") },
  { slug: "carpet-cleaning", months: [3, 4, 10, 11], minGapDays: 300,
    spring: both("Spring cleaning — lift a winter of salt and slush out of your carpets.", "Limpieza de primavera: saque de sus alfombras la sal y el lodo del invierno."),
    fall: both("Get the carpets fresh before the holidays and guests.", "Deje las alfombras frescas antes de las fiestas y las visitas.") },
  { slug: "house-cleaning", months: [3, 4, 11, 12], minGapDays: 150,
    spring: both("Spring cleaning season — let us do the deep clean.", "Temporada de limpieza de primavera: nosotros hacemos la limpieza profunda."),
    fall: both("Hosting this season? Get the house guest-ready.", "¿Recibe visitas esta temporada? Deje la casa lista.") },
  { slug: "mobile-car-detailing", months: [4, 5, 10, 11], minGapDays: 150,
    spring: both("Wash off winter's road salt before it eats the paint.", "Quite la sal del invierno antes de que dañe la pintura."),
    fall: both("Protect the paint before salt season — a detail and wax now.", "Proteja la pintura antes de la temporada de sal: detallado y cera ahora.") },
  { slug: "pet-waste-removal", months: [3, 4], minGapDays: 300,
    spring: both("The snow melted and so did the surprises — we'll clean up the yard.", "Se derritió la nieve y aparecieron las sorpresas: limpiamos el jardín."), fall: both("", "") },
];

export interface PastJob { service_slug: string; completed_at: string | null }

/** Spring (Jan–Jun) or fall (Jul–Dec) of a year — a reminder goes out at most once per half. */
export function seasonKey(slug: string, now = new Date()): string {
  return `${slug}:${now.getUTCFullYear()}-${now.getUTCMonth() < 6 ? "spring" : "fall"}`;
}

export function seasonalPitch(rule: SeasonRule, locale: string | null | undefined, now = new Date()): string {
  const half = now.getUTCMonth() < 6 ? rule.spring : rule.fall;
  return (locale === "es" ? half.es : half.en) || (locale === "es" ? rule.spring.es || rule.fall.es : rule.spring.en || rule.fall.en);
}

/**
 * Services this customer had done that are due again this season.
 * skip = slugs they already have covered (an active recurring plan or an upcoming booking).
 */
export function seasonalDue(history: PastJob[], opts: { now?: Date; skip?: string[] } = {}): { rule: SeasonRule; lastDone: string }[] {
  const now = opts.now ?? new Date();
  const month = now.getUTCMonth() + 1;
  const out: { rule: SeasonRule; lastDone: string }[] = [];
  for (const rule of SEASONAL) {
    if (!rule.months.includes(month) || opts.skip?.includes(rule.slug)) continue;
    const last = history.filter((j) => j.service_slug === rule.slug && j.completed_at).map((j) => j.completed_at!).sort().pop();
    if (!last) continue;
    if ((now.getTime() - new Date(last).getTime()) / 86400000 < rule.minGapDays) continue;
    out.push({ rule, lastDone: last });
  }
  // the one they had done longest ago first
  return out.sort((a, b) => a.lastDone.localeCompare(b.lastDone));
}

/** Unpaid bookings: payment reminders this many days after booking (the first already existed). */
export const BOOKING_FOLLOWUPS = [1, 3, 7];
/** "Email me this price": the price right away, then these follow-ups. */
export const QUOTE_FOLLOWUPS = [1, 4];

/** Index of the follow-up due now (0-based), or null. `sent` = how many already went out. */
export function followupDue(createdAt: string, sent: number, schedule: number[], now = new Date()): number | null {
  if (sent >= schedule.length) return null;
  const age = (now.getTime() - new Date(createdAt).getTime()) / 86400000;
  return age >= schedule[sent] ? sent : null;
}
