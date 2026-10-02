/*
 * FILE    : packages/core/src/intake.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2334 UTC
 * PURPOSE : Getting the price right before anyone pays, so jobs are never underbid.
 *             • photoRule()       — which photos the customer must or should add per service
 *             • applyCorrections() — quantities the AI corrects from the photos (e.g. the
 *                                    driveway is 1,400 sq ft, not 800), re-priced by the rules engine
 *             • aiPriceDecision() — the AI may raise a price up to 40% and cut at most 10%;
 *                                    bigger than that becomes a free site visit, never a capped price
 *             • scopeChange()     — the pro on site finds more work → priced difference = change order
 *             • sizeNeedsSiteVisit() — jobs too big for an instant price (a commercial repaint, 15+
 *                                    rooms) always get a free site visit and a firm quote
 */
import { AI_MAX_CUT, AI_MAX_RAISE, estimate, type Estimate } from "./pricing.ts";
import { getService, type Answers } from "./services.ts";
import type { Frequency } from "./types.ts";
import { t } from "./i18n.ts";

export interface PhotoRule {
  need: "required" | "recommended" | "none";
  min: number;
  /** What to photograph, shown to the customer as a checklist. */
  tips: string[];
}

const R = (min: number, ...tips: string[]): PhotoRule => ({ need: "required", min, tips });
const O = (...tips: string[]): PhotoRule => ({ need: "recommended", min: 0, tips });

const RULES: Record<string, PhotoRule> = {
  "house-cleaning": O("Kitchen", "Bathrooms", "Main living area"),
  "window-cleaning": O("Front of the home", "Back of the home"),
  "carpet-cleaning": R(1, "Each room, wide shot", "The worst stains up close", "Any upholstery"),
  organizing: R(2, "Each space to organize, wide shot", "Inside closets or cabinets"),
  "gutter-cleaning": O("Roofline from the street", "Back of the home"),
  "power-washing": R(2, "The whole surface, wide shot", "The worst stains or mildew up close", "Anything nearby to protect"),
  "lawn-care": O("Front yard", "Back yard"),
  "leaf-removal": O("Front yard", "Back yard"),
  "snow-removal": O("Driveway and walkways"),
  "tree-removal": R(2, "The whole tree", "Base of the trunk", "Nearby house, fence or power lines"),
  "pet-waste-removal": O("The yard"),
  "junk-removal": R(2, "Everything that's going, wide shot", "Anything heavy or bulky", "The path out (stairs, doorways)"),
  "large-item-removal": R(1, "Each item", "Labels showing model or weight on heavy items", "The path out (stairs, doorways)"),
  "junk-container": O("Where the container goes (driveway or street)", "Anything overhead (wires, branches)"),
  handyman: R(1, "Each thing to fix or install", "Close-up of the problem"),
  plumbing: R(1, "The leak, clog or fixture", "Under the sink / shut-off valves"),
  "water-heater": R(2, "The whole water heater", "Its label (model & gallons)", "Venting and gas or electric hookup"),
  "hvac-install": R(2, "Furnace or air handler", "Outdoor unit", "Model labels"),
  "lighting-install": R(1, "Where the light goes", "Existing fixture or switch"),
  "camera-install": O("Where each camera goes", "Your Wi-Fi router"),
  "garbage-disposal": R(1, "Under the sink, showing the disposal and pipes"),
  "interior-painting": R(2, "Each room or area, wide shot", "Any cracks, holes or water stains", "Ceilings and trim if included"),
  "exterior-painting": R(3, "Each side of the building", "Peeling or damaged areas up close", "Trim, doors and any deck"),
  "bathroom-remodel": R(3, "Each wall of the room", "Floor", "Anything you're keeping"),
  "kitchen-remodel": R(3, "Each wall of the kitchen", "Floor and ceiling", "Anything you're keeping"),
  "home-remodel": R(3, "Each area to remodel", "Floors", "Anything you're keeping"),
};

export function photoRule(slug: string): PhotoRule {
  return RULES[slug] ?? { need: "none", min: 0, tips: [] };
}

/** null when the photos are enough, otherwise what to tell the customer. */
export function photoProblem(slug: string, count: number, locale: string = "en"): string | null {
  const r = photoRule(slug);
  if (r.need !== "required" || count >= r.min) return null;
  if (locale === "es") return `Agregue al menos ${r.min} foto${r.min > 1 ? "s" : ""} (${r.tips.slice(0, r.min + 1).map((x) => t("es", x)).join(", ").toLowerCase()}) para que su precio sea correcto desde el principio.`;
  return `Please add at least ${r.min} photo${r.min > 1 ? "s" : ""} (${r.tips.slice(0, r.min + 1).join(", ").toLowerCase()}) so your price is right the first time.`;
}

export interface AnswerCorrection {
  question_id: string;
  value: string | number | boolean;
  reason: string;
}

