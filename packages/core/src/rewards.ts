/*
 * FILE    : packages/core/src/rewards.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Handled Pro Rewards — loyalty points for independent pros, earned on the revenue they bring in.
 *             points per job = Handled's take ($) × earn rate (10) × quality multiplier × tenure multiplier
 *               quality  1.25× when QA passed first time, no redo / refund, rating ≥ 4.8 (or not rated); 0 when refunded
 *               tenure   1.0× / 1.1× / 1.25× / 1.5× at 0–6 / 6–12 / 12–24 / 24+ months active
 *             100 points ≈ $1 of reward cost → about 10% of our take at the base rate (≈2% of the job price)
 *             New points are pending for 90 days (final multipliers are set then; refunds void them), then available.
 *             Milestones add bonus points. Points expire after 12 months with no completed job; forfeited only on
 *             deactivation for cause. Redeemed for merchandise, gift cards, electronics and trips — never cash.
 *           Never tied to accepting or declining offers (pros stay free to pass). Redeemed value is reported on the
 *           pro's 1099 at fair market value.
 */

export interface RewardSettings {
  enabled: boolean;
  /** Points per $1 of Handled's take. */
  earnRate: number;
  /** Our cost of one point, in dollars (redemption value). */
  pointValue: number;
  pendingDays: number;
  inactivityExpiryMonths: number;
  qualityMultiplier: number;
  minRatingForQuality: number;
}

export const REWARD_DEFAULTS: RewardSettings = {
  enabled: true,
  earnRate: 10,
  pointValue: 0.01,
  pendingDays: 90,
  inactivityExpiryMonths: 12,
  qualityMultiplier: 1.25,
  minRatingForQuality: 4.8,
};

export const mergeRewards = (s?: Partial<RewardSettings> | null): RewardSettings => ({ ...REWARD_DEFAULTS, ...(s ?? {}) });

export const TENURE_TIERS = [
  { months: 0, multiplier: 1.0, en: "Starter", es: "Inicial" },
  { months: 6, multiplier: 1.1, en: "6 months", es: "6 meses" },
  { months: 12, multiplier: 1.25, en: "1 year", es: "1 año" },
  { months: 24, multiplier: 1.5, en: "2 years +", es: "2 años o más" },
] as const;

export function tenureTier(monthsActive: number) {
  const i = TENURE_TIERS.reduce((at, t, k) => (monthsActive >= t.months ? k : at), 0);
  return { ...TENURE_TIERS[i], next: TENURE_TIERS[i + 1] ?? null };
}

/** Whole months between two dates. */
export const monthsBetween = (from: string | Date, to: Date = new Date()) => {
  const a = new Date(from);
  return Math.max(0, (to.getFullYear() - a.getFullYear()) * 12 + (to.getMonth() - a.getMonth()) - (to.getDate() < a.getDate() ? 1 : 0));
};

/** Handled's take on a job: what the customer paid minus the pro's payout (tips are the pro's alone). */
export const takeOf = (j: { price_final?: number | null; contractor_payout?: number | null }) =>
  Math.max(0, Math.round((Number(j.price_final ?? 0) - Number(j.contractor_payout ?? 0)) * 100) / 100);

export interface JobPointsInput { take: number; monthsActive: number; qaPassedFirstTime: boolean; redo: boolean; refunded: boolean; rating?: number | null }

export function pointsForJob(j: JobPointsInput, s: RewardSettings = REWARD_DEFAULTS) {
  const base = j.take * s.earnRate;
  const quality = j.refunded ? 0 : j.qaPassedFirstTime && !j.redo && (j.rating == null || j.rating >= s.minRatingForQuality) ? s.qualityMultiplier : 1;
  const tenure = tenureTier(j.monthsActive).multiplier;
  return { base: Math.round(base), quality, tenure, points: Math.round(base * quality * tenure) };
}

export const pointsToDollars = (points: number, s: RewardSettings = REWARD_DEFAULTS) => Math.round(points * s.pointValue * 100) / 100;

// ── Milestones (one-time bonuses) ───────────────────────────────────────────

