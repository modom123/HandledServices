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
 */

import type { CategoryId, Frequency } from "./types.ts";
import { planEventBudget } from "./event-budget.ts";

export type Answers = Record<string, number | string | boolean | undefined>;

/** Show a question only when another answer is one of these values. */
export type ShowIf = { id: string; is: (string | boolean)[] };

export type Question =
  | { id: string; label: string; type: "number"; min: number; max: number; default: number; unit?: string; help?: string; showIf?: ShowIf }
  | { id: string; label: string; type: "select"; options: { value: string; label: string }[]; default: string; help?: string; showIf?: ShowIf }
  | { id: string; label: string; type: "toggle"; default: boolean; help?: string; showIf?: ShowIf };

/** Should this question be shown for these answers? */
export function questionVisible(q: Question, answers: Answers, all: Question[] = []): boolean {
  if (!q.showIf) return true;
  const dep = all.find((x) => x.id === q.showIf!.id);
  const v = answers[q.showIf.id] ?? dep?.default;
  return q.showIf.is.includes(v as string | boolean);
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
  /** Share of the final price paid to the subcontractor (0–1). */
  payoutShare: number;
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
  price: (a: Answers) => PriceResult;
}

export const CATEGORIES: { id: CategoryId; name: string; icon: string; blurb: string }[] = [
  { id: "cleaning", name: "Cleaning & Organizing", icon: "🧽", blurb: "Homes, offices, windows, carpets, gutters, power washing — plus decluttering." },
  { id: "outdoor", name: "Lawn, Leaves & Snow", icon: "🌳", blurb: "Mowing, leaf cleanup, snow removal and trees." },
  { id: "pets", name: "Pet Care", icon: "🐾", blurb: "Dog walking, dog sitting and yard poop pickup by background-checked pros." },
  { id: "removal", name: "Haul Away", icon: "🚛", blurb: "Junk, furniture and heavy items gone today — or a container dropped off for the week." },
  { id: "repair_remodel", name: "Repairs, Painting & Remodels", icon: "🔧", blurb: "Handyman, plumbing, electrical, HVAC, water heaters, interior & exterior painting — up to full remodels." },
  { id: "errands", name: "Errands & Assistant", icon: "🛍️", blurb: "Dry cleaning, shopping, returns and drop-offs, or an assistant for the day." },
  { id: "transport", name: "Transportation", icon: "🚘", blurb: "Private drivers, black cars, airport rides, limos, party buses, tour buses and event shuttles — licensed operators only." },
  { id: "events", name: "Parties & Events", icon: "🎉", blurb: "Planning, catering, food trucks, DJs, rentals and venues — one invoice." },
];

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
    payoutShare: 0.65,
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly", "monthly"],
    trades: ["cleaning"],
    price: (a) => {
      // Square footage drives the price: $0.12/sq ft up to 2,000 sq ft, $0.09/sq ft beyond.
      const sqft = n(a, "sqft", 1800);
      const area = Math.round(Math.min(sqft, 2000) * 0.12 + Math.max(0, sqft - 2000) * 0.09);
      const baths = n(a, "bathrooms", 2);
      const beds = n(a, "bedrooms", 3);
      const items: LineItem[] = [{ label: `${sqft.toLocaleString("en-US")} sq ft`, amount: area }];
      if (baths > 1) items.push({ label: `${baths - 1} extra bathroom${baths > 2 ? "s" : ""}`, amount: (baths - 1) * 20 });
      // Two bedrooms are in the base; each one more adds, each one fewer (studio / 1-bed) takes off.
      if (beds > 2) items.push({ label: `${beds - 2} extra bedroom${beds > 3 ? "s" : ""}/office${beds > 3 ? "s" : ""}`, amount: (beds - 2) * 10 });
      if (beds < 2) items.push({ label: beds === 0 ? "Studio" : "1 bedroom", amount: (beds - 2) * 10 });
      const subtotal = sum(items);
      const level = s(a, "level", "standard");
      if (level === "deep") items.push({ label: "Deep clean", amount: Math.round(subtotal * 0.5) });
      if (level === "move") items.push({ label: "Move-in/out clean", amount: Math.round(subtotal * 0.8) });
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
    payoutShare: 0.65,
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
    payoutShare: 0.65,
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
    payoutShare: 0.65,
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
    payoutShare: 0.65,
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
    payoutShare: 0.7,
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
    slug: "lawn-care",
    name: "Lawn Care",
    category: "outdoor",
    icon: "🌱",
    tagline: "Mow, edge, blow — on autopilot.",
    description: "Weekly or biweekly mowing plus seasonal leaf cleanup, aeration and fertilization for homes and commercial lots.",
    includes: ["Mow & edge", "Trim around beds", "Blow walks & drives", "Clippings handled"],
    questions: [
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
    minimum: 45,
    spread: [0.95, 1.1],
    payoutShare: 0.7,
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["lawn"],
    price: (a) => {
      const mow = { small: 45, quarter: 60, half: 85, acre: 125 }[s(a, "lot", "quarter")] ?? 60;
      const mult = mow / 60;
      const items: LineItem[] = [{ label: "Mow, edge & blow", amount: mow }];
      if (b(a, "leaves")) items.push({ label: "Leaf cleanup", amount: Math.round(160 * mult) });
      if (b(a, "aeration")) items.push({ label: "Core aeration", amount: Math.round(120 * mult) });
      if (b(a, "fertilize")) items.push({ label: "Fertilization", amount: Math.round(70 * mult) });
      const base = sum(items);
      return { items, base, hours: Math.max(0.75, base / 70) };
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
    payoutShare: 0.75,
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
    payoutShare: 0.7,
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
    minimum: 45,
    spread: [1, 1.1],
    payoutShare: 0.7,
    siteVisit: false,
    frequencies: ["once"],
    trades: ["snow", "lawn"],
    price: (a) => {
      const per = { one_car: 45, two_car: 65, large: 95, lot_small: 175, lot_large: 375 }[s(a, "area", "two_car")] ?? 65;
      const lot = s(a, "area", "two_car").startsWith("lot");
      const items: LineItem[] = [{ label: "Plow / snow-blow", amount: per }];
      if (b(a, "walks")) items.push({ label: "Sidewalks & walks", amount: lot ? 45 : 20 });
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
    payoutShare: 0.7,
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
    payoutShare: 0.7,
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
    payoutShare: 0.7,
    siteVisit: false,
    frequencies: ["once", "weekly", "biweekly"],
    trades: ["pet_waste"],
    price: (a) => {
      const dogs = n(a, "dogs", 1);
      const yard = { small: 1, medium: 1.2, large: 1.6 }[s(a, "yard", "medium")] ?? 1.2;
      const items: LineItem[] = [{ label: `Visit — ${dogs} dog${dogs > 1 ? "s" : ""}`, amount: Math.round((18 + (dogs - 1) * 5) * yard) }];
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
    payoutShare: 0.65,
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
    payoutShare: 0.65,
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
    payoutShare: 0.75,
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
    payoutShare: 0.7,
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
    payoutShare: 0.7,
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
    name: "Water Heater Replacement",
    category: "repair_remodel",
    icon: "🔥",
    tagline: "New tank or tankless, installed and hauled away.",
    description: "Water heater replacement with the unit, permit, code-required parts and haul-away of the old tank. Gas or electric, tank or tankless.",
    includes: ["New unit included", "Licensed plumber", "Permit pulled where required", "Old tank hauled away", "Manufacturer + 1-year labor warranty"],
    questions: [
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
      { id: "expansion", label: "Add expansion tank", type: "toggle", default: false },
      { id: "tight", label: "Tight closet / attic install", type: "toggle", default: false },
    ],
    minimum: 1400,
    spread: [0.95, 1.15],
    payoutShare: 0.75,
    siteVisit: false,
    frequencies: ["once"],
    trades: ["plumbing"],
    licensed: true,
    price: (a) => {
      const unit = { tank40: 1550, tank50: 1750, tank75: 2600, tankless: 3900 }[s(a, "type", "tank50")] ?? 1750;
      const gas = s(a, "fuel", "gas") === "gas";
      const items: LineItem[] = [{ label: `${s(a, "type", "tank50")} ${gas ? "gas" : "electric"} — unit + install`, amount: gas ? unit + 150 : unit }];
      items.push({ label: "Permit & code parts", amount: 125 });
      if (b(a, "expansion")) items.push({ label: "Expansion tank", amount: 175 });
      if (b(a, "tight")) items.push({ label: "Difficult access", amount: 250 });
      const base = sum(items);
      return { items, base, hours: s(a, "type", "tank50") === "tankless" ? 7 : 4 };
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
    payoutShare: 0.8,
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
    payoutShare: 0.7,
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
    payoutShare: 0.7,
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
    payoutShare: 0.7,
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
      { id: "size", label: "Typical room size", type: "select", default: "medium", options: [{ value: "small", label: "Small (bath, closet, under 100 sq ft)" }, { value: "medium", label: "Medium (bedroom, 100–200 sq ft)" }, { value: "large", label: "Large (living room, open plan, 200+ sq ft)" }] },
      { id: "ceilings", label: "Paint ceilings too", type: "toggle", default: false },
      { id: "trim", label: "Trim, baseboards & doors", type: "toggle", default: false },
      { id: "color_change", label: "Big color change (dark to light, or bold colors)", type: "toggle", default: false },
      { id: "repairs", label: "Drywall repairs beyond nail holes (cracks, dents, patches)", type: "toggle", default: false },
      { id: "high", label: "Ceilings over 10 ft / stairwell walls", type: "toggle", default: false },
    ],
    minimum: 349,
    spread: [0.95, 1.15],
    payoutShare: 0.7,
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
    payoutShare: 0.7,
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
    payoutShare: 0.85,
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
    payoutShare: 0.85,
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
    payoutShare: 0.85,
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
    name: "Errands & Pickups",
    category: "errands",
    icon: "🛍️",
    tagline: "Dry cleaning, groceries, returns and drop-offs — done.",
    description: "A background-checked runner picks up dry cleaning and prescriptions, does the shopping, makes returns and drops things off, with photo proof at every stop. Store purchases are billed at cost with the receipt.",
    includes: ["Background-checked, bonded runner", "Photo at every stop", "Purchases at cost with receipt", "Up to 20 miles included"],
    questions: [
      { id: "stops", label: "Number of stops", type: "number", min: 1, max: 12, default: 3 },
      { id: "shopping", label: "Includes shopping (groceries, store pickup)", type: "toggle", default: false },
      { id: "bulky", label: "Bulky or heavy items (needs an SUV/truck)", type: "toggle", default: false },
    ],
    minimum: 39,
    spread: [1, 1],
    payoutShare: 0.75,
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
    slug: "personal-assistant",
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
    payoutShare: 0.75,
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
    payoutShare: 0.8,
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
    payoutShare: 0.8,
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
    payoutShare: 0.8,
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
    payoutShare: 0.8,
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
    payoutShare: 0.8,
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
    payoutShare: 0.8,
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
    ],
    minimum: 1000,
    spread: [1, 1],
    payoutShare: 0.82,
    siteVisit: true,
    frequencies: ["once"],
    trades: ["event_planner"],
    leadDays: 14,
    price: (a) => {
      const plan = planEventBudget({ budget: n(a, "budget", 5000), guests: n(a, "guests", 50), eventType: s(a, "event_type", "birthday"), haveVenue: s(a, "venue", "need") === "have" });
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
    payoutShare: 0.75,
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
    payoutShare: 0.8,
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
    payoutShare: 0.8,
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
    payoutShare: 0.8,
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
    payoutShare: 0.75,
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
    payoutShare: 0.85,
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
  { id: "lawn", label: "Lawn care" },
  { id: "tree", label: "Tree service / arborist" },
  { id: "snow", label: "Snow plowing & removal" },
  { id: "pet_waste", label: "Pet waste removal" },
  { id: "pet_care", label: "Dog walking & pet sitting" },
  { id: "pressure_washing", label: "Power / pressure washing" },
  { id: "errands", label: "Errands & personal assistant" },
  { id: "hauling", label: "Junk & item hauling" },
  { id: "dumpster", label: "Roll-off container / dumpster" },
  { id: "handyman", label: "Handyman" },
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
];
