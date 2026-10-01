/*
 * FILE    : packages/core/src/services.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : The service catalog. Each service declares the questions the booking flow
 *           asks, a deterministic price model (the "floor" the AI quote refines), the
 *           share of the price paid to the subcontractor, and whether a site visit is
 *           required before a firm quote. Prices are launch defaults for a mid-cost US
 *           metro — tune them per market in the ops hub (services table overrides).
 */

import type { CategoryId, Frequency } from "./types.ts";
import { planEventBudget } from "./event-budget.ts";

export type Answers = Record<string, number | string | boolean | undefined>;

export type Question =
  | { id: string; label: string; type: "number"; min: number; max: number; default: number; unit?: string; help?: string }
  | { id: string; label: string; type: "select"; options: { value: string; label: string }[]; default: string; help?: string }
  | { id: string; label: string; type: "toggle"; default: boolean; help?: string };

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
  /** Work that legally needs a licensed tradesperson — dispatch only to pros with a license on file. */
  licensed?: boolean;
  price: (a: Answers) => PriceResult;
}

export const CATEGORIES: { id: CategoryId; name: string; blurb: string }[] = [
  { id: "cleaning", name: "Cleaning & Organizing", blurb: "Homes, offices, windows, carpets, gutters — plus decluttering." },
  { id: "outdoor", name: "Lawn & Outdoor", blurb: "Mowing, trees and pet waste — on a schedule." },
  { id: "removal", name: "Haul Away", blurb: "Junk, furniture and big items gone today." },
  { id: "repair_remodel", name: "Repairs, Installs & Remodels", blurb: "Handyman, plumbing, electrical, HVAC, water heaters — up to full remodels." },
  { id: "events", name: "Parties & Events", blurb: "Planning, catering, food trucks, DJs, rentals and venues — one invoice." },
];

const n = (a: Answers, k: string, d = 0) => (typeof a[k] === "number" ? (a[k] as number) : Number(a[k] ?? d) || d);
const s = (a: Answers, k: string, d = "") => (a[k] === undefined ? d : String(a[k]));
const b = (a: Answers, k: string) => a[k] === true || a[k] === "true";
const sum = (items: LineItem[]) => items.reduce((t, i) => t + i.amount, 0);

