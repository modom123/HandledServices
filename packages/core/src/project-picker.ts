/*
 * FILE    : packages/core/src/project-picker.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-27_1500 UTC
 * PURPOSE : "Get it Handled" (/post) picker (owner, 2026-11-27: the list of all ~105 services is too long; show
 *           categories, then click to get more specific). Pure data:
 *           The path starts with Home or Business (owner, 2026-11-27: "start off as home or business, then it walks you
 *           through a logical path"):
 *             Home      → category (home categories only) → service
 *             Business  → what kind of business (INDUSTRIES) → that industry's usual services, or "something else" →
 *                         category (business categories) → service
 *             PICKER_CATEGORIES   the category tiles for each path, most-asked first
 *             pickerGroups(cat)   the services in a category, in sub-groups where a category is big (Repairs has 37):
 *                                 every service in the category appears in exactly one group (a test checks)
 *             popularPicks()      the 4–5 services most people choose on each path (from real bookings, with defaults
 *                                 until there are enough), shown first after Home / Business
 *             GET_IT_HANDLED      the short flow: 3 photos, then ZIP, when and an optional note
 */
import { CATEGORIES, SERVICES } from "./services.ts";
import type { CategoryId } from "./types.ts";

export const GET_IT_HANDLED = {
  /** Photos we ask for: enough for the AI to size most jobs. */
  photos: 3,
  /** The most a customer can add. */
  maxPhotos: 6,
} as const;

export type PickerAudience = "home" | "business";

/** Category tiles on /post for each path, most-asked first. */
export const PICKER_CATEGORIES: Record<PickerAudience, CategoryId[]> = {
  home: ["cleaning", "repair_remodel", "outdoor", "removal", "pets", "errands", "events", "transport"],
  business: ["cleaning", "repair_remodel", "outdoor", "removal", "security", "errands", "events", "transport", "business"],
};

/** Services only a business buys: hidden on the Home path. */
export const BUSINESS_ONLY = new Set(["dock-door-service", "fire-extinguisher-inspection", "waste-oil-collection", "retail-delivery", "freight-delivery", "medical-delivery"]);
/** Services only a household buys: hidden on the Business path. */
export const HOME_ONLY = new Set(["organizing", "chimney-sweep", "holiday-lights", "home-watch", "laundry-pickup", "smart-home-setup"]);
const fits = (slug: string, a?: PickerAudience) => !a || (a === "home" ? !BUSINESS_ONLY.has(slug) : !HOME_ONLY.has(slug));

/** Sub-groups for categories too big to show as one list. Anything not listed lands in "More". */
const SUBGROUPS: Partial<Record<CategoryId, { label: string; labelEs: string; slugs: string[] }[]>> = {
  repair_remodel: [
    { label: "Fix, assemble & install", labelEs: "Arreglar, armar e instalar", slugs: ["handyman", "furniture-assembly", "appliance-repair", "garbage-disposal", "locksmith", "garage-door", "smart-home-setup", "camera-install", "lighting-install", "small-engine-repair"] },
    { label: "Plumbing, heating & cooling", labelEs: "Plomería, calefacción y aire", slugs: ["plumbing", "water-heater", "hvac-install"] },
    { label: "Painting & floors", labelEs: "Pintura y pisos", slugs: ["interior-painting", "exterior-painting", "flooring"] },
    { label: "Outside the building", labelEs: "Exterior del edificio", slugs: ["roofing", "siding", "gutter-install", "window-door-install", "fence-install", "deck-build", "carpentry", "masonry", "concrete-repair", "driveway-sealcoating", "foundation-repair", "insulation"] },
    { label: "Damage & inspections", labelEs: "Daños e inspecciones", slugs: ["water-damage", "mold-removal", "property-inspection", "fire-extinguisher-inspection"] },
    { label: "Remodels", labelEs: "Remodelaciones", slugs: ["bathroom-remodel", "kitchen-remodel", "home-remodel"] },
    { label: "Rentals & business property", labelEs: "Rentas y propiedades comerciales", slugs: ["unit-turnover", "dock-door-service"] },
  ],
};

export interface PickerGroup { label: string | null; labelEs: string | null; slugs: string[] }

/** The services in a category, grouped where it's big; one group with no label otherwise. */
export function pickerGroups(cat: CategoryId, audience?: PickerAudience): PickerGroup[] {
  const inCat = SERVICES.filter((s) => s.category === cat && fits(s.slug, audience)).map((s) => s.slug);
  const subs = SUBGROUPS[cat];
  if (!subs) return [{ label: null, labelEs: null, slugs: inCat }];
  const used = new Set<string>();
  const groups: PickerGroup[] = subs.map((g) => ({ label: g.label, labelEs: g.labelEs, slugs: g.slugs.filter((x) => inCat.includes(x) && !used.has(x) && used.add(x)) })).filter((g) => g.slugs.length);
  const rest = inCat.filter((x) => !used.has(x));
  if (rest.length) groups.push({ label: "More", labelEs: "Más", slugs: rest });
  return groups;
}

/** Categories that have services on this path (both paths, deduped, when none is given), in picker order. */
export const pickerCategories = (audience?: PickerAudience) =>
  [...new Set(audience ? PICKER_CATEGORIES[audience] : [...PICKER_CATEGORIES.home, ...PICKER_CATEGORIES.business])]
    .map((id) => CATEGORIES.find((c) => c.id === id)!).filter((c) => c && SERVICES.some((s) => s.category === c.id && fits(s.slug, audience)));

/** Until there are enough bookings to rank, the services most people ask for on each path. */
export const POPULAR_DEFAULTS: Record<PickerAudience, string[]> = {
  home: ["house-cleaning", "handyman", "junk-removal", "lawn-care", "power-washing"],
  business: ["house-cleaning", "handyman", "junk-removal", "power-washing", "snow-removal"],
};

/**
 * The quick picks for a path: the most-booked services (counts by slug), topped up from the defaults, only services
 * on that path, `n` of them. Needs at least `minBookings` in total before real counts lead. Pure.
 */
export function popularPicks(audience: PickerAudience, counts: Record<string, number> = {}, n = 5, minBookings = 20): string[] {
  const ok = new Set(pickerCategories(audience).flatMap((c) => pickerGroups(c.id, audience).flatMap((g) => g.slugs)));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const ranked = total >= minBookings ? Object.entries(counts).filter(([slug, c]) => c > 0 && ok.has(slug)).sort((a, b) => b[1] - a[1]).map(([slug]) => slug) : [];
  return [...new Set([...ranked, ...POPULAR_DEFAULTS[audience].filter((x) => ok.has(x))])].slice(0, n);
}
