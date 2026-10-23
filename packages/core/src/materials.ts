/*
 * FILE    : packages/core/src/materials.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : Materials bought for a job and billed to the customer at cost, end to end (pure functions, no I/O):
 *             materialsEstimate()  — the low–high materials range a quote shows for services that bill parts at cost
 *                                    (handyman, appliance repair, small engines, locksmith hardware, errands shopping…);
 *                                    the high end is held on the customer's card when the pro starts
 *             APPROVED_VENDORS / matchVendor() — where pros may buy: the built-in list (Hub → Vendors adds to it or
 *                                    turns entries off); a card swipe or a receipt is matched by merchant name
 *             cardCategoriesFor()  — the merchant categories a pro's materials card works at, from their trades
 *             cardDecision()       — real-time yes/no on a materials card swipe: an active job, an approved vendor,
 *                                    an allowed category, in person unless the vendor is an online parts supplier,
 *                                    and within the job's remaining materials allowance
 *             materialsAllowance() / settleMaterials() — the job's cap, and how the receipts are paid at the end
 *                                    (captured from the hold; anything over it needs the customer's OK first)
 *           The card and the vendor list keep pros from fronting money; receipts still back every purchase.
 */
import { getService, type Answers } from "./services.ts";

export interface MaterialsRange { low: number; high: number; note: string }

const roundTo = (v: number, step = 5) => Math.round(v / step) * step;
const n = (a: Answers, k: string, d = 0) => { const v = Number(a[k]); return Number.isFinite(v) && a[k] !== "" && a[k] !== undefined ? v : d; };
const s = (a: Answers, k: string, d: string) => (a[k] === undefined ? d : String(a[k]));
const yes = (a: Answers, k: string) => a[k] === true || a[k] === "true";

/**
 * Services whose price leaves out parts or purchases (billed at cost with receipts). [low, high] per job, Detroit-metro
 * 2026 parts prices. Services that include their materials (painting, fences, plumbing flat rates…) aren't listed.
 */
const ESTIMATES: Record<string, (a: Answers) => [number, number, string] | null> = {
  handyman: (a) => { const t = Math.max(1, n(a, "tasks", 3)); return [t * 10, 25 + t * 35, "Hardware, anchors, caulk and small parts for your tasks"]; },
  "small-engine-repair": (a) => {
    const m = Math.max(1, n(a, "machines", 1));
    const big = ["riding", "generator", "snowblower"].includes(s(a, "equipment", "push"));
    const [lo, hi] = s(a, "service", "tuneup") === "repair" ? (big ? [40, 220] : [25, 120]) : (big ? [20, 60] : [12, 40]);
    return [m * lo, m * hi, "Parts (plug, filters, belts, carburetor kit) for each machine"];
  },
  "appliance-repair": (a) => {
    const c = Math.max(1, n(a, "count", 1));
    if (s(a, "job", "repair") === "install") return [c * 10, c * 60, "Hook-up parts (hoses, cords, vent, supply line)"];
    const [lo, hi] = ({ washer: [40, 220], dryer: [25, 160], fridge: [60, 350], dishwasher: [40, 200], range: [40, 250], microwave: [40, 180] } as Record<string, [number, number]>)[s(a, "appliance", "washer")] ?? [40, 220];
    return [c * lo, c * hi, "Replacement parts, quoted before ordering"];
  },
  locksmith: (a) => {
    const sv = s(a, "service", "rekey"), l = Math.max(1, n(a, "locks", 3));
    if (sv === "install") return [l * 35, l * 120, "New deadbolts or handle sets (skip if you have your own)"];
    if (sv === "rekey") return [0, l * 8, "Extra keys and pins"];
    return null;
  },
  "dock-door-service": (a) => (s(a, "service", "inspection") === "repair" ? [Math.max(1, n(a, "doors", 1)) * 50, Math.max(1, n(a, "doors", 1)) * 600, "Springs, cables, rollers or seals, quoted before any repair"] : null),
  organizing: (a) => (yes(a, "shopping") ? [Math.max(1, n(a, "spaces", 1)) * 50, Math.max(1, n(a, "spaces", 1)) * 250, "Bins, shelving and labels you approve"] : null),
  errands: (a) => (yes(a, "shopping") ? [20, 150, "The items you ask us to buy"] : null),
  "personal-assistant": () => [0, 100, "Anything you ask your assistant to buy"],
};

