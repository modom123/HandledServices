/*
 * FILE    : packages/core/src/services.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : The service catalog. Each service declares the questions the booking flow
 *           asks, a deterministic price model (the "floor" the AI quote refines), the
 *           share of the price paid to the subcontractor, and whether a site visit is
 *           required before a firm quote. Prices are launch defaults for a mid-cost US
 *           metro — tune them per market in the ops hub (services table overrides).
 * UPDATED : 2026-10-02_0233 UTC — calculator audit: questions can be shown only when another
 *           answer applies (showIf, e.g. mini-split zones), and rides move up to a vehicle
 *           big enough for the passenger count, so the price rises as passengers are added.
 * UPDATED : 2026-10-02_0244 UTC — grocery pickup & delivery, mobile car detailing, medical deliveries.
 * UPDATED : 2026-10-02_0251 UTC — game day & concert rides (sporting events, concerts, festivals).
 * UPDATED : 2026-10-03_0147 UTC — market recalibration (Detroit metro 2026): house cleaning re-weighted to a visit
 *           base + bed/bath (standard 3/2 ≈ $193, deep ≈ $309, move ≈ $367); lawn mowing raised so pros clear
 *           local rates after plan discounts; snow per-visit lowered to market; grocery & medical delivery,
 *           dog-poop scooping and full car detail nudged up so pro payouts meet local independent rates.
 * UPDATED : 2026-10-03_1247 UTC — water heater recalibrated to a standard-grade unit (50-gal gas ≈ $1,250
 *           suggested, was ≈ $2,030) with our commission capped at 15% (maxCommission) so the pro
 *           still clears a fair labor margin after buying the tank.
 * UPDATED : 2026-10-03_1311 UTC — water heater: value-brand replacement, install-only (customer's new unit) and
 *           repair options. New units only, never used.
 * UPDATED : 2026-10-04_1934 UTC — new services from the growth plan: small moves, same-day large item delivery (stores),
 *           home staging furniture moves and rental unit turnover (property managers). Hauling trade covers moves.
 * UPDATED : 2026-10-04_1950 UTC — grocery pickup & delivery replaced by Same-Day Courier (documents, packages, parts; business routes).
 * UPDATED : 2026-10-05_0438 UTC — Event Security (licensed Michigan security agencies; unarmed by default, armed on request) and the security trade.
 * UPDATED : 2026-10-05_1433 UTC — Security category: Security Guards & Patrol (standing post, mobile patrol, fire watch; once, weekly or monthly). Plan My Event asks about alcohol and budgets licensed guards.
 * UPDATED : 2026-10-06_0526 UTC — Dead Animal Removal (removal category; new wildlife trade): priced by animal size, where it is
 *           (open ground, under a deck or crawlspace, attic or wall) and how many, with sanitizing and pet aftercare.
 * UPDATED : 2026-10-06_0637 UTC — six new services (60 total): Small Engine Repair, Loading Dock & Overhead Door Service,
 *           Fire Extinguisher Inspection & Service, Foundation Repair, Used Oil Collection and Urgent Ride (Non-Medical,
 *           "call 911" for medical emergencies; onDemand, so no rush surcharge). New trades: small_engine, dock_door,
 *           fire_safety, foundation, waste_oil.
 * UPDATED : 2026-10-06_0740 UTC — removed the fixed per-service payoutShare (it said 65–70% while real pay slides with
 *           job size). What a pro earns now comes from one place only: splitJob() / proShare() in pricing.ts.
 * UPDATED : 2026-10-07_0225 UTC — real measurements for size- and weight-based services (lawn, leaves, snow, trees, pet waste,
 *           junk, dead animal, deliveries, courier, interior painting): required numbers that pick the calibrated size band
 *           (applyMeasurements) so prices stay the same and the pro sees the exact size.
 * UPDATED : 2026-10-11_0608 UTC — Business & Technology category (65 services): Website Design & Build, Business Formation,
 *           Business Consulting, AI Automation and Custom AI Agents. Remote (Service.remote): any US ZIP, a free video
 *           consultation sets the firm price, state filing fees billed at cost. New trades: web_design, business_formation,
 *           consulting, ai_automation.
 * UPDATED : 2026-10-11_1405 UTC — Freight & Pallet Delivery (66 services): cargo van, 26-ft box truck with liftgate or a 53-ft
 *           truckload, moved up to the vehicle that fits the pallets and weight; weekly or monthly routes. New trade: freight
 *           (licensed: USDOT number on file; commercial auto + cargo insurance required).
 * UPDATED : 2026-10-11_2307 UTC — "We build": Website Design & Build is now Intelligent Websites (AI assistant built in,
 *           instant lead follow-up option; same slug), plus Business Operating System and Automated Business (68 services).
 * UPDATED : 2026-10-12_0117 UTC — Mold Removal (certified remediation: containment, removal, HEPA, optional testing) and the mold trade.
 * UPDATED : 2026-10-19_1320 UTC — insuranceOptional: services with no work on the customer's property with tools or equipment
 *           (remote business work; errands, courier, personal assistant) don't need a general liability certificate, so pros
 *           without one still get those jobs. Trade coverages (bond, business-use auto) still apply.
 * UPDATED : 2026-10-23_1900 UTC — six new services (75 total): Landscaping & Bed Care (mulch, bed edging, shrub trimming,
 *           planting, sod, seeding), Furniture Assembly & TV Mounting (per piece), Roof Repair & Replacement, Masonry & Brick
 *           Repair, Concrete Steps, Patios & Sidewalks, and Demolition & Tear-Out. Detroit-metro 2026 rates noted in each
 *           price(). New trades: assembly, roofing, masonry, concrete, demolition (the last four licensed); lawn is now
 *           "Lawn care & landscaping".
 * UPDATED : 2026-10-23_2100 UTC — 25 more services (100 total), none overlapping an existing one: fences, decks, siding, gutter
 *           installation, windows & doors, insulation, garage doors, driveway sealcoating, flooring, appliance repair, smart
 *           home & Wi-Fi, water damage, locksmith, property inspection, duct & dryer vent cleaning, tile & grout, trash bins,
 *           chimney sweep, sprinklers, holiday lights, pools, pest control, live wildlife removal, laundry pickup, home watch.
 * UPDATED : 2026-10-23_2330 UTC — TUCKED_CATEGORIES / MAIN_CATEGORIES: Business & Technology stays off the default
 *           lists and opens from a button.
 */

import type { CategoryId, Frequency } from "./types.ts";
import { planEventBudget } from "./event-budget.ts";

export type Answers = Record<string, number | string | boolean | undefined>;

/** Show a question only when another answer is one of these values. */
export type ShowIf = { id: string; is: (string | boolean)[] };

export type Question =
  | {
      id: string; label: string; type: "number"; min: number; max: number; default: number; unit?: string; help?: string; showIf?: ShowIf;
      /** a real measurement the customer must enter (0 = not entered yet) */
      required?: boolean;
      /** this measurement picks the size band of another (select) question: [up to and including, option value] */
      sets?: { id: string; tiers: [number, string][]; scaleAbove?: number };
    }
  | { id: string; label: string; type: "select"; options: { value: string; label: string }[]; default: string; help?: string; showIf?: ShowIf }
  | { id: string; label: string; type: "toggle"; default: boolean; help?: string; showIf?: ShowIf };

/** Should this question be shown for these answers? A size band filled in from a measurement is never asked. */
export function questionVisible(q: Question, answers: Answers, all: Question[] = []): boolean {
  if (q.type === "select" && all.some((x) => x.type === "number" && x.sets?.id === q.id)) return false;
  if (!q.showIf) return true;
  const dep = all.find((x) => x.id === q.showIf!.id);
  const v = answers[q.showIf.id] ?? dep?.default;
  return q.showIf.is.includes(v as string | boolean);
}

/** Fill size bands from the measurements entered (prices stay on the calibrated bands; the pro sees the exact numbers). */
export function applyMeasurements(questions: Question[], answers: Answers): Answers {
  const out: Answers = { ...answers };
  for (const q of questions) {
    if (q.type !== "number" || !q.sets) continue;
    const v = Number(answers[q.id] ?? 0);
    if (!(v > 0)) continue;
    const tier = q.sets.tiers.find(([max]) => v <= max) ?? q.sets.tiers[q.sets.tiers.length - 1];
    out[q.sets.id] = tier[1];
  }
  return out;
}

/** Above the top band's typical size the price grows with the measurement (a 5-acre lawn isn't a 1-acre lawn). */
export function sizeFactor(questions: Question[], answers: Answers): number {
  let f = 1;
  for (const q of questions) {
    if (q.type !== "number" || !q.sets?.scaleAbove) continue;
    const v = Number(answers[q.id] ?? 0);
    if (v > q.sets.scaleAbove) f = Math.max(f, v / q.sets.scaleAbove);
  }
  return f;
}

/** Required measurements still missing (visible ones only). */
export function missingMeasurements(questions: Question[], answers: Answers): Question[] {
  return questions.filter((q) => q.type === "number" && q.required && questionVisible(q, answers, questions) && !(Number(answers[q.id] ?? 0) > 0));
}

export interface LineItem {
  label: string;
  amount: number;
}

export interface PriceResult {
  items: LineItem[];
  /** Point estimate before range spread. */
  base: number;
  /** Labor hours for one crew, used for scheduling capacity. */
  hours: number;
}

export interface Service {
  slug: string;
  name: string;
  category: CategoryId;
  icon: string; // emoji, used by web + mobile without an icon dependency
  tagline: string;
  description: string;
  includes: string[];
  questions: Question[];
  /** Minimum ticket — every quote is at least this. */
  minimum: number;
  /** Spread applied around the point estimate: [low multiplier, high multiplier]. */
  spread: [number, number];
  /**
   * Equipment-heavy jobs (the pro buys a unit that is most of the price): cap on our commission so a
   * competitive price still leaves the pro a fair labor margin. Defaults to the sliding rate.
   */
  maxCommission?: number;
  /** A firm price needs eyes on site (tree work, remodels). */
  siteVisit: boolean;
  /** Recurring plans allowed for this service. */
  frequencies: Frequency[];
  /** Pro trade(s) qualified to take the job. */
  trades: string[];
  /** Minimum days' notice (events). */
  leadDays?: number;
  /** What to put in the notes for this service (shown as the placeholder). */
  notesHint?: string;
  /** Work that legally needs a licensed tradesperson — dispatch only to pros with a license on file. */
  licensed?: boolean;
  /** Already priced as on-demand (urgent rides): no within-48h rush surcharge on top. */
  onDemand?: boolean;
  /**
   * Done remotely (websites, AI, formation, consulting): bookable from any US ZIP, no market or driving-radius limits,
   * no area price level, and the free "site visit" is a video consultation. Staff or specialists anywhere can take it.
   */
  remote?: boolean;
  /**
   * General liability (COI) not required to take this job: no work on the customer's property with tools or equipment
   * (remote business work; errands, courier, personal assistant). Trade coverages (bond, business-use auto) still apply.
   */
  insuranceOptional?: boolean;
  price: (a: Answers) => PriceResult;
}

export const CATEGORIES: { id: CategoryId; name: string; short: string; icon: string; blurb: string }[] = [
  { id: "cleaning", name: "Cleaning & Organizing", short: "Cleaning", icon: "🧽", blurb: "Homes, offices, windows, carpets, tile & grout, air ducts, chimneys, trash bins, power washing, mobile car detailing — plus decluttering." },
  { id: "outdoor", name: "Lawn, Leaves & Snow", short: "Lawn & Snow", icon: "🌳", blurb: "Mowing and edging, landscaping and mulch, sprinklers, pools, holiday lights, leaf cleanup, snow removal and trees." },
  { id: "pets", name: "Pet Care", short: "Pet Care", icon: "🐾", blurb: "Dog walking, dog sitting and yard poop pickup by background-checked pros." },
  { id: "removal", name: "Haul Away, Moves & Delivery", short: "Haul & Move", icon: "🚛", blurb: "Junk gone today, pest control, wildlife removal, demolition and tear-outs, small moves, same-day large-item delivery, staging furniture, dead animal removal — or a container for the week." },
  { id: "repair_remodel", name: "Repairs, Painting & Remodels", short: "Repairs", icon: "🔧", blurb: "Handyman, furniture assembly, appliances, locksmith, plumbing, electrical, HVAC, roofing, siding, gutters, windows & doors, fences & decks, flooring, insulation, masonry, concrete, water damage, painting — up to full remodels." },
  { id: "errands", name: "Errands & Delivery", short: "Errands", icon: "🛍️", blurb: "Same-day courier, medical deliveries, laundry pickup, home watch, dry cleaning, returns and drop-offs, or an assistant for the day." },
  { id: "transport", name: "Transportation", short: "Rides", icon: "🚘", blurb: "Private drivers, black cars, airport rides, game day & concert rides, limos, party buses, tour buses and event shuttles — licensed operators only." },
  { id: "events", name: "Parties & Events", short: "Events", icon: "🎉", blurb: "Planning, catering, food trucks, DJs, rentals, venues and event security — one invoice." },
  { id: "security", name: "Security Guards & Patrol", short: "Security", icon: "🛡️", blurb: "Licensed guards for buildings, job sites, lots and events: standing posts, nightly patrols and fire watch." },
  { id: "business", name: "Business & Technology", short: "Business & Tech", icon: "💼", blurb: "We build intelligent websites, business operating systems and automated businesses — plus AI agents, automation, business formation and consulting. Done remotely, with a free consultation first." },
];

/**
 * Categories kept off the default lists (services sidebar, Services menu, footer, home cards) so home-service customers
 * aren't overloaded: they open from a "Business & technology" button, and direct links (?cat=business) still work.
 */
export const TUCKED_CATEGORIES: readonly CategoryId[] = ["business"];
export const isTucked = (id: string) => (TUCKED_CATEGORIES as readonly string[]).includes(id);
/** The categories shown by default. */
export const MAIN_CATEGORIES = CATEGORIES.filter((c) => !isTucked(c.id));

const n = (a: Answers, k: string, d = 0) => (typeof a[k] === "number" ? (a[k] as number) : Number(a[k] ?? d) || d);
const s = (a: Answers, k: string, d = "") => (a[k] === undefined ? d : String(a[k]));

/**
 * Rides: the vehicle the customer picked, or the smallest one (in the given order) that seats
 * everyone if they picked one too small. Returns the vehicle and whether it was upgraded.
 */
function fitVehicle(chosen: string, passengers: number, seats: [string, number][]): { veh: string; upgraded: boolean } {
  const i = Math.max(0, seats.findIndex(([v]) => v === chosen));
  for (let j = i; j < seats.length; j++) if (passengers <= seats[j][1]) return { veh: seats[j][0], upgraded: j > i };
  return { veh: seats[seats.length - 1][0], upgraded: seats.length - 1 > i };
}
const b = (a: Answers, k: string) => a[k] === true || a[k] === "true";
const sum = (items: LineItem[]) => items.reduce((t, i) => t + i.amount, 0);

const EVENT_TYPES = [
  { value: "birthday", label: "Birthday / party" },
  { value: "wedding", label: "Wedding / shower" },
  { value: "corporate", label: "Corporate / office party" },
  { value: "corporate_dinner", label: "Corporate dinner" },
  { value: "company_bbq", label: "Company BBQ / picnic" },
  { value: "lunch_party", label: "Office lunch party (Taco Tuesday…)" },
  { value: "day_party", label: "Day party" },
  { value: "pool_party", label: "Pool party" },
  { value: "graduation", label: "Graduation / reunion" },
  { value: "holiday", label: "Holiday party" },
  { value: "other", label: "Other" },
];

const STORIES = [
  { value: "1", label: "1 story" },
  { value: "2", label: "2 stories" },
  { value: "3", label: "3+ stories" },
];