export interface MilestoneStats { jobsCompleted: number; monthsActive: number; fiveStarReviews: number }
export const MILESTONES: { key: string; en: string; es: string; points: number; reached: (s: MilestoneStats) => boolean }[] = [
  { key: "jobs_10", en: "10 jobs completed", es: "10 trabajos completados", points: 1000, reached: (s) => s.jobsCompleted >= 10 },
  { key: "jobs_50", en: "50 jobs completed", es: "50 trabajos completados", points: 5000, reached: (s) => s.jobsCompleted >= 50 },
  { key: "jobs_100", en: "100 jobs completed", es: "100 trabajos completados", points: 10000, reached: (s) => s.jobsCompleted >= 100 },
  { key: "jobs_250", en: "250 jobs completed", es: "250 trabajos completados", points: 25000, reached: (s) => s.jobsCompleted >= 250 },
  { key: "jobs_500", en: "500 jobs completed", es: "500 trabajos completados", points: 50000, reached: (s) => s.jobsCompleted >= 500 },
  { key: "year_1", en: "1 year with Handled", es: "1 año con Handled", points: 10000, reached: (s) => s.monthsActive >= 12 },
  { key: "year_2", en: "2 years with Handled", es: "2 años con Handled", points: 20000, reached: (s) => s.monthsActive >= 24 },
  { key: "year_3", en: "3 years with Handled", es: "3 años con Handled", points: 30000, reached: (s) => s.monthsActive >= 36 },
  { key: "five_star_25", en: "25 five-star reviews", es: "25 reseñas de cinco estrellas", points: 2500, reached: (s) => s.fiveStarReviews >= 25 },
  { key: "five_star_100", en: "100 five-star reviews", es: "100 reseñas de cinco estrellas", points: 10000, reached: (s) => s.fiveStarReviews >= 100 },
];

export const milestonesReached = (s: MilestoneStats, already: string[]) => MILESTONES.filter((m) => m.reached(s) && !already.includes(m.key));

// ── Catalog (starter items; staff edit them in the Hub) ─────────────────────

export type RewardCategory = "merch" | "gift_card" | "tools" | "electronics" | "travel" | "experience";
export const REWARD_CATEGORY_LABEL: Record<RewardCategory, { en: string; es: string }> = {
  merch: { en: "Handled gear", es: "Artículos Handled" }, gift_card: { en: "Gift cards", es: "Tarjetas de regalo" }, tools: { en: "Tools & equipment", es: "Herramientas y equipo" },
  electronics: { en: "Electronics", es: "Electrónicos" }, travel: { en: "Trips", es: "Viajes" }, experience: { en: "Experiences", es: "Experiencias" },
};

export interface CatalogSeed { slug: string; name: string; name_es: string; category: RewardCategory; points: number; cost_usd: number; description: string; description_es: string }
export const CATALOG_SEED: CatalogSeed[] = [
  { slug: "hat", name: "Handled hat", name_es: "Gorra Handled", category: "merch", points: 2500, cost_usd: 25, description: "Embroidered cap.", description_es: "Gorra bordada." },
  { slug: "tee", name: "Handled T-shirt", name_es: "Camiseta Handled", category: "merch", points: 2500, cost_usd: 25, description: "Heavyweight cotton tee.", description_es: "Camiseta de algodón grueso." },
  { slug: "hoodie", name: "Handled hoodie", name_es: "Sudadera Handled", category: "merch", points: 6000, cost_usd: 60, description: "Warm pullover hoodie.", description_es: "Sudadera cálida con capucha." },
  { slug: "jacket", name: "Handled work jacket", name_es: "Chamarra de trabajo Handled", category: "merch", points: 12000, cost_usd: 120, description: "Insulated, water-resistant.", description_es: "Aislada y resistente al agua." },
  { slug: "gas-50", name: "$50 gas card", name_es: "Tarjeta de gasolina de $50", category: "gift_card", points: 5000, cost_usd: 50, description: "For the miles you drive.", description_es: "Para las millas que maneja." },
  { slug: "tools-100", name: "$100 tool store gift card", name_es: "Tarjeta de regalo de $100 para ferretería", category: "gift_card", points: 10000, cost_usd: 100, description: "Home-improvement store gift card.", description_es: "Tarjeta de una tienda de mejoras para el hogar." },
  { slug: "drill-kit", name: "Cordless drill & driver kit", name_es: "Kit de taladro y atornillador inalámbrico", category: "tools", points: 20000, cost_usd: 200, description: "Brushless, two batteries.", description_es: "Sin escobillas, dos baterías." },
  { slug: "earbuds", name: "Wireless earbuds", name_es: "Audífonos inalámbricos", category: "electronics", points: 15000, cost_usd: 150, description: "Noise-cancelling.", description_es: "Con cancelación de ruido." },
  { slug: "tv-55", name: '55" 4K TV', name_es: 'Televisión 4K de 55"', category: "electronics", points: 45000, cost_usd: 450, description: "Smart TV, delivered.", description_es: "Smart TV, con entrega." },
  { slug: "tablet", name: "Tablet", name_es: "Tableta", category: "electronics", points: 35000, cost_usd: 350, description: "For quotes, photos and the app.", description_es: "Para cotizaciones, fotos y la app." },
  { slug: "game-day", name: "Detroit game-day tickets (2)", name_es: "Boletos para un partido en Detroit (2)", category: "experience", points: 30000, cost_usd: 300, description: "Two tickets to a home game.", description_es: "Dos boletos para un partido en casa." },
  { slug: "weekend-trip", name: "Weekend getaway (2 nights)", name_es: "Escapada de fin de semana (2 noches)", category: "travel", points: 90000, cost_usd: 900, description: "Hotel for two nights in Michigan or nearby.", description_es: "Hotel por dos noches en Michigan o cerca." },
  { slug: "trip-for-two", name: "4-day trip for two", name_es: "Viaje de 4 días para dos", category: "travel", points: 200000, cost_usd: 2000, description: "Flights and hotel, booked with you.", description_es: "Vuelos y hotel, reservados con usted." },
];

