/*
 * FILE    : packages/core/src/earnings.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1244 UTC
 * PURPOSE : "What pros make" — the earnings story for the /pros page and recruiting copy, computed
 *           from the live pricing engine so it can't drift. Leads with what matters to a pro
 *           (a full day, and the range from a small job to a big one) instead of a single small-job
 *           number. Small and large jobs are hand-picked realistic examples per trade.
 */
import { BOOKING_FEE, COMMISSION, estimate, splitJob } from "./pricing.ts";
import { defaultAnswers, getService, type Answers } from "./services.ts";
import { PRO_TIERS } from "./pro-program.ts";

export interface ShowcaseDef {
  slug: string;
  /** Shown instead of the service name (e.g. "Electrical" for light-fixture installs). */
  label?: string;
  small: Answers;
  large: Answers;
  /** Typical jobs a pro does in a full day of this work (null = multi-day projects). */
  perDay: number | null;
}

export const EARNINGS_SHOWCASE: ShowcaseDef[] = [
  { slug: "house-cleaning", small: { bedrooms: 1, bathrooms: 1, sqft: 700 }, large: { bedrooms: 4, bathrooms: 3, sqft: 2800, level: "deep" }, perDay: 2 },
  { slug: "lawn-care", small: { lot: "small" }, large: { lot: "acre" }, perDay: 8 },
  { slug: "snow-removal", small: { area: "one_car" }, large: { area: "large", walks: true, salt: true }, perDay: 10 },
  { slug: "handyman", label: "Handyman & carpentry", small: { hours: 1 }, large: { hours: 6 }, perDay: 3 },
  { slug: "junk-removal", small: { volume: "eighth" }, large: { volume: "full" }, perDay: 4 },
  { slug: "gutter-cleaning", small: { feet: 100 }, large: { feet: 250, stories: "2" }, perDay: 4 },
  { slug: "window-cleaning", small: { windows: 10, sides: "outside" }, large: { windows: 35, sides: "both" }, perDay: 2 },
  { slug: "power-washing", small: { surface: "driveway", sqft: 400 }, large: { surface: "house", sqft: 2500, stories: "2" }, perDay: 3 },
  { slug: "mobile-car-detailing", small: { package: "exterior" }, large: { vehicle: "suv", package: "full" }, perDay: 3 },
  { slug: "plumbing", small: { issue: "clog" }, large: { issue: "main" }, perDay: 4 },
  { slug: "lighting-install", label: "Electrical", small: { fixtures: 1 }, large: { fixtures: 6 }, perDay: 3 },
  { slug: "interior-painting", label: "Painting", small: { rooms: 1 }, large: { rooms: 4, size: "large", trim: true }, perDay: null },
];

const down5 = (n: number) => Math.floor(n / 5) * 5;
const up5 = (n: number) => Math.ceil(n / 5) * 5;
const near10 = (n: number) => Math.round(n / 10) * 10;

export interface ShowcaseRow { slug: string; name: string; icon: string; low: number; high: number; typical: number; day: number | null; perHour: number | null }

/** Pro pay (base tier) for a small job, a typical job and a large job; a full day at the typical size. */
export function earningsShowcase(defs: ShowcaseDef[] = EARNINGS_SHOWCASE): ShowcaseRow[] {
  return defs.flatMap((d) => {
    const svc = getService(d.slug);
    if (!svc || svc.siteVisit) return [];
    const base = defaultAnswers(svc);
    const pay = (a: Answers) => { const e = estimate({ slug: d.slug, answers: { ...base, ...a } }); return { p: splitJob(e.point, d.slug).payout, h: e.hours }; };
    const small = pay(d.small), typical = pay({}), large = pay(d.large);
    const low = down5(Math.min(small.p, typical.p)), high = up5(Math.max(large.p, typical.p));
    return [{
      slug: d.slug, name: d.label ?? svc.name, icon: svc.icon, low, high, typical: typical.p,
      day: d.perDay ? near10(typical.p * d.perDay) : null,
      perHour: typical.h > 0 ? Math.round(typical.p / typical.h) : null,
    }];
  });
}

/** Headline numbers: the share pros keep (small → large jobs) and the best tier boost. */
export function earningsHeadline() {
  const keepSmall = Math.round((1 - COMMISSION.minRate) * 100), keepLarge = Math.round((1 - COMMISSION.maxRate) * 100);
  const topBoost = Math.round(Math.max(...PRO_TIERS.map((t) => t.payoutBoost)) * 100);
  return { keepSmall, keepLarge, topBoost, bookingFee: BOOKING_FEE };
}