/** The materials range a quote shows (null when the price already covers materials). Rounded to $5. */
export function materialsEstimate(slug: string, answers: Answers): MaterialsRange | null {
  const r = ESTIMATES[slug]?.(answers);
  if (!r || r[1] <= 0) return null;
  return { low: roundTo(r[0], 5), high: Math.max(roundTo(r[1], 5), roundTo(r[0], 5)), note: r[2] };
}
export const billsMaterialsAtCost = (slug: string) => slug in ESTIMATES;

/** The job's materials cap: the high estimate held on the card, else the policy share of the price. */
export function materialsAllowance(job: { materials_high?: number | null; price_final?: number | null }, maxShareOfPrice: number): number {
  const high = Number(job.materials_high ?? 0);
  if (high > 0) return high;
  return Math.round(Number(job.price_final ?? 0) * maxShareOfPrice * 100) / 100;
}

/** At the end of the job: take what the receipts add up to from the hold; anything over it needs the customer's OK. */
export function settleMaterials(total: number, held: number): { capture: number; extra: number } {
  const t = Math.max(0, Math.round(total * 100) / 100), h = Math.max(0, held);
  return { capture: Math.min(t, h), extra: Math.round(Math.max(0, t - h) * 100) / 100 };
}

// ─── Approved vendors ─────────────────────────────────────────────────────────

export type VendorGroup = "building" | "plumbing_hvac" | "electrical" | "paint" | "garden" | "auto_parts" | "appliance_parts" | "general" | "grocery_pharmacy";

export interface Vendor {
  id: string;
  name: string;
  /** Card statement names look like "THE HOME DEPOT #2745" — matched case-insensitively, ignoring punctuation. */
  match: string[];
  groups: VendorGroup[];
  /** Online suppliers: card-not-present purchases allowed (shipped to the job or the pro). */
  online?: boolean;
  /** Turned off in the Hub. */
  active?: boolean;
}

