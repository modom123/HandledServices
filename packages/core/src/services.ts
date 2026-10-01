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
  price: (a: Answers) => PriceResult;
}

export const CATEGORIES: { id: CategoryId; name: string; blurb: string }[] = [
  { id: "cleaning", name: "Cleaning", blurb: "Homes, offices, windows, carpets and gutters." },
  { id: "outdoor", name: "Lawn & Outdoor", blurb: "Mowing, trees and pet waste — on a schedule." },
  { id: "removal", name: "Haul Away", blurb: "Junk, furniture and big items gone today." },
  { id: "repair_remodel", name: "Repair & Remodel", blurb: "Handyman fixes to full kitchen and bath remodels." },
];

const n = (a: Answers, k: string, d = 0) => (typeof a[k] === "number" ? (a[k] as number) : Number(a[k] ?? d) || d);
const s = (a: Answers, k: string, d = "") => (a[k] === undefined ? d : String(a[k]));
const b = (a: Answers, k: string) => a[k] === true || a[k] === "true";
const sum = (items: LineItem[]) => items.reduce((t, i) => t + i.amount, 0);

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
      { id: "sqft", label: "Approx. square feet", type: "number", min: 400, max: 10000, default: 1800, unit: "sq ft" },
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
      const items: LineItem[] = [
        { label: "Base clean", amount: 95 },
        { label: `${n(a, "bedrooms", 3)} bedrooms`, amount: 22 * n(a, "bedrooms", 3) },
        { label: `${n(a, "bathrooms", 2)} bathrooms`, amount: 28 * n(a, "bathrooms", 2) },
      ];
      const sqft = n(a, "sqft", 1800);
      if (sqft > 2000) items.push({ label: "Large home", amount: Math.round((sqft - 2000) * 0.04) });
      const subtotal = sum(items);
      const level = s(a, "level", "standard");
      if (level === "deep") items.push({ label: "Deep clean", amount: Math.round(subtotal * 0.5) });
      if (level === "move") items.push({ label: "Move-in/out clean", amount: Math.round(subtotal * 0.8) });
      if (b(a, "pets")) items.push({ label: "Pet hair", amount: 20 });
      if (b(a, "fridge_oven")) items.push({ label: "Fridge & oven interior", amount: 60 });
      const base = sum(items);
      return { items, base, hours: Math.max(2, base / 45) };
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
      const items: LineItem[] = [{ label: `${rooms} rooms`, amount: rooms * 49 }];
      if (n(a, "stairs")) items.push({ label: `${n(a, "stairs")} staircases`, amount: n(a, "stairs") * 45 });
      if (n(a, "sofa_seats")) items.push({ label: `${n(a, "sofa_seats")} upholstery seats`, amount: n(a, "sofa_seats") * 30 });
      if (b(a, "pet")) items.push({ label: "Pet treatment", amount: rooms * 20 });
      const base = sum(items);
      return { items, base, hours: Math.max(1.5, rooms * 0.5 + n(a, "stairs") * 0.5) };
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
  { id: "gutters", label: "Gutters" },
  { id: "lawn", label: "Lawn care" },
  { id: "tree", label: "Tree service / arborist" },
  { id: "pet_waste", label: "Pet waste removal" },
  { id: "hauling", label: "Junk & item hauling" },
  { id: "handyman", label: "Handyman" },
  { id: "remodel", label: "Remodeling / general contractor" },
];