export type RedemptionStatus = "requested" | "approved" | "ordered" | "shipped" | "delivered" | "cancelled";
export const REDEMPTION_LABEL: Record<RedemptionStatus, { en: string; es: string }> = {
  requested: { en: "Requested", es: "Solicitado" }, approved: { en: "Approved", es: "Aprobado" }, ordered: { en: "Ordered", es: "Pedido" },
  shipped: { en: "Shipped", es: "Enviado" }, delivered: { en: "Delivered", es: "Entregado" }, cancelled: { en: "Cancelled — points returned", es: "Cancelado: puntos devueltos" },
};

/** Plain-language rules shown on the Rewards page and in the Rewards Terms. */
export const REWARD_RULES_EN = (s: RewardSettings = REWARD_DEFAULTS) => [
  `You earn ${s.earnRate} points for every $1 Handled earns on your jobs (what we keep after your pay).`,
  `Great work earns more: ×${s.qualityMultiplier} when a job passes review the first time with no redo or refund and a ${s.minRatingForQuality}★+ rating.`,
  `Staying earns more: ×1.1 after 6 months, ×1.25 after 1 year, ×1.5 after 2 years.`,
  `New points are pending for ${s.pendingDays} days, then you can spend them. Refunded jobs don't earn points.`,
  "Milestones (10, 50, 100… jobs; 1, 2, 3 years; five-star reviews) add bonus points.",
  `Points never depend on taking or passing on offers. They expire only after ${s.inactivityExpiryMonths} months with no completed job.`,
  "Redeem for gear, gift cards, tools, electronics and trips. Points have no cash value. Rewards count as income and appear on your 1099.",
];
export const REWARD_RULES_ES = (s: RewardSettings = REWARD_DEFAULTS) => [
  `Gana ${s.earnRate} puntos por cada $1 que Handled gana en sus trabajos (nuestra parte después de su pago).`,
  `El buen trabajo gana más: ×${s.qualityMultiplier} cuando un trabajo pasa la revisión a la primera, sin repetición ni reembolso y con calificación de ${s.minRatingForQuality}★ o más.`,
  "Quedarse gana más: ×1.1 después de 6 meses, ×1.25 después de 1 año, ×1.5 después de 2 años.",
  `Los puntos nuevos quedan pendientes ${s.pendingDays} días; después los puede usar. Los trabajos reembolsados no ganan puntos.`,
  "Las metas (10, 50, 100… trabajos; 1, 2, 3 años; reseñas de cinco estrellas) dan puntos extra.",
  `Los puntos nunca dependen de aceptar o rechazar ofertas. Solo vencen después de ${s.inactivityExpiryMonths} meses sin un trabajo completado.`,
  "Cámbielos por artículos, tarjetas de regalo, herramientas, electrónicos y viajes. Los puntos no tienen valor en efectivo. Los premios cuentan como ingreso y aparecen en su 1099.",
];