/** Built-in approved vendors (national chains and suppliers with metro Detroit branches, plus online parts suppliers). */
export const APPROVED_VENDORS: Vendor[] = [
  { id: "home_depot", name: "The Home Depot", match: ["home depot", "homedepot"], groups: ["building", "plumbing_hvac", "electrical", "paint", "garden", "appliance_parts"] },
  { id: "lowes", name: "Lowe's", match: ["lowes", "lowe s"], groups: ["building", "plumbing_hvac", "electrical", "paint", "garden", "appliance_parts"] },
  { id: "menards", name: "Menards", match: ["menards"], groups: ["building", "plumbing_hvac", "electrical", "paint", "garden"] },
  { id: "ace", name: "Ace Hardware", match: ["ace hardware", "ace hdwe", "ace hdw"], groups: ["building", "plumbing_hvac", "electrical", "paint", "garden"] },
  { id: "true_value", name: "True Value", match: ["true value"], groups: ["building", "plumbing_hvac", "electrical", "paint", "garden"] },
  { id: "harbor_freight", name: "Harbor Freight", match: ["harbor freight"], groups: ["building", "auto_parts"] },
  { id: "sherwin", name: "Sherwin-Williams", match: ["sherwin williams", "sherwin-williams"], groups: ["paint"] },
  { id: "ferguson", name: "Ferguson", match: ["ferguson"], groups: ["plumbing_hvac"] },
  { id: "johnstone", name: "Johnstone Supply", match: ["johnstone supply", "johnstone"], groups: ["plumbing_hvac", "electrical"] },
  { id: "grainger", name: "Grainger", match: ["grainger"], groups: ["building", "plumbing_hvac", "electrical"], online: true },
  { id: "fastenal", name: "Fastenal", match: ["fastenal"], groups: ["building", "electrical"] },
  { id: "supplyhouse", name: "SupplyHouse.com", match: ["supplyhouse"], groups: ["plumbing_hvac", "electrical"], online: true },
  { id: "siteone", name: "SiteOne Landscape Supply", match: ["siteone"], groups: ["garden"] },
  { id: "advance_auto", name: "Advance Auto Parts", match: ["advance auto"], groups: ["auto_parts"] },
  { id: "autozone", name: "AutoZone", match: ["autozone"], groups: ["auto_parts"] },
  { id: "oreilly", name: "O'Reilly Auto Parts", match: ["oreilly", "o reilly"], groups: ["auto_parts"] },
  { id: "repairclinic", name: "RepairClinic.com", match: ["repairclinic", "repair clinic"], groups: ["appliance_parts", "auto_parts"], online: true },
  { id: "appliance_parts_pros", name: "AppliancePartsPros.com", match: ["appliancepartspros", "appliance parts pros"], groups: ["appliance_parts"], online: true },
  { id: "container_store", name: "The Container Store", match: ["container store"], groups: ["general"] },
  { id: "target", name: "Target", match: ["target"], groups: ["general", "grocery_pharmacy"] },
  { id: "walmart", name: "Walmart", match: ["walmart", "wal mart", "wm supercenter"], groups: ["general", "grocery_pharmacy", "auto_parts"] },
  { id: "meijer", name: "Meijer", match: ["meijer"], groups: ["general", "grocery_pharmacy", "garden"] },
  { id: "costco", name: "Costco", match: ["costco"], groups: ["general", "grocery_pharmacy"] },
  { id: "kroger", name: "Kroger", match: ["kroger"], groups: ["grocery_pharmacy"] },
  { id: "cvs", name: "CVS Pharmacy", match: ["cvs"], groups: ["grocery_pharmacy"] },
  { id: "walgreens", name: "Walgreens", match: ["walgreens"], groups: ["grocery_pharmacy"] },
];

/** Which vendor groups each trade buys from. A trade not listed can't use a materials card. */
export const TRADE_VENDOR_GROUPS: Record<string, VendorGroup[]> = {
  handyman: ["building", "plumbing_hvac", "electrical", "paint"],
  assembly: ["building"],
  plumbing: ["building", "plumbing_hvac"],
  electrical: ["building", "electrical"],
  hvac: ["plumbing_hvac", "electrical"],
  low_voltage: ["building", "electrical"],
  remodel: ["building", "plumbing_hvac", "electrical", "paint"],
  gutters: ["building"],
  pressure_washing: ["building", "paint"],
  dumpster: ["building"],
  small_engine: ["auto_parts", "building"],
  appliance: ["appliance_parts", "building"],
  locksmith: ["building"],
  dock_door: ["building", "electrical"],
  organizing: ["general"],
  errands: ["general", "grocery_pharmacy"],
};

/** Stripe Issuing merchant categories for each vendor group (the card's spending controls). */
export const GROUP_CATEGORIES: Record<VendorGroup, string[]> = {
  building: ["hardware_stores", "home_supply_warehouse_stores", "lumber_building_materials_stores", "hardware_equipment_and_supplies", "industrial_supplies", "construction_materials"],
  plumbing_hvac: ["plumbing_heating_equipment_and_supplies", "heating_plumbing_a_c", "hardware_equipment_and_supplies", "industrial_supplies"],
  electrical: ["electrical_parts_and_equipment", "hardware_equipment_and_supplies", "industrial_supplies"],
  paint: ["paints_varnishes_and_supplies", "glass_paint_and_wallpaper_stores"],
  garden: ["nurseries_lawn_and_garden_supply_stores", "florists_supplies_nursery_stock_and_flowers"],
  auto_parts: ["automotive_parts_and_accessories_stores", "auto_and_home_supply_stores", "motor_vehicle_supplies_and_new_parts"],
  appliance_parts: ["household_appliance_stores", "small_appliance_repair", "electrical_parts_and_equipment"],
  general: ["discount_stores", "department_stores", "miscellaneous_general_merchandise", "wholesale_clubs", "miscellaneous_home_furnishing_specialty_stores"],
  grocery_pharmacy: ["grocery_stores_supermarkets", "drug_stores_and_pharmacies", "wholesale_clubs", "discount_stores", "miscellaneous_general_merchandise"],
};