const EVENT_TYPES = [
  { value: "birthday", label: "Birthday / party" },
  { value: "wedding", label: "Wedding / shower" },
  { value: "corporate", label: "Corporate / office" },
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
      if (beds > 2) items.push({ label: `${beds - 2} extra bedroom${beds > 3 ? "s" : ""}/office${beds > 3 ? "s" : ""}`, amount: (beds - 2) * 10 });
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
      const items: LineItem[] = csq > 0
        ? [{ label: `${csq.toLocaleString("en-US")} sq ft of carpet`, amount: Math.max(129, Math.round(csq * 0.28)) }]
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
    slug: "pet-waste-removal",
    name: "Dog Poop Removal",
    category: "outdoor",
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
    tagline: "Priced by truck volume. Donated & recycled first.",
    description: "Full-service junk hauling from homes, garages, offices and job sites. You point, we lift, load and sweep.",
    includes: ["2-person crew", "All lifting & loading", "Donation & recycling first", "Area swept clean"],
    questions: [
      {
        id: "volume",
        label: "How much stuff",
        type: "select",
        default: "quarter",
        options: [
          { value: "min", label: "A few items (minimum)" },
          { value: "eighth", label: "⅛ truck (pickup bed)" },
          { value: "quarter", label: "¼ truck" },
          { value: "half", label: "½ truck" },
          { value: "three_quarter", label: "¾ truck" },
          { value: "full", label: "Full truck" },
        ],
      },
      { id: "stairs", label: "Items upstairs / basement", type: "toggle", default: false },
      { id: "heavy", label: "Heavy debris (concrete, dirt, roofing)", type: "toggle", default: false },
    ],
    minimum: 129,
    spread: [0.9, 1.15],
    payoutShare: 0.65,
    siteVisit: false,
    frequencies: ["once"],
    trades: ["hauling"],
    price: (a) => {
      const vol = s(a, "volume", "quarter");
      const price = { min: 129, eighth: 189, quarter: 259, half: 409, three_quarter: 539, full: 669 }[vol] ?? 259;
      const items: LineItem[] = [{ label: "Truck volume", amount: price }];
      if (b(a, "stairs")) items.push({ label: "Stairs / basement carry", amount: 50 });
      if (b(a, "heavy")) items.push({ label: "Heavy debris surcharge", amount: Math.round(price * 0.25) });
      const base = sum(items);
      return { items, base, hours: Math.max(1, base / 220) };
    },
  },
  {
    slug: "large-item-removal",
    name: "Large Item Removal",
    category: "removal",
    icon: "🛋️",
    tagline: "Couches, mattresses, appliances, hot tubs, pianos.",
    description: "Single and multi-item pickups for bulky furniture and appliances, including specialty items that need extra hands.",
    includes: ["2-person crew", "Disassembly if needed", "Doorframes & floors protected", "Responsible disposal"],
    questions: [
      { id: "items", label: "Standard bulky items", type: "number", min: 0, max: 20, default: 1, help: "Couch, mattress, fridge, dresser…" },
      { id: "specialty", label: "Specialty items", type: "number", min: 0, max: 5, default: 0, help: "Piano, hot tub, safe, pool table" },
      { id: "stairs", label: "Stairs involved", type: "toggle", default: false },
    ],
    minimum: 99,
    spread: [0.95, 1.15],
    payoutShare: 0.65,
    siteVisit: false,
    frequencies: ["once"],
    trades: ["hauling"],
    price: (a) => {
      const items: LineItem[] = [];
      const std = n(a, "items", 1);
      if (std) items.push({ label: `${std} bulky item${std > 1 ? "s" : ""}`, amount: 99 + Math.max(0, std - 1) * 49 });
      const spec = n(a, "specialty");
      if (spec) items.push({ label: `${spec} specialty item${spec > 1 ? "s" : ""}`, amount: spec * 325 });
      if (b(a, "stairs")) items.push({ label: "Stair carry", amount: 40 + std * 10 + spec * 75 });
      const base = sum(items);
      return { items, base, hours: Math.max(1, std * 0.3 + spec) };
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
      { id: "zones", label: "Mini-split zones (if ductless)", type: "number", min: 1, max: 6, default: 1 },
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
    price: (a) => {
      const perSqft = { refresh: 45, mid: 110, full: 200 }[s(a, "scope", "mid")] ?? 110;
      const sq = n(a, "sqft", 1200);
      const items: LineItem[] = [{ label: `${sq} sq ft (${s(a, "scope", "mid")})`, amount: perSqft * sq }];
      const base = sum(items);
      return { items, base, hours: base / 95 };
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
      const per = { apps: 22, buffet: 32, family: 40, plated: 52 }[s(a, "style", "buffet")] ?? 32;
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
  { id: "pet_waste", label: "Pet waste removal" },
  { id: "hauling", label: "Junk & item hauling" },
  { id: "handyman", label: "Handyman" },
  { id: "remodel", label: "Remodeling / general contractor" },
  { id: "plumbing", label: "Plumbing (licensed)" },
  { id: "electrical", label: "Electrical (licensed)" },
  { id: "hvac", label: "HVAC (licensed)" },
  { id: "low_voltage", label: "Cameras & low-voltage" },
  { id: "event_planner", label: "Event planning & coordination" },
  { id: "catering", label: "Catering (food-service license)" },
  { id: "food_truck", label: "Food truck (food-service license)" },
  { id: "dj_music", label: "DJ / live music" },
  { id: "rentals", label: "Party & event rentals" },
  { id: "venue", label: "Event venue / space" },
];