/** Apply the AI's corrections to the customer's answers, kept within each question's limits. */
export function applyCorrections(slug: string, answers: Answers, corrections: AnswerCorrection[]) {
  const svc = getService(slug);
  const out: Answers = { ...answers };
  const changes: { label: string; from: string; to: string; reason: string }[] = [];
  for (const c of corrections) {
    const q = svc?.questions.find((x) => x.id === c.question_id);
    if (!q) continue;
    let v: string | number | boolean | undefined;
    if (q.type === "number") {
      const n = Number(c.value);
      if (!Number.isFinite(n)) continue;
      v = Math.min(q.max, Math.max(q.min, Math.round(n)));
    } else if (q.type === "select") {
      if (!q.options.some((o) => o.value === String(c.value))) continue;
      v = String(c.value);
    } else {
      v = c.value === true || c.value === "true";
    }
    if (v === out[q.id]) continue;
    const show = (x: unknown) => (q.type === "select" ? q.options.find((o) => o.value === x)?.label ?? String(x) : q.type === "toggle" ? (x ? "Yes" : "No") : `${x}${q.unit ? ` ${q.unit}` : ""}`);
    changes.push({ label: q.label, from: show(out[q.id] ?? q.default), to: show(v), reason: c.reason });
    out[q.id] = v;
  }
  return { answers: out, changes };
}

export type PriceAction = "price" | "site_visit";

/**
 * Decide the final instant price from the rules-engine baseline (after corrections) and the
 * AI's proposal. Never underbid: a cut is limited to 10%, and when the work looks more than
 * 40% bigger than an instant price allows, the job becomes a free site visit for a firm quote.
 */
export function aiPriceDecision(baseline: Estimate, proposed: number, o: { needsSiteVisit?: boolean; confidence?: "low" | "medium" | "high" }): { action: PriceAction; final: number; reason: string } {
  const svc = getService(baseline.slug)!;
  if (o.needsSiteVisit) return { action: "site_visit", final: baseline.point, reason: "The photos show work that needs a pro's eyes for a firm price." };
  if (proposed > baseline.point * (1 + AI_MAX_RAISE)) return { action: "site_visit", final: baseline.point, reason: "The job looks much bigger than the details entered, so a pro confirms the firm price in person (free)." };
  const floor = Math.max(svc.minimum * (1 - baseline.discount), baseline.point * (1 - AI_MAX_CUT));
  // low confidence can raise the price but never lower it
  const target = o.confidence === "low" ? Math.max(proposed, baseline.point) : proposed;
  const final = Math.round(Math.min(baseline.point * (1 + AI_MAX_RAISE), Math.max(floor, target)));
  return { action: "price", final, reason: final > baseline.point ? "Adjusted up for what the photos and notes show." : final < baseline.point ? "Adjusted down slightly for what the photos and notes show." : "Matches your details." };
}

/**
 * The pro on site finds more work than booked: re-price with the corrected answers and charge
 * only the difference in the rules-engine price (so earlier AI adjustments carry over).
 */
export function scopeChange(slug: string, booked: Answers, actual: Answers, frequency: Frequency = "once", rush = false) {
  const before = estimate({ slug, answers: booked, frequency, rush });
  const after = estimate({ slug, answers: actual, frequency, rush });
  return { before: before.point, after: after.point, extra: Math.max(0, Math.round(after.point - before.point)) };
}

/** Answers that make a normally instant-priced job too big to price without a visit. */
const SITE_VISIT_IF: Record<string, (a: Answers) => string | null> = {
  "interior-painting": (a) => (Number(a.rooms ?? 0) > 15 ? "More than 15 rooms" : null),
  "exterior-painting": (a) => (a.building === "commercial" ? "Commercial building" : Number(a.sqft ?? 0) > 5000 ? "Building over 5,000 sq ft" : null),
  "power-washing": (a) => (Number(a.sqft ?? 0) > 5000 ? "Over 5,000 sq ft" : null),
  "event-shuttle": (a) => (Number(a.vehicles ?? 0) > 4 ? "More than 4 shuttles (we plan the loops with you)" : null),
  "charter-bus": (a) => (a.out_of_state === true || a.out_of_state === "true" ? "Out-of-state trip (routing and federal authority confirmed first)" : Number(a.days ?? 0) > 3 ? "Trip longer than 3 days" : null),
  "large-item-removal": (a) => (Number(a.heaviest ?? 0) > 1000 ? "An item over 1,000 lb" : Number(a.specialty ?? 0) > 2 ? "More than 2 specialty items" : null),
  "junk-removal": (a) => (a.volume === "double" && a.kind === "heavy" ? "Two truckloads of heavy debris" : null),
};

/** Why this job needs a free site visit for a firm price (null = instant price is fine). */
export function sizeNeedsSiteVisit(slug: string, answers: Answers): string | null {
  return SITE_VISIT_IF[slug]?.(answers) ?? null;
}

/** Junk container: pickup date (YYYY-MM-DD) from the drop-off date and rental length. */
export function containerPickup(dropOff: string | null | undefined, days: unknown): string | null {
  if (!dropOff || !/^\d{4}-\d{2}-\d{2}$/.test(dropOff)) return null;
  const d = new Date(`${dropOff}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (Number(days) || 7));
  return d.toISOString().slice(0, 10);
}