export const groupsForTrades = (trades: string[]): VendorGroup[] => [...new Set(trades.flatMap((t) => TRADE_VENDOR_GROUPS[t] ?? []))];

/** Merchant categories a pro's materials card works at (empty → the pro gets no card). */
export function cardCategoriesFor(trades: string[]): string[] {
  return [...new Set(groupsForTrades(trades).flatMap((g) => GROUP_CATEGORIES[g]))].sort();
}

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The approved vendor a merchant name belongs to (built-in list merged with the Hub's additions and switches). */
export function matchVendor(merchantName: string | null | undefined, vendors: Vendor[] = APPROVED_VENDORS): Vendor | null {
  const m = ` ${norm(merchantName ?? "")} `;
  if (!m.trim()) return null;
  return vendors.find((v) => v.active !== false && v.match.some((p) => m.includes(` ${norm(p)} `))) ?? null;
}

/** Built-in list + the Hub's rows: a Hub row with a built-in id overrides it (e.g. turned off); others are added. */
export function mergeVendors(custom: Vendor[] | null | undefined): Vendor[] {
  const extra = custom ?? [];
  const byId = new Map(extra.map((v) => [v.id, v]));
  return [...APPROVED_VENDORS.map((v) => ({ ...v, ...(byId.get(v.id) ?? {}) })), ...extra.filter((v) => !APPROVED_VENDORS.some((b) => b.id === v.id))];
}

/** Approved vendors a pro in these trades may use (for the pro's job page and the receipt form). */
export function vendorsForTrades(trades: string[], vendors: Vendor[] = APPROVED_VENDORS): Vendor[] {
  const g = new Set(groupsForTrades(trades));
  return vendors.filter((v) => v.active !== false && v.groups.some((x) => g.has(x)));
}

export interface SwipeInput {
  amount: number;
  merchantName: string | null;
  category: string | null;
  cardPresent: boolean;
  /** The job the pro is working (null when they haven't started one). */
  job: { id: string; status: string; service_slug: string } | null;
  /** The pro's trades that the job's service uses. */
  jobTrades: string[];
  /** Materials already on this job (approved swipes and receipts). */
  spent: number;
  allowance: number;
}

export type SwipeDecision = { approved: true; vendor: Vendor } | { approved: false; reason: string };

/** Real-time decision on a materials card swipe. */
export function cardDecision(i: SwipeInput, vendors: Vendor[] = APPROVED_VENDORS): SwipeDecision {
  if (!i.job || i.job.status !== "in_progress") return { approved: false, reason: "No job in progress — start the job in the app first" };
  const vendor = matchVendor(i.merchantName, vendors);
  if (!vendor) return { approved: false, reason: `${i.merchantName ?? "This store"} isn't an approved vendor` };
  const groups = new Set(groupsForTrades(i.jobTrades));
  if (!vendor.groups.some((g) => groups.has(g))) return { approved: false, reason: `${vendor.name} isn't approved for ${getService(i.job.service_slug)?.name ?? "this job"}` };
  if (i.category && !cardCategoriesFor(i.jobTrades).includes(i.category)) return { approved: false, reason: `Purchase type (${i.category.replace(/_/g, " ")}) isn't allowed on this card` };
  if (!i.cardPresent && !vendor.online) return { approved: false, reason: `Online orders only from approved online suppliers` };
  const left = Math.round((i.allowance - i.spent) * 100) / 100;
  if (i.amount > left + 0.005) return { approved: false, reason: `Over this job's materials limit (${left > 0 ? `$${left.toFixed(2)} left` : "nothing left"}) — ask us for a customer-approved increase` };
  return { approved: true, vendor };
}