export const SERVICES: Service[] = [
  // ───────────────────────────── CLEANING ─────────────────────────────
  {
    slug: "house-cleaning",
    name: "House & Office Cleaning",
    category: "cleaning",
    icon: "🧽",
    tagline: "Background-checked cleaners, same crew every visit.",
    description:
      "Standard, deep and move-in/move-out cleaning for homes and offices. Book once or set a weekly, biweekly or monthly plan and save up to 20%.",
    includes: ["Kitchen & bathrooms sanitized", "Dusting & vacuuming all rooms", "Floors mopped", "Trash out", "Photo check-out"],
    questions: [
      { id: "bedrooms", label: "Bedrooms (or offices)", type: "number", min: 0, max: 10, default: 3 },
      { id: "bathrooms", label: "Bathrooms", type: "number", min: 1, max: 8, default: 2 },
      { id: "sqft", label: "Square feet", type: "number", min: 400, max: 20000, default: 1800, unit: "sq ft", help: "Finished living or office space. Not sure? Use the number on your listing or tax record." },
      {
        id: "level",
        label: "Type of clean",
        type: "select",
        default: "standard",
        options: [
          { value: "standard", label: "Standard" },
          { value: "deep", label: "Deep clean" },
          { value: "move", label: "Move-in / move-out" },
        ],
      },
      { id: "pets", label: "Pets in the home", type: "toggle", default: false },
      { id: "fridge_oven", label: "Inside fridge & oven", type: "toggle", default: false },
    ],
    minimum: 120,
    spread: [0.95, 1.1],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly", "monthly"],
    trades: ["cleaning"],
    price: (a) => {
      // Square footage drives the price: a $45 visit base plus $0.06/sq ft up to 2,000 sq ft, $0.045/sq ft beyond
      // (Detroit-metro 2026: standard clean of a 3 bd / 2 ba, 1,800 sq ft ≈ $150–$220).
      const sqft = n(a, "sqft", 1800);
      const area = Math.round(45 + Math.min(sqft, 2000) * 0.06 + Math.max(0, sqft - 2000) * 0.045);
      const baths = n(a, "bathrooms", 2);
      const beds = n(a, "bedrooms", 3);
      const items: LineItem[] = [{ label: `${sqft.toLocaleString("en-US")} sq ft`, amount: area }];
      if (baths > 1) items.push({ label: `${baths - 1} extra bathroom${baths > 2 ? "s" : ""}`, amount: (baths - 1) * 25 });
      // Two bedrooms are in the base; each one more adds, each one fewer (studio / 1-bed) takes off.
      if (beds > 2) items.push({ label: `${beds - 2} extra bedroom${beds > 3 ? "s" : ""}/office${beds > 3 ? "s" : ""}`, amount: (beds - 2) * 15 });
      if (beds < 2) items.push({ label: beds === 0 ? "Studio" : "1 bedroom", amount: (beds - 2) * 15 });
      const subtotal = sum(items);
      const level = s(a, "level", "standard");
      if (level === "deep") items.push({ label: "Deep clean", amount: Math.round(subtotal * 0.6) });
      if (level === "move") items.push({ label: "Move-in/out clean", amount: Math.round(subtotal * 0.9) });
      if (b(a, "pets")) items.push({ label: "Pet hair", amount: 20 });
      if (b(a, "fridge_oven")) items.push({ label: "Fridge & oven interior", amount: 60 });
      const base = sum(items);
      return { items, base, hours: Math.max(2, sqft / 500 + (level === "standard" ? 0 : sqft / 1000)) };
    },
  },
  {
    slug: "window-cleaning",
    name: "Window Cleaning",
    category: "cleaning",
    icon: "🪟",
    tagline: "Streak-free glass, screens and tracks.",
    description: "Interior and exterior window cleaning for homes and storefronts, including screens, sills and tracks.",
    includes: ["Glass washed & squeegeed", "Screens brushed", "Sills & tracks wiped", "Ladder work up to 3 stories"],
    questions: [
      { id: "windows", label: "Number of windows", type: "number", min: 1, max: 200, default: 20 },
      {
        id: "sides",
        label: "Which sides",
        type: "select",
        default: "both",
        options: [
          { value: "outside", label: "Outside only" },
          { value: "both", label: "Inside & outside" },
        ],
      },
      { id: "stories", label: "Building height", type: "select", default: "1", options: STORIES },
      { id: "screens", label: "Screens & tracks detail", type: "toggle", default: true },
    ],
    minimum: 149,
    spread: [0.95, 1.12],
    siteVisit: false,
    frequencies: ["once", "quarterly"],
    trades: ["windows"],
    price: (a) => {
      const w = n(a, "windows", 20);
      const per = s(a, "sides", "both") === "both" ? 12 : 8;
      const story = { "1": 1, "2": 1.25, "3": 1.5 }[s(a, "stories", "1")] ?? 1;
      const items: LineItem[] = [{ label: `${w} windows`, amount: Math.round(w * per * story) }];
      if (b(a, "screens")) items.push({ label: "Screens & tracks", amount: w * 3 });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, w / 10) };
    },
  },
  {
    slug: "carpet-cleaning",
    name: "Carpet & Upholstery Cleaning",
    category: "cleaning",
    icon: "🧼",
    tagline: "Hot-water extraction, dry in hours.",
    description: "Truck-mounted hot-water extraction for carpets, stairs, rugs and furniture, with pet and stain treatments.",
    includes: ["Pre-vacuum & pre-spray", "Hot-water extraction", "Spot treatment", "Furniture moved & replaced"],
    questions: [
      { id: "rooms", label: "Rooms / areas", type: "number", min: 1, max: 20, default: 3 },
      { id: "carpet_sqft", label: "Or total carpet square feet", type: "number", min: 0, max: 20000, default: 0, unit: "sq ft", help: "Leave at 0 to price by room. Use square feet for open areas, basements and offices." },
      { id: "stairs", label: "Staircases", type: "number", min: 0, max: 5, default: 0 },
      { id: "sofa_seats", label: "Upholstery seats (sofa, chairs)", type: "number", min: 0, max: 20, default: 0 },
      { id: "pet", label: "Pet odor & stain treatment", type: "toggle", default: false },
    ],
    minimum: 129,
    spread: [0.95, 1.1],
    siteVisit: false,
    frequencies: ["once", "quarterly"],
    trades: ["carpet"],
    price: (a) => {
      const rooms = n(a, "rooms", 3);
      const csq = n(a, "carpet_sqft", 0);
      // Square feet, when given, can only raise the room price — never undercut it.
      const bySqft = Math.max(129, Math.round(csq * 0.28));
      const items: LineItem[] = csq > 0 && bySqft > rooms * 49
        ? [{ label: `${csq.toLocaleString("en-US")} sq ft of carpet`, amount: bySqft }]
        : [{ label: `${rooms} rooms`, amount: rooms * 49 }];
      if (n(a, "stairs")) items.push({ label: `${n(a, "stairs")} staircases`, amount: n(a, "stairs") * 45 });
      if (n(a, "sofa_seats")) items.push({ label: `${n(a, "sofa_seats")} upholstery seats`, amount: n(a, "sofa_seats") * 30 });
      if (b(a, "pet")) items.push({ label: "Pet treatment", amount: csq > 0 ? Math.round(csq * 0.1) : rooms * 20 });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, (csq > 0 ? csq / 400 : rooms * 0.5) + n(a, "stairs") * 0.5) };
    },
  },
  {
    slug: "organizing",
    name: "Organizing & Decluttering",
    category: "cleaning",
    icon: "🧺",
    tagline: "Closets to garages — sorted, labeled, donated.",
    description:
      "Professional organizers declutter and set up systems for closets, pantries, kitchens, garages, offices and whole-home moves. Donations hauled away so nothing lingers.",
    includes: ["Sort: keep / donate / toss", "Systems & labeling", "Donation drop-off or haul-away", "Before/after photos"],
    questions: [
      {
        id: "space",
        label: "Main space",
        type: "select",
        default: "closet",
        options: [
          { value: "closet", label: "Closet" },
          { value: "pantry", label: "Pantry / kitchen" },
          { value: "room", label: "Bedroom / office / playroom" },
          { value: "garage", label: "Garage / basement" },
          { value: "home", label: "Whole home / move" },
        ],
      },
      { id: "spaces", label: "Number of spaces like this", type: "number", min: 1, max: 10, default: 1 },
      {
        id: "clutter",
        label: "How full is it",
        type: "select",
        default: "moderate",
        options: [
          { value: "light", label: "Light tidy-up" },
          { value: "moderate", label: "Moderate" },
          { value: "heavy", label: "Overflowing" },
        ],
      },
      { id: "haul", label: "Haul away donations & trash", type: "toggle", default: true },
      { id: "shopping", label: "Shop for bins & organizers (products at cost)", type: "toggle", default: false },
    ],
    minimum: 199,
    spread: [0.9, 1.2],
    siteVisit: false,
    frequencies: ["once", "monthly", "quarterly"],
    trades: ["organizing"],
    price: (a) => {
      const hrs = { closet: 3, pantry: 4, room: 5, garage: 8, home: 16 }[s(a, "space", "closet")] ?? 3;
      const clutter = { light: 0.75, moderate: 1, heavy: 1.4 }[s(a, "clutter", "moderate")] ?? 1;
      const totalHrs = Math.max(3, hrs * n(a, "spaces", 1) * clutter);
      const crew = totalHrs >= 8 ? 2 : 1; // two organizers on big jobs, same total labor hours
      const items: LineItem[] = [{ label: `${Math.round(totalHrs)} organizer-hours${crew > 1 ? " (2-person team)" : ""}`, amount: Math.round(totalHrs * 70) }];
      if (b(a, "haul")) items.push({ label: "Donation & trash haul-away", amount: 79 });
      if (b(a, "shopping")) items.push({ label: "Product shopping trip", amount: 45 });
      const base = sum(items);
      return { items, base, hours: totalHrs / crew };
    },
  },
  {
    slug: "gutter-cleaning",
    name: "Gutter Cleaning",
    category: "cleaning",
    icon: "🏠",
    tagline: "Cleared, flushed, and photo-proven.",
    description: "Debris removal, downspout flush and a before/after photo of every run so you never have to climb up and check.",
    includes: ["Hand-clear all gutters", "Downspouts flushed", "Debris bagged & hauled", "Before/after photos"],
    questions: [
      { id: "feet", label: "Linear feet of gutter (≈ home perimeter)", type: "number", min: 50, max: 600, default: 150, unit: "ft" },
      { id: "stories", label: "Home height", type: "select", default: "1", options: STORIES },
      { id: "guards", label: "Gutter guards installed", type: "toggle", default: false },
    ],
    minimum: 149,
    spread: [0.95, 1.12],
    siteVisit: false,
    frequencies: ["once", "quarterly"],
    trades: ["gutters"],
    price: (a) => {
      const ft = n(a, "feet", 150);
      const rate = { "1": 1.25, "2": 1.75, "3": 2.25 }[s(a, "stories", "1")] ?? 1.25;
      const items: LineItem[] = [{ label: `${ft} ft of gutter`, amount: Math.round(ft * rate) }];
      if (b(a, "guards")) items.push({ label: "Guard removal & reinstall", amount: Math.round(ft * 0.75) });
      const base = sum(items);
      return { items, base, hours: Math.max(1, ft / 100) };
    },
  },

  {
    slug: "power-washing",
    name: "Power Washing",
    category: "cleaning",
    icon: "💦",
    tagline: "Driveways, siding, basements and decks — like new.",
    description: "Pressure and soft washing for driveways, walkways, house siding, basement floors and walls, decks, patios and fences. Mildew treatment and optional concrete sealing.",
    includes: ["Pre-treatment for mildew & stains", "Surface-safe pressure or soft wash", "Rinse-down of nearby windows & plants", "Before/after photos"],
    questions: [
      {
        id: "surface", label: "What needs washing", type: "select", default: "driveway",
        options: [
          { value: "driveway", label: "Driveway & walkways" },
          { value: "house", label: "House siding (soft wash)" },
          { value: "basement", label: "Basement floor & walls" },
          { value: "deck", label: "Deck or patio" },
          { value: "fence", label: "Fence" },
        ],
      },
      { id: "sqft", label: "Area to wash (house: home's sq ft)", type: "number", min: 100, max: 6000, default: 800, unit: "sq ft" },
      { id: "stories", label: "Home height (house siding)", type: "select", default: "1", options: STORIES },
      { id: "seal", label: "Seal concrete / stain deck after washing", type: "toggle", default: false },
    ],
    minimum: 149,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once", "quarterly"],
    trades: ["pressure_washing"],
    price: (a) => {
      const surface = s(a, "surface", "driveway");
      const area = n(a, "sqft", 800);
      const rate = { driveway: 0.25, house: 0.18, basement: 0.35, deck: 0.4, fence: 0.3 }[surface] ?? 0.25;
      const height = surface === "house" ? ({ "1": 1, "2": 1.2, "3": 1.4 }[s(a, "stories", "1")] ?? 1) : 1;
      const label = { driveway: "Driveway & walkways", house: "House soft wash", basement: "Basement floor & walls", deck: "Deck / patio", fence: "Fence" }[surface] ?? "Power washing";
      const items: LineItem[] = [{ label: `${label} — ${area} sq ft`, amount: Math.round(area * rate * height) }];
      if (b(a, "seal") && surface !== "house" && surface !== "basement") items.push({ label: surface === "deck" || surface === "fence" ? "Stain / seal" : "Concrete sealer", amount: Math.round(area * 0.45) });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, area / 600 + (b(a, "seal") ? area / 800 : 0)) };
    },
  },

  // ───────────────────────────── OUTDOOR ─────────────────────────────
  {
    slug: "mobile-car-detailing",
    name: "Mobile Car Detailing",
    category: "cleaning",
    icon: "🚗",
    tagline: "Showroom clean in your driveway or office lot.",
    description: "A detailer comes to your home or workplace with water, power and pro products: hand wash and wax, full interior shampoo and wipe-down, or a full detail inside and out — up to ceramic coating. Fleets and multiple cars welcome.",
    includes: ["Comes to you — home or office lot", "Pro-grade, paint-safe products", "Interior vacuum, shampoo & wipe-down (interior packages)", "Before & after photos"],
    questions: [
      { id: "vehicle", label: "Vehicle size", type: "select", default: "sedan", options: [{ value: "sedan", label: "Car / coupe" }, { value: "suv", label: "Small SUV / crossover" }, { value: "large", label: "Truck, minivan or 3-row SUV" }] },
      { id: "package", label: "Package", type: "select", default: "full", options: [{ value: "exterior", label: "Exterior — hand wash, wheels & wax" }, { value: "interior", label: "Interior — vacuum, shampoo & wipe-down" }, { value: "full", label: "Full detail — inside & out" }, { value: "ceramic", label: "Full detail + ceramic coating" }] },
      { id: "vehicles", label: "Vehicles", type: "number", min: 1, max: 10, default: 1 },
      { id: "pet_hair", label: "Heavy pet hair", type: "toggle", default: false },
      { id: "stains", label: "Heavy stains or odor treatment", type: "toggle", default: false },
      { id: "headlights", label: "Headlight restoration", type: "toggle", default: false },
      { id: "no_hookup", label: "No outdoor water or outlet we can use", type: "toggle", default: false, help: "We bring our own water tank and power." },
    ],
    minimum: 79,
    spread: [1, 1],
    siteVisit: false,
    frequencies: ["once", "biweekly", "monthly"],
    trades: ["auto_detailing"],
    notesHint: "Where the car will be parked, make/model/color, anything to watch for (scratches, child seats to leave in)",
    price: (a) => {
      const veh = s(a, "vehicle", "sedan");
      const pkg = s(a, "package", "full");
      const v = Math.max(1, n(a, "vehicles", 1));
      const table: Record<string, Record<string, number>> = { exterior: { sedan: 79, suv: 99, large: 119 }, interior: { sedan: 119, suv: 139, large: 159 }, full: { sedan: 189, suv: 219, large: 249 }, ceramic: { sedan: 599, suv: 749, large: 899 } };
      const each = table[pkg]?.[veh] ?? 189;
      const items: LineItem[] = [{ label: `${({ exterior: "Exterior detail", interior: "Interior detail", full: "Full detail", ceramic: "Full detail + ceramic coating" } as Record<string, string>)[pkg] ?? "Detail"} · ${v} vehicle${v > 1 ? "s" : ""} × $${each}`, amount: v * each }];
      if (b(a, "pet_hair")) items.push({ label: `Pet hair removal × ${v}`, amount: 40 * v });
      if (b(a, "stains")) items.push({ label: `Stain & odor treatment × ${v}`, amount: 50 * v });
      if (b(a, "headlights")) items.push({ label: `Headlight restoration × ${v}`, amount: 60 * v });
      if (b(a, "no_hookup")) items.push({ label: "Self-contained water & power", amount: 20 });
      const base = sum(items);
      const hrs = ({ exterior: 1.25, interior: 2, full: 3, ceramic: 7 } as Record<string, number>)[pkg] ?? 3;
      return { items, base, hours: v * hrs * (veh === "large" ? 1.25 : 1) };
    },
  },
  {
    slug: "duct-cleaning",
    name: "Air Duct & Dryer Vent Cleaning",
    category: "cleaning",
    icon: "🌬️",
    tagline: "Dust, pet hair and lint out of your ducts and dryer vent.",
    description: "Whole-system air duct cleaning with negative-pressure vacuum and agitation tools, every supply and return vent cleaned, the furnace blower and coil compartment wiped down, and before & after photos inside the ducts. Dryer vent cleaning removes lint from the dryer to the outside cap — the leading cause of dryer fires. Optional sanitizer for allergies or after a renovation.",
    includes: ["Vetted, insured duct cleaning tech (NADCA standards)", "Negative-pressure vacuum system", "Every vent and return cleaned", "Furnace blower compartment wiped", "Before & after photos inside the ducts"],
    notesHint: "Number of vents and returns, how many furnaces, pets in the home, and where the dryer vents outside",
    questions: [
      { id: "vents", label: "Supply vents and returns", type: "number", min: 0, max: 60, default: 14, help: "Count every register in the floors, walls and ceilings, plus the big return grilles. A 3-bedroom home has about 12–16." },
      { id: "systems", label: "Furnaces / air handlers", type: "number", min: 0, max: 4, default: 1 },
      { id: "dryer", label: "Dryer vent cleaning", type: "toggle", default: true },
      { id: "sanitize", label: "Sanitizer fogged into the ducts", type: "toggle", default: false },
    ],
    minimum: 129,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["duct_cleaning"],
    price: (a) => {
      // Detroit-metro 2026: whole-system duct cleaning $350–$550 for 12–16 vents (no $99 bait-and-switch), each extra vent $15–$25,
      // second system $200–$300, dryer vent $120–$175, sanitizer $75–$125.
      const v = n(a, "vents"), sy = n(a, "systems");
      const items: LineItem[] = [];
      if (v && sy) {
        items.push({ label: `Air duct cleaning — ${v} vents & returns`, amount: 299 + v * 14 });
        if (sy > 1) items.push({ label: `Additional furnace systems — ${sy - 1}`, amount: (sy - 1) * 245 });
        if (b(a, "sanitize")) items.push({ label: "Duct sanitizer", amount: 95 });
      }
      if (b(a, "dryer")) items.push({ label: "Dryer vent cleaning", amount: 145 });
      if (!items.length) items.push({ label: "Duct & vent visit", amount: 129 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, v * 0.15 + sy * 1 + (b(a, "dryer") ? 0.75 : 0)) };
    },
  },
  {
    slug: "tile-grout-cleaning",
    name: "Tile & Grout Cleaning",
    category: "cleaning",
    icon: "🧼",
    tagline: "Dingy grout lines steam-cleaned back to their color, then sealed.",
    description: "Tile floors, showers and backsplashes cleaned with high-pressure hot-water extraction and grout brushes, then rinsed and dried. Sealing protects the grout from stains; color sealing evens out grout that won't come clean. Natural stone gets a pH-neutral cleaner. Regular house cleaning is booked under House & Office Cleaning.",
    includes: ["Vetted, insured tile cleaning tech", "Hot-water extraction and grout brushing", "Furniture moved and replaced", "Before & after photos"],
    notesHint: "Rooms and showers, the tile type (ceramic, porcelain, stone), and how stained the grout is",
    questions: [
      { id: "floor_sqft", label: "Tile floor area", type: "number", min: 0, max: 5000, default: 200, unit: "sq ft" },
      { id: "showers", label: "Tiled showers or tub surrounds", type: "number", min: 0, max: 6, default: 0 },
      { id: "seal", label: "Seal the grout", type: "select", default: "clear", options: [{ value: "none", label: "No sealing" }, { value: "clear", label: "Clear sealer" }, { value: "color", label: "Color seal (makes grout uniform)" }] },
      { id: "stone", label: "Natural stone (marble, travertine, slate)", type: "toggle", default: false },
    ],
    minimum: 199,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["carpet"],
    price: (a) => {
      // Detroit-metro 2026: tile & grout cleaning $1.00–$1.75/sq ft, showers $150–$225 each, clear seal $0.60–$1.00/sq ft,
      // color seal $1.75–$2.75/sq ft, natural stone +20–30%.
      const f = n(a, "floor_sqft"), sh = n(a, "showers"), seal = s(a, "seal", "clear");
      const stone = b(a, "stone") ? 1.25 : 1;
      const items: LineItem[] = [];
      if (f) items.push({ label: `Tile & grout cleaning — ${f} sq ft`, amount: Math.round(f * 1.3 * stone) });
      if (sh) items.push({ label: `Showers or tub surrounds — ${sh}`, amount: Math.round(sh * 175 * stone) });
      const area = f + sh * 80;
      if (seal === "clear" && area) items.push({ label: `Clear grout sealer — ${area} sq ft`, amount: Math.round(area * 0.8) });
      if (seal === "color" && area) items.push({ label: `Color seal — ${area} sq ft`, amount: Math.round(area * 2.25) });
      if (!items.length) items.push({ label: "Tile cleaning visit", amount: 199 });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, base / 80) };
    },
  },
  {
    slug: "trash-bin-cleaning",
    name: "Trash Bin Cleaning",
    category: "cleaning",
    icon: "🗑️",
    tagline: "Garbage, recycling and yard carts washed and deodorized at the curb.",
    description: "After pickup day, your carts are pressure-washed with hot water inside and out, sanitized and deodorized right at the curb — no maggots, no smell. Wastewater is captured, not sent down the storm drain. Monthly or every-other-week plans keep them clean all summer.",
    includes: ["Vetted, insured cleaning crew", "Hot-water pressure wash inside & out", "Sanitized and deodorized", "Wastewater captured", "Photo after every cleaning"],
    notesHint: "Your trash pickup day and how many carts (garbage, recycling, yard waste)",
    questions: [
      { id: "bins", label: "Carts to clean", type: "number", min: 1, max: 12, default: 2 },
      { id: "first_deep", label: "First cleaning is a heavy one (never cleaned, maggots)", type: "toggle", default: false },
    ],
    minimum: 35,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once", "biweekly", "monthly"],
    trades: ["pressure_washing"],
    price: (a) => {
      // Detroit-metro 2026: one-time $25–$40 per cart, $15–$20 per cart on a monthly plan (plan discount applies),
      // heavy first cleaning +$10–$20 per cart.
      const c = Math.max(1, n(a, "bins", 2));
      const items: LineItem[] = [{ label: `Carts washed & deodorized — ${c}`, amount: c * 22 }];
      if (b(a, "first_deep")) items.push({ label: `Heavy first cleaning — ${c} carts`, amount: c * 12 });
      return { items, base: sum(items), hours: Math.max(0.25, c * 0.15) };
    },
  },
  {
    slug: "chimney-sweep",
    name: "Chimney Sweep & Inspection",
    category: "cleaning",
    icon: "🔥",
    tagline: "Creosote swept out and the flue inspected before you light a fire.",
    description: "Fireplace and wood-stove chimneys swept from the top or bottom with rotary brushes and a HEPA vacuum, the firebox and smoke chamber cleaned, and a Level 1 inspection of the flue, damper, crown and cap with photos. A Level 2 camera inspection is recommended when you buy a home or after a chimney fire. Masonry and crown repairs are booked under Masonry & Brick Repair.",
    includes: ["Certified chimney sweep (CSIA or equal)", "Drop cloths and HEPA vacuum — no soot in the house", "Level 1 inspection with photos", "Written condition report"],
    notesHint: "Fireplace or wood stove, how often you burn, the last time it was swept, and any smoke or smell problems",
    questions: [
      { id: "flues", label: "Flues to sweep", type: "number", min: 1, max: 4, default: 1, help: "Each fireplace or stove has its own flue." },
      { id: "heavy", label: "Heavy creosote (glazed or not swept in years)", type: "toggle", default: false },
      { id: "camera", label: "Level 2 camera inspection (buying a home, after a chimney fire)", type: "toggle", default: false },
      { id: "cap", label: "Install a new chimney cap", type: "toggle", default: false },
    ],
    minimum: 199,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["chimney_sweep"],
    price: (a) => {
      // Detroit-metro 2026: sweep + Level 1 inspection $200–$300, each extra flue $100–$150, heavy creosote +$125–$200,
      // Level 2 camera inspection $250–$450, stainless cap installed $200–$300.
      const f = Math.max(1, n(a, "flues", 1));
      const items: LineItem[] = [{ label: `Chimney sweep & Level 1 inspection — ${f} flue${f > 1 ? "s" : ""}`, amount: 249 + (f - 1) * 129 }];
      if (b(a, "heavy")) items.push({ label: "Heavy creosote removal", amount: 150 * f });
      if (b(a, "camera")) items.push({ label: "Level 2 camera inspection", amount: 325 });
      if (b(a, "cap")) items.push({ label: "Stainless chimney cap installed", amount: 245 });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, f * 1.25 + (b(a, "camera") ? 1 : 0)) };
    },
  },
  {
    slug: "lawn-care",
    name: "Lawn Care",
    category: "outdoor",
    icon: "🌱",
    tagline: "Mow, edge, blow — on autopilot.",
    description: "Weekly or biweekly mowing plus seasonal leaf cleanup, aeration and fertilization for homes and commercial lots.",
    includes: ["Mow & edge", "Trim around beds", "Blow walks & drives", "Clippings handled"],
    questions: [
      { id: "yard_sqft", label: "Yard size", type: "number", min: 0, max: 400000, default: 0, unit: "sq ft", required: true, help: "The lawn area to mow. Measure length × width in feet, or on Google Maps (computer) right-click your yard → Measure distance and click around it. 1 acre = 43,560 sq ft.", sets: { id: "lot", tiers: [[10890, "small"], [21780, "quarter"], [43560, "half"], [Infinity, "acre"]], scaleAbove: 65000 } },
      {
        id: "lot",
        label: "Lot size",
        type: "select",
        default: "quarter",
        options: [
          { value: "small", label: "Under ¼ acre" },
          { value: "quarter", label: "¼ – ½ acre" },
          { value: "half", label: "½ – 1 acre" },
          { value: "acre", label: "Over 1 acre" },
        ],
      },
      { id: "leaves", label: "Leaf cleanup", type: "toggle", default: false },
      { id: "aeration", label: "Core aeration", type: "toggle", default: false },
      { id: "fertilize", label: "Fertilization", type: "toggle", default: false },
    ],
    minimum: 55,
    spread: [0.95, 1.1],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["lawn"],
    price: (a) => {
      // Detroit-metro 2026 per-cut market: < ¼ ac $40–$60, ¼–½ ac $55–$80, ½–1 ac $85–$130, 1+ ac $130–$200.
      // Priced so the pro still clears a local independent's rate after the weekly-plan discount.
      const mow = { small: 55, quarter: 75, half: 105, acre: 160 }[s(a, "lot", "quarter")] ?? 75;
      const mult = mow / 75;
      const items: LineItem[] = [{ label: "Mow, edge & blow", amount: mow }];
      if (b(a, "leaves")) items.push({ label: "Leaf cleanup", amount: Math.round(160 * mult) });
      if (b(a, "aeration")) items.push({ label: "Core aeration", amount: Math.round(120 * mult) });
      if (b(a, "fertilize")) items.push({ label: "Fertilization", amount: Math.round(70 * mult) });
      const base = sum(items);
      return { items, base, hours: Math.max(0.75, base / 70) };
    },
  },
  {
    slug: "landscaping",
    name: "Landscaping & Bed Care",
    category: "outdoor",
    icon: "🌷",
    tagline: "Mulch, crisp bed edges, trimmed shrubs and new plants.",
    description: "Bed and landscape work for homes and commercial properties: weeding, fresh mulch, hand-cut bed edges, shrub and hedge trimming, planting, new sod and seeding. Mulch and plants are included at a standard grade; upgrades are billed at cost.",
    includes: ["Vetted, insured landscaper", "Mulch and standard plants included", "Hand-cut bed edges", "Debris hauled or bagged", "Before & after photos"],
    notesHint: "Which beds and areas, mulch color, any plants to keep or remove, and the gate or water access",
    questions: [
      { id: "mulch_yards", label: "Mulch to spread", type: "number", min: 0, max: 60, default: 3, unit: "cu yd", help: "1 cubic yard covers about 100 sq ft at 3 inches deep. Measure the beds (length × width) and divide by 100." },
      { id: "edge_ft", label: "Bed edges to hand-cut", type: "number", min: 0, max: 2000, default: 100, unit: "ft", help: "The total length of bed borders. A crisp spade-cut edge keeps grass and mulch apart." },
      { id: "shrubs", label: "Shrubs or hedge sections to trim", type: "number", min: 0, max: 200, default: 6, help: "Count each shrub, or each 10 ft of hedge." },
      { id: "plants", label: "New shrubs or perennials to plant", type: "number", min: 0, max: 200, default: 0, help: "Standard nursery sizes (1–3 gallon) included. Larger trees get a site visit." },
      { id: "sod_sqft", label: "New sod to lay", type: "number", min: 0, max: 20000, default: 0, unit: "sq ft", help: "Old turf removed and soil graded first. For bare patches, use seeding instead." },
      { id: "seed_sqft", label: "Bare or thin lawn to seed", type: "number", min: 0, max: 40000, default: 0, unit: "sq ft" },
      { id: "weeding", label: "Weed the beds first", type: "toggle", default: true },
      { id: "haul", label: "Haul away the debris (not bagged at the curb)", type: "toggle", default: true },
    ],
    minimum: 150,
    spread: [0.92, 1.15],
    siteVisit: false,
    frequencies: ["once", "monthly"],
    trades: ["lawn"],
    price: (a) => {
      // Detroit-metro 2026: mulch installed $85–$110/yd, spade edging $1.50–$2.50/ft, shrub trim $12–$25 each,
      // planted 1–3 gal shrubs/perennials $45–$70, sod installed $1.75–$2.50/sq ft, seeding $0.15–$0.25/sq ft.
      const yd = n(a, "mulch_yards"), ft = n(a, "edge_ft"), sh = n(a, "shrubs"), pl = n(a, "plants"), sod = n(a, "sod_sqft"), seed = n(a, "seed_sqft");
      const items: LineItem[] = [];
      if (b(a, "weeding")) items.push({ label: "Weed the beds", amount: 85 + Math.round(yd * 15) });
      if (yd) items.push({ label: `Mulch — ${yd} cu yd, delivered & spread`, amount: yd * 95 });
      if (ft) items.push({ label: `Hand-cut bed edges — ${ft} ft`, amount: Math.round(ft * 2) });
      if (sh) items.push({ label: `Shrub & hedge trimming — ${sh}`, amount: sh * 18 });
      if (pl) items.push({ label: `Planting — ${pl} shrubs or perennials`, amount: pl * 55 });
      if (sod) items.push({ label: `Sod — ${sod} sq ft, prepped & laid`, amount: Math.round(sod * 2.1) });
      if (seed) items.push({ label: `Seeding — ${seed} sq ft, with starter fertilizer & straw`, amount: Math.max(90, Math.round(seed * 0.2)) });
      if (b(a, "haul") && items.length) items.push({ label: "Debris haul-away", amount: 75 });
      if (!items.length) items.push({ label: "Bed cleanup & touch-up", amount: 150 });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, base / 65) };
    },
  },
  {
    slug: "tree-removal",
    name: "Tree Removal & Trimming",
    category: "outdoor",
    icon: "🌳",
    tagline: "Insured arborists. Free on-site estimate.",
    description:
      "Tree removal, trimming and stump grinding by insured crews. Upload photos for an instant range; a pro confirms the firm price on site.",
    includes: ["Certificate of insurance on file", "Cut, rig & lower", "Haul-away of wood & debris", "Optional stump grinding"],
    questions: [
      {
        id: "work",
        label: "Type of work",
        type: "select",
        default: "remove",
        options: [
          { value: "trim", label: "Trim / prune" },
          { value: "remove", label: "Full removal" },
        ],
      },
      { id: "height_ft", label: "Tree height (tallest tree)", type: "number", min: 0, max: 150, default: 0, unit: "ft", required: true, help: "Best guess is fine: a 2-story house is about 25 ft to the roof peak.", sets: { id: "height", tiers: [[29, "small"], [60, "medium"], [Infinity, "large"]] } },
      { id: "trunk_in", label: "Trunk width at chest height", type: "number", min: 0, max: 120, default: 0, unit: "in", help: "Across the trunk, about 4 ft off the ground. Optional, but it helps the pro bring the right saw." },
      {
        id: "height",
        label: "Tree height",
        type: "select",
        default: "medium",
        options: [
          { value: "small", label: "Under 30 ft" },
          { value: "medium", label: "30 – 60 ft" },
          { value: "large", label: "Over 60 ft" },
        ],
      },
      { id: "trees", label: "Number of trees", type: "number", min: 1, max: 20, default: 1 },
      { id: "near_structure", label: "Near house, lines or fence", type: "toggle", default: false },
      { id: "stump", label: "Stump grinding", type: "toggle", default: false },
    ],
    minimum: 250,
    spread: [0.8, 1.35],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["tree"],
    price: (a) => {
      const size = s(a, "height", "medium");
      const trim = s(a, "work", "remove") === "trim";
      const per = trim ? { small: 250, medium: 450, large: 800 }[size] ?? 450 : { small: 400, medium: 900, large: 1700 }[size] ?? 900;
      const trees = n(a, "trees", 1);
      const items: LineItem[] = [{ label: `${trees} × ${trim ? "trim" : "removal"} (${size})`, amount: per * trees }];
      if (b(a, "near_structure")) items.push({ label: "Rigging near structures", amount: Math.round(per * trees * 0.35) });
      if (b(a, "stump") && !trim) items.push({ label: "Stump grinding", amount: 175 * trees });
      const base = sum(items);
      return { items, base, hours: base / 150 };
    },
  },
  {
    slug: "leaf-removal",
    name: "Leaf Removal",
    category: "outdoor",
    icon: "🍂",
    tagline: "Raked, blown, bagged and hauled — beds and gutters too.",
    description: "Fall and spring leaf cleanup for yards, beds and driveways. We blow and rake everything out, then bag it at the curb or haul it away. Book once or every week or two through the season.",
    includes: ["Lawn, beds & hard surfaces cleared", "Bagged at the curb or hauled away", "Downspout outlets cleared", "Before/after photos"],
    questions: [
      { id: "yard_sqft", label: "Yard size", type: "number", min: 0, max: 400000, default: 0, unit: "sq ft", required: true, help: "The area to clear. Measure length × width in feet, or on Google Maps (computer) right-click your yard → Measure distance. 1 acre = 43,560 sq ft.", sets: { id: "lot", tiers: [[10890, "small"], [21780, "quarter"], [43560, "half"], [Infinity, "acre"]], scaleAbove: 65000 } },
      {
        id: "lot",
        label: "Lot size",
        type: "select",
        default: "quarter",
        options: [
          { value: "small", label: "Under ¼ acre" },
          { value: "quarter", label: "¼ – ½ acre" },
          { value: "half", label: "½ – 1 acre" },
          { value: "acre", label: "Over 1 acre" },
        ],
      },
      {
        id: "volume",
        label: "How many leaves",
        type: "select",
        default: "moderate",
        options: [
          { value: "light", label: "Light (a few trees)" },
          { value: "moderate", label: "Moderate" },
          { value: "heavy", label: "Heavy (wooded / first cleanup)" },
        ],
      },
      { id: "haul", label: "Haul away (instead of bags at the curb)", type: "toggle", default: false },
      { id: "beds", label: "Detail flower beds & shrubs", type: "toggle", default: true },
    ],
    minimum: 125,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["lawn"],
    price: (a) => {
      const base0 = { small: 150, quarter: 225, half: 325, acre: 475 }[s(a, "lot", "quarter")] ?? 225;
      const mult = { light: 0.75, moderate: 1, heavy: 1.5 }[s(a, "volume", "moderate")] ?? 1;
      const items: LineItem[] = [{ label: `Leaf cleanup (${s(a, "lot", "quarter")} lot, ${s(a, "volume", "moderate")})`, amount: Math.round(base0 * mult) }];
      if (b(a, "beds")) items.push({ label: "Bed & shrub detailing", amount: 60 });
      if (b(a, "haul")) items.push({ label: "Haul-away & disposal", amount: Math.round(60 + base0 * mult * 0.25) });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, base / 75) };
    },
  },
  {
    slug: "snow-removal",
    name: "Snow Removal",
    category: "outdoor",
    icon: "❄️",
    tagline: "Driveways, walks and lots cleared — one storm or the whole season.",
    description: "Snow plowing and shoveling for homes and businesses. Book a single clearing, or a prepaid season plan where your crew comes automatically after every 2-inch-plus snowfall, November through March.",
    includes: ["Driveway plowed or blown", "Walks & steps shoveled", "Ice melt on request", "Photo after every visit"],
    questions: [
      { id: "drive_sqft", label: "Driveway or lot size", type: "number", min: 0, max: 100000, default: 0, unit: "sq ft", required: true, help: "Length × width in feet. A 1-car driveway is about 10 × 40 = 400 sq ft; a parking space with its share of aisle is about 300 sq ft.", sets: { id: "area", tiers: [[450, "one_car"], [900, "two_car"], [2000, "large"], [4000, "lot_small"], [Infinity, "lot_large"]], scaleAbove: 12000 } },
      {
        id: "area",
        label: "What needs clearing",
        type: "select",
        default: "two_car",
        options: [
          { value: "one_car", label: "1-car driveway" },
          { value: "two_car", label: "2-car driveway" },
          { value: "large", label: "3+ car / long driveway" },
          { value: "lot_small", label: "Small business lot (≤ 10 spaces)" },
          { value: "lot_large", label: "Business lot (11–40 spaces)" },
        ],
      },
      { id: "walks", label: "Sidewalk & front walk", type: "toggle", default: true },
      { id: "steps", label: "Steps & porch", type: "toggle", default: false },
      { id: "salt", label: "Ice melt / salt", type: "toggle", default: false },
      {
        id: "plan",
        label: "How often",
        type: "select",
        default: "once",
        options: [
          { value: "once", label: "One clearing" },
          { value: "season", label: "Season plan (every 2\"+ snowfall, Nov–Mar, prepaid)" },
        ],
      },
    ],
    minimum: 40,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["snow", "lawn"],
    price: (a) => {
      const per = { one_car: 40, two_car: 50, large: 75, lot_small: 175, lot_large: 375 }[s(a, "area", "two_car")] ?? 50;
      const lot = s(a, "area", "two_car").startsWith("lot");
      const items: LineItem[] = [{ label: "Plow / snow-blow", amount: per }];
      if (b(a, "walks")) items.push({ label: "Sidewalks & walks", amount: lot ? 45 : 15 });
      if (b(a, "steps")) items.push({ label: "Steps & porch", amount: 15 });
      if (b(a, "salt")) items.push({ label: "Ice melt", amount: lot ? 60 : 20 });
      const visit = sum(items);
      if (s(a, "plan", "once") === "season") {
        // Detroit averages ~12 plowable (2"+) events a season; prepaid season saves 15%
        const season = Math.round(visit * 12 * 0.85);
        return { items: [{ label: `Season plan — up to 12 storms × ${"$" + visit} per visit, 15% off`, amount: season }], base: season, hours: 12 };
      }
      return { items, base: visit, hours: lot ? 2 : 0.75 };
    },
  },
  {
    slug: "sprinkler-service",
    name: "Sprinkler Start-Up, Winterizing & Repair",
    category: "outdoor",
    icon: "💦",
    tagline: "Turned on in spring, blown out before the freeze, and broken heads fixed.",
    description: "Lawn sprinkler systems: spring start-up (water on, every zone run and adjusted, controller programmed), fall winterization with a compressed-air blowout so pipes don't crack in the freeze, and repairs for broken heads, leaks and valves. The annual backflow test some cities require can be added.",
    includes: ["Vetted, insured irrigation tech", "Every zone run and checked", "Controller set for the season", "Broken heads quoted before replacing"],
    notesHint: "Number of zones, the controller brand, where the shutoff and backflow device are, and any dry or soggy spots",
    questions: [
      { id: "service", label: "What do you need?", type: "select", default: "startup", options: [{ value: "startup", label: "Spring start-up" }, { value: "winterize", label: "Fall winterization (blowout)" }, { value: "repair", label: "Repair visit" }] },
      { id: "zones", label: "Zones", type: "number", min: 1, max: 40, default: 6 },
      { id: "heads", label: "Broken sprinkler heads to replace", type: "number", min: 0, max: 50, default: 0 },
      { id: "backflow", label: "Annual backflow test (certified tester)", type: "toggle", default: false },
    ],
    minimum: 85,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["irrigation"],
    price: (a) => {
      // Detroit-metro 2026: start-up $80–$130 + $5–$10/zone over 4, blowout $75–$120 + $5–$10/zone over 4,
      // repair visit $95–$150, heads $15–$25 each installed, backflow test $75–$110.
      const sv = s(a, "service", "startup"), z = Math.max(1, n(a, "zones", 6)), h = n(a, "heads");
      const extra = Math.max(0, z - 4);
      const items: LineItem[] = [];
      if (sv === "startup") items.push({ label: `Spring start-up — ${z} zones`, amount: 95 + extra * 8 });
      if (sv === "winterize") items.push({ label: `Winterization blowout — ${z} zones`, amount: 89 + extra * 7 });
      if (sv === "repair") items.push({ label: "Sprinkler repair visit", amount: 125 });
      if (h) items.push({ label: `Sprinkler heads replaced — ${h}`, amount: h * 19 });
      if (b(a, "backflow")) items.push({ label: "Backflow test & city report", amount: 89 });
      const base = sum(items);
      return { items, base, hours: Math.max(0.75, z * 0.15 + h * 0.2 + (sv === "repair" ? 1 : 0)) };
    },
  },
  {
    slug: "holiday-lights",
    name: "Holiday Light Installation",
    category: "outdoor",
    icon: "🎄",
    tagline: "Rooflines, trees and wreaths lit — and taken down after the holidays.",
    description: "Commercial-grade LED holiday lights installed on rooflines, gutters, trees, bushes and railings, with wreaths and garland, on timers. Lights are provided (or we hang yours), any burned-out bulbs are fixed during the season, and takedown in January is included. Book by early November for the best dates.",
    includes: ["Vetted, insured install crew", "Commercial-grade LED lights provided", "Timers set", "Service call if anything goes out", "Takedown in January"],
    notesHint: "Roofline length, trees and bushes to wrap, colors (warm white, multicolor), and an outdoor outlet location",
    questions: [
      { id: "roof_ft", label: "Roofline & gutters to light", type: "number", min: 0, max: 1000, default: 80, unit: "ft", help: "The front of a typical city house is 40–60 ft; around the whole house, 120–180 ft." },
      { id: "trees", label: "Trees or large bushes to wrap", type: "number", min: 0, max: 30, default: 0 },
      { id: "wreaths", label: "Wreaths or garland pieces", type: "number", min: 0, max: 30, default: 0 },
      { id: "lights", label: "Lights", type: "select", default: "ours", options: [{ value: "ours", label: "Provided (commercial-grade LED)" }, { value: "own", label: "Hang my own lights (about 30% less)" }] },
      { id: "stories", label: "Height", type: "select", default: "1", options: STORIES },
    ],
    minimum: 349,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["holiday_lights"],
    leadDays: 7,
    price: (a) => {
      // Detroit-metro 2026 (lights provided, install + takedown): roofline $5–$9/ft, trees/large bushes $60–$150 each,
      // wreaths/garland $35–$60 each; customer's own lights about 30% less.
      const height = { "1": 1, "2": 1.15, "3": 1.3 }[s(a, "stories", "1")] ?? 1;
      const own = s(a, "lights", "ours") === "own" ? 0.7 : 1;
      const r = n(a, "roof_ft"), t = n(a, "trees"), w = n(a, "wreaths");
      const items: LineItem[] = [];
      if (r) items.push({ label: `Roofline lights — ${r} ft`, amount: Math.round(r * 6.75 * height * own) });
      if (t) items.push({ label: `Trees & bushes wrapped — ${t}`, amount: Math.round(t * 95 * own) });
      if (w) items.push({ label: `Wreaths & garland — ${w}`, amount: Math.round(w * 45 * own) });
      if (!items.length) items.push({ label: "Holiday lighting visit", amount: 349 });
      const base = sum(items);
      return { items, base, hours: Math.max(2, base / 75) };
    },
  },
  {
    slug: "pool-service",
    name: "Pool Opening, Closing & Cleaning",
    category: "outdoor",
    icon: "🏊",
    tagline: "Pools opened in spring, closed for winter and kept clean all summer.",
    description: "Inground and above-ground pools: spring opening (cover off, equipment started, water balanced), fall closing (water lowered, lines blown out and plugged, winter chemicals, cover on), weekly cleaning visits with chemicals included, and green-to-clean recovery. Equipment repairs are quoted separately.",
    includes: ["Vetted, insured pool tech", "Chemicals included", "Water tested and balanced", "Photo of the pool after every visit"],
    notesHint: "Pool type and size, the cover type, the pump and filter, and when you want it open or closed",
    questions: [
      { id: "pool", label: "Pool", type: "select", default: "inground", options: [{ value: "inground", label: "Inground" }, { value: "above", label: "Above-ground" }] },
      { id: "service", label: "What do you need?", type: "select", default: "open", options: [{ value: "open", label: "Spring opening" }, { value: "close", label: "Fall closing" }, { value: "clean", label: "Cleaning visit (weekly plan available)" }, { value: "green", label: "Green-to-clean recovery" }] },
      { id: "safety_cover", label: "Safety cover (anchored) to take off or put on", type: "toggle", default: false, showIf: { id: "service", is: ["open", "close"] } },
    ],
    minimum: 95,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["pool"],
    price: (a) => {
      // Detroit-metro 2026: opening inground $275–$400 (above-ground $175–$275), closing $250–$375 ($175–$250),
      // weekly cleaning $85–$125 with chemicals, green-to-clean $350–$600, safety cover +$50–$100.
      const ig = s(a, "pool", "inground") === "inground", sv = s(a, "service", "open");
      const [label, amount, hrs] = ({
        open: ["Pool opening", ig ? 325 : 225, 2.5], close: ["Pool closing", ig ? 295 : 200, 2.5],
        clean: ["Pool cleaning visit, chemicals included", ig ? 105 : 85, 1], green: ["Green-to-clean recovery", ig ? 475 : 350, 4],
      } as Record<string, [string, number, number]>)[sv] ?? ["Pool opening", 325, 2.5];
      const items: LineItem[] = [{ label, amount }];
      if (b(a, "safety_cover") && (sv === "open" || sv === "close")) items.push({ label: "Safety cover", amount: 75 });
      return { items, base: sum(items), hours: hrs };
    },
  },
  {
    slug: "dog-walking",
    name: "Dog Walking",
    category: "pets",
    icon: "🦮",
    tagline: "Same walker, every walk — GPS photo updates after each one.",
    description: "Background-checked walkers for daily or occasional walks. Fresh water, treats if you allow them, and a photo + note after every walk. Book a one-off walk or a weekly schedule.",
    includes: ["Background-checked, insured walker", "Leash-on, door-to-door", "Fresh water & paw wipe", "Photo + note after every walk"],
    questions: [
      {
        id: "length",
        label: "Walk length",
        type: "select",
        default: "30",
        options: [
          { value: "20", label: "20 min (potty break)" },
          { value: "30", label: "30 min" },
          { value: "60", label: "60 min" },
        ],
      },
      { id: "walks", label: "Walks per week", type: "number", min: 1, max: 14, default: 5, help: "For a one-off walk choose 1 and \"One time\"." },
      { id: "dogs", label: "Dogs", type: "number", min: 1, max: 4, default: 1 },
      { id: "puppy", label: "Puppy or reactive dog (extra care)", type: "toggle", default: false },
    ],
    minimum: 22,
    spread: [1, 1],
    siteVisit: false,
    frequencies: ["once", "weekly"],
    trades: ["pet_care"],
    price: (a) => {
      const per = { "20": 22, "30": 27, "60": 40 }[s(a, "length", "30")] ?? 27;
      const walks = n(a, "walks", 5), dogs = n(a, "dogs", 1);
      const walkPrice = per + (dogs - 1) * 8 + (b(a, "puppy") ? 5 : 0);
      const items: LineItem[] = [{ label: `${walks} × ${s(a, "length", "30")}-min walk${walks > 1 ? "s" : ""}${dogs > 1 ? ` (${dogs} dogs)` : ""} @ $${walkPrice}`, amount: walks * walkPrice }];
      const base = sum(items);
      return { items, base, hours: walks * (Number(s(a, "length", "30")) / 60 + 0.25) };
    },
  },
  {
    slug: "dog-sitting",
    name: "Dog Sitting & Pet Watching",
    category: "pets",
    icon: "🐶",
    tagline: "Drop-in visits, daytime watching or overnight stays in your home.",
    description: "Trusted, background-checked sitters while you're at work or away: feeding, walks, play, meds and a photo update every visit. Overnight sitters stay in your home so your dog keeps its routine.",
    includes: ["Background-checked, insured sitter", "Feeding, fresh water & meds", "Walks & playtime", "Photo update every visit", "Meet & greet before the first booking"],
    questions: [
      {
        id: "type",
        label: "What you need",
        type: "select",
        default: "dropin",
        options: [
          { value: "dropin", label: "Drop-in visits (30 min)" },
          { value: "day", label: "Daytime watching (up to 8 hrs)" },
          { value: "overnight", label: "Overnight in your home" },
        ],
      },
      { id: "count", label: "Visits / days / nights", type: "number", min: 1, max: 30, default: 3 },
      { id: "visits_per_day", label: "Drop-in visits per day", type: "number", min: 1, max: 4, default: 2, help: "Drop-ins only" },
      { id: "pets", label: "Pets", type: "number", min: 1, max: 5, default: 1 },
      { id: "meds", label: "Medication or special care", type: "toggle", default: false },
      { id: "holiday", label: "Includes a major holiday", type: "toggle", default: false },
    ],
    minimum: 28,
    spread: [1, 1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["pet_care"],
    price: (a) => {
      const type = s(a, "type", "dropin"), count = n(a, "count", 3), pets = n(a, "pets", 1);
      const units = type === "dropin" ? count * n(a, "visits_per_day", 2) : count;
      const per = ({ dropin: 28, day: 55, overnight: 85 }[type] ?? 28) + (pets - 1) * (type === "dropin" ? 6 : 12);
      const label = { dropin: "drop-in visit", day: "day of watching", overnight: "overnight stay" }[type] ?? "visit";
      const items: LineItem[] = [{ label: `${units} × ${label}${units > 1 ? "s" : ""} @ $${per}${pets > 1 ? ` (${pets} pets)` : ""}`, amount: units * per }];
      if (b(a, "meds")) items.push({ label: "Medication / special care", amount: units * 5 });
      if (b(a, "holiday")) items.push({ label: "Holiday rate", amount: Math.round(units * per * 0.25) });
      const base = sum(items);
      return { items, base, hours: type === "overnight" ? count * 12 : type === "day" ? count * 8 : units * 0.5 };
    },
  },
  {
    slug: "pet-waste-removal",
    name: "Dog Poop Removal",
    category: "pets",
    icon: "🐕",
    tagline: "A clean yard every week. Gate closed, guaranteed.",
    description: "Weekly or biweekly yard scooping with waste hauled away and the gate photo-verified closed on every visit.",
    includes: ["Full yard sweep", "Waste bagged & removed", "Gate-closed photo", "Deodorizer available"],
    questions: [
      { id: "dogs", label: "Number of dogs", type: "number", min: 1, max: 8, default: 1 },
      { id: "yard_sqft", label: "Yard size", type: "number", min: 0, max: 200000, default: 0, unit: "sq ft", required: true, help: "The area the dogs use. Length × width in feet.", sets: { id: "yard", tiers: [[5000, "small"], [15000, "medium"], [Infinity, "large"]], scaleAbove: 30000 } },
      {
        id: "yard",
        label: "Yard size",
        type: "select",
        default: "medium",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large / acreage" },
        ],
      },
      { id: "first_cleanup", label: "Yard hasn't been cleaned in 2+ weeks", type: "toggle", default: false },
      { id: "deodorize", label: "Deodorize turf / patio", type: "toggle", default: false },
    ],
    minimum: 20,
    spread: [1, 1.05],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["pet_waste"],
    price: (a) => {
      const dogs = n(a, "dogs", 1);
      const yard = { small: 1, medium: 1.2, large: 1.6 }[s(a, "yard", "medium")] ?? 1.2;
      const items: LineItem[] = [{ label: `Visit — ${dogs} dog${dogs > 1 ? "s" : ""}`, amount: Math.round((21 + (dogs - 1) * 5) * yard) }];
      if (b(a, "first_cleanup")) items.push({ label: "Initial heavy cleanup", amount: 75 });
      if (b(a, "deodorize")) items.push({ label: "Deodorizer", amount: 12 });
      const base = sum(items);
      return { items, base, hours: 0.5 };
    },
  },

  // ───────────────────────────── REMOVAL ─────────────────────────────
  {
    slug: "junk-removal",
    name: "Junk Removal",
    category: "removal",
    icon: "🚛",
    tagline: "Priced by how much — we load it all. Donated & recycled first.",
    description: "Full-service junk hauling from homes, garages, basements, offices and job sites. You point, we lift, load and sweep. Prefer to load it yourself over a few days? Book a Junk Container instead.",
    includes: ["2-person crew", "All lifting & loading", "Donation & recycling first", "Area swept clean"],
    questions: [
      { id: "cubic_yards", label: "How much (cubic yards)", type: "number", min: 0, max: 80, default: 0, unit: "cu yd", required: true, help: "A pickup-truck bed holds about 2 cubic yards; a couch is about 2; a full one-car garage is about 16. Best guess is fine — add photos and we check them before you pay.", sets: { id: "volume", tiers: [[1, "min"], [2, "eighth"], [4, "quarter"], [8, "half"], [12, "three_quarter"], [16, "full"], [Infinity, "double"]], scaleAbove: 32 } },
      { id: "est_weight_lb", label: "Rough total weight", type: "number", min: 0, max: 20000, default: 0, unit: "lb", help: "Optional. Helps for heavy loads (concrete, dirt, roofing, appliances)." },
      {
        id: "volume",
        label: "How much stuff",
        type: "select",
        default: "quarter",
        help: "A pickup-truck bed holds about 2 cubic yards. Our truck holds about 16. Not sure? Pick your best guess and add photos — we check them before you pay.",
        options: [
          { value: "min", label: "A few items (≈1 cu yd · e.g. a chair and a few bags)" },
          { value: "eighth", label: "⅛ truck (≈2 cu yd · one pickup-truck bed)" },
          { value: "quarter", label: "¼ truck (≈4 cu yd · a couch, a dresser and boxes)" },
          { value: "half", label: "½ truck (≈8 cu yd · a small room or half a garage)" },
          { value: "three_quarter", label: "¾ truck (≈12 cu yd · a full room or a cluttered garage)" },
          { value: "full", label: "Full truck (≈16 cu yd · a full one-car garage)" },
          { value: "double", label: "2 trucks (≈32 cu yd · whole-house or estate clean-out)" },
        ],
      },
      {
        id: "kind", label: "Mostly", type: "select", default: "household",
        options: [
          { value: "household", label: "Household junk & furniture" },
          { value: "yard", label: "Yard waste (branches, leaves, soil bags)" },
          { value: "construction", label: "Construction / remodel debris" },
          { value: "heavy", label: "Heavy debris (concrete, brick, dirt, roofing)" },
        ],
      },
      { id: "special", label: "Items with disposal fees", type: "number", min: 0, max: 20, default: 0, help: "Mattresses or box springs, TVs and monitors, tires, fridges, freezers and AC units (refrigerant)" },
      { id: "stairs", label: "Items upstairs / in a basement", type: "toggle", default: false },
    ],
    minimum: 129,
    spread: [0.9, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["hauling"],
    price: (a) => {
      const vol = s(a, "volume", "quarter");
      const price = { min: 129, eighth: 189, quarter: 259, half: 409, three_quarter: 539, full: 669, double: 1249 }[vol] ?? 259;
      const items: LineItem[] = [{ label: "Truck volume", amount: price }];
      const kind = s(a, "kind", "household");
      if (kind === "construction") items.push({ label: "Construction debris (dense, mixed)", amount: Math.round(price * 0.15) });
      if (kind === "heavy") items.push({ label: "Heavy debris (weight-based dump fees)", amount: Math.round(price * 0.35) });
      const special = n(a, "special");
      if (special) items.push({ label: `${special} item${special > 1 ? "s" : ""} with disposal fees × $30`, amount: special * 30 });
      if (b(a, "stairs")) items.push({ label: "Stairs / basement carry", amount: vol === "double" ? 100 : 50 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, base / 220) };
    },
  },
  {
    slug: "large-item-removal",
    name: "Large Item Removal",
    category: "removal",
    icon: "🛋️",
    tagline: "Priced by how many items and how heavy — from couches to pianos.",
    description: "Pickup of bulky and heavy items: furniture, mattresses, appliances, exercise equipment, safes, pianos and hot tubs. Tell us how many items in each weight class and the heaviest one, so we send the right crew and equipment.",
    includes: ["2-person crew (3 for 300 lb+)", "Dollies, straps & stair-climber for heavy items", "Disassembly if needed", "Doorframes & floors protected", "Responsible disposal & recycling"],
    questions: [
      { id: "light", label: "Light items — under 50 lb", type: "number", min: 0, max: 30, default: 0, help: "Chair, side table, TV, bike, small rug" },
      { id: "medium", label: "Medium items — 50 to 150 lb", type: "number", min: 0, max: 30, default: 1, help: "Couch, mattress or box spring, dresser, desk, washer or dryer, recliner" },
      { id: "heavy", label: "Heavy items — 150 to 300 lb", type: "number", min: 0, max: 20, default: 0, help: "Refrigerator, sectional, sleeper sofa, treadmill, armoire, china cabinet" },
      { id: "very_heavy", label: "Very heavy items — 300 to 600 lb", type: "number", min: 0, max: 10, default: 0, help: "Gun safe, upright piano, slate pool table, home gym, large freezer" },
      { id: "specialty", label: "Specialty items — 600 lb+ or special handling", type: "number", min: 0, max: 5, default: 0, help: "Hot tub, grand piano, large safe, commercial equipment" },
      { id: "heaviest", label: "Heaviest single item (approx. weight)", type: "number", min: 10, max: 3000, default: 120, unit: "lb", help: "Check the label or manual, or search the model online. Over 1,000 lb gets a free site visit." },
      { id: "flights", label: "Flights of stairs to carry down", type: "number", min: 0, max: 6, default: 0 },
      { id: "long_carry", label: "Long carry (over 50 ft from where the truck parks)", type: "toggle", default: false },
      { id: "disassembly", label: "Needs taking apart (bed frame, sectional, playset, hot tub cutting)", type: "toggle", default: false },
    ],
    minimum: 99,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["hauling"],
    price: (a) => {
      const cls = [
        { id: "light", label: "light (under 50 lb)", each: 39, stair: 5, hrs: 0.15 },
        { id: "medium", label: "medium (50–150 lb)", each: 79, stair: 15, hrs: 0.3 },
        { id: "heavy", label: "heavy (150–300 lb)", each: 129, stair: 30, hrs: 0.5 },
        { id: "very_heavy", label: "very heavy (300–600 lb)", each: 249, stair: 75, hrs: 1 },
        { id: "specialty", label: "specialty (600 lb+)", each: 399, stair: 125, hrs: 2 },
      ];
      const items: LineItem[] = [];
      let hours = 0, stairs = 0;
      const flights = n(a, "flights");
      for (const c of cls) {
        const k = n(a, c.id);
        if (!k) continue;
        items.push({ label: `${k} ${c.label} item${k > 1 ? "s" : ""} × $${c.each}`, amount: k * c.each });
        stairs += k * c.stair * flights;
        hours += k * c.hrs;
      }
      if (!items.length) items.push({ label: "1 item pickup", amount: 79 });
      if (stairs) items.push({ label: `Stair carry (${flights} flight${flights > 1 ? "s" : ""}, by weight)`, amount: stairs });
      const heaviest = n(a, "heaviest", 120);
      if (heaviest >= 300) items.push({ label: "3rd crew member (300 lb+ item)", amount: 75 });
      if (heaviest >= 600) items.push({ label: "Heavy-move equipment (stair-climber, skates)", amount: 125 });
      if (b(a, "long_carry")) items.push({ label: "Long carry", amount: 35 });
      if (b(a, "disassembly")) items.push({ label: "Disassembly", amount: 45 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, hours * (1 + flights * 0.2)) };
    },
  },
  {
    slug: "junk-container",
    name: "Junk Container (Drop-off & Pickup)",
    category: "removal",
    icon: "🗑️",
    tagline: "We drop a container, you fill it for a week, we haul it away.",
    description: "A roll-off container delivered to your driveway for a clean-out, move or remodel. Load it at your own pace; we pick it up when your rental ends. Weight allowance included — any overage is billed at the landfill's cost per ton with the weigh ticket.",
    includes: ["Delivery & pickup", "Driveway protection boards", "Weight allowance included", "Landfill & recycling fees for the allowance", "Extra days available"],
    questions: [
      {
        id: "size", label: "Container size", type: "select", default: "15",
        help: "10 yd ≈ 4 pickup loads (a garage clean-out) · 15 yd ≈ 6 (a basement or small remodel) · 20 yd ≈ 8 (a whole-floor clean-out or roof) · 30 yd ≈ 12 (a whole house or big remodel)",
        options: [
          { value: "10", label: "10 yard — includes 1 ton" },
          { value: "15", label: "15 yard — includes 2 tons" },
          { value: "20", label: "20 yard — includes 3 tons" },
          { value: "30", label: "30 yard — includes 4 tons" },
        ],
      },
      { id: "days", label: "Rental length", type: "select", default: "7", options: [{ value: "3", label: "3 days" }, { value: "7", label: "1 week" }, { value: "14", label: "2 weeks" }, { value: "30", label: "1 month" }] },
      {
        id: "debris", label: "What goes in", type: "select", default: "mixed",
        options: [
          { value: "mixed", label: "Household junk, furniture, yard waste" },
          { value: "construction", label: "Construction / remodel debris, roofing" },
          { value: "heavy", label: "Clean concrete, brick or dirt only (10 yard max)" },
        ],
      },
      { id: "street", label: "Goes on the street, not the driveway (needs a city permit)", type: "toggle", default: false },
      { id: "load_help", label: "Add a 2-person crew to load it for 2 hours", type: "toggle", default: false },
    ],
    minimum: 349,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["dumpster"],
    leadDays: 2,
    price: (a) => {
      const size = s(a, "size", "15");
      const debris = s(a, "debris", "mixed");
      const heavy = debris === "heavy";
      const base7 = heavy ? 525 : ({ "10": 375, "15": 425, "20": 475, "30": 575 }[size] ?? 425);
      const items: LineItem[] = [{ label: heavy ? "10 yard heavy-debris container (concrete, brick, dirt — flat rate)" : `${size} yard container, 1 week, ${({ "10": 1, "15": 2, "20": 3, "30": 4 } as Record<string, number>)[size] ?? 2} ton${size === "10" ? "" : "s"} included`, amount: base7 }];
      const days = Number(s(a, "days", "7"));
      if (days === 3) items.push({ label: "3-day rental", amount: -40 });
      if (days > 7) items.push({ label: `${days - 7} extra days × $12`, amount: (days - 7) * 12 });
      if (debris === "construction") items.push({ label: "Construction debris (dense load)", amount: 50 });
      if (b(a, "street")) items.push({ label: "Street placement permit (we file it)", amount: 75 });
      if (b(a, "load_help")) items.push({ label: "2-person loading crew, 2 hours", amount: 230 });
      const base = sum(items);
      return { items, base, hours: 1.5 + (b(a, "load_help") ? 2 : 0) };
    },
  },

  // ───────────────────────────── REPAIR & REMODEL ─────────────────────────────
  {
    slug: "dead-animal-removal",
    name: "Dead Animal Removal",
    category: "removal",
    icon: "🧤",
    tagline: "Gone today: bagged, removed and disposed of properly. Odor treatment available.",
    description: "Removal of dead animals from yards, driveways, garages, under decks and porches, crawlspaces, attics and walls: squirrels, birds, rodents, raccoons, opossums, skunks, cats and dogs, deer and more. Sealed in double bags, disposed of at an approved site the same day, and the spot sanitized on request. Lost a pet? We can take them to your vet or a pet crematory instead. We don't handle live or trapped animals.",
    includes: ["Protective gear & sealed double bags", "Disposal at an approved site the same day", "Before & after photos", "Sanitizing & odor treatment available"],
    questions: [
      { id: "weight_lb", label: "Animal\u2019s approximate weight", type: "number", min: 0, max: 400, default: 0, unit: "lb", required: true, help: "Squirrel ≈ 1 lb, raccoon ≈ 15 lb, large dog ≈ 70 lb, deer ≈ 150 lb.", sets: { id: "size", tiers: [[4.99, "small"], [40, "medium"], [100, "large"], [Infinity, "xl"]] } },
      {
        id: "size", label: "Size of the animal", type: "select", default: "medium",
        options: [
          { value: "small", label: "Small — under 5 lb (squirrel, bird, rat, chipmunk)" },
          { value: "medium", label: "Medium — 5 to 40 lb (raccoon, opossum, skunk, cat, small dog)" },
          { value: "large", label: "Large — 40 to 100 lb (large dog, coyote, fawn)" },
          { value: "xl", label: "Very large — over 100 lb (deer)" },
        ],
      },
      {
        id: "where", label: "Where is it", type: "select", default: "open",
        help: "Not sure? Pick your best guess and describe the smell or spot in the notes — we confirm before the pro goes in.",
        options: [
          { value: "open", label: "In the open (yard, driveway, curb, garage or basement floor)" },
          { value: "under", label: "Under a deck, porch or shed, or in a crawlspace" },
          { value: "attic", label: "In the attic, a wall or the ceiling" },
        ],
      },
      { id: "count", label: "Number of animals", type: "number", min: 1, max: 10, default: 1, help: "In the same place. Several spots? Note them and we'll price each one." },
      { id: "sanitize", label: "Sanitize & deodorize the area", type: "toggle", default: false, help: "Enzyme cleaner and odor treatment where the animal was. Recommended if it's been there more than a day or two." },
      { id: "pet", label: "It's a pet — take them to my vet or a pet crematory", type: "toggle", default: false, help: "Handled with care. Cremation is billed by the crematory." },
    ],
    minimum: 129,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["wildlife"],
    notesHint: "Where it is and how to get there (gate, crawlspace hatch, attic ladder), what kind of animal if you know, and how long it's been there",
    price: (a) => {
      const size = s(a, "size", "medium");
      const where = s(a, "where", "open");
      const count = n(a, "count", 1);
      const base = { small: 129, medium: 159, large: 219, xl: 299 }[size] ?? 159;
      const label = { small: "small", medium: "medium", large: "large", xl: "very large" }[size] ?? "medium";
      const items: LineItem[] = [{ label: `Removal & disposal — ${label} animal`, amount: base }];
      if (count > 1) items.push({ label: `${count - 1} more animal${count > 2 ? "s" : ""} × $${Math.round(base * 0.35)}`, amount: (count - 1) * Math.round(base * 0.35) });
      if (where === "under") items.push({ label: "Crawlspace / under-deck access", amount: 90 });
      if (where === "attic") items.push({ label: "Attic / wall access (locating by odor; small access cut if needed)", amount: 175 });
      if (b(a, "sanitize")) items.push({ label: "Sanitize & deodorize", amount: 49 });
      if (b(a, "pet")) items.push({ label: "Pet aftercare — taken to your vet or a pet crematory", amount: 45 });
      const hours = ({ open: 0.75, under: 1.5, attic: 2.5 }[where] ?? 0.75) + (count - 1) * 0.25 + (b(a, "sanitize") ? 0.5 : 0) + (b(a, "pet") ? 0.75 : 0);
      return { items, base: sum(items), hours };
    },
  },
  {
    slug: "pest-control",
    name: "Pest Control",
    category: "removal",
    icon: "🐜",
    tagline: "Ants, roaches, spiders, mice, bed bugs and wasp nests — handled by a licensed applicator.",
    description: "Pest control by a state-licensed applicator: general treatments for ants, roaches, spiders and silverfish inside and around the foundation; rodent programs with sealed bait stations, traps, entry points sealed and follow-up visits; bed bug treatment room by room; and wasp, hornet and yellow jacket nests removed. Products are labeled for homes with kids and pets, and you get the safety sheets.",
    includes: ["Michigan-licensed pesticide applicator", "Products labeled for homes with kids and pets", "Entry points found and explained", "Follow-up visit included on rodents and bed bugs", "Treatment report with photos"],
    notesHint: "What you're seeing, where, for how long, any pets or small children, and anyone with asthma or allergies",
    questions: [
      {
        id: "pest",
        label: "Pest",
        type: "select",
        default: "general",
        options: [
          { value: "general", label: "Ants, roaches, spiders or silverfish" },
          { value: "rodents", label: "Mice or rats" },
          { value: "bed_bugs", label: "Bed bugs" },
          { value: "stinging", label: "Wasp, hornet or yellow jacket nests" },
        ],
      },
      { id: "sqft", label: "Home size", type: "number", min: 0, max: 10000, default: 1500, unit: "sq ft", showIf: { id: "pest", is: ["general", "rodents"] } },
      { id: "rooms", label: "Rooms with bed bugs", type: "number", min: 1, max: 15, default: 2, showIf: { id: "pest", is: ["bed_bugs"] } },
      { id: "nests", label: "Nests to remove", type: "number", min: 1, max: 10, default: 1, showIf: { id: "pest", is: ["stinging"] } },
    ],
    minimum: 149,
    spread: [0.92, 1.2],
    siteVisit: false,
    frequencies: ["once", "quarterly"],
    trades: ["pest"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: general treatment $175–$250 (quarterly plan $110–$150 a visit), rodent program with 2 follow-ups
      // $300–$450, bed bugs $400–$600 per room (heat or chemical), nests $125–$200 each.
      const p = s(a, "pest", "general"), sq = n(a, "sqft");
      const big = sq > 2500 ? 1 + Math.min(1, (sq - 2500) / 5000) : 1;
      const items: LineItem[] = [];
      if (p === "general") items.push({ label: `General pest treatment — ${sq} sq ft`, amount: Math.round(199 * big) });
      if (p === "rodents") items.push({ label: `Rodent program with 2 follow-ups — ${sq} sq ft`, amount: Math.round(349 * big) });
      if (p === "bed_bugs") { const r = Math.max(1, n(a, "rooms", 2)); items.push({ label: `Bed bug treatment — ${r} room${r > 1 ? "s" : ""}`, amount: r * 475 }); }
      if (p === "stinging") { const ne = Math.max(1, n(a, "nests", 1)); items.push({ label: `Stinging insect nests removed — ${ne}`, amount: 149 + (ne - 1) * 75 }); }
      const base = sum(items);
      return { items, base, hours: Math.max(1, base / 120) };
    },
  },
  {
    slug: "wildlife-removal",
    name: "Wildlife Removal & Exclusion",
    category: "removal",
    icon: "🦝",
    tagline: "Raccoons, squirrels, skunks and bats out — and kept out.",
    description: "Live nuisance wildlife removed humanely by a DNR-permitted operator: raccoons, squirrels, skunks, opossums and groundhogs trapped and relocated as Michigan law allows, and bats excluded with one-way doors (never trapped). Entry points are sealed with steel mesh and flashing so they don't come back, and attic droppings and nesting cleaned up on request. Dead animals are booked under Dead Animal Removal.",
    includes: ["DNR-permitted nuisance wildlife operator", "Humane trapping or one-way exclusion", "Trap checks every day", "Entry points sealed with steel mesh", "Photos of the entry points and repairs"],
    notesHint: "What you hear or see, where (attic, chimney, under the deck), when it's active, and any babies you've noticed",
    questions: [
      {
        id: "animal",
        label: "Animal",
        type: "select",
        default: "raccoon",
        options: [
          { value: "raccoon", label: "Raccoon" },
          { value: "squirrel", label: "Squirrels" },
          { value: "skunk", label: "Skunk, opossum or groundhog" },
          { value: "bats", label: "Bats (exclusion only)" },
        ],
      },
      { id: "entries", label: "Entry points to seal", type: "number", min: 0, max: 20, default: 1, help: "Holes, gaps at the roofline, vents, chimney. The tech confirms on the first visit." },
      { id: "attic_cleanup", label: "Clean up droppings and nesting in the attic", type: "toggle", default: false },
    ],
    minimum: 275,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["nuisance_wildlife"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: inspection + trapping (5–7 days of checks) $275–$400, bat exclusion $450–$900,
      // entry point sealing $125–$250 each, attic droppings cleanup $400–$800.
      const an = s(a, "animal", "raccoon"), e = n(a, "entries");
      const items: LineItem[] = [];
      if (an === "bats") items.push({ label: "Bat exclusion with one-way doors", amount: 595 });
      else items.push({ label: "Inspection, trapping & daily checks", amount: an === "squirrel" ? 325 : 345 });
      if (e) items.push({ label: `Entry points sealed — ${e}`, amount: e * 175 });
      if (b(a, "attic_cleanup")) items.push({ label: "Attic droppings & nesting cleanup", amount: 550 });
      const base = sum(items);
      return { items, base, hours: Math.max(2, base / 100) };
    },
  },
  {
    slug: "waste-oil-collection",
    name: "Used Oil Collection",
    category: "removal",
    icon: "🛢️",
    tagline: "Used motor oil, filters and antifreeze picked up by a licensed hauler.",
    description: "Pickup of used motor and hydraulic oil, used oil filters and antifreeze from shops, fleets, farms and businesses, by a licensed used-oil transporter. You get the shipping papers for your records, and it all goes to a permitted recycler. Under 5 gallons from home? Most auto parts stores take it free.",
    includes: ["Licensed used-oil transporter", "Shipping papers for your records", "Recycled at a permitted facility", "Drums of filters and antifreeze too"],
    questions: [
      { id: "gallons", label: "Gallons of used oil", type: "number", min: 5, max: 3000, default: 55, unit: "gal", help: "A drum holds 55 gallons." },
      {
        id: "container", label: "Stored in", type: "select", default: "drums",
        options: [
          { value: "drums", label: "55-gallon drums" },
          { value: "tank", label: "A bulk tank" },
          { value: "jugs", label: "Jugs or small containers" },
        ],
      },
      { id: "filter_drums", label: "Drums of used oil filters", type: "number", min: 0, max: 20, default: 0 },
      { id: "antifreeze", label: "Gallons of used antifreeze", type: "number", min: 0, max: 1000, default: 0, unit: "gal" },
      { id: "mixed", label: "Oil may be mixed with water, gas or solvents", type: "toggle", default: false, help: "We test it first. Mixed oil may need special disposal, priced before pickup." },
    ],
    minimum: 95,
    spread: [0.95, 1.25],
    siteVisit: false,
    frequencies: ["once", "biweekly", "monthly"],
    trades: ["waste_oil"],
    licensed: true,
    notesHint: "Business name, where the oil is (drums, tank, jugs), about how many gallons, pickup hours and which door or dock",
    price: (a) => {
      const g = n(a, "gallons", 55);
      const items: LineItem[] = [{ label: "Pickup (first 55 gallons)", amount: 95 }];
      if (g > 55) items.push({ label: `${g - 55} more gallons × $0.35`, amount: Math.round((g - 55) * 0.35) });
      if (s(a, "container", "drums") === "jugs") items.push({ label: "Pumping from small containers", amount: 25 });
      const f = n(a, "filter_drums"), af = n(a, "antifreeze");
      if (f) items.push({ label: `Used oil filters — ${f} drum${f > 1 ? "s" : ""} × $95`, amount: f * 95 });
      if (af) items.push({ label: `Used antifreeze — ${af} gal × $1.25`, amount: Math.round(af * 1.25) });
      if (b(a, "mixed")) items.push({ label: "Contamination test", amount: 75 });
      return { items, base: sum(items), hours: 0.75 + g / 400 };
    },
  },
  {
    slug: "small-moves",
    name: "Small Moves & Moving Help",
    category: "removal",
    icon: "📦",
    tagline: "Movers by the hour, with or without a truck — apartments, small homes, single rooms.",
    description: "Local moves and moving labor: loading, unloading, carrying and placing furniture and boxes, with or without our truck. Priced by the hour for the crew size you need, plus the drive. Great for apartments, dorms, storage units and moving within the building.",
    includes: ["Insured, background-checked movers", "Moving blankets, dollies & straps", "Furniture disassembly & reassembly (basic)", "Floors & doorframes protected", "Truck included when you choose it"],
    questions: [
      { id: "size", label: "How much are you moving?", type: "select", default: "1br", options: [
        { value: "items", label: "A few items" }, { value: "studio", label: "Studio / dorm" }, { value: "1br", label: "1 bedroom" },
        { value: "2br", label: "2 bedrooms" }, { value: "3br", label: "3 bedrooms" },
      ] },
      { id: "movers", label: "Movers", type: "select", default: "2", options: [{ value: "2", label: "2 movers" }, { value: "3", label: "3 movers (faster for 2+ bedrooms)" }] },
      { id: "truck", label: "Truck", type: "select", default: "ours", options: [{ value: "ours", label: "Bring your truck" }, { value: "labor", label: "Labor only — I have a truck or container" }] },
      { id: "miles", label: "Distance between the two places", type: "number", min: 0, max: 100, default: 10, unit: "miles", showIf: { id: "truck", is: ["ours"] } },
      { id: "flights", label: "Flights of stairs (both ends together)", type: "number", min: 0, max: 10, default: 0 },
      { id: "packing", label: "Pack boxes for me", type: "toggle", default: false },
      { id: "heavy", label: "Piano, safe or item over 300 lb", type: "toggle", default: false },
    ],
    minimum: 199,
    spread: [0.95, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["hauling"],
    // Metro Detroit: 2 movers ≈ $100–150/hour; truck fee ≈ $75–150 plus mileage; 2-hour minimum.
    price: (a) => {
      const crew = s(a, "movers", "2") === "3" ? 3 : 2;
      const baseHours = { items: 2, studio: 3, "1br": 4, "2br": 6, "3br": 8 }[s(a, "size", "1br")] ?? 4;
      const flights = n(a, "flights");
      const hours = Math.max(2, Math.round((baseHours * (crew === 3 ? 0.72 : 1) + flights * 0.25) * 2) / 2);
      const rate = crew === 3 ? 179 : 129;
      const items: LineItem[] = [{ label: `${crew} movers × ${hours} hours (estimated)`, amount: Math.round(rate * hours) }];
      if (s(a, "truck", "ours") === "ours") {
        items.push({ label: "Moving truck", amount: 99 });
        const extra = Math.max(0, n(a, "miles", 10) - 10);
        if (extra) items.push({ label: `Drive over 10 miles (${extra} mi)`, amount: Math.round(extra * 2) });
      }
      if (b(a, "packing")) items.push({ label: "Packing service", amount: Math.round(baseHours * 35) });
      if (b(a, "heavy")) items.push({ label: "Heavy item handling", amount: 150 });
      return { items, base: sum(items), hours };
    },
  },
  {
    slug: "retail-delivery",
    name: "Same-Day Large Item Delivery",
    category: "removal",
    icon: "🚚",
    tagline: "Furniture and appliances delivered today — for stores, sellers and shoppers.",
    description: "Same-day or scheduled delivery of large items from a store, warehouse or seller to a home or business: furniture, mattresses, appliances (not hooked up), fixtures and bulky purchases. Two-person crew, placed in the room you choose, packaging taken away. Stores can book deliveries for their customers.",
    includes: ["2-person crew", "Blankets, straps & dollies", "Placed in the room you choose", "Packaging taken away", "Photo proof of delivery"],
    questions: [
      { id: "items", label: "Items", type: "number", min: 1, max: 20, default: 1 },
      { id: "heaviest_lb", label: "Heaviest item\u2019s weight", type: "number", min: 0, max: 2000, default: 0, unit: "lb", required: true, help: "Check the product page or box. A sofa is about 100–200 lb, a fridge 250–350 lb.", sets: { id: "weight", tiers: [[49, "light"], [150, "medium"], [300, "heavy"], [Infinity, "very_heavy"]] } },
      { id: "largest_in", label: "Largest item\u2019s longest side", type: "number", min: 0, max: 240, default: 0, unit: "in", required: true, help: "So we send a vehicle it fits in. Measure the box or check the product dimensions." },
      { id: "weight", label: "Heaviest item", type: "select", default: "medium", options: [
        { value: "light", label: "Under 50 lb" }, { value: "medium", label: "50 to 150 lb" }, { value: "heavy", label: "150 to 300 lb" }, { value: "very_heavy", label: "Over 300 lb" },
      ] },
      { id: "miles", label: "Distance from pickup to drop-off", type: "number", min: 0, max: 100, default: 10, unit: "miles" },
      { id: "flights", label: "Flights of stairs at drop-off", type: "number", min: 0, max: 6, default: 0 },
      { id: "assembly", label: "Basic assembly (legs, bed frame, shelving)", type: "toggle", default: false },
      { id: "haul_old", label: "Take away the old one", type: "toggle", default: false },
    ],
    minimum: 89,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once", "weekly"],
    trades: ["hauling"],
    price: (a) => {
      const w = s(a, "weight", "medium");
      const count = Math.max(1, n(a, "items", 1));
      const items: LineItem[] = [{ label: "Pickup & delivery, 2-person crew", amount: 89 }];
      if (count > 1) items.push({ label: `${count - 1} more item${count > 2 ? "s" : ""} × $25`, amount: (count - 1) * 25 });
      const heavy = { light: 0, medium: 0, heavy: 40, very_heavy: 95 }[w] ?? 0;
      if (heavy) items.push({ label: w === "very_heavy" ? "Over 300 lb (3rd mover & equipment)" : "Heavy item (150–300 lb)", amount: heavy });
      const extra = Math.max(0, n(a, "miles", 10) - 10);
      if (extra) items.push({ label: `Drive over 10 miles (${extra} mi)`, amount: Math.round(extra * 1.75) });
      const flights = n(a, "flights");
      if (flights) items.push({ label: `Stairs (${flights} flight${flights > 1 ? "s" : ""})`, amount: flights * 20 * (w === "heavy" || w === "very_heavy" ? 2 : 1) });
      if (b(a, "assembly")) items.push({ label: "Basic assembly", amount: 45 });
      if (b(a, "haul_old")) items.push({ label: "Haul away the old item", amount: 49 });
      return { items, base: sum(items), hours: 1 + (count - 1) * 0.25 + extra / 30 + flights * 0.15 + (b(a, "assembly") ? 0.5 : 0) };
    },
  },
  {
    slug: "staging-transport",
    name: "Home Staging Furniture Moves",
    category: "removal",
    icon: "🛋️",
    tagline: "Staging furniture delivered, placed and picked up after the sale — for stagers and agents.",
    description: "Furniture and decor transport for home stagers and real estate agents: pickup from your warehouse or storage, delivery and placement in the listing, and pickup when the home sells. Book one way or both trips together.",
    includes: ["Truck & 2–3 person crew", "Blankets, wrap & dollies", "Placed where your stager wants it", "Pickup trip when the listing closes (round trip)", "Photo proof of every delivery"],
    questions: [
      { id: "load", label: "How much furniture?", type: "select", default: "rooms", options: [
        { value: "few", label: "A few pieces" }, { value: "rooms", label: "2–3 rooms" }, { value: "half", label: "Half a house" }, { value: "full", label: "A full house" },
      ] },
      { id: "trip", label: "Trips", type: "select", default: "round", options: [{ value: "one", label: "One way (delivery or pickup)" }, { value: "round", label: "Round trip (deliver now, pick up later)" }] },
      { id: "miles", label: "Distance from storage to the listing", type: "number", min: 0, max: 100, default: 15, unit: "miles" },
      { id: "flights", label: "Flights of stairs at the listing", type: "number", min: 0, max: 6, default: 0 },
      { id: "placement", label: "Help placing and setting up", type: "toggle", default: true },
    ],
    minimum: 249,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["hauling"],
    price: (a) => {
      const load = s(a, "load", "rooms");
      const oneTrip = { few: 249, rooms: 449, half: 749, full: 1095 }[load] ?? 449;
      const trips = s(a, "trip", "round") === "round" ? 2 : 1;
      const items: LineItem[] = [{ label: trips === 2 ? "Delivery + pickup trip" : "One trip", amount: oneTrip * trips - (trips === 2 ? Math.round(oneTrip * 0.1) : 0) }];
      const extra = Math.max(0, n(a, "miles", 15) - 15);
      if (extra) items.push({ label: `Drive over 15 miles (${extra} mi, each trip)`, amount: Math.round(extra * 2 * trips) });
      const flights = n(a, "flights");
      if (flights) items.push({ label: `Stairs (${flights} flight${flights > 1 ? "s" : ""}, each trip)`, amount: flights * 35 * trips });
      if (b(a, "placement")) items.push({ label: "Placement & setup", amount: { few: 40, rooms: 90, half: 150, full: 225 }[load] ?? 90 });
      const hours = ({ few: 2, rooms: 3.5, half: 5.5, full: 8 }[load] ?? 3.5) * trips;
      return { items, base: sum(items), hours };
    },
  },
  {
    slug: "unit-turnover",
    name: "Rental Unit Turnover",
    category: "repair_remodel",
    icon: "🔑",
    tagline: "Cleanout, deep clean, touch-ups and punch list — rent-ready in one booking.",
    description: "Everything between one tenant and the next, for landlords and property managers: haul out what was left behind, deep clean top to bottom, patch and touch-up paint, and a handyman punch list (bulbs, outlet covers, doorstops, caulk, small repairs). One booking, one crew lead, before-and-after photos of every room. Full repaints and licensed repairs are quoted separately.",
    includes: ["Cleanout of left-behind items", "Move-out deep clean (inside fridge, oven, cabinets)", "Nail-hole patching & touch-up paint", "Handyman punch list", "Before & after photos of every room"],
    questions: [
      { id: "bedrooms", label: "Bedrooms", type: "number", min: 0, max: 6, default: 2 },
      { id: "bathrooms", label: "Bathrooms", type: "number", min: 1, max: 5, default: 1 },
      { id: "condition", label: "Condition", type: "select", default: "average", options: [
        { value: "light", label: "Light — tenant left it fairly clean" }, { value: "average", label: "Average wear" }, { value: "heavy", label: "Heavy — very dirty or damaged" },
      ] },
      { id: "cleanout", label: "Left-behind items to haul", type: "select", default: "none", options: [
        { value: "none", label: "None" }, { value: "few", label: "A few items" }, { value: "quarter", label: "About a quarter truck" }, { value: "half", label: "About half a truck" },
      ] },
      { id: "touchup", label: "Rooms needing patch & touch-up paint", type: "number", min: 0, max: 10, default: 2 },
      { id: "punch", label: "Punch-list hours", type: "number", min: 0, max: 8, default: 1, help: "Small fixes: bulbs, outlet covers, blinds, caulk, doorstops, loose hardware." },
      { id: "carpet", label: "Shampoo the carpets", type: "toggle", default: false },
    ],
    minimum: 299,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["handyman"],
    price: (a) => {
      const beds = n(a, "bedrooms", 2), baths = Math.max(1, n(a, "bathrooms", 1));
      const cond = { light: 0.85, average: 1, heavy: 1.4 }[s(a, "condition", "average")] ?? 1;
      const clean = Math.round((180 + beds * 45 + baths * 40) * cond);
      const items: LineItem[] = [{ label: "Move-out deep clean", amount: clean }];
      const haul = { none: 0, few: 99, quarter: 199, half: 329 }[s(a, "cleanout", "none")] ?? 0;
      if (haul) items.push({ label: "Cleanout & haul-away", amount: haul });
      const rooms = n(a, "touchup");
      if (rooms) items.push({ label: `Patch & touch-up paint (${rooms} room${rooms > 1 ? "s" : ""})`, amount: rooms * 65 });
      const punch = n(a, "punch");
      if (punch) items.push({ label: `Punch list (${punch} hr${punch > 1 ? "s" : ""})`, amount: punch * 79 });
      if (b(a, "carpet")) items.push({ label: "Carpet shampoo", amount: 60 + beds * 35 });
      const hours = (clean / 45) + (haul ? 1 : 0) + rooms * 0.75 + punch;
      return { items, base: sum(items), hours: Math.round(hours * 2) / 2 };
    },
  },
  {
    slug: "handyman",
    name: "Handyman",
    category: "repair_remodel",
    icon: "🔧",
    tagline: "Your to-do list, done in one visit.",
    description: "Mounting, assembly, drywall patches, doors, fixtures, caulking and small repairs. Book by the hour, materials at cost.",
    includes: ["Vetted, insured handyman", "Tools & basic supplies", "Materials at cost + receipt", "1-year workmanship guarantee"],
    questions: [
      { id: "hours", label: "Estimated hours", type: "number", min: 1, max: 16, default: 2, unit: "hrs", help: "Not sure? Describe tasks and the AI will estimate." },
      { id: "tasks", label: "Number of separate tasks", type: "number", min: 1, max: 20, default: 3 },
      { id: "materials", label: "We should pick up materials", type: "toggle", default: false },
    ],
    minimum: 99,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once", "monthly"],
    trades: ["handyman"],
    price: (a) => {
      const hrs = Math.max(n(a, "hours", 2), Math.ceil(n(a, "tasks", 3) * 0.6));
      const items: LineItem[] = [{ label: `${hrs} hrs labor`, amount: hrs * 95 }];
      if (b(a, "materials")) items.push({ label: "Material run", amount: 45 });
      const base = sum(items);
      return { items, base, hours: hrs };
    },
  },
  {
    slug: "furniture-assembly",
    name: "Furniture Assembly & TV Mounting",
    category: "repair_remodel",
    icon: "🪑",
    tagline: "Flat-pack to finished, priced per piece.",
    description: "Beds, dressers, desks, bookcases, cribs, patio sets, gym equipment and playsets assembled, leveled and anchored to the wall, plus TV mounting with the wires hidden. Priced per piece, so you know the total before we arrive.",
    includes: ["Vetted, insured assembler", "Own tools and drill", "Tall pieces anchored to the wall", "Boxes broken down", "Before & after photos"],
    notesHint: "The pieces (store and model if you have them), which rooms, and stairs or elevator access",
    questions: [
      { id: "small", label: "Small pieces (nightstand, chair, side table, shelf)", type: "number", min: 0, max: 50, default: 0 },
      { id: "medium", label: "Medium pieces (dresser, desk, bookcase, TV stand, crib)", type: "number", min: 0, max: 30, default: 2 },
      { id: "large", label: "Large pieces (bed frame, wardrobe, sectional, entertainment center)", type: "number", min: 0, max: 20, default: 0 },
      { id: "xl", label: "Extra-large (playset, trampoline, shed kit, home gym)", type: "number", min: 0, max: 10, default: 0 },
      { id: "tvs", label: "TVs to mount", type: "number", min: 0, max: 10, default: 0, help: "Bring your own mount or we pick one up at cost. Brick and stone walls need masonry anchors (included)." },
      { id: "hide_wires", label: "Hide the TV wires in the wall", type: "toggle", default: false, help: "For each TV mounted. Not possible on brick or exterior walls." },
      { id: "haul_boxes", label: "Take the boxes and packaging away", type: "toggle", default: false },
    ],
    minimum: 89,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["assembly", "handyman"],
    price: (a) => {
      // Detroit-metro 2026 per-piece market: small $40–$60, medium $75–$110, large $120–$180, playsets/gyms $250–$450,
      // TV mount $100–$160 (+$80–$150 to run wires in the wall).
      const sm = n(a, "small"), md = n(a, "medium"), lg = n(a, "large"), xl = n(a, "xl"), tv = n(a, "tvs");
      const items: LineItem[] = [];
      if (sm) items.push({ label: `Small pieces — ${sm}`, amount: sm * 45 });
      if (md) items.push({ label: `Medium pieces — ${md}`, amount: md * 85 });
      if (lg) items.push({ label: `Large pieces — ${lg}`, amount: lg * 140 });
      if (xl) items.push({ label: `Extra-large pieces — ${xl}`, amount: xl * 325 });
      if (tv) items.push({ label: `TVs mounted — ${tv}`, amount: tv * 129 });
      if (tv && b(a, "hide_wires")) items.push({ label: `Wires hidden in the wall — ${tv} TVs`, amount: tv * 99 });
      if (b(a, "haul_boxes") && items.length) items.push({ label: "Boxes & packaging taken away", amount: 35 });
      if (!items.length) items.push({ label: "Assembly visit", amount: 89 });
      return { items, base: sum(items), hours: Math.max(1, sm * 0.5 + md * 1 + lg * 1.75 + xl * 4 + tv * 1.25) };
    },
  },
  {
    slug: "plumbing",
    name: "Plumbing Repairs",
    category: "repair_remodel",
    icon: "🚰",
    tagline: "Clogs, leaks, toilets, faucets — fixed today.",
    description: "Licensed plumbers for drains, leaks, toilets, faucets, shutoff valves and main-line clogs. Flat-rate prices for common fixes; parts included unless noted.",
    includes: ["Licensed, insured plumber", "Flat-rate pricing", "Standard parts included", "1-year workmanship guarantee"],
    questions: [
      {
        id: "issue",
        label: "What's going on",
        type: "select",
        default: "clog",
        options: [
          { value: "clog", label: "Clogged sink / tub / toilet" },
          { value: "toilet", label: "Toilet running / leaking / replace parts" },
          { value: "faucet", label: "Replace faucet (fixture supplied)" },
          { value: "leak", label: "Leak under sink / pipe repair" },
          { value: "main", label: "Main line backup" },
          { value: "other", label: "Something else (diagnose)" },
        ],
      },
      { id: "count", label: "How many fixtures / problems", type: "number", min: 1, max: 6, default: 1 },
      { id: "emergency", label: "Water actively leaking now", type: "toggle", default: false },
    ],
    minimum: 149,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["plumbing"],
    licensed: true,
    price: (a) => {
      const per = { clog: 199, toilet: 189, faucet: 239, leak: 259, main: 429, other: 169 }[s(a, "issue", "clog")] ?? 199;
      const count = n(a, "count", 1);
      const items: LineItem[] = [{ label: `${count} × ${s(a, "issue", "clog")} repair`, amount: per + Math.max(0, count - 1) * Math.round(per * 0.6) }];
      if (b(a, "emergency")) items.push({ label: "Emergency dispatch", amount: 99 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, count * 1.2) };
    },
  },
  {
    slug: "water-heater",
    name: "Water Heater Replace & Repair",
    category: "repair_remodel",
    icon: "🔥",
    tagline: "New tank, install-only or repair, by licensed plumbers.",
    description: "Replace your water heater with a new standard-grade or value-brand unit (permit, code parts and haul-away included), have us install a new unit you bought, or repair the one you have. Gas or electric, tank or tankless. We install new units only, never used ones: a used tank has no manufacturer warranty and no way to know how long it will last.",
    includes: ["New unit included on replacements", "Licensed plumber", "Permit pulled where required", "Old tank hauled away", "Manufacturer + 1-year labor warranty"],
    questions: [
      {
        id: "job",
        label: "What do you need?",
        type: "select",
        default: "replace",
        options: [
          { value: "replace", label: "Replace: new standard-grade unit" },
          { value: "budget", label: "Replace: new value-brand unit (lowest price)" },
          { value: "install", label: "Install only: I bought a new unit" },
          { value: "repair", label: "Repair my water heater" },
        ],
        help: "Not sure? Pick repair. If it can’t be fixed for a fair price, your plumber quotes a replacement on the spot.",
      },
      {
        id: "type",
        label: "Type",
        type: "select",
        default: "tank50",
        options: [
          { value: "tank40", label: "40-gal tank" },
          { value: "tank50", label: "50-gal tank" },
          { value: "tank75", label: "75-gal tank" },
          { value: "tankless", label: "Tankless" },
        ],
      },
      {
        id: "fuel",
        label: "Fuel",
        type: "select",
        default: "gas",
        options: [
          { value: "gas", label: "Gas" },
          { value: "electric", label: "Electric" },
        ],
      },
      { id: "expansion", label: "Add expansion tank", type: "toggle", default: false, showIf: { id: "job", is: ["replace", "budget", "install"] } },
      { id: "tight", label: "Tight closet / attic install", type: "toggle", default: false, showIf: { id: "job", is: ["replace", "budget", "install"] } },
    ],
    minimum: 175,
    spread: [0.95, 1.15],
    maxCommission: 0.15,
    siteVisit: false,
    frequencies: ["once"],
    trades: ["plumbing"],
    licensed: true,
    // Metro Detroit street prices: standard-grade (Rheem / A.O. Smith / Bradford White builder line) 40–50 gal
    // tank installed ≈ $1,150–1,450; value brand ≈ $175–250 less; install-only labor ≈ $500–900; repair ≈ $150–350.
    // Premium units are a change order, not the default. New units only — never used.
    price: (a) => {
      const job = s(a, "job", "replace");
      const type = s(a, "type", "tank50");
      const gas = s(a, "fuel", "gas") === "gas";
      const fuel = gas ? "gas" : "electric";
      const items: LineItem[] = [];
      if (job === "repair") {
        items.push({ label: `Water heater repair — ${fuel}`, amount: gas ? 245 : 215 });
        if (type === "tankless") items.push({ label: "Tankless descale & service", amount: 100 });
        return { items, base: sum(items), hours: type === "tankless" ? 2.5 : 1.5 };
      }
      if (job === "install") {
        const labor = { tank40: 575, tank50: 575, tank75: 700, tankless: 1150 }[type] ?? 575;
        items.push({ label: `${type} ${fuel} — install only (your new unit)`, amount: gas ? labor + 100 : labor });
      } else {
        const unit = (job === "budget" ? { tank40: 800, tank50: 875, tank75: 1600, tankless: 2600 } : { tank40: 950, tank50: 1050, tank75: 1800, tankless: 2900 })[type] ?? 1050;
        items.push({ label: `${type} ${fuel} — ${job === "budget" ? "value unit" : "unit"} + install`, amount: gas ? unit + 100 : unit });
      }
      items.push({ label: "Permit & code parts", amount: 100 });
      if (b(a, "expansion")) items.push({ label: "Expansion tank", amount: 175 });
      if (b(a, "tight")) items.push({ label: "Difficult access", amount: 250 });
      return { items, base: sum(items), hours: type === "tankless" ? 7 : 4 };
    },
  },
  {
    slug: "hvac-install",
    name: "HVAC Installation",
    category: "repair_remodel",
    icon: "❄️",
    tagline: "AC, furnace, heat pump & mini-splits — free in-home quote.",
    description: "New and replacement heating and cooling systems sized to your home by licensed HVAC contractors. Free in-home load assessment, permit, install and haul-away of old equipment.",
    includes: ["Free in-home assessment", "Licensed HVAC contractor", "Permits & inspection", "Old equipment hauled away", "Manufacturer + labor warranty"],
    questions: [
      {
        id: "system",
        label: "System",
        type: "select",
        default: "ac",
        options: [
          { value: "ac", label: "Central AC" },
          { value: "furnace", label: "Furnace" },
          { value: "full", label: "AC + furnace" },
          { value: "heatpump", label: "Heat pump" },
          { value: "minisplit", label: "Ductless mini-split" },
        ],
      },
      { id: "sqft", label: "Home size", type: "number", min: 500, max: 6000, default: 1800, unit: "sq ft" },
      { id: "zones", label: "Mini-split zones (rooms with their own unit)", type: "number", min: 1, max: 6, default: 1, showIf: { id: "system", is: ["minisplit"] } },
      { id: "ductwork", label: "Ductwork needs repair / replacement", type: "toggle", default: false },
    ],
    minimum: 3500,
    spread: [0.85, 1.3],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["hvac"],
    licensed: true,
    price: (a) => {
      const sys = s(a, "system", "ac");
      const size = Math.max(0.8, Math.min(1.6, n(a, "sqft", 1800) / 1800));
      const base0 = { ac: 6200, furnace: 5200, full: 10500, heatpump: 9000, minisplit: 3800 }[sys] ?? 6200;
      const amt = sys === "minisplit" ? base0 * n(a, "zones", 1) : Math.round(base0 * size);
      const items: LineItem[] = [{ label: `${sys} system installed`, amount: amt }];
      if (b(a, "ductwork")) items.push({ label: "Ductwork allowance", amount: 2500 });
      const base = sum(items);
      return { items, base, hours: base / 400 };
    },
  },
  {
    slug: "lighting-install",
    name: "Lighting & Ceiling Fan Install",
    category: "repair_remodel",
    icon: "💡",
    tagline: "Fixtures, fans, recessed & outdoor lights.",
    description: "Swap fixtures, hang ceiling fans, add recessed or outdoor motion lights. New wiring or circuits are done by a licensed electrician.",
    includes: ["Licensed electrician", "Install & test", "Old fixtures removed", "1-year workmanship guarantee"],
    questions: [
      { id: "fixtures", label: "Replace existing fixtures", type: "number", min: 0, max: 30, default: 2 },
      { id: "fans", label: "Ceiling fans", type: "number", min: 0, max: 10, default: 0 },
      { id: "recessed", label: "New recessed / can lights", type: "number", min: 0, max: 30, default: 0 },
      { id: "outdoor", label: "Outdoor / motion lights", type: "number", min: 0, max: 10, default: 0 },
      { id: "high", label: "Ceilings over 12 ft", type: "toggle", default: false },
    ],
    minimum: 149,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["electrical"],
    licensed: true,
    price: (a) => {
      const items: LineItem[] = [];
      const add = (k: string, label: string, each: number) => { const c = n(a, k); if (c) items.push({ label: `${c} ${label}`, amount: c * each }); };
      add("fixtures", "fixture swap(s)", 119);
      add("fans", "ceiling fan(s)", 209);
      add("recessed", "recessed light(s)", 235);
      add("outdoor", "outdoor light(s)", 159);
      if (b(a, "high")) items.push({ label: "High-ceiling equipment", amount: 120 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, base / 120) };
    },
  },
  {
    slug: "camera-install",
    name: "Security Camera Install",
    category: "repair_remodel",
    icon: "📹",
    tagline: "Doorbells, Wi-Fi & wired cameras — set up on your phone.",
    description: "Mount, wire and configure doorbell cameras, Wi-Fi cameras and wired (PoE) camera systems, then set everything up in your app before we leave.",
    includes: ["Mounting & weatherproofing", "App setup on your phone", "Wire concealment", "Walkthrough before we leave"],
    questions: [
      { id: "doorbell", label: "Video doorbells", type: "number", min: 0, max: 4, default: 1 },
      { id: "wifi", label: "Wi-Fi / battery cameras", type: "number", min: 0, max: 16, default: 2 },
      { id: "wired", label: "Wired (PoE) cameras", type: "number", min: 0, max: 16, default: 0 },
      { id: "nvr", label: "Recorder (NVR) setup", type: "toggle", default: false },
    ],
    minimum: 149,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["low_voltage", "handyman"],
    price: (a) => {
      const items: LineItem[] = [];
      if (n(a, "doorbell")) items.push({ label: `${n(a, "doorbell")} doorbell camera(s)`, amount: n(a, "doorbell") * 149 });
      if (n(a, "wifi")) items.push({ label: `${n(a, "wifi")} Wi-Fi camera(s)`, amount: n(a, "wifi") * 99 });
      if (n(a, "wired")) items.push({ label: `${n(a, "wired")} wired camera(s) incl. cable runs`, amount: n(a, "wired") * 229 });
      if (b(a, "nvr")) items.push({ label: "NVR setup & remote viewing", amount: 129 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, base / 110) };
    },
  },
  {
    slug: "garbage-disposal",
    name: "Garbage Disposal Repair & Replace",
    category: "repair_remodel",
    icon: "🌀",
    tagline: "Unjam, repair or swap in a new unit.",
    description: "Jammed, leaking or dead disposal? We repair it or replace it with a new unit (included) and haul the old one away.",
    includes: ["New unit included on replacements", "Leak test", "Old unit hauled away", "1-year workmanship guarantee"],
    questions: [
      {
        id: "job",
        label: "What do you need",
        type: "select",
        default: "replace_half",
        options: [
          { value: "repair", label: "Repair / unjam" },
          { value: "replace_half", label: "Replace — ½ HP (unit included)" },
          { value: "replace_34", label: "Replace — ¾ HP (unit included)" },
          { value: "install_own", label: "Install a unit I bought" },
          { value: "new", label: "Add a disposal where there isn't one" },
        ],
      },
    ],
    minimum: 149,
    spread: [0.95, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["handyman", "plumbing"],
    price: (a) => {
      const amt = { repair: 149, replace_half: 359, replace_34: 469, install_own: 199, new: 549 }[s(a, "job", "replace_half")] ?? 359;
      const items: LineItem[] = [{ label: "Garbage disposal", amount: amt }];
      return { items, base: amt, hours: 1.5 };
    },
  },
  {
    slug: "small-engine-repair",
    name: "Small Engine Repair",
    category: "repair_remodel",
    icon: "⚙️",
    tagline: "Mowers, snow blowers, generators and more, fixed at your place or ours.",
    description: "Tune-ups and repairs for lawn mowers, riding mowers, snow blowers, generators, chainsaws, trimmers and leaf blowers. A mobile tech comes to you, or we pick it up and bring it back. Parts at cost with the receipt.",
    includes: ["Mobile service or pickup & drop-off", "Oil, plug, filter & carburetor cleaning on tune-ups", "Parts at cost + receipt", "Tested before we hand it back"],
    questions: [
      {
        id: "equipment", label: "Equipment", type: "select", default: "push",
        options: [
          { value: "push", label: "Push mower" },
          { value: "handheld", label: "Trimmer, leaf blower or chainsaw" },
          { value: "snowblower", label: "Snow blower" },
          { value: "generator", label: "Portable generator" },
          { value: "riding", label: "Riding mower / lawn tractor" },
        ],
      },
      {
        id: "service", label: "What it needs", type: "select", default: "tuneup",
        options: [
          { value: "tuneup", label: "Seasonal tune-up (runs, but due for service)" },
          { value: "repair", label: "Repair (won't start, runs rough, leaking, smoking)" },
        ],
      },
      { id: "machines", label: "Number of machines", type: "number", min: 1, max: 10, default: 1, help: "Same type. Different kinds? Note them and we'll price each one." },
      { id: "pickup", label: "Pick it up and bring it back", type: "toggle", default: false, help: "Otherwise the tech works on it at your place." },
    ],
    minimum: 69,
    spread: [0.95, 1.3],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["small_engine"],
    notesHint: "Make and model, what it's doing (won't start, smoking, leaking), when it last ran, where it's kept",
    price: (a) => {
      const eq = s(a, "equipment", "push");
      const tune = { push: 79, handheld: 69, snowblower: 119, generator: 129, riding: 159 }[eq] ?? 79;
      const label = { push: "push mower", handheld: "handheld tool", snowblower: "snow blower", generator: "generator", riding: "riding mower" }[eq] ?? "machine";
      const repair = s(a, "service", "tuneup") === "repair";
      const each = repair ? tune + 50 : tune;
      const k = n(a, "machines", 1);
      const items: LineItem[] = [{ label: `${repair ? "Diagnose & repair labor" : "Tune-up"} — ${label}`, amount: each }];
      if (k > 1) items.push({ label: `${k - 1} more × $${Math.round(each * 0.85)}`, amount: (k - 1) * Math.round(each * 0.85) });
      if (b(a, "pickup")) items.push({ label: eq === "riding" ? "Pickup & return (trailer)" : "Pickup & return", amount: eq === "riding" ? 89 : 45 });
      return { items, base: sum(items), hours: k * (eq === "riding" ? 1.5 : 1) * (repair ? 1.5 : 1) };
    },
  },
  {
    slug: "dock-door-service",
    name: "Loading Dock & Overhead Door Service",
    category: "repair_remodel",
    icon: "🚪",
    tagline: "Inspections, maintenance and repairs for dock doors, levelers and overhead doors.",
    description: "Annual safety inspections with a written report, preventive maintenance and repairs for commercial overhead doors, rolling steel and high-speed doors, dock levelers, seals and restraints. Parts are quoted and approved before any repair.",
    includes: ["Commercial door technician", "Written report with photos for every door", "Springs, cables, rollers, seals & levelers checked", "Parts quoted before any repair"],
    questions: [
      {
        id: "service", label: "Service", type: "select", default: "inspection",
        options: [
          { value: "inspection", label: "Safety inspection & written report" },
          { value: "pm", label: "Inspection + preventive maintenance (lube, adjust, tighten)" },
          { value: "repair", label: "Repair (stuck, off track, broken spring, damaged panel)" },
        ],
      },
      {
        id: "kind", label: "Mostly", type: "select", default: "overhead",
        options: [
          { value: "overhead", label: "Sectional overhead doors" },
          { value: "rolling", label: "Rolling steel or high-speed doors" },
          { value: "dock", label: "Dock positions (door, leveler, seals & restraint)" },
        ],
      },
      { id: "doors", label: "Number of doors or dock positions", type: "number", min: 1, max: 60, default: 4, help: "For repairs: how many need work." },
      { id: "after_hours", label: "After hours or weekend", type: "toggle", default: false, help: "So the work doesn't slow your shipping and receiving." },
    ],
    minimum: 195,
    spread: [0.9, 1.35],
    siteVisit: false,
    frequencies: ["once", "quarterly"],
    trades: ["dock_door"],
    notesHint: "Number and type of doors or docks, make if known, what's wrong, receiving hours, and the site contact",
    price: (a) => {
      const svc = s(a, "service", "inspection");
      const kind = s(a, "kind", "overhead");
      const k = n(a, "doors", 4);
      const items: LineItem[] = [{ label: "Service call", amount: 95 }];
      if (svc === "repair") items.push({ label: `Repair labor, first hour — ${k} door${k > 1 ? "s" : ""} × $145`, amount: k * 145 });
      else {
        const per = ({ overhead: 45, rolling: 60, dock: 75 }[kind] ?? 45) + (svc === "pm" ? 40 : 0);
        items.push({ label: `${svc === "pm" ? "Inspection & maintenance" : "Inspection"} — ${k} door${k > 1 ? "s" : ""} × $${per}`, amount: k * per });
      }
      if (b(a, "after_hours")) items.push({ label: "After hours or weekend", amount: 150 });
      return { items, base: sum(items), hours: 0.5 + k * (svc === "repair" ? 1 : svc === "pm" ? 0.75 : 0.4) };
    },
  },
  {
    slug: "fire-extinguisher-inspection",
    name: "Fire Extinguisher Inspection & Service",
    category: "repair_remodel",
    icon: "🧯",
    tagline: "Annual inspections, tags, recharges and new extinguishers, done on site.",
    description: "Annual fire extinguisher inspections by a state-certified technician, with a new tag on every unit and a written report for your fire marshal or insurer. Recharges, hydrostatic tests and new extinguishers on the same visit.",
    includes: ["State-certified technician", "New inspection tag on every extinguisher", "Written report for the fire marshal or insurer", "Recharges and replacements on the same visit"],
    questions: [
      { id: "units", label: "Extinguishers to inspect", type: "number", min: 1, max: 300, default: 6 },
      { id: "recharge", label: "Need recharging (used or low pressure)", type: "number", min: 0, max: 100, default: 0 },
      { id: "hydro", label: "Due for a hydrostatic test", type: "number", min: 0, max: 100, default: 0, help: "Every 5 or 12 years depending on type; the date is on the label. Not sure? The tech checks." },
      { id: "new_units", label: "New extinguishers to buy and mount (5 lb ABC)", type: "number", min: 0, max: 50, default: 0 },
    ],
    minimum: 79,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["fire_safety"],
    licensed: true,
    notesHint: "How many extinguishers and where, types if you know (ABC, CO2, kitchen K-class), the date on the last tag, any that were used",
    price: (a) => {
      const k = n(a, "units", 6);
      const items: LineItem[] = [{ label: "Service call", amount: 59 }, { label: `Annual inspection & tag — ${k} × $12`, amount: k * 12 }];
      const r = n(a, "recharge"), h = n(a, "hydro"), nu = n(a, "new_units");
      if (r) items.push({ label: `Recharge — ${r} × $35`, amount: r * 35 });
      if (h) items.push({ label: `Hydrostatic test — ${h} × $45`, amount: h * 45 });
      if (nu) items.push({ label: `New 5 lb ABC extinguisher, mounted — ${nu} × $79`, amount: nu * 79 });
      return { items, base: sum(items), hours: 0.5 + k * 0.1 + (r + h) * 0.25 + nu * 0.2 };
    },
  },
  {
    slug: "interior-painting",
    name: "Interior Painting",
    category: "repair_remodel",
    icon: "🖌️",
    tagline: "A room, a few areas, or the whole house or office.",
    description: "Walls, ceilings, trim and doors for single rooms, hallways and stairwells, whole homes, offices and commercial interiors. Furniture moved and covered, minor patching, two coats, clean lines and a spotless cleanup. Paint included.",
    includes: ["Licensed, insured painters", "Premium paint & primer included", "Furniture moved & floors covered", "Minor nail-hole patching", "Two coats, clean cut lines", "Daily cleanup & before/after photos"],
    questions: [
      { id: "property", label: "Property", type: "select", default: "home", options: [{ value: "home", label: "Home / apartment" }, { value: "office", label: "Office / commercial" }] },
      { id: "rooms", label: "Rooms or areas (a hallway or stairwell counts as one)", type: "number", min: 1, max: 40, default: 2 },
      { id: "room_sqft", label: "Average room size (floor)", type: "number", min: 0, max: 5000, default: 0, unit: "sq ft", required: true, help: "Length × width of a typical room in feet (a 12 × 12 bedroom is 144 sq ft).", sets: { id: "size", tiers: [[99, "small"], [200, "medium"], [Infinity, "large"]], scaleAbove: 300 } },
      { id: "size", label: "Typical room size", type: "select", default: "medium", options: [{ value: "small", label: "Small (bath, closet, under 100 sq ft)" }, { value: "medium", label: "Medium (bedroom, 100–200 sq ft)" }, { value: "large", label: "Large (living room, open plan, 200+ sq ft)" }] },
      { id: "ceilings", label: "Paint ceilings too", type: "toggle", default: false },
      { id: "trim", label: "Trim, baseboards & doors", type: "toggle", default: false },
      { id: "color_change", label: "Big color change (dark to light, or bold colors)", type: "toggle", default: false },
      { id: "repairs", label: "Drywall repairs beyond nail holes (cracks, dents, patches)", type: "toggle", default: false },
      { id: "high", label: "Ceilings over 10 ft / stairwell walls", type: "toggle", default: false },
    ],
    minimum: 349,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["painting"],
    licensed: true,
    price: (a) => {
      const rooms = n(a, "rooms", 2);
      const size = s(a, "size", "medium");
      const per = { small: 275, medium: 395, large: 575 }[size] ?? 395;
      const items: LineItem[] = [{ label: `${rooms} ${size} room${rooms > 1 ? "s" : ""}/area${rooms > 1 ? "s" : ""} — walls, 2 coats`, amount: rooms * per }];
      if (b(a, "ceilings")) items.push({ label: "Ceilings", amount: rooms * ({ small: 90, medium: 140, large: 210 }[size] ?? 140) });
      if (b(a, "trim")) items.push({ label: "Trim, baseboards & doors", amount: rooms * ({ small: 90, medium: 130, large: 180 }[size] ?? 130) });
      if (b(a, "repairs")) items.push({ label: "Drywall repairs", amount: rooms * 85 });
      let base = sum(items);
      if (b(a, "color_change")) { const x = Math.round(base * 0.2); items.push({ label: "Extra coat for the color change", amount: x }); base += x; }
      if (b(a, "high")) { const x = Math.round(base * 0.15); items.push({ label: "High ceilings / stairwell staging", amount: x }); base += x; }
      if (s(a, "property", "home") === "office") { const x = Math.round(base * 0.1); items.push({ label: "Commercial scheduling & protection", amount: x }); base += x; }
      return { items, base, hours: rooms * ({ small: 3, medium: 5, large: 7.5 }[size] ?? 5) * (b(a, "ceilings") ? 1.3 : 1) * (b(a, "trim") ? 1.25 : 1) };
    },
  },
  {
    slug: "exterior-painting",
    name: "Exterior Painting",
    category: "repair_remodel",
    icon: "🏡",
    tagline: "Houses and buildings — siding, trim, doors and decks.",
    description: "Full exterior repaints for houses, townhomes and commercial buildings: power wash, scrape and sand, prime bare spots, caulk, and two coats on siding, trim, doors and shutters. Lead-safe practices for pre-1978 homes. Paint included.",
    includes: ["Licensed, insured painters", "Power wash & surface prep", "Scrape, sand, prime & caulk", "Two coats on siding & trim", "Lead-safe (EPA RRP) for pre-1978 homes", "Before/after photos & walkthrough"],
    questions: [
      { id: "building", label: "Building", type: "select", default: "house", options: [{ value: "house", label: "House" }, { value: "townhome", label: "Townhome / duplex" }, { value: "commercial", label: "Commercial building" }] },
      { id: "sqft", label: "Building size (finished sq ft)", type: "number", min: 500, max: 25000, default: 1800, unit: "sq ft" },
      { id: "stories", label: "Height", type: "select", default: "2", options: STORIES },
      { id: "siding", label: "Siding", type: "select", default: "wood", options: [{ value: "vinyl", label: "Vinyl / aluminum" }, { value: "wood", label: "Wood / fiber cement" }, { value: "masonry", label: "Brick / stucco / block" }] },
      { id: "trim_only", label: "Trim, doors & shutters only (not the siding)", type: "toggle", default: false },
      { id: "heavy_prep", label: "Peeling or bare wood (heavy scraping)", type: "toggle", default: false },
      { id: "deck", label: "Also stain or paint a deck / porch", type: "toggle", default: false },
    ],
    minimum: 1200,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["painting"],
    licensed: true,
    leadDays: 3,
    price: (a) => {
      const sqft = n(a, "sqft", 1800);
      const height = { "1": 1, "2": 1.15, "3": 1.35 }[s(a, "stories", "2")] ?? 1.15;
      const rate = { vinyl: 2.1, wood: 2.6, masonry: 2.9 }[s(a, "siding", "wood")] ?? 2.6;
      const items: LineItem[] = b(a, "trim_only")
        ? [{ label: `Trim, doors & shutters (${sqft} sq ft building)`, amount: Math.round(sqft * 0.95 * height) }]
        : [{ label: `Siding & trim — ${sqft} sq ft ${s(a, "building", "house")}`, amount: Math.round(sqft * rate * height) }];
      let base = sum(items);
      if (b(a, "heavy_prep")) { const x = Math.round(base * 0.2); items.push({ label: "Heavy scraping & priming", amount: x }); base += x; }
      if (b(a, "deck")) { items.push({ label: "Deck / porch stain or paint", amount: 650 }); base += 650; }
      if (s(a, "building", "house") === "commercial") { const x = Math.round(base * 0.12); items.push({ label: "Commercial staging, lifts & scheduling", amount: x }); base += x; }
      return { items, base, hours: Math.max(8, (sqft / 120) * height * (b(a, "trim_only") ? 0.4 : 1)) };
    },
  },
  {
    slug: "foundation-repair",
    name: "Foundation Repair",
    category: "repair_remodel",
    icon: "🧱",
    tagline: "Cracks, bowing walls and settling, fixed by a licensed contractor.",
    description: "Foundation crack injection, bowing-wall bracing, piers for settling, and interior drain tile with a sump for wet basements. A licensed contractor inspects first and gives a firm written price before any work.",
    includes: ["Free site visit and written estimate", "Licensed contractor, permits where required", "Contractor's written warranty", "Before & after photos"],
    questions: [
      { id: "cracks", label: "Cracks to seal (injection)", type: "number", min: 0, max: 20, default: 2, help: "Leaking or wider than a credit card. Hairline cracks usually don't need repair." },
      { id: "walls", label: "Bowing or leaning walls to brace", type: "number", min: 0, max: 4, default: 0 },
      { id: "piers", label: "Piers for settling (sloping floors, stair-step cracks)", type: "number", min: 0, max: 30, default: 0, help: "Your best guess. The site visit confirms how many." },
      { id: "drain_ft", label: "Feet of interior drain tile & sump (wet basement)", type: "number", min: 0, max: 400, default: 0, unit: "ft" },
    ],
    minimum: 550,
    spread: [0.85, 1.3],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["foundation"],
    licensed: true,
    notesHint: "What you're seeing (cracks, water, bowing, sloping floors), where, for how long, and the basement type (poured, block, crawlspace)",
    price: (a) => {
      const c = n(a, "cracks", 2), w = n(a, "walls"), p = n(a, "piers"), d = n(a, "drain_ft");
      const items: LineItem[] = [];
      if (c) items.push({ label: `Crack injection — ${c} × $550`, amount: c * 550 });
      if (w) items.push({ label: `Wall bracing — ${w} wall${w > 1 ? "s" : ""} × $4,000`, amount: w * 4000 });
      if (p) items.push({ label: `Piers — ${p} × $1,500`, amount: p * 1500 });
      if (d) items.push({ label: `Interior drain tile — ${d} ft × $65, plus sump`, amount: d * 65 + 1200 });
      if (!items.length) items.push({ label: "Foundation inspection & repair", amount: 550 });
      return { items, base: sum(items), hours: Math.max(4, c * 3 + w * 8 + p * 3 + d / 15) };
    },
  },
  {
    slug: "mold-removal",
    name: "Mold Removal",
    category: "repair_remodel",
    icon: "🦠",
    tagline: "Mold found, contained and removed by a certified remediation pro — and the moisture behind it found.",
    description: "Mold remediation by a certified pro: the area is sealed off with plastic and negative air, moldy drywall, insulation and carpet are removed and bagged, surfaces are HEPA-vacuumed and treated, and the space is dried. The pro finds the moisture source (leak, humidity, poor venting) and tells you how to fix it, so the mold doesn't come back. Testing before and after is optional — we recommend an independent lab test after big jobs. Large or spreading growth gets a free site visit and a firm price first.",
    includes: ["Certified remediation pro (IICRC or equal)", "Containment and negative-air HEPA filtration", "Removal and bagging of moldy materials", "HEPA vacuuming and antimicrobial treatment", "Moisture source found and explained", "Before & after photos"],
    notesHint: "Where the mold is, how big an area, how long it's been there, any leak or flooding, a musty smell, and whether anyone in the home has asthma or allergies",
    questions: [
      { id: "sqft", label: "Moldy area", type: "number", min: 1, max: 2000, default: 20, unit: "sq ft", help: "Your best guess of the visible growth. 10 sq ft is about a 3 × 3 ft patch. Over 100 sq ft gets a free site visit first." },
      {
        id: "location",
        label: "Where is it?",
        type: "select",
        default: "basement",
        options: [
          { value: "bathroom", label: "Bathroom or laundry" },
          { value: "room", label: "Walls or ceiling in a living area" },
          { value: "basement", label: "Basement" },
          { value: "crawlspace", label: "Crawlspace" },
          { value: "attic", label: "Attic" },
        ],
      },
      { id: "remove", label: "Moldy drywall, insulation or carpet to remove", type: "toggle", default: true, help: "Porous materials with mold growing in them are cut out and bagged, not just cleaned. Rebuilding drywall is a separate handyman job." },
      { id: "hvac", label: "Mold in the furnace or air ducts too", type: "toggle", default: false },
      {
        id: "testing",
        label: "Mold testing",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "No testing — the mold is visible" },
          { value: "before", label: "Inspection & air test before (find hidden mold)" },
          { value: "after", label: "Clearance test after (proof it's gone)" },
          { value: "both", label: "Both before and after" },
        ],
        help: "Lab results in 2–3 business days. Clearance tests are done by an independent tester, not the crew that did the work.",
      },
    ],
    minimum: 450,
    spread: [0.85, 1.35],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["mold"],
    price: (a) => {
      const sq = Math.max(1, n(a, "sqft", 20));
      const loc = s(a, "location", "basement");
      const setup = ({ bathroom: 400, room: 550, basement: 750, crawlspace: 950, attic: 1050 } as Record<string, number>)[loc] ?? 750;
      const items: LineItem[] = [{ label: `Containment, HEPA air & cleanup — ${sq} sq ft`, amount: setup + sq * 16 }];
      if (b(a, "remove")) items.push({ label: `Remove & bag moldy materials — ${sq} sq ft`, amount: sq * 7 });
      if (b(a, "hvac")) items.push({ label: "Furnace & duct mold cleaning", amount: 650 });
      const test = s(a, "testing", "none");
      if (test === "before" || test === "both") items.push({ label: "Mold inspection & air test (before)", amount: 375 });
      if (test === "after" || test === "both") items.push({ label: "Clearance air test (after)", amount: 325 });
      return { items, base: sum(items), hours: Math.max(3, 2 + sq / 25 + (b(a, "remove") ? sq / 40 : 0) + (b(a, "hvac") ? 3 : 0)) };
    },
  },
  {
    slug: "roofing",
    name: "Roof Repair & Replacement",
    category: "repair_remodel",
    icon: "🏠",
    tagline: "Leaks stopped, shingles replaced, or a whole new roof, by a licensed roofer.",
    description: "Leak and storm repairs, missing or damaged shingles, flashing around chimneys, skylights and vents, and full tear-off and replacement in architectural asphalt shingles or a flat-roof membrane. Repairs are priced instantly; a full replacement is measured on site first and gets a firm written price. Permits, dumpster and cleanup with a magnet sweep included.",
    includes: ["Licensed, insured roofer", "Permit pulled where required", "Dumpster, cleanup and magnet sweep", "Manufacturer's shingle warranty plus the roofer's workmanship warranty", "Before & after photos (roof and attic)"],
    notesHint: "Where it leaks or what's damaged, the roof's age, how many layers you think it has, and any skylights or chimneys",
    questions: [
      {
        id: "work",
        label: "What do you need?",
        type: "select",
        default: "repair",
        options: [
          { value: "inspection", label: "Inspection & written report" },
          { value: "repair", label: "Leak or shingle repair" },
          { value: "replace", label: "Full roof replacement" },
        ],
      },
      { id: "areas", label: "Areas to repair", type: "number", min: 1, max: 10, default: 1, help: "Each leak or damaged spot (up to about 100 sq ft each).", showIf: { id: "work", is: ["repair"] } },
      { id: "flashing", label: "Chimney, skylight or wall flashing to redo", type: "number", min: 0, max: 6, default: 0, showIf: { id: "work", is: ["repair", "replace"] } },
      { id: "roof_sqft", label: "Roof area", type: "number", min: 0, max: 20000, default: 0, unit: "sq ft", required: true, help: "Not sure? House footprint × 1.2 for a typical pitched roof (a 1,500 sq ft ranch is about 1,800 sq ft of roof). The roofer measures exactly before the firm price.", showIf: { id: "work", is: ["replace"] } },
      { id: "material", label: "New roof", type: "select", default: "asphalt", options: [{ value: "asphalt", label: "Architectural asphalt shingles" }, { value: "flat", label: "Flat roof membrane (EPDM / modified bitumen)" }], showIf: { id: "work", is: ["replace"] } },
      { id: "layers", label: "Layers to tear off", type: "select", default: "1", options: [{ value: "1", label: "1 layer" }, { value: "2", label: "2 layers" }, { value: "3", label: "3 layers" }], showIf: { id: "work", is: ["replace"] } },
      { id: "decking", label: "Sheets of rotted decking to replace (estimate)", type: "number", min: 0, max: 100, default: 0, help: "Usually found during tear-off; you're only charged for sheets actually replaced.", showIf: { id: "work", is: ["replace"] } },
      { id: "stories", label: "Height", type: "select", default: "1", options: STORIES },
      { id: "steep", label: "Steep roof (hard to walk on)", type: "toggle", default: false },
    ],
    minimum: 225,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["roofing"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: inspection $175–$300, leak/shingle repair $350–$900, flashing $350–$650,
      // tear-off & architectural shingles $450–$650 per square (100 sq ft), flat membrane $650–$900 per square,
      // extra layer $60–$100 per square, decking $75–$110 per sheet.
      const work = s(a, "work", "repair");
      const height = { "1": 1, "2": 1.12, "3": 1.25 }[s(a, "stories", "1")] ?? 1;
      const pitch = b(a, "steep") ? 1.15 : 1;
      const fl = n(a, "flashing");
      const items: LineItem[] = [];
      if (work === "inspection") items.push({ label: "Roof & attic inspection with written report", amount: 225 });
      else if (work === "repair") {
        const ar = Math.max(1, n(a, "areas", 1));
        items.push({ label: `Leak & shingle repair — ${ar} area${ar > 1 ? "s" : ""}`, amount: Math.round((450 + (ar - 1) * 275) * height * pitch) });
      } else {
        const sq = Math.max(10, Math.ceil(n(a, "roof_sqft") / 100) || 18);
        const flat = s(a, "material", "asphalt") === "flat";
        items.push({ label: `Tear-off & new ${flat ? "flat roof membrane" : "architectural shingles"} — ${sq} squares`, amount: Math.round(sq * (flat ? 775 : 525) * height * pitch) });
        const extra = Number(s(a, "layers", "1")) - 1;
        if (extra > 0) items.push({ label: `Extra layer tear-off — ${extra} × ${sq} squares`, amount: extra * sq * 80 });
        const dk = n(a, "decking");
        if (dk) items.push({ label: `Decking replacement — ${dk} sheets`, amount: dk * 95 });
        items.push({ label: "Permit, dumpster & cleanup", amount: 650 });
      }
      if (fl && work !== "inspection") items.push({ label: `Flashing redone — ${fl}`, amount: fl * 450 });
      const base = sum(items);
      return { items, base, hours: work === "inspection" ? 1.5 : work === "repair" ? Math.max(3, base / 110) : Math.max(16, base / 95) };
    },
  },
  {
    slug: "masonry",
    name: "Masonry & Brick Repair",
    category: "repair_remodel",
    icon: "🧱",
    tagline: "Tuckpointing, brick replacement, chimneys and walls, by a licensed mason.",
    description: "Brick and block repair for homes and buildings: tuckpointing worn mortar joints, replacing cracked or spalling bricks with the closest match, chimney crowns and rebuilds above the roof, brick steps, and new block retaining or garden walls. A licensed mason does the work; big chimney and wall jobs get a free site visit first.",
    includes: ["Licensed, insured mason", "Mortar color matched as closely as possible", "Brick matched from local yards", "Scaffold or lift when needed", "Cleanup and before & after photos"],
    notesHint: "What's cracked or crumbling, where (chimney, front wall, steps, foundation above grade), the brick color, and how high it is",
    questions: [
      { id: "tuck_sqft", label: "Wall area to tuckpoint (repoint mortar)", type: "number", min: 0, max: 5000, default: 50, unit: "sq ft", help: "Measure the patch of worn or missing mortar: width × height in feet." },
      { id: "bricks", label: "Cracked or crumbling bricks to replace", type: "number", min: 0, max: 500, default: 0 },
      {
        id: "chimney",
        label: "Chimney",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "No chimney work" },
          { value: "crown", label: "New crown (concrete cap) & seal" },
          { value: "rebuild", label: "Rebuild above the roofline" },
        ],
      },
      { id: "wall_sqft", label: "New block retaining or garden wall (face area)", type: "number", min: 0, max: 2000, default: 0, unit: "sq ft", help: "Length × height of the wall face. Walls over 4 ft tall need an engineer and a site visit." },
      { id: "stories", label: "Height of the work", type: "select", default: "1", options: STORIES },
    ],
    minimum: 450,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["masonry"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: tuckpointing $12–$22/sq ft, brick replacement $25–$50 per brick, chimney crown $750–$1,500,
      // rebuild above roofline $3,000–$5,500, segmental block wall $35–$55 per face sq ft.
      const height = { "1": 1, "2": 1.2, "3": 1.4 }[s(a, "stories", "1")] ?? 1;
      const t = n(a, "tuck_sqft"), br = n(a, "bricks"), w = n(a, "wall_sqft");
      const items: LineItem[] = [];
      if (t) items.push({ label: `Tuckpointing — ${t} sq ft`, amount: Math.round(t * 16 * height) });
      if (br) items.push({ label: `Brick replacement — ${br} bricks`, amount: Math.round(br * 38 * height) });
      const ch = s(a, "chimney", "none");
      if (ch === "crown") items.push({ label: "Chimney crown & seal", amount: 1100 });
      if (ch === "rebuild") items.push({ label: "Chimney rebuild above the roofline", amount: 4200 });
      if (w) items.push({ label: `Block retaining / garden wall — ${w} sq ft`, amount: w * 45 });
      if (!items.length) items.push({ label: "Masonry repair visit", amount: 450 });
      if (height > 1 && (t || br)) items.push({ label: "Scaffold or lift", amount: height > 1.2 ? 450 : 250 });
      const base = sum(items);
      return { items, base, hours: Math.max(4, base / 85) };
    },
  },
  {
    slug: "concrete-repair",
    name: "Concrete Steps, Patios & Sidewalks",
    category: "repair_remodel",
    icon: "🪨",
    tagline: "Crumbling steps, sunken slabs and cracked walks, fixed or replaced.",
    description: "Concrete work by a licensed contractor: front and back steps resurfaced or rebuilt, handrails, patios, sidewalks and driveway sections poured new, sunken slabs lifted level, and cracks routed and sealed. Old concrete broken out and hauled away. Larger pours get a free site visit and a firm written price.",
    includes: ["Licensed, insured concrete contractor", "Forms, gravel base and reinforcement", "Old concrete hauled away", "Broom finish (stamped optional)", "Before & after photos"],
    notesHint: "What's damaged (steps, patio, walk, driveway), the size, whether water pools there, and access for a truck",
    questions: [
      { id: "steps_fix", label: "Steps to resurface or patch", type: "number", min: 0, max: 30, default: 3, help: "Each step (tread). Good for chipped or flaking steps that are still solid." },
      { id: "steps_new", label: "Steps to break out and pour new", type: "number", min: 0, max: 30, default: 0, help: "Each step (tread). For steps that are cracked through, sinking or pulling from the house." },
      { id: "railing", label: "New metal handrail", type: "toggle", default: false },
      { id: "slab_sqft", label: "Patio, sidewalk or driveway to pour new", type: "number", min: 0, max: 5000, default: 0, unit: "sq ft", help: "Length × width in feet. A sidewalk square is about 4 × 4 = 16 sq ft." },
      { id: "tear_out", label: "Break out and haul away the old concrete there", type: "toggle", default: true },
      { id: "stamped", label: "Stamped / colored finish", type: "toggle", default: false },
      { id: "lift_sqft", label: "Sunken slab to lift level (mudjacking / foam)", type: "number", min: 0, max: 3000, default: 0, unit: "sq ft" },
      { id: "crack_ft", label: "Cracks to route & seal", type: "number", min: 0, max: 1000, default: 0, unit: "ft" },
    ],
    minimum: 400,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["concrete"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: step resurfacing $125–$200 per step, new poured steps $400–$650 per step plus footing,
      // new broom-finish slab $9–$14/sq ft (+$3–$5 stamped), tear-out $2–$4/sq ft, lifting $5–$8/sq ft,
      // crack routing & sealing $3–$6/ft, handrail $350–$600.
      const fix = n(a, "steps_fix"), nw = n(a, "steps_new"), slab = n(a, "slab_sqft"), lift = n(a, "lift_sqft"), cr = n(a, "crack_ft");
      const items: LineItem[] = [];
      if (fix) items.push({ label: `Step resurfacing — ${fix} steps`, amount: fix * 165 });
      if (nw) items.push({ label: `New poured steps — ${nw} steps, with footing`, amount: nw * 525 + 600 });
      if (b(a, "railing")) items.push({ label: "Metal handrail", amount: 450 });
      if (slab) {
        items.push({ label: `New concrete — ${slab} sq ft`, amount: Math.round(slab * 11) });
        if (b(a, "tear_out")) items.push({ label: `Break out & haul away old concrete — ${slab} sq ft`, amount: Math.round(slab * 3) });
        if (b(a, "stamped")) items.push({ label: `Stamped / colored finish — ${slab} sq ft`, amount: Math.round(slab * 4) });
      }
      if (lift) items.push({ label: `Slab lifting — ${lift} sq ft`, amount: Math.max(450, Math.round(lift * 6.5)) });
      if (cr) items.push({ label: `Crack routing & sealing — ${cr} ft`, amount: Math.max(150, Math.round(cr * 4.5)) });
      if (!items.length) items.push({ label: "Concrete repair visit", amount: 400 });
      const base = sum(items);
      return { items, base, hours: Math.max(3, base / 90) };
    },
  },
  {
    slug: "demolition",
    name: "Demolition & Tear-Out",
    category: "removal",
    icon: "🔨",
    tagline: "Sheds, decks, garages, pools and rooms torn out and hauled away.",
    description: "Small demolition by a licensed contractor: interior tear-outs (kitchens, bathrooms, drywall, flooring), sheds, decks and porches, above-ground pools, concrete slabs and detached garages. Utilities are confirmed disconnected first, permits pulled where required, and all debris hauled away. Garages and anything over 400 sq ft get a free site visit and a firm price.",
    includes: ["Licensed, insured demolition crew", "Permit pulled where required", "Utilities confirmed off before work", "All debris hauled & dumped", "Site left broom-clean or raked", "Before & after photos"],
    notesHint: "What's coming down, its size and material, what stays, and whether a truck can get close",
    questions: [
      {
        id: "kind",
        label: "What's being torn out?",
        type: "select",
        default: "interior",
        options: [
          { value: "interior", label: "Interior room (kitchen, bath, drywall, flooring)" },
          { value: "shed", label: "Shed or playset" },
          { value: "deck", label: "Deck or porch" },
          { value: "pool", label: "Above-ground pool" },
          { value: "slab", label: "Concrete slab, patio or walk" },
          { value: "garage", label: "Detached garage" },
        ],
      },
      { id: "sqft", label: "Size", type: "number", min: 0, max: 5000, default: 0, unit: "sq ft", required: true, help: "Floor area of the room, shed, deck or garage, or the slab's length × width. A pool: its footprint (a 24 ft round pool is about 450 sq ft)." },
      { id: "stories", label: "Floor of the house (interior work)", type: "select", default: "1", options: [{ value: "1", label: "Ground floor or basement" }, { value: "2", label: "Upstairs" }], showIf: { id: "kind", is: ["interior"] } },
      { id: "slab_too", label: "Also break out the concrete slab or footings under it", type: "toggle", default: false, showIf: { id: "kind", is: ["shed", "deck", "garage"] } },
      { id: "fill", label: "Fill, grade and seed the area after", type: "toggle", default: false, showIf: { id: "kind", is: ["shed", "deck", "pool", "slab", "garage"] } },
    ],
    minimum: 450,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["demolition"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026 incl. haul & dump: interior tear-out $5–$9/sq ft, shed $5–$8/sq ft (min ~$500),
      // deck/porch $8–$12/sq ft, above-ground pool $600–$1,200, slab break-out $4–$7/sq ft,
      // detached garage $12–$18/sq ft (2-car ~$5,000–$7,500 incl. permit).
      const kind = s(a, "kind", "interior");
      const sq = n(a, "sqft") || ({ interior: 150, shed: 100, deck: 200, pool: 450, slab: 200, garage: 400 } as Record<string, number>)[kind] || 150;
      const items: LineItem[] = [];
      if (kind === "interior") items.push({ label: `Interior tear-out — ${sq} sq ft`, amount: Math.round(sq * 7 * (s(a, "stories", "1") === "2" ? 1.15 : 1)) });
      if (kind === "shed") items.push({ label: `Shed or playset demolition — ${sq} sq ft`, amount: Math.max(500, Math.round(sq * 6.5)) });
      if (kind === "deck") items.push({ label: `Deck or porch demolition — ${sq} sq ft`, amount: Math.round(sq * 10) });
      if (kind === "pool") items.push({ label: "Above-ground pool removal", amount: Math.max(750, Math.round(sq * 1.9)) });
      if (kind === "slab") items.push({ label: `Concrete break-out — ${sq} sq ft`, amount: Math.round(sq * 5.5) });
      if (kind === "garage") items.push({ label: `Detached garage demolition — ${sq} sq ft`, amount: Math.round(sq * 14) });
      if (b(a, "slab_too") && ["shed", "deck", "garage"].includes(kind)) items.push({ label: `Slab & footing break-out — ${sq} sq ft`, amount: Math.round(sq * 4.5) });
      if (b(a, "fill") && kind !== "interior") items.push({ label: `Fill, grade & seed — ${sq} sq ft`, amount: Math.max(250, Math.round(sq * 1.25)) });
      if (["garage", "interior"].includes(kind)) items.push({ label: "Permit & utility disconnect check", amount: kind === "garage" ? 450 : 150 });
      const base = sum(items);
      return { items, base, hours: Math.max(3, base / 95) };
    },
  },
  {
    slug: "fence-install",
    name: "Fence Install & Repair",
    category: "repair_remodel",
    icon: "🚧",
    tagline: "New fences and gates, or leaning posts and broken sections fixed.",
    description: "Chain link, wood privacy, vinyl and ornamental aluminum fences installed with posts set in concrete, plus walk and drive gates. Repairs reset leaning posts and replace broken boards or sections. Utility lines are marked (MISS DIG) before any digging, and the old fence can be torn out and hauled away. Over 300 ft gets a free site visit first.",
    includes: ["Licensed, insured fence contractor", "MISS DIG utility marking before digging", "Posts set in concrete", "Materials included (standard grade)", "Old fence hauled away when booked", "Before & after photos"],
    notesHint: "Where the fence goes (or what's broken), the property line markers if you know them, gates you need, and any HOA rules",
    questions: [
      { id: "job", label: "New fence or repair?", type: "select", default: "new", options: [{ value: "new", label: "New fence" }, { value: "repair", label: "Repair an existing fence" }] },
      { id: "feet", label: "Length of fence", type: "number", min: 0, max: 2000, default: 0, unit: "ft", required: true, help: "Walk the line or measure on Google Maps. A typical city backyard is 120–180 ft.", showIf: { id: "job", is: ["new"] } },
      { id: "material", label: "Fence type", type: "select", default: "wood", options: [{ value: "chain", label: "Chain link" }, { value: "wood", label: "Wood privacy" }, { value: "vinyl", label: "Vinyl privacy" }, { value: "aluminum", label: "Ornamental aluminum" }], showIf: { id: "job", is: ["new"] } },
      { id: "height", label: "Height", type: "select", default: "6", options: [{ value: "4", label: "4 ft" }, { value: "6", label: "6 ft" }], showIf: { id: "job", is: ["new"] } },
      { id: "walk_gates", label: "Walk gates", type: "number", min: 0, max: 6, default: 1, showIf: { id: "job", is: ["new"] } },
      { id: "drive_gates", label: "Double drive gates", type: "number", min: 0, max: 3, default: 0, showIf: { id: "job", is: ["new"] } },
      { id: "remove_old", label: "Tear out and haul away the old fence", type: "toggle", default: false, showIf: { id: "job", is: ["new"] } },
      { id: "posts", label: "Leaning or broken posts to reset or replace", type: "number", min: 0, max: 30, default: 2, showIf: { id: "job", is: ["repair"] } },
      { id: "sections", label: "Broken boards or sections to replace (8 ft each)", type: "number", min: 0, max: 30, default: 1, showIf: { id: "job", is: ["repair"] } },
    ],
    minimum: 350,
    spread: [0.9, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["fence_deck"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026 installed per foot: chain link $20–$28, wood privacy $32–$45, vinyl $42–$55, aluminum $48–$65;
      // walk gate $300–$450, double drive gate $800–$1,300, tear-out $4–$6/ft; post reset $150–$225, section $150–$250.
      const items: LineItem[] = [];
      if (s(a, "job", "new") === "repair") {
        const p = n(a, "posts"), sc = n(a, "sections");
        if (p) items.push({ label: `Posts reset or replaced — ${p}`, amount: p * 185 });
        if (sc) items.push({ label: `Sections or boards replaced — ${sc}`, amount: sc * 195 });
        if (!items.length) items.push({ label: "Fence repair visit", amount: 350 });
      } else {
        const ft = n(a, "feet") || 150;
        const rate = ({ chain: 24, wood: 38, vinyl: 48, aluminum: 55 } as Record<string, number>)[s(a, "material", "wood")] ?? 38;
        const tall = s(a, "height", "6") === "4" ? 0.82 : 1;
        items.push({ label: `New fence — ${ft} ft`, amount: Math.round(ft * rate * tall) });
        const wg = n(a, "walk_gates"), dg = n(a, "drive_gates");
        if (wg) items.push({ label: `Walk gates — ${wg}`, amount: wg * 375 });
        if (dg) items.push({ label: `Double drive gates — ${dg}`, amount: dg * 1050 });
        if (b(a, "remove_old")) items.push({ label: `Old fence torn out & hauled — ${ft} ft`, amount: Math.round(ft * 5) });
      }
      const base = sum(items);
      return { items, base, hours: Math.max(3, base / 90) };
    },
  },
  {
    slug: "deck-build",
    name: "Deck Building & Repair",
    category: "repair_remodel",
    icon: "🪵",
    tagline: "New decks built to code, or soft boards, railings and stairs fixed.",
    description: "New pressure-treated or composite decks with footings, framing, railings and stairs, built to code with the permit pulled. Repairs replace rotted or loose boards, wobbly railings and steps. New decks get a free site visit and drawings for the permit before the firm price. Staining is booked separately under Exterior Painting.",
    includes: ["Licensed, insured carpenter", "Permit and inspections for new decks", "Footings below frost line (42 in)", "Materials included", "Before & after photos"],
    notesHint: "Size and height, what's attached to the house, the material you like, and any existing deck to remove",
    questions: [
      { id: "job", label: "New deck or repair?", type: "select", default: "repair", options: [{ value: "new", label: "New deck" }, { value: "repair", label: "Repair an existing deck" }] },
      { id: "sqft", label: "Deck size", type: "number", min: 0, max: 2000, default: 0, unit: "sq ft", required: true, help: "Length × width. A 12 × 16 ft deck is 192 sq ft.", showIf: { id: "job", is: ["new"] } },
      { id: "material", label: "Decking", type: "select", default: "pt", options: [{ value: "pt", label: "Pressure-treated wood" }, { value: "composite", label: "Composite (Trex or similar)" }], showIf: { id: "job", is: ["new"] } },
      { id: "raised", label: "Raised more than 30 in off the ground", type: "toggle", default: false, showIf: { id: "job", is: ["new"] } },
      { id: "boards_sqft", label: "Deck boards to replace", type: "number", min: 0, max: 1000, default: 40, unit: "sq ft", showIf: { id: "job", is: ["repair"] } },
      { id: "rail_ft", label: "Railing to build or replace", type: "number", min: 0, max: 300, default: 0, unit: "ft" },
      { id: "steps", label: "Stair steps to build or replace", type: "number", min: 0, max: 20, default: 0 },
    ],
    minimum: 400,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["fence_deck"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: new pressure-treated deck $35–$50/sq ft, composite $55–$80/sq ft (railings extra),
      // board replacement $10–$15/sq ft, railing $40–$85/ft, stair step $100–$160, permit & drawings $300–$450.
      const items: LineItem[] = [];
      const comp = s(a, "material", "pt") === "composite";
      if (s(a, "job", "repair") === "new") {
        const sq = n(a, "sqft") || 192;
        items.push({ label: `New ${comp ? "composite" : "pressure-treated"} deck — ${sq} sq ft`, amount: Math.round(sq * (comp ? 68 : 42) * (b(a, "raised") ? 1.15 : 1)) });
        items.push({ label: "Permit, drawings & inspections", amount: 375 });
      } else {
        const bd = n(a, "boards_sqft");
        if (bd) items.push({ label: `Deck boards replaced — ${bd} sq ft`, amount: Math.round(bd * 12.5) });
      }
      const r = n(a, "rail_ft"), st = n(a, "steps");
      if (r) items.push({ label: `Railing — ${r} ft`, amount: Math.round(r * (comp ? 80 : 45)) });
      if (st) items.push({ label: `Stair steps — ${st}`, amount: st * 135 });
      if (!items.length) items.push({ label: "Deck repair visit", amount: 400 });
      const base = sum(items);
      return { items, base, hours: Math.max(4, base / 85) };
    },
  },
  {
    slug: "siding",
    name: "Siding Repair & Replacement",
    category: "repair_remodel",
    icon: "🏘️",
    tagline: "Storm-damaged panels patched, or the whole house re-sided.",
    description: "Vinyl and fiber cement siding: damaged or loose panels replaced and matched as closely as possible, and full re-siding with house wrap, new trim, soffit and fascia. Old siding torn off and hauled away. Full replacements are measured on site for the firm price.",
    includes: ["Licensed, insured siding contractor", "Closest available color match on repairs", "House wrap on replacements", "Tear-off, dumpster and cleanup", "Before & after photos"],
    notesHint: "What's damaged and where, the siding type and color, and photos of any storm damage for insurance",
    questions: [
      { id: "job", label: "What do you need?", type: "select", default: "repair", options: [{ value: "repair", label: "Repair damaged areas" }, { value: "replace", label: "Replace all the siding" }] },
      { id: "areas", label: "Damaged areas to repair", type: "number", min: 1, max: 10, default: 1, help: "Each spot up to about 50 sq ft.", showIf: { id: "job", is: ["repair"] } },
      { id: "wall_sqft", label: "Wall area to re-side", type: "number", min: 0, max: 10000, default: 0, unit: "sq ft", required: true, help: "Not sure? About 1.5 × the home's finished sq ft for a 2-story house, 1 × for a ranch. Measured on site before the firm price.", showIf: { id: "job", is: ["replace"] } },
      { id: "material", label: "New siding", type: "select", default: "vinyl", options: [{ value: "vinyl", label: "Vinyl" }, { value: "fiber", label: "Fiber cement (Hardie)" }], showIf: { id: "job", is: ["replace"] } },
      { id: "trim_ft", label: "Soffit, fascia or trim to wrap or replace", type: "number", min: 0, max: 1000, default: 0, unit: "ft" },
      { id: "stories", label: "Height", type: "select", default: "1", options: STORIES },
    ],
    minimum: 350,
    spread: [0.9, 1.25],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["siding"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: siding repair $300–$700 per area; full vinyl re-side $7–$11/sq ft of wall, fiber cement $11–$16;
      // soffit, fascia & trim wrap $14–$22/ft.
      const height = { "1": 1, "2": 1.12, "3": 1.25 }[s(a, "stories", "1")] ?? 1;
      const items: LineItem[] = [];
      if (s(a, "job", "repair") === "replace") {
        const sq = n(a, "wall_sqft") || 1500;
        const fiber = s(a, "material", "vinyl") === "fiber";
        items.push({ label: `Tear-off & new ${fiber ? "fiber cement" : "vinyl"} siding — ${sq} sq ft`, amount: Math.round(sq * (fiber ? 13.5 : 9) * height) });
      } else {
        const ar = Math.max(1, n(a, "areas", 1));
        items.push({ label: `Siding repair — ${ar} area${ar > 1 ? "s" : ""}`, amount: Math.round((395 + (ar - 1) * 225) * height) });
      }
      const t = n(a, "trim_ft");
      if (t) items.push({ label: `Soffit, fascia & trim — ${t} ft`, amount: Math.round(t * 18 * height) });
      const base = sum(items);
      return { items, base, hours: Math.max(3, base / 95) };
    },
  },
  {
    slug: "gutter-install",
    name: "Gutter Installation & Guards",
    category: "repair_remodel",
    icon: "🌧️",
    tagline: "New seamless gutters and downspouts, with guards if you want them.",
    description: "Seamless aluminum gutters formed on site in 5 or 6 inch, new downspouts and extensions to carry water away from the foundation, and gutter guards. Old gutters taken down and hauled away. Cleaning existing gutters is booked under Gutter Cleaning.",
    includes: ["Licensed, insured gutter contractor", "Seamless aluminum, formed on site", "Downspouts & extensions", "Old gutters hauled away", "Before & after photos"],
    notesHint: "The home's perimeter or roofline length, the color, any spots where water overflows or pools, and whether guards are wanted",
    questions: [
      { id: "feet", label: "Gutter length", type: "number", min: 0, max: 1000, default: 0, unit: "ft", required: true, help: "Usually the length of the roof edges that drain (about the home's perimeter for a hip roof, the front and back for a gable)." },
      { id: "size", label: "Gutter size", type: "select", default: "5", options: [{ value: "5", label: "5 inch (most homes)" }, { value: "6", label: "6 inch (large or steep roofs)" }] },
      { id: "downspouts", label: "Downspouts", type: "number", min: 0, max: 20, default: 4 },
      { id: "guards", label: "Add gutter guards", type: "toggle", default: false },
      { id: "remove_old", label: "Take down and haul away old gutters", type: "toggle", default: true },
      { id: "stories", label: "Height", type: "select", default: "1", options: STORIES },
    ],
    minimum: 450,
    spread: [0.92, 1.18],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["gutter_install"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: seamless aluminum 5" $9–$13/ft, 6" $12–$17/ft, downspouts $100–$150 each,
      // guards $7–$12/ft, old gutter removal $1–$3/ft.
      const ft = n(a, "feet") || 150;
      const height = { "1": 1, "2": 1.12, "3": 1.25 }[s(a, "stories", "1")] ?? 1;
      const items: LineItem[] = [{ label: `Seamless gutters — ${ft} ft`, amount: Math.round(ft * (s(a, "size", "5") === "6" ? 14.5 : 11) * height) }];
      const d = n(a, "downspouts");
      if (d) items.push({ label: `Downspouts & extensions — ${d}`, amount: d * 125 });
      if (b(a, "guards")) items.push({ label: `Gutter guards — ${ft} ft`, amount: Math.round(ft * 9.5) });
      if (b(a, "remove_old")) items.push({ label: `Old gutters removed — ${ft} ft`, amount: Math.round(ft * 2) });
      const base = sum(items);
      return { items, base, hours: Math.max(3, base / 110) };
    },
  },
  {
    slug: "window-door-install",
    name: "Window & Door Replacement",
    category: "repair_remodel",
    icon: "🪟",
    tagline: "Energy-efficient replacement windows and new entry, storm and patio doors.",
    description: "Replacement vinyl windows (double-hung, sliders, casements), bay and bow windows, steel or fiberglass entry doors, storm doors and patio sliders, installed and sealed with the trim finished and the old units hauled away. Measured on site before ordering; lead-safe practices for homes built before 1978.",
    includes: ["Licensed, insured installer", "Measured on site before ordering", "Insulated, sealed and trimmed", "Old units hauled away", "Lead-safe (EPA RRP) for pre-1978 homes", "Manufacturer and workmanship warranties"],
    notesHint: "How many windows and which kinds, any doors, the rooms and floors they're on, and the color you want",
    questions: [
      { id: "windows", label: "Standard replacement windows", type: "number", min: 0, max: 40, default: 4, help: "Double-hung, slider or casement up to about 36 × 60 in." },
      { id: "bay", label: "Bay or bow windows", type: "number", min: 0, max: 4, default: 0 },
      { id: "upper", label: "How many windows are above the first floor", type: "number", min: 0, max: 40, default: 0 },
      { id: "entry", label: "Entry doors (steel or fiberglass, prehung)", type: "number", min: 0, max: 6, default: 0 },
      { id: "storm", label: "Storm doors", type: "number", min: 0, max: 6, default: 0 },
      { id: "patio", label: "Patio sliders", type: "number", min: 0, max: 4, default: 0 },
    ],
    minimum: 550,
    spread: [0.9, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["windows_doors"],
    licensed: true,
    leadDays: 14,
    price: (a) => {
      // Detroit-metro 2026 installed: vinyl replacement window $550–$800, bay/bow $2,800–$4,500, upper-floor +$40–$80,
      // prehung entry door $1,500–$2,500, storm door $450–$700, patio slider $2,000–$3,200.
      const w = n(a, "windows"), bay = n(a, "bay"), up = Math.min(n(a, "upper"), w), e = n(a, "entry"), st = n(a, "storm"), p = n(a, "patio");
      const items: LineItem[] = [];
      if (w) items.push({ label: `Replacement windows — ${w}`, amount: w * 675 });
      if (up) items.push({ label: `Upper-floor access — ${up} windows`, amount: up * 60 });
      if (bay) items.push({ label: `Bay or bow windows — ${bay}`, amount: bay * 3400 });
      if (e) items.push({ label: `Entry doors — ${e}`, amount: e * 1850 });
      if (st) items.push({ label: `Storm doors — ${st}`, amount: st * 550 });
      if (p) items.push({ label: `Patio sliders — ${p}`, amount: p * 2500 });
      if (!items.length) items.push({ label: "Window & door measure visit", amount: 550 });
      const base = sum(items);
      return { items, base, hours: Math.max(3, w * 1.5 + bay * 6 + e * 4 + st * 2 + p * 5) };
    },
  },
  {
    slug: "insulation",
    name: "Attic & Wall Insulation",
    category: "repair_remodel",
    icon: "🧤",
    tagline: "Blown-in attic insulation, air sealing and walls — lower heating bills.",
    description: "Blown-in cellulose or fiberglass to R-49 in the attic (DTE and Consumers Energy recommend it for Michigan), air sealing around attic bypasses, baffles at the eaves, and dense-pack insulation blown into empty walls. Old contaminated insulation can be vacuumed out first. Ask about utility rebates — we give you the paperwork.",
    includes: ["Licensed, insured insulation contractor", "Depth markers and before & after photos", "Baffles to keep soffit vents open", "Rebate paperwork for your utility"],
    notesHint: "The attic access (hatch or stairs), what's up there now and how deep, any knob-and-tube wiring, and which walls feel cold",
    questions: [
      { id: "attic_sqft", label: "Attic floor area", type: "number", min: 0, max: 5000, default: 1000, unit: "sq ft", help: "About the footprint of the top floor of the house." },
      { id: "depth", label: "What's in the attic now", type: "select", default: "some", options: [{ value: "some", label: "Some insulation (top up to R-49)" }, { value: "none", label: "Little or none (full R-49)" }] },
      { id: "air_seal", label: "Air seal the attic first", type: "toggle", default: true },
      { id: "remove_old", label: "Vacuum out old insulation first (wet, moldy or rodent-damaged)", type: "toggle", default: false },
      { id: "wall_sqft", label: "Exterior walls to dense-pack (empty walls)", type: "number", min: 0, max: 5000, default: 0, unit: "sq ft" },
    ],
    minimum: 650,
    spread: [0.92, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["insulation"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026: blown-in attic top-up $1.50–$2.20/sq ft, full R-49 $2.20–$3.00, air sealing $500–$900,
      // removal $1.25–$2.00/sq ft, dense-pack walls $3.50–$5.00/sq ft of wall.
      const at = n(a, "attic_sqft"), wl = n(a, "wall_sqft");
      const items: LineItem[] = [];
      if (at) {
        if (b(a, "remove_old")) items.push({ label: `Old insulation vacuumed out — ${at} sq ft`, amount: Math.round(at * 1.6) });
        items.push({ label: `Blown-in attic insulation to R-49 — ${at} sq ft`, amount: Math.round(at * (s(a, "depth", "some") === "none" || b(a, "remove_old") ? 2.6 : 1.85)) });
        if (b(a, "air_seal")) items.push({ label: "Attic air sealing & baffles", amount: 650 });
      }
      if (wl) items.push({ label: `Dense-pack wall insulation — ${wl} sq ft`, amount: Math.round(wl * 4.25) });
      if (!items.length) items.push({ label: "Insulation visit", amount: 650 });
      const base = sum(items);
      return { items, base, hours: Math.max(4, base / 110) };
    },
  },
  {
    slug: "garage-door",
    name: "Garage Door Repair & Install",
    category: "repair_remodel",
    icon: "🚘",
    tagline: "Broken springs, openers and off-track doors fixed — or a new door.",
    description: "Home garage doors: torsion spring replacement, cables and rollers, doors off track, tune-ups, new openers (belt drive with Wi-Fi and battery backup) and new insulated steel doors, with the old door hauled away. Commercial overhead and dock doors are booked under Loading Dock & Overhead Door Service.",
    includes: ["Vetted, insured garage door technician", "Safety reversal test on every visit", "Parts warranty plus workmanship warranty", "Old door or opener hauled away"],
    notesHint: "What's happening (won't open, loud bang, off track), the door size, and the opener brand",
    questions: [
      {
        id: "service",
        label: "What do you need?",
        type: "select",
        default: "spring",
        options: [
          { value: "tune", label: "Tune-up & safety check" },
          { value: "spring", label: "Broken spring (both springs replaced)" },
          { value: "track", label: "Off track, cables or rollers" },
          { value: "opener", label: "New opener, installed" },
          { value: "door_single", label: "New single-car door (8–9 ft)" },
          { value: "door_double", label: "New double-car door (16 ft)" },
        ],
      },
      { id: "insulated", label: "Insulated door (warmer garage, quieter)", type: "toggle", default: true, showIf: { id: "service", is: ["door_single", "door_double"] } },
      { id: "add_opener", label: "Also a new opener", type: "toggle", default: false, showIf: { id: "service", is: ["door_single", "door_double"] } },
    ],
    minimum: 129,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["garage_door"],
    price: (a) => {
      // Detroit-metro 2026: tune-up $100–$160, torsion spring pair $275–$400, cables/rollers/off-track $175–$300,
      // belt-drive opener installed $475–$700, single door $1,100–$1,800, double $1,800–$3,000 (insulated +$300–$600).
      const sv = s(a, "service", "spring");
      const [label, amount, hrs] = ({ tune: ["Garage door tune-up & safety check", 129, 1], spring: ["Torsion springs replaced (pair)", 325, 1.5], track: ["Door back on track — cables & rollers", 235, 1.5], opener: ["Belt-drive opener installed", 575, 2.5], door_single: ["New single-car garage door", 1350, 4], door_double: ["New double-car garage door", 2150, 5] } as Record<string, [string, number, number]>)[sv] ?? ["Torsion springs replaced (pair)", 325, 1.5];
      const items: LineItem[] = [{ label, amount }];
      const door = sv === "door_single" || sv === "door_double";
      if (door && b(a, "insulated")) items.push({ label: "Insulated door upgrade", amount: sv === "door_double" ? 550 : 325 });
      if (door && b(a, "add_opener")) items.push({ label: "Belt-drive opener installed", amount: 575 });
      return { items, base: sum(items), hours: hrs + (door && b(a, "add_opener") ? 2 : 0) };
    },
  },
  {
    slug: "driveway-sealcoating",
    name: "Driveway Sealcoating & Asphalt Repair",
    category: "repair_remodel",
    icon: "🛣️",
    tagline: "Asphalt sealed, cracks filled and potholes patched — drives and lots.",
    description: "Asphalt driveways and parking lots cleaned, cracks filled with hot rubberized sealant, potholes patched, and two coats of sealer applied, plus line striping for lots. Best done every 2–3 years, May through October (needs 50°F and dry weather). Concrete driveways are booked under Concrete Steps, Patios & Sidewalks.",
    includes: ["Vetted, insured paving crew", "Surface cleaned and edged first", "Hot-pour crack filler", "Two coats of commercial-grade sealer", "Area taped off while it cures"],
    notesHint: "Driveway or lot size, the worst cracks or holes, when you can keep cars off it for 24 hours, and stalls to stripe",
    questions: [
      { id: "sqft", label: "Asphalt area", type: "number", min: 0, max: 100000, default: 0, unit: "sq ft", required: true, help: "Length × width. A 2-car city driveway is about 600 sq ft; a 20-space lot is about 7,000 sq ft." },
      { id: "crack_ft", label: "Cracks to fill", type: "number", min: 0, max: 5000, default: 50, unit: "ft" },
      { id: "patch_sqft", label: "Potholes or broken spots to patch", type: "number", min: 0, max: 2000, default: 0, unit: "sq ft" },
      { id: "stalls", label: "Parking stalls to stripe", type: "number", min: 0, max: 500, default: 0 },
    ],
    minimum: 225,
    spread: [0.92, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["paving"],
    price: (a) => {
      // Detroit-metro 2026: sealcoating $0.25–$0.40/sq ft (2 coats), hot crack fill $1–$2/ft,
      // pothole patch $9–$15/sq ft, stall striping $6–$10 each.
      const sq = n(a, "sqft") || 600, cr = n(a, "crack_ft"), p = n(a, "patch_sqft"), st = n(a, "stalls");
      const items: LineItem[] = [{ label: `Clean & sealcoat, 2 coats — ${sq} sq ft`, amount: Math.max(225, Math.round(sq * (sq > 5000 ? 0.26 : 0.34))) }];
      if (cr) items.push({ label: `Hot crack fill — ${cr} ft`, amount: Math.round(cr * 1.5) });
      if (p) items.push({ label: `Pothole & patch repair — ${p} sq ft`, amount: Math.max(150, Math.round(p * 12)) });
      if (st) items.push({ label: `Line striping — ${st} stalls`, amount: Math.max(125, st * 8) });
      const base = sum(items);
      return { items, base, hours: Math.max(2, base / 100) };
    },
  },
  {
    slug: "flooring",
    name: "Flooring Installation",
    category: "repair_remodel",
    icon: "🪚",
    tagline: "Luxury vinyl plank, laminate, hardwood, carpet and tile floors installed.",
    description: "New floors for rooms, basements and whole homes: luxury vinyl plank, laminate, engineered or solid hardwood, carpet with pad, and porcelain or ceramic floor tile. Standard-grade material included (upgrades at cost), old flooring removed and hauled away, subfloor leveled where needed, and new baseboard or quarter round. Bathroom and kitchen remodels are booked under the remodel services.",
    includes: ["Licensed, insured flooring installer", "Standard-grade material included (upgrades at cost)", "Furniture moved and replaced", "Old flooring hauled away", "Transitions at doorways", "Before & after photos"],
    notesHint: "Which rooms, the material and color you like (a link is great), what's on the floor now, and any stairs",
    questions: [
      {
        id: "material",
        label: "New floor",
        type: "select",
        default: "lvp",
        options: [
          { value: "lvp", label: "Luxury vinyl plank (waterproof)" },
          { value: "laminate", label: "Laminate" },
          { value: "engineered", label: "Engineered hardwood" },
          { value: "hardwood", label: "Solid hardwood (site-finished)" },
          { value: "carpet", label: "Carpet with pad" },
          { value: "tile", label: "Porcelain or ceramic tile" },
        ],
      },
      { id: "sqft", label: "Floor area", type: "number", min: 0, max: 5000, default: 0, unit: "sq ft", required: true, help: "Add up length × width of each room. Add 10% for closets and odd shapes." },
      { id: "remove_old", label: "Remove and haul away the old flooring", type: "toggle", default: true },
      { id: "level", label: "Level or patch the subfloor", type: "toggle", default: false },
      { id: "stairs", label: "Stairs to cover", type: "number", min: 0, max: 30, default: 0 },
      { id: "trim_ft", label: "New baseboard or quarter round", type: "number", min: 0, max: 2000, default: 0, unit: "ft" },
    ],
    minimum: 450,
    spread: [0.9, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["flooring"],
    licensed: true,
    price: (a) => {
      // Detroit-metro 2026 installed with standard material: LVP $5–$8/sq ft, laminate $4.50–$7, engineered $9–$13,
      // solid hardwood $11–$15, carpet & pad $4–$6.50, tile $11–$17; removal $1–$2, leveling $1.50–$3,
      // stairs $60–$120 per step, baseboard $2.50–$4/ft.
      const mat = s(a, "material", "lvp");
      const sq = n(a, "sqft") || 300;
      const rate = ({ lvp: 6.5, laminate: 5.75, engineered: 11, hardwood: 13, carpet: 5.25, tile: 14 } as Record<string, number>)[mat] ?? 6.5;
      const name = ({ lvp: "luxury vinyl plank", laminate: "laminate", engineered: "engineered hardwood", hardwood: "solid hardwood", carpet: "carpet & pad", tile: "tile" } as Record<string, string>)[mat] ?? "luxury vinyl plank";
      const items: LineItem[] = [{ label: `New ${name} — ${sq} sq ft`, amount: Math.round(sq * rate) }];
      if (b(a, "remove_old")) items.push({ label: `Old flooring removed — ${sq} sq ft`, amount: Math.round(sq * 1.5) });
      if (b(a, "level")) items.push({ label: `Subfloor leveling — ${sq} sq ft`, amount: Math.round(sq * 2) });
      const st = n(a, "stairs"), tr = n(a, "trim_ft");
      if (st) items.push({ label: `Stairs — ${st} steps`, amount: st * (mat === "carpet" ? 60 : 110) });
      if (tr) items.push({ label: `Baseboard or quarter round — ${tr} ft`, amount: Math.round(tr * 3.25) });
      const base = sum(items);
      return { items, base, hours: Math.max(4, base / 90) };
    },
  },
  {
    slug: "appliance-repair",
    name: "Appliance Repair & Install",
    category: "repair_remodel",
    icon: "🧺",
    tagline: "Washers, dryers, fridges, dishwashers and ranges fixed — or new ones hooked up.",
    description: "Repairs for washers, dryers, refrigerators, dishwashers, ovens and ranges, and microwaves: the tech diagnoses it, quotes the parts before ordering, and the diagnostic fee is part of the repair price. Or hook-up of new appliances you bought (dishwashers, ranges, washers and dryers, over-the-range microwaves). Gas lines and new circuits go to licensed plumbers and electricians.",
    includes: ["Vetted, insured appliance technician", "Diagnosis included in the repair", "Parts quoted before ordering, billed at cost", "90-day labor warranty", "Old appliance hauled away on installs"],
    notesHint: "The appliance, brand and model number (inside the door or on the back), and what it's doing or the error code",
    questions: [
      {
        id: "appliance",
        label: "Appliance",
        type: "select",
        default: "washer",
        options: [
          { value: "washer", label: "Washer" },
          { value: "dryer", label: "Dryer" },
          { value: "fridge", label: "Refrigerator or freezer" },
          { value: "dishwasher", label: "Dishwasher" },
          { value: "range", label: "Oven, range or cooktop" },
          { value: "microwave", label: "Over-the-range microwave" },
        ],
      },
      { id: "job", label: "Repair or install?", type: "select", default: "repair", options: [{ value: "repair", label: "Repair" }, { value: "install", label: "Install a new one I bought" }] },
      { id: "count", label: "How many of these", type: "number", min: 1, max: 6, default: 1 },
      { id: "haul_old", label: "Haul away the old appliance", type: "toggle", default: false, showIf: { id: "job", is: ["install"] } },
    ],
    minimum: 95,
    spread: [0.9, 1.35],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["appliance"],
    price: (a) => {
      // Detroit-metro 2026 labor (parts at cost): diagnostic $80–$120 (applied to the repair), washer/dryer repair $150–$250,
      // fridge $200–$325, dishwasher $150–$225, range $160–$260, OTR microwave $130–$200;
      // install: dishwasher $200–$275, range $150–$225, washer/dryer $110–$160, OTR microwave $175–$250.
      const ap = s(a, "appliance", "washer"), c = Math.max(1, n(a, "count", 1));
      const name = ({ washer: "washer", dryer: "dryer", fridge: "refrigerator", dishwasher: "dishwasher", range: "oven or range", microwave: "microwave" } as Record<string, string>)[ap] ?? "appliance";
      const items: LineItem[] = [];
      if (s(a, "job", "repair") === "install") {
        const each = ({ washer: 135, dryer: 135, fridge: 120, dishwasher: 235, range: 185, microwave: 215 } as Record<string, number>)[ap] ?? 150;
        items.push({ label: `Install new ${name} — ${c}`, amount: each * c });
        if (b(a, "haul_old")) items.push({ label: `Old appliance hauled away — ${c}`, amount: c * 45 });
      } else {
        const each = ({ washer: 195, dryer: 185, fridge: 265, dishwasher: 185, range: 205, microwave: 165 } as Record<string, number>)[ap] ?? 195;
        items.push({ label: `Diagnose & repair ${name} (labor; parts at cost) — ${c}`, amount: each * c });
      }
      const base = sum(items);
      return { items, base, hours: Math.max(1, c * 1.5) };
    },
  },
  {
    slug: "smart-home-setup",
    name: "Smart Home & Wi-Fi Setup",
    category: "repair_remodel",
    icon: "📶",
    tagline: "Mesh Wi-Fi, smart thermostats, TVs, speakers and voice assistants set up right.",
    description: "Whole-home mesh Wi-Fi installed and tested room by room, smart thermostats (Nest, Ecobee, Honeywell) wired to your existing system, TVs, streaming boxes and soundbars connected, smart plugs and bulbs paired, and voice assistant routines set up — then we show you how it all works. Cameras and doorbells are booked under Security Camera Install; smart locks under Locksmith; new wiring by a licensed electrician.",
    includes: ["Vetted, insured smart-home tech", "Everything tested before we leave", "A walkthrough of the apps", "Packaging taken away"],
    notesHint: "Your internet provider and plan speed, the devices you bought, the home's size and floors, and where the Wi-Fi is weak",
    questions: [
      { id: "mesh_nodes", label: "Mesh Wi-Fi units to install", type: "number", min: 0, max: 10, default: 2, help: "1 unit per 1,000–1,500 sq ft is typical; basements usually need their own." },
      { id: "thermostats", label: "Smart thermostats", type: "number", min: 0, max: 4, default: 0 },
      { id: "tvs", label: "TVs or soundbars to connect (no wall mounting)", type: "number", min: 0, max: 8, default: 0 },
      { id: "devices", label: "Smart plugs, bulbs or speakers to pair", type: "number", min: 0, max: 50, default: 0 },
      { id: "routines", label: "Voice assistant routines & schedules", type: "toggle", default: false },
    ],
    minimum: 99,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["low_voltage"],
    price: (a) => {
      // Detroit-metro 2026 (Geek Squad / local techs): mesh setup $129–$199 + $25–$50 per extra unit, thermostat $100–$160,
      // TV/soundbar setup $80–$130, device pairing $10–$20 each, routines $50–$80.
      const m = n(a, "mesh_nodes"), th = n(a, "thermostats"), tv = n(a, "tvs"), dv = n(a, "devices");
      const items: LineItem[] = [];
      if (m) items.push({ label: `Mesh Wi-Fi — ${m} unit${m > 1 ? "s" : ""}, tested room by room`, amount: 149 + (m - 1) * 39 });
      if (th) items.push({ label: `Smart thermostats — ${th}`, amount: th * 129 });
      if (tv) items.push({ label: `TVs or soundbars connected — ${tv}`, amount: tv * 99 });
      if (dv) items.push({ label: `Smart devices paired — ${dv}`, amount: dv * 15 });
      if (b(a, "routines")) items.push({ label: "Voice assistant routines & schedules", amount: 65 });
      if (!items.length) items.push({ label: "Smart home visit", amount: 99 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, m * 0.5 + th * 1 + tv * 0.75 + dv * 0.15 + (b(a, "routines") ? 0.75 : 0)) };
    },
  },
  {
    slug: "water-damage",
    name: "Water Damage Cleanup",
    category: "repair_remodel",
    icon: "💧",
    tagline: "Flooded basement or burst pipe? Water out, wet materials removed, everything dried.",
    description: "Water damage cleanup by a certified restoration crew: standing water extracted, wet carpet, pad and drywall cut out and bagged, antimicrobial applied, and commercial dehumidifiers and air movers run until moisture readings are back to normal (usually 3 days, with daily checks). Photos and moisture logs for your insurance claim. Mold that's already growing is booked under Mold Removal; fixing the leak goes to a plumber.",
    includes: ["Certified restoration crew (IICRC WRT or equal)", "Water extraction", "Dehumidifiers & air movers with daily checks", "Moisture readings logged for insurance", "Antimicrobial treatment", "Photos for your claim"],
    notesHint: "Where the water came from, how long ago, how deep it got, what's wet (carpet, drywall, furniture), and whether the source is fixed",
    questions: [
      { id: "sqft", label: "Wet area", type: "number", min: 0, max: 5000, default: 0, unit: "sq ft", required: true, help: "The floor area that got wet. A typical basement room is 200–400 sq ft." },
      {
        id: "water",
        label: "Kind of water",
        type: "select",
        default: "clean",
        options: [
          { value: "clean", label: "Clean — burst supply pipe, water heater, rain" },
          { value: "gray", label: "Gray — washer or dishwasher overflow" },
          { value: "black", label: "Black — sewer backup or outside flooding" },
        ],
      },
      { id: "remove", label: "Cut out wet carpet, pad or drywall", type: "toggle", default: true },
      { id: "after_hours", label: "Tonight or this weekend (emergency response)", type: "toggle", default: false },
    ],
    minimum: 450,
    spread: [0.85, 1.35],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["water_damage"],
    onDemand: true,
    price: (a) => {
      // Detroit-metro 2026: extraction + 3-day drying $3.50–$5.50/sq ft plus $350–$500 setup; gray water ×1.3,
      // black water (sewage) ×1.9; tear-out $2.50–$4/sq ft; after-hours dispatch $200–$300.
      const sq = n(a, "sqft") || 300;
      const mult = ({ clean: 1, gray: 1.3, black: 1.9 } as Record<string, number>)[s(a, "water", "clean")] ?? 1;
      const items: LineItem[] = [{ label: `Extraction & 3-day drying — ${sq} sq ft`, amount: Math.round((425 + sq * 4.5) * mult) }];
      if (b(a, "remove")) items.push({ label: `Wet materials removed & bagged — ${sq} sq ft`, amount: Math.round(sq * 3 * mult) });
      if (b(a, "after_hours")) items.push({ label: "Emergency after-hours response", amount: 250 });
      const base = sum(items);
      return { items, base, hours: Math.max(3, 2 + sq / 60) };
    },
  },
  {
    slug: "locksmith",
    name: "Locksmith",
    category: "repair_remodel",
    icon: "🔑",
    tagline: "Locked out, lost keys, or new tenants — rekeyed or new locks today.",
    description: "Home and car lockouts, rekeying after a move or a tenant change (all locks on one key), new deadbolts and handle sets, and smart lock installation. The locksmith checks ID and proof you live there or own the car before opening anything. Hardware billed at cost unless you have your own.",
    includes: ["Vetted, insured locksmith", "ID and residence checked before any lockout", "All locks keyed alike on request", "2 keys per lock", "Hardware at cost with the receipt"],
    notesHint: "Home or car (make and year), how many doors, the lock brand if you know it, and any smart lock you bought",
    questions: [
      {
        id: "service",
        label: "What do you need?",
        type: "select",
        default: "rekey",
        options: [
          { value: "home_lockout", label: "Locked out of my home" },
          { value: "car_lockout", label: "Locked out of my car" },
          { value: "rekey", label: "Rekey my locks" },
          { value: "install", label: "Install new deadbolts or handle sets" },
          { value: "smart", label: "Install a smart lock" },
        ],
      },
      { id: "locks", label: "Number of locks", type: "number", min: 1, max: 20, default: 3, showIf: { id: "service", is: ["rekey", "install", "smart"] } },
      { id: "after_hours", label: "After 6 pm, weekend or holiday", type: "toggle", default: false },
    ],
    minimum: 85,
    spread: [0.95, 1.2],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["locksmith"],
    onDemand: true,
    price: (a) => {
      // Detroit-metro 2026: home lockout $100–$175, car lockout $75–$125, service call $65–$95 + rekey $25–$40 per cylinder,
      // deadbolt/handle install $75–$120 labor each, smart lock install $95–$150 each, after-hours +$50–$100.
      const sv = s(a, "service", "rekey"), l = Math.max(1, n(a, "locks", 3));
      const items: LineItem[] = [];
      if (sv === "home_lockout") items.push({ label: "Home lockout", amount: 135 });
      else if (sv === "car_lockout") items.push({ label: "Car lockout", amount: 95 });
      else {
        items.push({ label: "Service call", amount: 85 });
        const [lab, each] = ({ rekey: ["Locks rekeyed", 35], install: ["New locks installed (hardware at cost)", 95], smart: ["Smart locks installed & set up", 125] } as Record<string, [string, number]>)[sv] ?? ["Locks rekeyed", 35];
        items.push({ label: `${lab} — ${l}`, amount: l * each });
      }
      if (b(a, "after_hours")) items.push({ label: "After-hours call", amount: 75 });
      const base = sum(items);
      return { items, base, hours: sv.endsWith("lockout") ? 0.75 : Math.max(1, l * (sv === "rekey" ? 0.3 : 0.8)) };
    },
  },
  {
    slug: "property-inspection",
    name: "Property Condition Inspection",
    category: "repair_remodel",
    icon: "📋",
    tagline: "A full inspection and photo report — before you buy, sell, rent or insure.",
    description: "A visual inspection of the roof, exterior, foundation, structure, plumbing, electrical, heating and cooling, attic, interior and appliances, with a written report and photos of every finding, delivered within 24 hours. Optional radon test and sewer camera scope. Good for buyers, sellers, landlords getting ready for a rental inspection, and insurers. It doesn't replace the City of Detroit's rental Certificate of Compliance inspection.",
    includes: ["Certified home inspector (InterNACHI or ASHI)", "Roof-to-basement visual inspection", "Photo report within 24 hours", "Summary of repairs by priority", "Phone call to walk you through it"],
    notesHint: "The address, year built, whether it's occupied, access (lockbox or someone there), and why you need it (buying, selling, rental, insurance)",
    questions: [
      { id: "sqft", label: "Home size (finished sq ft)", type: "number", min: 0, max: 10000, default: 1500, unit: "sq ft" },
      { id: "units", label: "Units", type: "select", default: "1", options: [{ value: "1", label: "Single-family or condo" }, { value: "2", label: "Duplex (2 units)" }, { value: "3", label: "3 units" }, { value: "4", label: "4 units" }] },
      { id: "radon", label: "Radon test (2-day monitor)", type: "toggle", default: false },
      { id: "sewer", label: "Sewer line camera scope", type: "toggle", default: false },
    ],
    minimum: 325,
    spread: [0.95, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["inspection"],
    price: (a) => {
      // Detroit-metro 2026: home inspection $300–$450 to 1,500 sq ft, about $0.10–$0.15/sq ft above; each extra unit $125–$200;
      // radon $125–$175; sewer scope $175–$275.
      const sq = n(a, "sqft"), u = Number(s(a, "units", "1")) || 1;
      const items: LineItem[] = [{ label: `Inspection & photo report — ${sq} sq ft`, amount: 325 + Math.max(0, Math.round((sq - 1500) * 0.12)) }];
      if (u > 1) items.push({ label: `Additional units — ${u - 1}`, amount: (u - 1) * 150 });
      if (b(a, "radon")) items.push({ label: "Radon test", amount: 150 });
      if (b(a, "sewer")) items.push({ label: "Sewer camera scope", amount: 225 });
      const base = sum(items);
      return { items, base, hours: Math.max(2.5, 2 + sq / 1000 + (u - 1)) };
    },
  },
  {
    slug: "bathroom-remodel",
    name: "Bathroom Remodel",
    category: "repair_remodel",
    icon: "🛁",
    tagline: "Design to final walkthrough, one project manager.",
    description:
      "Vanity swaps to full gut renovations. Licensed, insured remodelers, permit handling, milestone payments and an AI-tracked schedule.",
    includes: ["Free design consult", "Licensed & insured GC", "Permits handled", "Milestone payments", "Daily photo updates"],
    questions: [
      {
        id: "scope",
        label: "Scope",
        type: "select",
        default: "mid",
        options: [
          { value: "refresh", label: "Refresh (paint, vanity, fixtures)" },
          { value: "mid", label: "Mid-range (tile, tub/shower, vanity)" },
          { value: "full", label: "Full gut / layout change" },
        ],
      },
      { id: "sqft", label: "Bathroom size", type: "number", min: 30, max: 300, default: 60, unit: "sq ft" },
      { id: "count", label: "Number of bathrooms", type: "number", min: 1, max: 6, default: 1 },
    ],
    minimum: 3500,
    spread: [0.8, 1.3],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["remodel"],
    licensed: true,
    price: (a) => {
      const perSqft = { refresh: 110, mid: 260, full: 420 }[s(a, "scope", "mid")] ?? 260;
      const sq = n(a, "sqft", 60);
      const count = n(a, "count", 1);
      const fixed = { refresh: 2500, mid: 6000, full: 10000 }[s(a, "scope", "mid")] ?? 6000;
      const items: LineItem[] = [{ label: `${count} × ${sq} sq ft (${s(a, "scope", "mid")})`, amount: (fixed + perSqft * sq) * count }];
      const base = sum(items);
      return { items, base, hours: base / 85 };
    },
  },
  {
    slug: "kitchen-remodel",
    name: "Kitchen Remodel",
    category: "repair_remodel",
    icon: "🍳",
    tagline: "Cabinets, counters, layout — fixed-scope pricing.",
    description: "Cabinet refacing to full custom kitchens, with design help, a fixed scope of work and milestone-based payments.",
    includes: ["Free design consult", "3D layout", "Licensed & insured GC", "Permits handled", "Milestone payments"],
    questions: [
      {
        id: "scope",
        label: "Scope",
        type: "select",
        default: "mid",
        options: [
          { value: "refresh", label: "Refresh (paint/reface cabinets, counters)" },
          { value: "mid", label: "Mid-range (new cabinets, counters, appliances)" },
          { value: "full", label: "Full / layout change, custom" },
        ],
      },
      { id: "sqft", label: "Kitchen size", type: "number", min: 70, max: 600, default: 180, unit: "sq ft" },
    ],
    minimum: 12000,
    spread: [0.8, 1.3],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["remodel"],
    licensed: true,
    price: (a) => {
      const perSqft = { refresh: 110, mid: 250, full: 450 }[s(a, "scope", "mid")] ?? 250;
      const sq = n(a, "sqft", 180);
      const items: LineItem[] = [{ label: `${sq} sq ft kitchen (${s(a, "scope", "mid")})`, amount: perSqft * sq }];
      const base = sum(items);
      return { items, base, hours: base / 90 };
    },
  },
  {
    slug: "home-remodel",
    name: "Whole-Home Remodel",
    category: "repair_remodel",
    icon: "🏗️",
    tagline: "Basements, additions, full renovations.",
    description: "Whole-home and multi-room renovations, basement finishing and additions managed end to end by one project manager.",
    includes: ["Project manager", "Licensed GC & trades", "Permits & inspections", "Budget tracking dashboard", "Milestone payments"],
    questions: [
      { id: "sqft", label: "Area being renovated", type: "number", min: 200, max: 8000, default: 1200, unit: "sq ft" },
      {
        id: "scope",
        label: "Finish level",
        type: "select",
        default: "mid",
        options: [
          { value: "refresh", label: "Cosmetic (floors, paint, fixtures)" },
          { value: "mid", label: "Standard renovation" },
          { value: "full", label: "Down to studs / addition" },
        ],
      },
    ],
    minimum: 25000,
    spread: [0.8, 1.35],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["remodel"],
    licensed: true,
    price: (a) => {
      const perSqft = { refresh: 45, mid: 110, full: 200 }[s(a, "scope", "mid")] ?? 110;
      const sq = n(a, "sqft", 1200);
      const items: LineItem[] = [{ label: `${sq} sq ft (${s(a, "scope", "mid")})`, amount: perSqft * sq }];
      const base = sum(items);
      return { items, base, hours: base / 95 };
    },
  },
  // ───────────────────────────── ERRANDS & ASSISTANT ─────────────────────────────
  {
    slug: "errands",
    insuranceOptional: true,
    name: "Errands & Pickups",
    category: "errands",
    icon: "🛍️",
    tagline: "Dry cleaning, returns, pickups and drop-offs — done.",
    description: "A background-checked runner picks up dry cleaning and prescriptions, does the shopping, makes returns and drops things off, with photo proof at every stop. Store purchases are billed at cost with the receipt.",
    includes: ["Background-checked, bonded runner", "Photo at every stop", "Purchases at cost with receipt", "Up to 20 miles included"],
    questions: [
      { id: "stops", label: "Number of stops", type: "number", min: 1, max: 12, default: 3 },
      { id: "shopping", label: "Includes store shopping or pickup", type: "toggle", default: false },
      { id: "bulky", label: "Bulky or heavy items (needs an SUV/truck)", type: "toggle", default: false },
    ],
    minimum: 39,
    spread: [1, 1],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["errands"],
    price: (a) => {
      const stops = n(a, "stops", 3);
      const items: LineItem[] = [{ label: "Errand run (first stop)", amount: 29 }];
      if (stops > 1) items.push({ label: `${stops - 1} more stop${stops > 2 ? "s" : ""} × $12`, amount: (stops - 1) * 12 });
      if (b(a, "shopping")) items.push({ label: "In-store shopping time", amount: 25 });
      if (b(a, "bulky")) items.push({ label: "Bulky items / larger vehicle", amount: 30 });
      const base = sum(items);
      return { items, base, hours: 0.75 + stops * 0.35 + (b(a, "shopping") ? 0.75 : 0) };
    },
  },
  {
    slug: "courier",
    insuranceOptional: true,
    name: "Same-Day Courier",
    category: "errands",
    icon: "📦",
    tagline: "Documents, packages and parts across town today, with photo proof.",
    description: "A background-checked courier picks up and delivers documents, packages, parts and supplies across metro Detroit: same day, within 2 hours, or on a regular route for your business. Photo proof at pickup and drop-off, and a signature when you need one. (Prescriptions and lab specimens go through Medical Deliveries.)",
    includes: ["Background-checked courier", "Photo proof at pickup & drop-off", "Live tracking link", "Signature on request", "Regular business routes available"],
    questions: [
      { id: "package_lb", label: "Package weight", type: "number", min: 0, max: 500, default: 0, unit: "lb", required: true, help: "Envelopes: enter 1. Up to 50 lb fits a car; heavier goes in an SUV or truck.", sets: { id: "size", tiers: [[1, "envelope"], [50, "box"], [Infinity, "bulky"]] } },
      { id: "package_in", label: "Longest side", type: "number", min: 0, max: 144, default: 0, unit: "in", help: "Optional. Anything over 36 in may need a larger vehicle." },
      { id: "size", label: "What are we carrying?", type: "select", default: "box", options: [
        { value: "envelope", label: "Envelope or documents" }, { value: "box", label: "Box or package (up to 50 lb)" }, { value: "bulky", label: "Bulky or heavy (needs an SUV or truck)" },
      ] },
      { id: "miles", label: "Distance from pickup to drop-off", type: "number", min: 1, max: 60, default: 8, unit: "mi", help: "First 5 miles included." },
      { id: "stops", label: "Drop-off stops", type: "number", min: 1, max: 10, default: 1 },
      { id: "speed", label: "How fast?", type: "select", default: "same_day", options: [
        { value: "same_day", label: "Same day" }, { value: "rush", label: "Within 2 hours" },
      ] },
      { id: "signature", label: "Signature required", type: "toggle", default: false },
      { id: "round_trip", label: "Round trip (bring something back)", type: "toggle", default: false },
    ],
    minimum: 25,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly", "monthly"],
    trades: ["errands"],
    price: (a) => {
      const size = s(a, "size", "box");
      const items: LineItem[] = [{ label: "Courier pickup & delivery", amount: { envelope: 25, box: 30, bulky: 55 }[size] ?? 30 }];
      const miles = n(a, "miles", 8);
      if (miles > 5) items.push({ label: `${miles - 5} extra miles × $1.50`, amount: Math.round((miles - 5) * 1.5) });
      const stops = Math.max(1, n(a, "stops", 1));
      if (stops > 1) items.push({ label: `${stops - 1} more stop${stops > 2 ? "s" : ""} × $10`, amount: (stops - 1) * 10 });
      if (s(a, "speed", "same_day") === "rush") items.push({ label: "Within 2 hours", amount: 20 });
      if (b(a, "signature")) items.push({ label: "Signature on delivery", amount: 3 });
      if (b(a, "round_trip")) items.push({ label: "Return trip", amount: Math.round(sum(items) * 0.6) });
      return { items, base: sum(items), hours: 0.75 + miles / 25 + (stops - 1) * 0.25 + (b(a, "round_trip") ? 0.5 : 0) };
    },
  },
  {
    slug: "medical-delivery",
    name: "Medical Deliveries",
    category: "errands",
    icon: "💊",
    tagline: "Prescriptions, supplies and lab specimens — handled with care, signed for.",
    description: "Courier delivery for patients, caregivers, pharmacies, clinics and labs: prescription pickups, medical supplies and equipment, lab specimens and records. Couriers are background-checked and HIPAA-trained; specimen couriers also have bloodborne-pathogen training. Signature and chain-of-custody log on every run.",
    includes: ["Background-checked, HIPAA-trained courier", "Signature & chain-of-custody log", "Sealed, labeled transport", "Cold chain on request", "Live updates and photo proof"],
    questions: [
      { id: "item", label: "What are we delivering?", type: "select", default: "prescription", options: [{ value: "prescription", label: "Prescription pickup (pharmacy)" }, { value: "supplies", label: "Medical supplies or equipment" }, { value: "specimens", label: "Lab specimens (clinics & labs)" }, { value: "documents", label: "Records, films or documents" }] },
      { id: "stops", label: "Drop-off stops", type: "number", min: 1, max: 20, default: 1 },
      { id: "miles", label: "Total miles", type: "number", min: 1, max: 80, default: 10, unit: "mi", help: "First 10 miles included." },
      { id: "temp", label: "Temperature-controlled (cold chain)", type: "toggle", default: false },
      { id: "equipment", label: "Large equipment (wheelchair, walker, oxygen concentrator)", type: "toggle", default: false },
      { id: "stat", label: "STAT — picked up within 90 minutes", type: "toggle", default: false },
    ],
    minimum: 29,
    spread: [1, 1],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly", "monthly"],
    trades: ["medical_courier"],
    licensed: true, // HIPAA training certificate on file (vetting: medical_courier)
    notesHint: "Pickup place and contact, drop-off(s), who may sign, time window. Prescriptions: tell the pharmacy we're picking up for you (we don't carry controlled substances without the pharmacy's approval).",
    price: (a) => {
      const item = s(a, "item", "prescription");
      const stops = Math.max(1, n(a, "stops", 1));
      const miles = n(a, "miles", 10);
      const items: LineItem[] = [{ label: ({ prescription: "Prescription pickup & delivery", supplies: "Medical supplies delivery", specimens: "Lab specimen courier (sealed, UN3373 packaging)", documents: "Records & documents courier" } as Record<string, string>)[item] ?? "Medical delivery", amount: ({ prescription: 29, supplies: 35, specimens: 45, documents: 29 } as Record<string, number>)[item] ?? 29 }];
      if (stops > 1) items.push({ label: `${stops - 1} more stop${stops > 2 ? "s" : ""} × $12`, amount: (stops - 1) * 12 });
      if (miles > 10) items.push({ label: `${miles - 10} extra miles × $1.50`, amount: Math.round((miles - 10) * 1.5) });
      if (b(a, "temp")) items.push({ label: "Temperature-controlled transport", amount: 25 });
      if (b(a, "equipment")) items.push({ label: "Large equipment handling", amount: 25 });
      if (b(a, "stat")) items.push({ label: "STAT pickup", amount: 35 });
      const base = sum(items);
      return { items, base, hours: 0.75 + stops * 0.3 + miles / 30 };
    },
  },
  {
    slug: "personal-assistant",
    insuranceOptional: true,
    name: "Personal Assistant for the Day",
    category: "errands",
    icon: "🗂️",
    tagline: "An extra pair of hands — for a few hours or the whole day.",
    description: "A background-checked assistant for errands, waiting for deliveries or contractors, light organizing, packing, event prep, home-office help and appointment runs. Purchases are billed at cost with receipts.",
    includes: ["Background-checked, bonded assistant", "Your task list, done in order", "Check-ins & photos through the app", "Purchases at cost with receipt"],
    questions: [
      { id: "hours", label: "Hours", type: "number", min: 2, max: 10, default: 4, unit: "hrs" },
      { id: "driving", label: "Assistant drives (errands, pickups)", type: "toggle", default: true },
    ],
    minimum: 120,
    spread: [1, 1],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly", "monthly"],
    trades: ["errands"],
    price: (a) => {
      const h = n(a, "hours", 4);
      const rate = h >= 8 ? 36 : 40;
      const items: LineItem[] = [{ label: `${h} hours × $${rate}${h >= 8 ? " (full-day rate)" : ""}`, amount: h * rate }];
      if (b(a, "driving")) items.push({ label: "Driving & mileage (up to 40 mi)", amount: 20 });
      const base = sum(items);
      return { items, base, hours: h };
    },
  },

  // ───────────────────────────── TRANSPORTATION ─────────────────────────────
  // Booked with licensed operator companies only (state/federal authority, passenger-carrier
  // insurance). Date + exact pickup time like events; pickup = the booking address.
  {
    slug: "laundry-pickup",
    name: "Laundry Pickup & Delivery",
    category: "errands",
    icon: "👕",
    tagline: "Wash & fold, picked up and back folded in 24–48 hours.",
    description: "Your laundry picked up at the door, washed, dried and folded the way you like (your detergent preferences, hang-dry items kept separate), and delivered back in 24 to 48 hours, or same day when booked by 10 am. Comforters and bedding priced per piece. Dry cleaning runs are booked under Errands & Drop-Offs.",
    includes: ["Background-checked laundry pro", "Your detergent and care preferences", "Hang-dry items kept separate", "Folded, bagged and delivered", "Weight receipt with every order"],
    notesHint: "Detergent and softener preferences, hang-dry or delicate items, and where to pick up and drop off",
    questions: [
      { id: "lbs", label: "Laundry weight", type: "number", min: 10, max: 200, default: 20, unit: "lb", help: "A full tall kitchen bag is about 15–20 lb; a week of laundry for 2 people is about 20–30 lb. Weighed at pickup." },
      { id: "comforters", label: "Comforters or duvets", type: "number", min: 0, max: 10, default: 0 },
      { id: "same_day", label: "Same-day return (booked by 10 am)", type: "toggle", default: false },
    ],
    minimum: 40,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["laundry"],
    insuranceOptional: true,
    price: (a) => {
      // Detroit-metro 2026: wash & fold with pickup $1.75–$2.50/lb (20 lb minimum), pickup & delivery $5–$12,
      // comforters $20–$35 each, same-day +$10–$20.
      const lb = Math.max(20, n(a, "lbs", 20)), c = n(a, "comforters");
      const items: LineItem[] = [{ label: `Wash & fold — ${lb} lb`, amount: Math.round(lb * 2) }, { label: "Pickup & delivery", amount: 9 }];
      if (c) items.push({ label: `Comforters & duvets — ${c}`, amount: c * 28 });
      if (b(a, "same_day")) items.push({ label: "Same-day return", amount: 15 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, 0.75 + lb / 25) };
    },
  },
  {
    slug: "home-watch",
    name: "Home Watch (Vacant & Seasonal Homes)",
    category: "errands",
    icon: "🏡",
    tagline: "Away for the winter or between tenants? We check the house and send photos.",
    description: "Scheduled visits to a home that's empty: inside and outside checked for leaks, break-ins, pests and storm damage, faucets run and toilets flushed, the furnace and thermostat checked (no frozen pipes), mail and packages brought in, and a photo report after every visit. Many insurers require regular checks on vacant homes — the reports are your proof. After a storm or a power outage we go the same day.",
    includes: ["Background-checked, bonded home watcher", "Inside & outside checklist every visit", "Faucets run, toilets flushed, heat checked", "Photo report after every visit", "Same-day check after storms or outages"],
    notesHint: "Access (lockbox code or key), the alarm, the thermostat setting you want, the water shutoff location, and who to call for repairs",
    questions: [
      { id: "sqft", label: "Home size", type: "number", min: 500, max: 10000, default: 1800, unit: "sq ft" },
      { id: "mail", label: "Bring in mail and packages", type: "toggle", default: true },
      { id: "plants", label: "Water indoor plants", type: "toggle", default: false },
      { id: "car", label: "Start the car and run it a few minutes", type: "toggle", default: false },
    ],
    minimum: 45,
    spread: [0.95, 1.1],
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly", "monthly"],
    trades: ["errands"],
    insuranceOptional: true,
    price: (a) => {
      // Detroit-metro 2026: home watch visit $40–$65 (bigger homes more), add-ons $5–$15 each.
      const sq = n(a, "sqft", 1800);
      const items: LineItem[] = [{ label: `Home watch visit with photo report — ${sq} sq ft`, amount: sq > 3500 ? 75 : sq > 2500 ? 60 : 49 }];
      if (b(a, "mail")) items.push({ label: "Mail & packages", amount: 8 });
      if (b(a, "plants")) items.push({ label: "Indoor plants watered", amount: 10 });
      if (b(a, "car")) items.push({ label: "Car started & run", amount: 10 });
      return { items, base: sum(items), hours: sq > 2500 ? 1 : 0.75 };
    },
  },
  {
    slug: "private-driver",
    name: "Private Driver / Black Car",
    category: "transport",
    icon: "🚘",
    tagline: "A professional driver by the hour — meetings, nights out, a day of errands.",
    description: "A licensed, insured chauffeur and late-model sedan, SUV or Sprinter van for as many hours as you need. Waiting time included; make as many stops as you like within your hours.",
    includes: ["Licensed operator & vetted chauffeur", "Late-model vehicle, cleaned for you", "Waiting time included", "Live driver contact on the day"],
    questions: [
      { id: "vehicle", label: "Vehicle", type: "select", default: "sedan", options: [{ value: "sedan", label: "Black sedan (up to 3 passengers)" }, { value: "suv", label: "Black SUV (up to 6)" }, { value: "sprinter", label: "Executive Sprinter (up to 12)" }] },
      { id: "hours", label: "Hours", type: "number", min: 2, max: 24, default: 3, unit: "hrs", help: "2-hour minimum. A full day is about 10 hours." },
      { id: "passengers", label: "Passengers", type: "number", min: 1, max: 12, default: 2 },
      { id: "meet_greet", label: "Meet & greet with a sign (airport, hotel, office lobby)", type: "toggle", default: false },
    ],
    minimum: 170,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once", "weekly"],
    trades: ["transportation"],
    licensed: true,
    leadDays: 1,
    notesHint: "Pickup time, drop-off address, stops in order, flight number if any, anything the driver should know",
    price: (a) => {
      const { veh, upgraded } = fitVehicle(s(a, "vehicle", "sedan"), n(a, "passengers", 2), [["sedan", 3], ["suv", 6], ["sprinter", 12]]);
      const rate = { sedan: 85, suv: 110, sprinter: 150 }[veh] ?? 85;
      const h = Math.max(2, n(a, "hours", 3));
      const items: LineItem[] = [{ label: `${({ sedan: "Black sedan", suv: "Black SUV", sprinter: "Executive Sprinter" } as Record<string, string>)[veh] ?? "Vehicle"}${upgraded ? " (sized up to seat everyone)" : ""} · ${h} hours × $${rate}`, amount: h * rate }];
      if (b(a, "meet_greet")) items.push({ label: "Meet & greet", amount: 25 });
      const base = sum(items);
      return { items, base, hours: h };
    },
  },
  {
    slug: "urgent-ride",
    name: "Urgent Ride (Non-Medical)",
    category: "transport",
    icon: "🚨",
    tagline: "Stranded or need to go right now? A licensed driver on the way. Medical emergency? Call 911.",
    description: "A ride as soon as possible when it can't wait but isn't a medical emergency: your car broke down, you're stranded, you'll miss your shift, a family emergency, or getting home safely late at night. A licensed, insured driver comes as fast as one is available. For a medical emergency, call 911. We don't provide medical transport or medical care.",
    includes: ["Licensed, insured driver", "Fastest available pickup", "Live driver tracking", "Up to 6 passengers"],
    questions: [
      { id: "vehicle", label: "Vehicle", type: "select", default: "sedan", options: [{ value: "sedan", label: "Sedan (up to 3 passengers)" }, { value: "suv", label: "SUV (up to 6)" }] },
      { id: "miles", label: "About how far", type: "number", min: 1, max: 150, default: 10, unit: "miles" },
      { id: "passengers", label: "Passengers", type: "number", min: 1, max: 6, default: 1 },
      { id: "wait_return", label: "Driver waits and brings you back (up to 1 hour)", type: "toggle", default: false },
    ],
    minimum: 45,
    spread: [1, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["transportation"],
    licensed: true,
    onDemand: true,
    notesHint: "Where you are now (address or landmark), where you're going, a phone number the driver can call, anything they should know. Medical emergency? Call 911.",
    price: (a) => {
      const { veh, upgraded } = fitVehicle(s(a, "vehicle", "sedan"), n(a, "passengers", 1), [["sedan", 3], ["suv", 6]]);
      const perMile = veh === "suv" ? 3.5 : 2.75;
      const miles = n(a, "miles", 10);
      const back = b(a, "wait_return");
      const legs = back ? 2 : 1;
      const items: LineItem[] = [
        { label: "Urgent dispatch", amount: 35 },
        { label: `${veh === "suv" ? "SUV" : "Sedan"}${upgraded ? " (sized up to seat everyone)" : ""} · ${miles * legs} miles × $${perMile.toFixed(2)}`, amount: Math.round(miles * legs * perMile) },
      ];
      if (back) items.push({ label: "Wait & return (up to 1 hour)", amount: 30 });
      return { items, base: sum(items), hours: 0.5 + (miles * legs) / 25 + (back ? 1 : 0) };
    },
  },
  {
    slug: "airport-transfer",
    name: "Airport Transfer",
    category: "transport",
    icon: "✈️",
    tagline: "Flat-rate rides to and from the airport — flight tracked.",
    description: "Door-to-terminal rides in a sedan, SUV or Sprinter. Your driver tracks your flight, waits for delays and meets you at baggage claim on request.",
    includes: ["Flat rate, tolls and parking included", "Flight tracking", "Free waiting for flight delays", "Licensed operator & vetted chauffeur"],
    questions: [
      { id: "vehicle", label: "Vehicle", type: "select", default: "sedan", options: [{ value: "sedan", label: "Sedan (up to 3 passengers, 3 bags)" }, { value: "suv", label: "SUV (up to 6, 6 bags)" }, { value: "sprinter", label: "Sprinter (up to 12, 12 bags)" }] },
      { id: "trip", label: "Trip", type: "select", default: "one_way", options: [{ value: "one_way", label: "One way" }, { value: "round_trip", label: "Round trip" }] },
      { id: "passengers", label: "Passengers", type: "number", min: 1, max: 12, default: 2 },
      { id: "meet_greet", label: "Meet at baggage claim with a sign", type: "toggle", default: false },
    ],
    minimum: 95,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["transportation"],
    licensed: true,
    leadDays: 1,
    notesHint: "Airport, airline and flight number(s), pickup time, return date and time for round trips, number of bags",
    price: (a) => {
      const { veh, upgraded } = fitVehicle(s(a, "vehicle", "sedan"), n(a, "passengers", 2), [["sedan", 3], ["suv", 6], ["sprinter", 12]]);
      const each = { sedan: 95, suv: 130, sprinter: 195 }[veh] ?? 95;
      const legs = s(a, "trip", "one_way") === "round_trip" ? 2 : 1;
      const items: LineItem[] = [{ label: `${({ sedan: "Sedan", suv: "SUV", sprinter: "Sprinter" } as Record<string, string>)[veh] ?? "Vehicle"}${upgraded ? " (sized up to seat everyone)" : ""} · ${legs === 2 ? "round trip" : "one way"} × $${each}`, amount: legs * each }];
      if (b(a, "meet_greet")) items.push({ label: `Meet & greet${legs === 2 ? " (arrival)" : ""}`, amount: 25 });
      const base = sum(items);
      return { items, base, hours: legs * 1.5 };
    },
  },
  {
    slug: "limousine",
    name: "Limousine",
    category: "transport",
    icon: "🥂",
    tagline: "Stretch and SUV limos for weddings, proms and big nights.",
    description: "A chauffeured stretch or SUV limousine by the hour, with a red-carpet option for weddings and proms. Licensed operators with passenger-carrier insurance.",
    includes: ["Licensed operator & vetted chauffeur", "Stretch or SUV limousine", "Ice, water & sound system", "Red carpet for weddings & proms (option)"],
    questions: [
      { id: "vehicle", label: "Limousine", type: "select", default: "stretch", options: [{ value: "stretch", label: "Stretch limo (up to 10)" }, { value: "suv_limo", label: "SUV limo (up to 18)" }] },
      { id: "hours", label: "Hours", type: "number", min: 3, max: 12, default: 4, unit: "hrs", help: "3-hour minimum." },
      { id: "passengers", label: "Passengers", type: "number", min: 1, max: 18, default: 8 },
      { id: "occasion", label: "Occasion", type: "select", default: "night_out", options: [{ value: "wedding", label: "Wedding" }, { value: "prom", label: "Prom / homecoming" }, { value: "night_out", label: "Night out / birthday" }, { value: "corporate", label: "Corporate" }] },
      { id: "red_carpet", label: "Red carpet & decorations", type: "toggle", default: false },
    ],
    minimum: 405,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["transportation"],
    licensed: true,
    leadDays: 2,
    notesHint: "Pickup time and address, every stop in order, drop-off, and whether anyone aboard is under 21",
    price: (a) => {
      const { veh, upgraded } = fitVehicle(s(a, "vehicle", "stretch"), n(a, "passengers", 8), [["stretch", 10], ["suv_limo", 18]]);
      const rate = veh === "suv_limo" ? 195 : 135;
      const h = Math.max(3, n(a, "hours", 4));
      const items: LineItem[] = [{ label: `${veh === "suv_limo" ? "SUV limo" : "Stretch limo"}${upgraded ? " (sized up to seat everyone)" : ""} · ${h} hours × $${rate}`, amount: h * rate }];
      if (b(a, "red_carpet")) items.push({ label: "Red carpet & decorations", amount: 150 });
      if (s(a, "occasion", "night_out") === "prom") items.push({ label: "Prom night (peak demand)", amount: Math.round(h * rate * 0.1) });
      const base = sum(items);
      return { items, base, hours: h };
    },
  },
  {
    slug: "party-bus",
    name: "Party Bus",
    category: "transport",
    icon: "🎉",
    tagline: "Lights, sound and room to move — for 20 to 40 guests.",
    description: "A chauffeured party bus with LED lighting, sound system and wrap-around seating for bachelor and bachelorette parties, birthdays, game days and bar crawls.",
    includes: ["Licensed operator & CDL driver", "LED lights & sound system", "Wrap-around seating", "Ice & coolers"],
    questions: [
      { id: "size", label: "Bus size", type: "select", default: "20", options: [{ value: "20", label: "Up to 20 guests" }, { value: "30", label: "Up to 30 guests" }, { value: "40", label: "Up to 40 guests" }] },
      { id: "hours", label: "Hours", type: "number", min: 4, max: 12, default: 4, unit: "hrs", help: "4-hour minimum." },
      { id: "weekend_night", label: "Friday or Saturday night", type: "toggle", default: true },
    ],
    minimum: 900,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["transportation"],
    licensed: true,
    leadDays: 3,
    notesHint: "Pickup time and address, stops in order, drop-off, the occasion, and whether anyone aboard is under 21",
    price: (a) => {
      const size = s(a, "size", "20");
      const rate = { "20": 225, "30": 275, "40": 325 }[size] ?? 225;
      const h = Math.max(4, n(a, "hours", 4));
      const items: LineItem[] = [{ label: `Party bus up to ${size} · ${h} hours × $${rate}`, amount: h * rate }];
      if (b(a, "weekend_night")) items.push({ label: "Friday / Saturday night", amount: Math.round(h * rate * 0.15) });
      const base = sum(items);
      return { items, base, hours: h };
    },
  },
  {
    slug: "charter-bus",
    name: "Tour & Charter Bus",
    category: "transport",
    icon: "🚌",
    tagline: "Mini-coaches and motorcoaches by the day — tours, teams, groups.",
    description: "Full-day charters for tours, school and church groups, sports teams, weddings and company outings. Professional CDL drivers, restroom-equipped motorcoaches, multi-day trips.",
    includes: ["Licensed operator & CDL driver", "Up to 10 hours of service per day", "Restroom on motorcoaches", "Luggage bays"],
    questions: [
      { id: "vehicle", label: "Coach", type: "select", default: "motorcoach", options: [{ value: "minicoach", label: "Mini-coach (up to 30)" }, { value: "motorcoach", label: "Motorcoach (up to 56, restroom)" }] },
      { id: "days", label: "Days", type: "number", min: 1, max: 14, default: 1 },
      { id: "passengers", label: "Passengers", type: "number", min: 1, max: 56, default: 40 },
      { id: "overnight", label: "Overnight trip (driver lodging)", type: "toggle", default: false },
      { id: "out_of_state", label: "Leaves Michigan", type: "toggle", default: false },
    ],
    minimum: 1100,
    spread: [1, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["transportation"],
    licensed: true,
    leadDays: 7,
    notesHint: "Itinerary: pickup time and place, each stop, overnight hotels, return time, total miles if known",
    price: (a) => {
      const { veh, upgraded } = fitVehicle(s(a, "vehicle", "motorcoach"), n(a, "passengers", 40), [["minicoach", 30], ["motorcoach", 56]]);
      const day = veh === "minicoach" ? 1100 : 1800;
      const d = Math.max(1, n(a, "days", 1));
      const items: LineItem[] = [{ label: `${veh === "minicoach" ? "Mini-coach" : "Motorcoach"}${upgraded ? " (sized up to seat everyone)" : ""} · ${d} day${d > 1 ? "s" : ""} × $${day}`, amount: d * day }];
      if (b(a, "overnight") && d > 1) items.push({ label: `Driver lodging · ${d - 1} night${d > 2 ? "s" : ""} × $200`, amount: (d - 1) * 200 });
      const base = sum(items);
      return { items, base, hours: d * 10 };
    },
  },
  {
    slug: "game-day-rides",
    name: "Game Day & Concert Rides",
    category: "transport",
    icon: "🏟️",
    tagline: "Door to the gate for the game or the show — your driver waits and brings everyone home.",
    description: "Round trips to sporting events, concerts and festivals in an SUV, Sprinter, party bus or coach. Drop-off at the gate or lot, your driver waits through the event and picks you up after — no parking, no traffic stress, no one has to drive home. Tailgate kits on request.",
    includes: ["Licensed operator & vetted chauffeur", "Drop-off and pickup at the venue", "Driver waits through the event", "Live driver contact for the post-event pickup"],
    questions: [
      { id: "event", label: "Event", type: "select", default: "sports", options: [{ value: "sports", label: "Sporting event" }, { value: "concert", label: "Concert or show" }, { value: "festival", label: "Festival" }] },
      { id: "vehicle", label: "Vehicle", type: "select", default: "sprinter", options: [{ value: "suv", label: "Black SUV (up to 6)" }, { value: "sprinter", label: "Sprinter van (up to 12)" }, { value: "party_bus", label: "Party bus (up to 20–40)" }, { value: "minicoach", label: "Mini-coach (up to 30)" }, { value: "motorcoach", label: "Motorcoach (up to 56)" }] },
      { id: "passengers", label: "Passengers", type: "number", min: 1, max: 56, default: 8 },
      { id: "hours", label: "Hours, pickup to drop-off", type: "number", min: 4, max: 14, default: 6, unit: "hrs", help: "Most games and concerts are 5–7 hours door to door. 4-hour minimum." },
      { id: "big_event", label: "Playoffs, championship, sold-out tour or festival weekend", type: "toggle", default: false },
      { id: "tailgate", label: "Tailgate kit (cooler with ice, folding table & chairs)", type: "toggle", default: false },
    ],
    minimum: 440,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["transportation"],
    licensed: true,
    leadDays: 2,
    notesHint: "Venue and event, pickup time and address, drop-off spot (gate or lot), where to meet after, and whether anyone aboard is under 21",
    price: (a) => {
      const chosen = s(a, "vehicle", "sprinter");
      const pax = n(a, "passengers", 8);
      // party buses size up within party buses; everything else up the van → coach ladder
      const { veh, upgraded } = chosen === "party_bus"
        ? fitVehicle("party_bus", pax, [["party_bus", 20], ["party_bus_30", 30], ["party_bus_40", 40], ["motorcoach", 56]])
        : fitVehicle(chosen, pax, [["suv", 6], ["sprinter", 12], ["minicoach", 30], ["motorcoach", 56]]);
      const rate = ({ suv: 110, sprinter: 150, party_bus: 225, party_bus_30: 275, party_bus_40: 325, minicoach: 210, motorcoach: 260 } as Record<string, number>)[veh] ?? 150;
      const name = ({ suv: "Black SUV", sprinter: "Sprinter van", party_bus: "Party bus (20)", party_bus_30: "Party bus (30)", party_bus_40: "Party bus (40)", minicoach: "Mini-coach", motorcoach: "Motorcoach" } as Record<string, string>)[veh] ?? "Vehicle";
      const h = Math.max(4, n(a, "hours", 6));
      const items: LineItem[] = [{ label: `${name}${upgraded ? " (sized up to seat everyone)" : ""} · ${h} hours × $${rate}`, amount: h * rate }];
      if (b(a, "big_event")) items.push({ label: "Peak event (playoffs, sold-out show, festival)", amount: Math.round(h * rate * 0.15) });
      if (b(a, "tailgate")) items.push({ label: "Tailgate kit", amount: 75 });
      items.push({ label: "Venue bus / limo parking, if the venue charges — billed at cost", amount: 0 });
      const base = sum(items);
      return { items, base, hours: h };
    },
  },
  {
    slug: "event-shuttle",
    name: "Corporate & Event Shuttle",
    category: "transport",
    icon: "🚐",
    tagline: "Loops between hotels, offices, parking and your venue.",
    description: "Scheduled shuttle loops for corporate events, conferences, weddings and festivals: Sprinters, mini-coaches or motorcoaches running between hotels, parking and the venue, with an on-site coordinator for larger fleets.",
    includes: ["Licensed operator & vetted drivers", "Loop schedule planned for you", "Signage at each stop", "On-site coordinator for 3+ vehicles"],
    questions: [
      { id: "vehicle", label: "Vehicle", type: "select", default: "sprinter", options: [{ value: "sprinter", label: "Sprinter (12 per vehicle)" }, { value: "minicoach", label: "Mini-coach (30)" }, { value: "motorcoach", label: "Motorcoach (56)" }] },
      { id: "vehicles", label: "Number of vehicles", type: "number", min: 1, max: 10, default: 1 },
      { id: "hours", label: "Hours of service", type: "number", min: 3, max: 14, default: 4, unit: "hrs", help: "3-hour minimum per vehicle." },
    ],
    minimum: 450,
    spread: [1, 1.1],
    siteVisit: false,
    frequencies: ["once", "weekly"],
    trades: ["transportation"],
    licensed: true,
    leadDays: 7,
    notesHint: "Event, stops (hotels, parking, venue), first and last run times, expected riders",
    price: (a) => {
      const veh = s(a, "vehicle", "sprinter");
      const rate = { sprinter: 150, minicoach: 210, motorcoach: 260 }[veh] ?? 150;
      const v = Math.max(1, n(a, "vehicles", 1));
      const h = Math.max(3, n(a, "hours", 4));
      const items: LineItem[] = [{ label: `${v} × ${veh} · ${h} hours × $${rate}`, amount: v * h * rate }];
      if (v >= 3) items.push({ label: "On-site shuttle coordinator", amount: h * 45 });
      const base = sum(items);
      return { items, base, hours: h };
    },
  },

  // ───────────────────────────── PARTIES & EVENTS ─────────────────────────────
  {
    slug: "event-package",
    name: "Plan My Event (by Budget)",
    category: "events",
    icon: "🎈",
    tagline: "Give us a budget and a guest count — we plan and book everything.",
    description: "Tell us your total budget, guest count and type of event. We split the budget across food, venue, music, rentals and coordination, book vetted vendors through Handled, and run the day. One invoice; your plan never goes over budget.",
    includes: ["Free planning call", "Budget split you approve", "All vendors booked & coordinated", "Day-of coordinator", "Never over your budget"],
    questions: [
      { id: "budget", label: "Total budget", type: "number", min: 1000, max: 250000, default: 5000, unit: "$" },
      { id: "guests", label: "Guests expected", type: "number", min: 10, max: 1000, default: 50 },
      { id: "event_type", label: "Type of event", type: "select", default: "birthday", options: EVENT_TYPES },
      {
        id: "venue",
        label: "Where",
        type: "select",
        default: "need",
        options: [
          { value: "need", label: "Find us a venue" },
          { value: "have", label: "We have a place (home, office, backyard)" },
        ],
      },
      { id: "alcohol", label: "Alcohol will be served", type: "toggle", default: false, help: "With alcohol and 50+ guests (or any event of 150+), we set aside part of the budget for licensed security." },
    ],
    minimum: 1000,
    spread: [1, 1],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["event_planner"],
    leadDays: 14,
    price: (a) => {
      const plan = planEventBudget({ budget: n(a, "budget", 5000), guests: n(a, "guests", 50), eventType: s(a, "event_type", "birthday"), haveVenue: s(a, "venue", "need") === "have", alcohol: b(a, "alcohol") });
      return { items: plan.lines.map((l) => ({ label: `${l.label} — ${l.buys}`, amount: l.amount })), base: plan.budget, hours: 40 };
    },
  },
  {
    slug: "event-planning",
    name: "Event Planning & Coordination",
    category: "events",
    icon: "🎉",
    tagline: "One planner, every vendor, one invoice.",
    description: "Birthdays, weddings, graduations, holiday and corporate events. Your planner builds the plan and budget, books catering, music, rentals and the venue through us, and runs the day so you can enjoy it.",
    includes: ["Free planning consultation", "Budget & timeline", "Vendor booking through Handled", "Day-of coordinator on site", "One invoice for everything"],
    questions: [
      { id: "event_type", label: "Type of event", type: "select", default: "birthday", options: EVENT_TYPES },
      { id: "guests", label: "Guests", type: "number", min: 10, max: 1000, default: 50 },
      {
        id: "level",
        label: "How much help",
        type: "select",
        default: "partial",
        options: [
          { value: "day_of", label: "Day-of coordination" },
          { value: "partial", label: "Partial planning (vendors + day-of)" },
          { value: "full", label: "Full planning, start to finish" },
        ],
      },
      { id: "hours", label: "Event length", type: "number", min: 2, max: 16, default: 5, unit: "hrs" },
    ],
    minimum: 650,
    spread: [0.9, 1.25],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["event_planner"],
    leadDays: 7,
    price: (a) => {
      const g = n(a, "guests", 50), h = n(a, "hours", 5);
      const lvl = s(a, "level", "partial");
      const fee = lvl === "day_of" ? 650 + h * 60 : lvl === "partial" ? 1600 + g * 8 + h * 60 : 2800 + g * 15 + h * 60;
      const items: LineItem[] = [{ label: `${{ day_of: "Day-of coordination", partial: "Partial planning", full: "Full planning" }[lvl] ?? lvl} — ${g} guests, ${h} hrs`, amount: fee }];
      return { items, base: fee, hours: lvl === "full" ? 40 : lvl === "partial" ? 16 : h + 2 };
    },
  },
  {
    slug: "catering",
    name: "Catering",
    category: "events",
    icon: "🍽️",
    tagline: "Appetizers to plated dinners, staffed and served.",
    description: "Licensed caterers for parties, offices and celebrations. Choose a service style, add servers, bar service and tableware; dietary needs handled in your notes.",
    includes: ["Licensed, insured caterer", "Menu planning", "Setup & cleanup", "Dietary options", "Food-safety compliant"],
    questions: [
      { id: "guests", label: "Guests", type: "number", min: 10, max: 1000, default: 50 },
      {
        id: "style",
        label: "Service style",
        type: "select",
        default: "buffet",
        options: [
          { value: "apps", label: "Appetizers / heavy hors d'oeuvres" },
          { value: "taco", label: "Taco / build-your-own bar" },
          { value: "bbq", label: "BBQ / grill-out" },
          { value: "buffet", label: "Buffet" },
          { value: "family", label: "Family-style" },
          { value: "plated", label: "Plated dinner" },
        ],
      },
      { id: "hours", label: "Service length", type: "number", min: 2, max: 10, default: 4, unit: "hrs" },
      { id: "servers", label: "Servers / staff", type: "toggle", default: true },
      { id: "bar", label: "Bar service (bartender & mixers)", type: "toggle", default: false },
      { id: "tableware", label: "Plates, glassware & flatware", type: "toggle", default: false },
    ],
    minimum: 600,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["catering"],
    licensed: true,
    leadDays: 7,
    price: (a) => {
      const g = n(a, "guests", 50), h = n(a, "hours", 4);
      const per = { apps: 22, taco: 24, bbq: 28, buffet: 32, family: 40, plated: 52 }[s(a, "style", "buffet")] ?? 32;
      const items: LineItem[] = [{ label: `${g} guests × $${per} (${s(a, "style", "buffet")})`, amount: g * per }];
      if (b(a, "servers")) { const staff = Math.max(1, Math.ceil(g / 25)); items.push({ label: `${staff} server${staff > 1 ? "s" : ""} × ${h} hrs`, amount: staff * h * 40 }); }
      if (b(a, "bar")) items.push({ label: "Bar service", amount: g * 14 });
      if (b(a, "tableware")) items.push({ label: "Tableware", amount: g * 4 });
      const base = sum(items);
      return { items, base, hours: h + 3 };
    },
  },
  {
    slug: "food-truck",
    name: "Food Truck Booking",
    category: "events",
    icon: "🚚",
    tagline: "Tacos, BBQ, pizza, burgers or dessert — parked at your party.",
    description: "Book a licensed food truck for parties, office lunches, block parties and weddings. Priced per guest with a booking minimum; the truck brings everything.",
    includes: ["Licensed, inspected truck", "Menu for your guest count", "Service window you choose", "Trash handled"],
    questions: [
      { id: "guests", label: "Guests", type: "number", min: 20, max: 1000, default: 75 },
      {
        id: "cuisine",
        label: "Cuisine",
        type: "select",
        default: "tacos",
        options: [
          { value: "tacos", label: "Tacos" },
          { value: "bbq", label: "BBQ" },
          { value: "pizza", label: "Wood-fired pizza" },
          { value: "burgers", label: "Burgers" },
          { value: "dessert", label: "Dessert / coffee" },
        ],
      },
      { id: "hours", label: "Service window", type: "number", min: 1, max: 6, default: 2, unit: "hrs" },
    ],
    minimum: 1200,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["food_truck"],
    licensed: true,
    leadDays: 7,
    price: (a) => {
      const g = n(a, "guests", 75), h = n(a, "hours", 2);
      const per = { tacos: 16, bbq: 20, pizza: 17, burgers: 17, dessert: 9 }[s(a, "cuisine", "tacos")] ?? 16;
      const items: LineItem[] = [{ label: `${g} guests × $${per}`, amount: g * per }];
      if (h > 2) items.push({ label: `${h - 2} extra hour${h > 3 ? "s" : ""} on site`, amount: (h - 2) * 150 });
      const base = sum(items);
      return { items, base, hours: h + 2 };
    },
  },
  {
    slug: "dj-music",
    name: "DJ & Live Music",
    category: "events",
    icon: "🎧",
    tagline: "DJs, MCs, bands and acoustic duos.",
    description: "Professional DJs and musicians with their own sound system. Add lighting and ceremony audio; share your must-play and do-not-play lists in the notes.",
    includes: ["Pro sound system", "Music planning call", "Setup & teardown", "Backup equipment"],
    questions: [
      {
        id: "act",
        label: "Entertainment",
        type: "select",
        default: "dj",
        options: [
          { value: "dj", label: "DJ" },
          { value: "dj_mc", label: "DJ + MC / host" },
          { value: "acoustic", label: "Acoustic duo" },
          { value: "band", label: "Live band (4-piece)" },
        ],
      },
      { id: "hours", label: "Performance length", type: "number", min: 2, max: 10, default: 4, unit: "hrs" },
      { id: "lighting", label: "Dance-floor lighting", type: "toggle", default: false },
      { id: "ceremony", label: "Ceremony / speech audio", type: "toggle", default: false },
    ],
    minimum: 450,
    spread: [0.95, 1.15],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["dj_music"],
    leadDays: 7,
    price: (a) => {
      const h = n(a, "hours", 4);
      const act = s(a, "act", "dj");
      const amt = act === "band" ? 2800 + Math.max(0, h - 3) * 400 : h * ({ dj: 175, dj_mc: 210, acoustic: 300 }[act] ?? 175);
      const items: LineItem[] = [{ label: `${{ dj: "DJ", dj_mc: "DJ + MC", acoustic: "Acoustic duo", band: "Live band" }[act] ?? act} — ${h} hrs`, amount: amt }];
      if (b(a, "lighting")) items.push({ label: "Lighting package", amount: 250 });
      if (b(a, "ceremony")) items.push({ label: "Ceremony / speech audio", amount: 200 });
      const base = sum(items);
      return { items, base, hours: h + 2 };
    },
  },
  {
    slug: "event-security",
    name: "Event Security",
    category: "events",
    icon: "🛡️",
    tagline: "Licensed, uniformed security for parties, venues and events.",
    description: "Uniformed guards from a licensed Michigan security agency: door and ID checks, guest-list control, crowd and parking management, and a calm presence when alcohol is served. Unarmed by default; armed officers on request. You get an incident report after the event.",
    includes: ["Licensed security agency", "Uniformed, background-checked guards", "Door, ID & guest-list checks", "Crowd & parking control", "Incident report after the event"],
    notesHint: "Venue, entrances to cover, guest count, whether alcohol is served, VIPs or concerns, dress code (uniform or plain clothes)",
    questions: [
      { id: "guards", label: "Guards", type: "number", min: 1, max: 30, default: 2, help: "A good rule: 1 guard per 75 guests, or 1 per 50 when alcohol is served. At least 2 for 100+ guests." },
      { id: "hours", label: "Hours per guard", type: "number", min: 4, max: 14, default: 5, unit: "hrs", help: "4-hour minimum. Add 30 minutes before guests arrive and after they leave." },
      {
        id: "type",
        label: "Guard type",
        type: "select",
        default: "unarmed",
        options: [
          { value: "unarmed", label: "Unarmed (most events)" },
          { value: "armed", label: "Armed officers (licensed)" },
        ],
      },
      { id: "plain", label: "Plain clothes instead of uniform", type: "toggle", default: false },
    ],
    minimum: 220,
    spread: [0.95, 1.12],
    siteVisit: false,
    licensed: true,
    frequencies: ["once"],
    trades: ["security"],
    leadDays: 3,
    price: (a) => {
      const g = n(a, "guards", 2), h = Math.max(4, n(a, "hours", 5));
      const armed = s(a, "type", "unarmed") === "armed";
      const rate = armed ? 58 : 39;
      const items: LineItem[] = [{ label: `${armed ? "Armed officers" : "Unarmed guards"} — ${g} × ${h} hrs`, amount: g * h * rate }];
      const supervisors = g >= 5 ? Math.ceil(g / 10) : 0;
      if (supervisors) items.push({ label: `On-site supervisor — ${supervisors} × ${h} hrs`, amount: supervisors * h * 48 });
      if (b(a, "plain")) items.push({ label: "Plain-clothes detail", amount: g * 25 });
      return { items, base: sum(items), hours: h };
    },
  },

  // ───────────────────────────── SECURITY ─────────────────────────────
  {
    slug: "security-guard",
    name: "Security Guards & Patrol",
    category: "security",
    icon: "👮",
    tagline: "Licensed guards for your building, job site or lot — a standing post, nightly patrols or fire watch.",
    description: "Uniformed guards from a licensed Michigan security agency for offices, stores, apartment buildings, job sites, vacant properties and parking lots. Book a standing guard post, drive-by patrols that check doors, lights and the lot, or a fire watch while your alarm or sprinklers are out. Every shift ends with a daily activity report with photos. Book one night, or weekly or monthly coverage.",
    includes: ["Licensed security agency", "Uniformed, background-checked guards", "Daily activity report with photos", "Incidents reported to you right away", "One night, weekly or monthly coverage"],
    notesHint: "Address and what to protect, posts or areas to cover, shift times, access (keys, codes, gate), who to call for incidents, any recent problems",
    questions: [
      {
        id: "kind",
        label: "Coverage",
        type: "select",
        default: "post",
        options: [
          { value: "post", label: "Standing guard post (on site the whole shift)" },
          { value: "patrol", label: "Mobile patrol (drive-by checks through the night)" },
          { value: "fire_watch", label: "Fire watch (alarm or sprinklers out)" },
        ],
      },
      { id: "guards", label: "Guards on duty", type: "number", min: 1, max: 10, default: 1, showIf: { id: "kind", is: ["post", "fire_watch"] } },
      { id: "hours", label: "Hours per shift", type: "number", min: 4, max: 12, default: 8, unit: "hrs", showIf: { id: "kind", is: ["post", "fire_watch"] }, help: "4-hour minimum per shift." },
      { id: "visits", label: "Patrol checks per night", type: "number", min: 1, max: 6, default: 2, showIf: { id: "kind", is: ["patrol"] }, help: "Each check: walk the outside, test doors, check lights and the lot, photos in the report." },
      { id: "days", label: "Days or nights covered", type: "number", min: 1, max: 7, default: 1, help: "Per booking. Choose weekly or monthly to keep the same coverage going." },
      {
        id: "type",
        label: "Guard type",
        type: "select",
        default: "unarmed",
        showIf: { id: "kind", is: ["post"] },
        options: [
          { value: "unarmed", label: "Unarmed (most sites)" },
          { value: "armed", label: "Armed officers (licensed)" },
        ],
      },
    ],
    minimum: 160,
    spread: [0.95, 1.1],
    siteVisit: false,
    licensed: true,
    frequencies: ["once", "weekly", "monthly"],
    trades: ["security"],
    price: (a) => {
      const kind = s(a, "kind", "post");
      const d = Math.max(1, n(a, "days", 1));
      if (kind === "patrol") {
        const v = Math.max(1, n(a, "visits", 2));
        const items: LineItem[] = [{ label: `Patrol checks — ${v} per night × ${d} nights`, amount: v * d * 45 }];
        return { items, base: sum(items), hours: Math.ceil(v * d * 0.5) };
      }
      const g = Math.max(1, n(a, "guards", 1)), h = Math.max(4, n(a, "hours", 8));
      const armed = kind === "post" && s(a, "type", "unarmed") === "armed";
      const rate = kind === "fire_watch" ? 42 : armed ? 55 : 36;
      const label = kind === "fire_watch" ? "Fire watch" : armed ? "Armed officers" : "Unarmed guards";
      const items: LineItem[] = [{ label: `${label} — ${g} × ${h} hrs × ${d} days`, amount: g * h * d * rate }];
      const supervisors = g >= 5 ? Math.ceil(g / 10) : 0;
      if (supervisors) items.push({ label: `Site supervisor — ${supervisors} × ${h} hrs × ${d} days`, amount: supervisors * h * d * 46 });
      return { items, base: sum(items), hours: g * h * d };
    },
  },
  {
    slug: "event-rentals",
    name: "Seating & Party Rentals",
    category: "events",
    icon: "🪑",
    tagline: "Chairs, tables, linens, tents and dance floors — delivered & set up.",
    description: "Everything to seat and shelter your guests, delivered, set up and picked up. Tent sizes for backyard parties to big celebrations.",
    includes: ["Delivery, setup & pickup", "Clean, inspected rentals", "Tent staking / weights", "Damage waiver available"],
    questions: [
      { id: "chairs", label: "Chairs", type: "number", min: 0, max: 1000, default: 50 },
      { id: "tables", label: "Tables (6-ft or 60\" round)", type: "number", min: 0, max: 200, default: 6 },
      { id: "linens", label: "Tablecloths", type: "toggle", default: false },
      {
        id: "tent",
        label: "Tent",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "No tent" },
          { value: "t20x20", label: "20×20 (≈ 40 seated)" },
          { value: "t20x40", label: "20×40 (≈ 80 seated)" },
          { value: "t40x60", label: "40×60 (≈ 200 seated)" },
        ],
      },
      { id: "dance_floor", label: "Dance floor", type: "toggle", default: false },
    ],
    minimum: 250,
    spread: [0.95, 1.12],
    siteVisit: false,
    frequencies: ["once"],
    trades: ["rentals"],
    leadDays: 7,
    price: (a) => {
      const items: LineItem[] = [];
      if (n(a, "chairs")) items.push({ label: `${n(a, "chairs")} chairs`, amount: Math.round(n(a, "chairs") * 3.75) });
      if (n(a, "tables")) items.push({ label: `${n(a, "tables")} tables`, amount: n(a, "tables") * 14 });
      if (b(a, "linens") && n(a, "tables")) items.push({ label: "Tablecloths", amount: n(a, "tables") * 12 });
      const tent = { none: 0, t20x20: 495, t20x40: 895, t40x60: 2200 }[s(a, "tent", "none")] ?? 0;
      if (tent) items.push({ label: `Tent ${s(a, "tent", "none").slice(1)}`, amount: tent });
      if (b(a, "dance_floor")) items.push({ label: "Dance floor", amount: 550 });
      const rental = sum(items);
      items.push({ label: "Delivery, setup & pickup", amount: 175 + Math.round(rental * 0.12) });
      const base = sum(items);
      return { items, base, hours: Math.max(2, base / 250) };
    },
  },
  {
    slug: "event-venue",
    name: "Event Space Rental & Coordination",
    category: "events",
    icon: "🏛️",
    tagline: "We find, tour and book the right room for your guest count.",
    description: "Tell us the date, guests and vibe; we shortlist venues, arrange tours, negotiate and book the space, then coordinate it with your catering, music and rentals.",
    includes: ["Venue shortlist & tours", "Booking & contract handled", "Coordination with your vendors", "Day-of point of contact"],
    questions: [
      { id: "guests", label: "Guests", type: "number", min: 10, max: 1000, default: 60 },
      { id: "hours", label: "Rental length", type: "number", min: 2, max: 14, default: 5, unit: "hrs" },
      {
        id: "setting",
        label: "Setting",
        type: "select",
        default: "hall",
        options: [
          { value: "hall", label: "Banquet / event hall" },
          { value: "restaurant", label: "Restaurant private room" },
          { value: "outdoor", label: "Outdoor / garden / park pavilion" },
          { value: "loft", label: "Loft / rooftop" },
        ],
      },
    ],
    minimum: 800,
    spread: [0.8, 1.35],
    siteVisit: true,
    frequencies: ["once"],
    trades: ["venue"],
    leadDays: 14,
    price: (a) => {
      const g = n(a, "guests", 60), h = n(a, "hours", 5);
      const size = g <= 50 ? 1 : g <= 120 ? 1.8 : g <= 250 ? 3 : 5;
      const rate = { hall: 150, restaurant: 120, outdoor: 90, loft: 220 }[s(a, "setting", "hall")] ?? 150;
      const items: LineItem[] = [
        { label: `Venue — ${g} guests, ${h} hrs (estimate)`, amount: Math.round(rate * size * h) },
        { label: "Venue search, booking & coordination", amount: 395 },
      ];
      const base = sum(items);
      return { items, base, hours: 10 };
    },
  },
  // ───────────────────────────── FREIGHT (licensed carriers) ─────────────────────────────
  {
    slug: "freight-delivery",
    name: "Freight & Pallet Delivery",
    category: "removal",
    icon: "🏭",
    tagline: "Pallets and freight moved by a licensed carrier — cargo van, box truck with liftgate, or a full 53-ft truckload.",
    description: "Business freight picked up and delivered by a licensed, insured carrier with USDOT operating authority and cargo insurance: one or two pallets in a cargo van, up to 12 pallets in a 26-ft box truck with a liftgate, or a full 53-ft truckload. Dock to dock, curbside, or inside delivery. Signed bill of lading at pickup and photo proof of delivery at drop-off. Book once, or set up a weekly or monthly route. No hazardous materials.",
    includes: ["Licensed carrier with USDOT authority", "Commercial auto & cargo insurance", "Signed bill of lading at pickup", "Photo proof of delivery", "Live tracking link", "First hour of loading and unloading included"],
    notesHint: "Pickup and delivery addresses, dock or no dock at each end, hours each site receives freight, what's on the pallets, contact names and phones, and any appointment or reference numbers",
    questions: [
      {
        id: "vehicle",
        label: "Vehicle",
        type: "select",
        default: "box_truck",
        help: "If your load doesn't fit, we move it up to the next size.",
        options: [
          { value: "cargo_van", label: "Cargo van (up to 2 pallets / 3,000 lb)" },
          { value: "box_truck", label: "26-ft box truck with liftgate (up to 12 pallets / 10,000 lb)" },
          { value: "truckload", label: "53-ft dry van, full truckload (up to 26 pallets / 45,000 lb)" },
        ],
      },
      { id: "pallets", label: "Pallets", type: "number", min: 1, max: 26, default: 2, help: "Standard 48 × 40 in pallets. Loose boxes or crates: count the pallets they would fill." },
      { id: "weight", label: "Total weight", type: "number", min: 100, max: 45000, default: 1500, unit: "lb" },
      { id: "miles", label: "Miles from pickup to delivery", type: "number", min: 1, max: 1500, default: 25, unit: "mi" },
      { id: "stops", label: "Extra stops", type: "number", min: 0, max: 8, default: 0, help: "Pickups or drop-offs beyond the first pickup and the final delivery." },
      { id: "liftgate", label: "Liftgate needed (no loading dock)", type: "toggle", default: false },
      { id: "inside", label: "Inside delivery (past the front door or dock)", type: "toggle", default: false },
    ],
    minimum: 125,
    spread: [0.95, 1.15],
    siteVisit: false,
    licensed: true,
    frequencies: ["once", "weekly", "monthly"],
    trades: ["freight"],
    price: (a) => {
      const pallets = Math.max(1, n(a, "pallets", 2)), weight = Math.max(100, n(a, "weight", 1500));
      // the vehicle the customer picked, or the smallest one that carries the load
      const fleet: [string, string, number, number, number, number, number][] = [
        // id, label, max pallets, max lb, base, per mile, per extra stop
        ["cargo_van", "Cargo van", 2, 3000, 95, 2.25, 35],
        ["box_truck", "26-ft box truck", 12, 10000, 225, 3.5, 60],
        ["truckload", "53-ft truckload", 26, 45000, 600, 3, 125],
      ];
      const pick = Math.max(0, fleet.findIndex(([id]) => id === s(a, "vehicle", "box_truck")));
      const fit = fleet.findIndex(([, , p, lb], i) => i >= pick && pallets <= p && weight <= lb);
      const [id, label, , , base, perMile, perStop] = fleet[fit === -1 ? fleet.length - 1 : fit];
      const miles = Math.max(1, n(a, "miles", 25)), stops = Math.max(0, n(a, "stops", 0));
      const items: LineItem[] = [{ label: `${label}${fit > pick ? " (moved up to fit your load)" : ""} — pickup, loading & delivery`, amount: base }];
      items.push({ label: `Linehaul — ${miles} mi`, amount: Math.round(miles * perMile) });
      if (stops) items.push({ label: `Extra stops — ${stops}`, amount: stops * perStop });
      if (b(a, "liftgate") && id !== "box_truck") items.push({ label: "Liftgate service", amount: 75 });
      if (b(a, "inside")) items.push({ label: "Inside delivery", amount: 95 });
      const speed = id === "truckload" ? 45 : id === "box_truck" ? 35 : 40;
      return { items, base: sum(items), hours: Math.round((({ cargo_van: 1.5, box_truck: 2.5, truckload: 4 } as Record<string, number>)[id] + miles / speed + stops * 0.5) * 10) / 10 };
    },
  },

  // ───────────────────────── BUSINESS & TECHNOLOGY (remote) ─────────────────────────
  // Done remotely by Handled staff or vetted specialists: any US ZIP, no driving radius, a free video consultation sets
  // the firm price (siteVisit). onDemand: a consultation booked inside 48 hours is never a rush job.
  {
    slug: "website-design",
    insuranceOptional: true,
    name: "Intelligent Websites",
    category: "business",
    icon: "🌐",
    tagline: "A website that works for you — answers visitors, captures every lead and books appointments, 24/7.",
    description: "We build intelligent websites: fast, mobile-friendly and designed around your brand, with an AI assistant that answers visitors' questions, captures every lead and books appointments around the clock. Add instant follow-up so every inquiry gets a reply in seconds by text and email. Pick a starter site, a full business site or an online store. You own the site, the domain and every login. A free video consultation confirms the scope and the firm price before any work starts.",
    includes: ["Free video consultation", "Mobile-friendly custom design", "AI assistant that answers and books (option)", "Contact forms, maps & click-to-call", "Two rounds of revisions", "You own the site, domain and logins", "30 days of fixes after launch", "Optional care plan (hosting, updates, backups), quoted at the consultation"],
    notesHint: "Your business and who it serves, sites you like, the pages you need, your domain if you have one, and any deadline",
    questions: [
      {
        id: "package",
        label: "Website type",
        type: "select",
        default: "starter",
        options: [
          { value: "starter", label: "Starter site (up to 5 pages)" },
          { value: "business", label: "Business site (up to 15 pages, forms & online booking)" },
          { value: "store", label: "Online store (up to 50 products)" },
        ],
      },
      { id: "pages", label: "Pages", type: "number", min: 1, max: 60, default: 5, help: "Home, About, Services, Contact… Pages beyond the package are added to the price." },
      { id: "logo", label: "Logo & brand kit (colors, fonts, social images)", type: "toggle", default: false },
      { id: "copy", label: "We write the words (copywriting)", type: "toggle", default: false, help: "Priced per page. Or send us your text and photos." },
      { id: "seo", label: "Google setup: Business Profile, analytics and search basics", type: "toggle", default: true },
      { id: "spanish", label: "Spanish version of every page", type: "toggle", default: false },
      { id: "ai_assistant", label: "AI assistant on the site (answers questions, captures leads, books appointments)", type: "toggle", default: true },
      { id: "followup", label: "Instant lead follow-up (every inquiry gets a text and email reply in seconds)", type: "toggle", default: false },
    ],
    minimum: 1500,
    spread: [0.9, 1.25],
    siteVisit: true,
    remote: true,
    onDemand: true,
    frequencies: ["once"],
    trades: ["web_design"],
    price: (a) => {
      const pkg = s(a, "package", "starter");
      const [label, base, included, hrs] = ({ starter: ["Starter site", 1500, 5, 25], business: ["Business site", 3500, 15, 50], store: ["Online store", 5500, 10, 70] } as Record<string, [string, number, number, number]>)[pkg] ?? ["Starter site", 1500, 5, 25];
      const pages = Math.max(1, n(a, "pages", included));
      const items: LineItem[] = [{ label: `${label} — design, build & launch (${included} pages included)`, amount: base }];
      const extra = Math.max(0, pages - included);
      if (extra) items.push({ label: `Extra pages beyond the package — ${extra}`, amount: extra * 150 });
      if (b(a, "logo")) items.push({ label: "Logo & brand kit", amount: 450 });
      if (b(a, "copy")) items.push({ label: `Copywriting — ${pages} pages`, amount: pages * 75 });
      if (b(a, "seo")) items.push({ label: "Google Business Profile, analytics & search setup", amount: 350 });
      if (b(a, "spanish")) items.push({ label: `Spanish version — ${pages} pages`, amount: pages * 80 });
      if (b(a, "ai_assistant")) items.push({ label: "AI assistant — trained on your business, captures leads & books", amount: 1200 });
      if (b(a, "followup")) items.push({ label: "Instant lead follow-up by text & email", amount: 450 });
      return { items, base: sum(items), hours: hrs + extra * 2 + (b(a, "logo") ? 8 : 0) + (b(a, "copy") ? pages : 0) + (b(a, "ai_assistant") ? 10 : 0) + (b(a, "followup") ? 4 : 0) };
    },
  },
  {
    slug: "business-operating-system",
    insuranceOptional: true,
    name: "Business Operating System",
    category: "business",
    icon: "🧠",
    tagline: "One system that runs your business — customers, booking, scheduling, dispatch, invoicing and dashboards.",
    description: "We build a business operating system around how your company actually works: your customer list, online booking, scheduling and dispatch, job tracking, invoicing and payments, your team's to-dos and a live dashboard — in one place instead of ten apps and a spreadsheet. Add AI agents, accounting sync and a branded mobile app as you grow. It's the same kind of system Handled runs on. You own your data. A free video consultation maps your operation and sets the firm price.",
    includes: ["Free video consultation", "Built around how your business works", "Customers, booking, scheduling & invoicing in one place", "Live dashboard", "Training for your team", "You own your data", "60 days of support after launch", "Monthly hosting & support quoted at the consultation"],
    notesHint: "What your business does, how work comes in and gets done today, the apps and spreadsheets you use, how many people would use it, and what you'd most like to stop doing by hand",
    questions: [
      {
        id: "scope",
        label: "System",
        type: "select",
        default: "core",
        options: [
          { value: "core", label: "Core OS: customers, booking & scheduling, invoicing & payments, dashboard" },
          { value: "operations", label: "Operations OS: Core + dispatch, team & job tracking, customer and staff portals" },
          { value: "enterprise", label: "Enterprise OS: Operations + AI agents, accounting sync, custom workflows & reporting" },
        ],
      },
      { id: "users", label: "Team members who'll use it", type: "number", min: 1, max: 200, default: 5, help: "Core includes 5, Operations 15, Enterprise 40. More users add setup and training." },
      { id: "integrations", label: "Systems to connect", type: "number", min: 0, max: 15, default: 2, help: "Accounting, payments, email, phone, existing software… Two are included." },
      { id: "migrate", label: "Move your data in (customers, jobs, price lists)", type: "toggle", default: true },
      { id: "app", label: "Branded mobile app (iPhone & Android)", type: "toggle", default: false },
    ],
    minimum: 7500,
    spread: [0.9, 1.35],
    siteVisit: true,
    remote: true,
    onDemand: true,
    frequencies: ["once"],
    trades: ["web_design", "ai_automation"],
    price: (a) => {
      const scope = s(a, "scope", "core");
      const [label, base, included, hrs] = ({ core: ["Core OS", 7500, 5, 80], operations: ["Operations OS", 15000, 15, 160], enterprise: ["Enterprise OS", 30000, 40, 320] } as Record<string, [string, number, number, number]>)[scope] ?? ["Core OS", 7500, 5, 80];
      const items: LineItem[] = [{ label: `${label} — discovery, build, launch & team training`, amount: base }];
      const users = Math.max(1, n(a, "users", 5)), extraUsers = Math.max(0, users - included);
      if (extraUsers) items.push({ label: `Additional team members — ${extraUsers}`, amount: extraUsers * 50 });
      const extraInt = Math.max(0, n(a, "integrations", 2) - 2);
      if (extraInt) items.push({ label: `Additional integrations — ${extraInt}`, amount: extraInt * 750 });
      if (b(a, "migrate")) items.push({ label: "Data migration", amount: 1500 });
      if (b(a, "app")) items.push({ label: "Branded mobile app (iPhone & Android)", amount: 6000 });
      return { items, base: sum(items), hours: hrs + extraInt * 6 + (b(a, "migrate") ? 12 : 0) + (b(a, "app") ? 60 : 0) };
    },
  },
  {
    slug: "automated-business",
    insuranceOptional: true,
    name: "Automated Business",
    category: "business",
    icon: "🚀",
    tagline: "A business that runs itself — website, operating system, AI agents and automations, built end to end.",
    description: "We automate your business from end to end, the way Handled is run: an intelligent website that brings in and books customers, a business operating system for the work, AI agents that answer leads, handle customer service, schedule and follow up, and automations for the busywork in between — with a dashboard showing everything the AI did and a person whenever it matters. Launch a new business, automate the one you have, or scale across locations. A free video consultation maps what to automate first and sets the firm price.",
    includes: ["Free video consultation", "Automation plan for your business", "Intelligent website", "Business operating system", "AI agents that answer, book and follow up", "Automations for the busywork", "Dashboard of everything the AI did", "Monthly hosting, AI usage & support quoted at the consultation"],
    notesHint: "What the business does (or will do), how customers find and buy from you, who does what today, the tasks that eat the most time, and your goals for the next 12 months",
    questions: [
      {
        id: "stage",
        label: "Where you are",
        type: "select",
        default: "automate",
        options: [
          { value: "launch", label: "Launch: a new business, automated from day one" },
          { value: "automate", label: "Automate: an existing business — take the busywork off your team" },
          { value: "scale", label: "Scale: several locations or services on one automated system" },
        ],
      },
      { id: "agents", label: "AI agents (sales, customer service, scheduling, bookkeeping…)", type: "number", min: 1, max: 12, default: 2, help: "Launch includes 1, Automate 2, Scale 4." },
      { id: "formation", label: "Business formation included (LLC or corporation, EIN)", type: "toggle", default: true, showIf: { id: "stage", is: ["launch"] } },
      { id: "managed", label: "Managed launch: we run it with you for the first 90 days", type: "toggle", default: false },
    ],
    minimum: 12000,
    spread: [0.9, 1.35],
    siteVisit: true,
    remote: true,
    onDemand: true,
    frequencies: ["once"],
    trades: ["ai_automation", "web_design", "consulting"],
    price: (a) => {
      const stage = s(a, "stage", "automate");
      const [label, base, included, hrs] = ({ launch: ["Launch", 12000, 1, 140], automate: ["Automate", 22000, 2, 240], scale: ["Scale", 40000, 4, 420] } as Record<string, [string, number, number, number]>)[stage] ?? ["Automate", 22000, 2, 240];
      const items: LineItem[] = [{ label: `Automated business — ${label}: plan, website, operating system, AI agents & automations`, amount: base }];
      const extra = Math.max(0, n(a, "agents", included) - included);
      if (extra) items.push({ label: `Additional AI agents — ${extra}`, amount: extra * 2000 });
      if (stage === "launch" && b(a, "formation")) items.push({ label: "Business formation (LLC or corporation, EIN)", amount: 299 });
      if (b(a, "managed")) items.push({ label: "Managed launch — first 90 days", amount: 4500 });
      return { items, base: sum(items), hours: hrs + extra * 20 + (b(a, "managed") ? 60 : 0) };
    },
  },
  {
    slug: "business-formation",
    insuranceOptional: true,
    name: "Business Formation (LLC & Corporation)",
    category: "business",
    icon: "🏛️",
    tagline: "Start your LLC or corporation the right way — filed, with your EIN and paperwork done.",
    description: "We prepare and file your LLC, corporation or nonprofit with the state, get your EIN from the IRS, and hand you an operating agreement or bylaws template, a compliance calendar and a checklist for your business bank account. Add a registered agent, license and permit research, or an S-corp election. State filing fees are passed through at cost — never marked up. Handled is not a law firm and doesn't give legal or tax advice; for those questions we'll point you to an attorney or accountant.",
    includes: ["Free video consultation", "State filing prepared and submitted", "EIN from the IRS", "Operating agreement or bylaws template", "Compliance calendar (annual reports & deadlines)", "Business bank account checklist", "State fees at cost, never marked up"],
    notesHint: "Business name (and a backup), what the business does, owners' names and percentages, the business address, and whether you need it by a date",
    questions: [
      {
        id: "entity",
        label: "Business type",
        type: "select",
        default: "llc",
        options: [
          { value: "llc", label: "LLC (most small businesses)" },
          { value: "corp", label: "Corporation (C corp or S corp)" },
          { value: "nonprofit", label: "Nonprofit corporation (state filing)" },
        ],
      },
      {
        id: "state",
        label: "State of formation",
        type: "select",
        default: "MI",
        options: [
          { value: "MI", label: "Michigan" },
          { value: "WA", label: "Washington" },
          { value: "other", label: "Another state" },
        ],
      },
      { id: "owners", label: "Owners or members", type: "number", min: 1, max: 10, default: 1, help: "Each owner beyond 2 adds a small fee for the ownership terms in your agreement." },
      { id: "agent", label: "Registered agent service (first year)", type: "toggle", default: false, help: "A registered address for legal mail, so your home address stays off public records." },
      { id: "licenses", label: "Business license & permit research (city, county, state)", type: "toggle", default: false },
      { id: "scorp", label: "S-corp election filed with the IRS (Form 2553)", type: "toggle", default: false, showIf: { id: "entity", is: ["llc", "corp"] } },
    ],
    minimum: 299,
    spread: [1, 1.1],
    siteVisit: true,
    remote: true,
    onDemand: true,
    frequencies: ["once"],
    trades: ["business_formation"],
    price: (a) => {
      const entity = s(a, "entity", "llc");
      const state = s(a, "state", "MI");
      const [label, fee, doc] = ({ llc: ["LLC", 299, "operating agreement"], corp: ["Corporation", 449, "bylaws"], nonprofit: ["Nonprofit corporation", 499, "bylaws"] } as Record<string, [string, number, string]>)[entity] ?? ["LLC", 299, "operating agreement"];
      const items: LineItem[] = [{ label: `${label} formation — state filing, EIN & ${doc} template`, amount: fee }];
      const stateFee = ({ MI: { llc: 50, corp: 60, nonprofit: 20 }, WA: { llc: 200, corp: 200, nonprofit: 50 } } as Record<string, Record<string, number>>)[state]?.[entity];
      items.push({ label: stateFee ? `State filing fee (about $${stateFee}) — paid to the state at cost` : "State filing fee — set by your state, paid at cost", amount: 0 });
      const owners = Math.max(1, n(a, "owners", 1));
      if (owners > 2) items.push({ label: `Additional owners — ${owners - 2}`, amount: (owners - 2) * 50 });
      if (b(a, "agent")) items.push({ label: "Registered agent — first year", amount: 125 });
      if (b(a, "licenses")) items.push({ label: "Business license & permit research", amount: 150 });
      if (b(a, "scorp") && entity !== "nonprofit") items.push({ label: "S-corp election (IRS Form 2553)", amount: 150 });
      return { items, base: sum(items), hours: 4 + (b(a, "licenses") ? 2 : 0) + (owners > 2 ? 1 : 0) };
    },
  },
  {
    slug: "business-consulting",
    insuranceOptional: true,
    name: "Business Consulting",
    category: "business",
    icon: "📈",
    tagline: "Plans, pricing, marketing and bids — a consultant who helps you grow.",
    description: "Work with an experienced business consultant on what matters most right now: a strategy session with a written action plan, a startup plan with pricing and a launch checklist, a growth and operations plan, a 90-day marketing plan, or a bid or RFP proposal written for you. Packages have a fixed price, or book by the hour. A free video consultation confirms the scope and the firm price first.",
    includes: ["Free video consultation", "Experienced business consultant", "Written plan you keep", "Follow-up call after delivery", "Fixed-price packages or by the hour"],
    notesHint: "Your business, where it is today, what you want to fix or grow, any numbers you can share, and deadlines (bid due dates)",
    questions: [
      {
        id: "package",
        label: "What you need",
        type: "select",
        default: "session",
        options: [
          { value: "session", label: "Strategy session (2 hours + written action plan)" },
          { value: "startup", label: "Startup plan: business plan, pricing & launch checklist" },
          { value: "growth", label: "Growth & operations plan (4 weeks)" },
          { value: "marketing", label: "90-day marketing plan" },
          { value: "bid", label: "Bid / RFP proposal writing (per proposal)" },
          { value: "hourly", label: "By the hour" },
        ],
      },
      { id: "hours", label: "Hours", type: "number", min: 2, max: 80, default: 4, unit: "hrs", showIf: { id: "package", is: ["hourly"] }, help: "Billed by the hour (2-hour minimum) — the price updates as you change the hours." },
      { id: "financials", label: "3-year financial projections", type: "toggle", default: false, showIf: { id: "package", is: ["startup", "growth"] } },
    ],
    minimum: 300,
    spread: [0.95, 1.15],
    siteVisit: true,
    remote: true,
    onDemand: true,
    frequencies: ["once"],
    trades: ["consulting"],
    price: (a) => {
      const pkg = s(a, "package", "session");
      if (pkg === "hourly") {
        const h = Math.max(2, n(a, "hours", 4));
        const items: LineItem[] = [{ label: `Consulting — ${h} hrs`, amount: h * 150 }];
        return { items, base: sum(items), hours: h };
      }
      const [label, amount, hrs] = ({ session: ["Strategy session & written action plan", 350, 3], startup: ["Startup plan — business plan, pricing & launch checklist", 1500, 14], growth: ["Growth & operations plan (4 weeks)", 3000, 28], marketing: ["90-day marketing plan", 1800, 16], bid: ["Bid / RFP proposal writing", 2500, 22] } as Record<string, [string, number, number]>)[pkg] ?? ["Strategy session & written action plan", 350, 3];
      const items: LineItem[] = [{ label, amount }];
      if (b(a, "financials") && (pkg === "startup" || pkg === "growth")) items.push({ label: "3-year financial projections", amount: 600 });
      return { items, base: sum(items), hours: hrs + (b(a, "financials") ? 5 : 0) };
    },
  },
  {
    slug: "ai-automation",
    insuranceOptional: true,
    name: "AI Automation",
    category: "business",
    icon: "⚙️",
    tagline: "Put repetitive work on autopilot — lead follow-up, scheduling, invoicing and reports.",
    description: "We connect the apps you already use and let AI handle the busywork: new leads answered and logged in seconds, appointments booked, invoices and reminders sent, data entered, reports built every morning. Each workflow is built, tested with you and documented, with 30 days of fixes after launch. Start with a process audit to find where you're losing the most time. A free video consultation confirms the scope and the firm price first.",
    includes: ["Free video consultation", "Works with the apps you already use", "Tested with you before it goes live", "Written how-it-works guide", "30 days of fixes after launch", "Monthly support plans quoted at the consultation"],
    notesHint: "What you do by hand today, step by step, the apps involved (email, CRM, calendar, invoicing, spreadsheets), and how often it happens",
    questions: [
      { id: "workflows", label: "Workflows to automate", type: "number", min: 1, max: 20, default: 1, help: "One workflow = one job done end to end, e.g. new web lead → CRM → text back → booked on your calendar." },
      {
        id: "complexity",
        label: "How involved",
        type: "select",
        default: "standard",
        options: [
          { value: "simple", label: "Simple (1–2 apps, no AI decisions)" },
          { value: "standard", label: "Standard (3–4 apps, AI writes or sorts)" },
          { value: "advanced", label: "Advanced (5+ apps, custom logic or your data)" },
        ],
      },
      { id: "audit", label: "Process audit first (map your workflows and find the time savings)", type: "toggle", default: false },
      { id: "training", label: "Team training session (90 minutes, recorded)", type: "toggle", default: false },
    ],
    minimum: 675,
    spread: [0.9, 1.3],
    siteVisit: true,
    remote: true,
    onDemand: true,
    frequencies: ["once"],
    trades: ["ai_automation"],
    price: (a) => {
      const w = Math.max(1, n(a, "workflows", 1));
      const cx = s(a, "complexity", "standard");
      const [label, mult] = ({ simple: ["simple", 0.75], standard: ["standard", 1], advanced: ["advanced", 1.7] } as Record<string, [string, number]>)[cx] ?? ["standard", 1];
      const items: LineItem[] = [{ label: `First workflow (${label}) — build, test & launch`, amount: Math.round(900 * mult) }];
      if (w > 1) items.push({ label: `Additional workflows (${label}) — ${w - 1}`, amount: (w - 1) * Math.round(600 * mult) });
      if (b(a, "audit")) items.push({ label: "Process audit & automation roadmap", amount: 400 });
      if (b(a, "training")) items.push({ label: "Team training session (recorded)", amount: 250 });
      return { items, base: sum(items), hours: Math.round((6 + 4 * (w - 1)) * mult) + (b(a, "audit") ? 3 : 0) + (b(a, "training") ? 2 : 0) };
    },
  },
  {
    slug: "ai-agents",
    insuranceOptional: true,
    name: "Custom AI Agents",
    category: "business",
    icon: "🤖",
    tagline: "An AI assistant that answers customers, books appointments and works inside your tools — 24/7.",
    description: "We build an AI agent trained on your business: a chat assistant on your website that answers questions and captures leads, a customer service agent for email and chat, an AI receptionist that answers your phone and books appointments, or an operations agent that works inside your CRM, calendar and invoicing. It hands off to a person whenever it isn't sure, and every conversation is logged for you. Built, tested with you and tuned for 30 days after launch. A free video consultation confirms the scope and the firm price first.",
    includes: ["Free video consultation", "Trained on your business information", "Hands off to a person when it isn't sure", "Every conversation logged for you", "30 days of tuning after launch", "Monthly hosting & usage quoted at the consultation"],
    notesHint: "What the agent should handle, the questions customers ask most, the tools it should connect to (website, phone, CRM, calendar), and when it should hand off to a person",
    questions: [
      {
        id: "agent",
        label: "Agent type",
        type: "select",
        default: "chat",
        options: [
          { value: "chat", label: "Website chat assistant (answers questions, captures leads)" },
          { value: "service", label: "Customer service agent (email & chat, trained on your info)" },
          { value: "voice", label: "AI phone receptionist (answers calls, books appointments)" },
          { value: "ops", label: "Operations agent (works inside your CRM, calendar and invoicing)" },
        ],
      },
      { id: "integrations", label: "Systems to connect", type: "number", min: 0, max: 10, default: 1, help: "CRM, calendar, booking, email, payments… The first one is included; each additional one is added to the price." },
      { id: "bilingual", label: "English + Spanish", type: "toggle", default: false },
    ],
    minimum: 2500,
    spread: [0.9, 1.3],
    siteVisit: true,
    remote: true,
    onDemand: true,
    frequencies: ["once"],
    trades: ["ai_automation"],
    price: (a) => {
      const kind = s(a, "agent", "chat");
      const [label, amount, hrs] = ({ chat: ["Website chat assistant", 2500, 25], service: ["Customer service agent", 4500, 40], voice: ["AI phone receptionist", 6000, 50], ops: ["Operations agent", 8500, 70] } as Record<string, [string, number, number]>)[kind] ?? ["Website chat assistant", 2500, 25];
      const items: LineItem[] = [{ label: `${label} — build, train, test & launch`, amount }];
      const extra = Math.max(0, n(a, "integrations", 1) - 1);
      if (extra) items.push({ label: `Additional integrations — ${extra}`, amount: extra * 750 });
      if (b(a, "bilingual")) items.push({ label: "English + Spanish", amount: 600 });
      return { items, base: sum(items), hours: hrs + extra * 6 + (b(a, "bilingual") ? 6 : 0) };
    },
  },
];

export const SERVICE_BY_SLUG: Record<string, Service> = Object.fromEntries(SERVICES.map((sv) => [sv.slug, sv]));

export function getService(slug: string): Service | undefined {
  return SERVICE_BY_SLUG[slug];
}

export function defaultAnswers(service: Service): Answers {
  return Object.fromEntries(service.questions.map((q) => [q.id, q.default]));
}

export const TRADES: { id: string; label: string }[] = [
  { id: "cleaning", label: "House / office cleaning" },
  { id: "windows", label: "Window cleaning" },
  { id: "carpet", label: "Carpet & upholstery" },
  { id: "organizing", label: "Professional organizing" },
  { id: "gutters", label: "Gutters" },
  { id: "duct_cleaning", label: "Air duct & dryer vent cleaning" },
  { id: "chimney_sweep", label: "Chimney sweep" },
  { id: "laundry", label: "Wash & fold laundry" },
  { id: "lawn", label: "Lawn care & landscaping" },
  { id: "tree", label: "Tree service / arborist" },
  { id: "snow", label: "Snow plowing & removal" },
  { id: "irrigation", label: "Sprinkler & irrigation" },
  { id: "holiday_lights", label: "Holiday lighting" },
  { id: "pool", label: "Pool service" },
  { id: "pet_waste", label: "Pet waste removal" },
  { id: "pet_care", label: "Dog walking & pet sitting" },
  { id: "pressure_washing", label: "Power / pressure washing" },
  { id: "errands", label: "Errands, courier & personal assistant" },
  { id: "medical_courier", label: "Medical courier (prescriptions, specimens, supplies)" },
  { id: "auto_detailing", label: "Mobile car detailing" },
  { id: "hauling", label: "Junk hauling, moving & delivery" },
  { id: "wildlife", label: "Wildlife control & dead animal removal" },
  { id: "nuisance_wildlife", label: "Live wildlife removal (DNR permit)" },
  { id: "pest", label: "Pest control (licensed applicator)" },
  { id: "waste_oil", label: "Used oil transporter (licensed)" },
  { id: "dumpster", label: "Roll-off container / dumpster" },
  { id: "handyman", label: "Handyman" },
  { id: "assembly", label: "Furniture assembly & TV mounting" },
  { id: "appliance", label: "Appliance repair & install" },
  { id: "garage_door", label: "Garage doors & openers" },
  { id: "locksmith", label: "Locksmith" },
  { id: "inspection", label: "Home inspector" },
  { id: "water_damage", label: "Water damage restoration (certified)" },
  { id: "small_engine", label: "Small engine repair" },
  { id: "dock_door", label: "Commercial & dock door service" },
  { id: "fire_safety", label: "Fire extinguisher service (state-certified)" },
  { id: "foundation", label: "Foundation repair (licensed)" },
  { id: "roofing", label: "Roofing (licensed)" },
  { id: "masonry", label: "Masonry & brick (licensed)" },
  { id: "concrete", label: "Concrete & flatwork (licensed)" },
  { id: "demolition", label: "Demolition (licensed)" },
  { id: "fence_deck", label: "Fences & decks (licensed)" },
  { id: "siding", label: "Siding (licensed)" },
  { id: "gutter_install", label: "Gutter installation (licensed)" },
  { id: "windows_doors", label: "Windows & doors (licensed)" },
  { id: "insulation", label: "Insulation (licensed)" },
  { id: "flooring", label: "Flooring & tile (licensed)" },
  { id: "paving", label: "Asphalt sealcoating & paving" },
  { id: "mold", label: "Mold remediation (certified)" },
  { id: "remodel", label: "Remodeling / general contractor" },
  { id: "painting", label: "Painting (interior & exterior)" },
  { id: "plumbing", label: "Plumbing (licensed)" },
  { id: "electrical", label: "Electrical (licensed)" },
  { id: "hvac", label: "HVAC (licensed)" },
  { id: "low_voltage", label: "Cameras & low-voltage" },
  { id: "transportation", label: "Transportation operator (licensed)" },
  { id: "event_planner", label: "Event planning & coordination" },
  { id: "catering", label: "Catering (food-service license)" },
  { id: "food_truck", label: "Food truck (food-service license)" },
  { id: "dj_music", label: "DJ / live music" },
  { id: "rentals", label: "Party & event rentals" },
  { id: "venue", label: "Event venue / space" },
  { id: "security", label: "Security guard agency (licensed)" },
  { id: "recruiter", label: "Recruiter (Handled Talent)" },
  { id: "web_design", label: "Web design & development (remote)" },
  { id: "business_formation", label: "Business formation & filings (remote)" },
  { id: "consulting", label: "Business consulting (remote)" },
  { id: "ai_automation", label: "AI automation & AI agents (remote)" },
  { id: "freight", label: "Freight carrier (USDOT authority)" },
];
