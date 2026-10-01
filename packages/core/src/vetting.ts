/*
 * FILE    : packages/core/src/vetting.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2109 UTC
 * PURPOSE : What each trade does and specializes in, and what we require before a pro in
 *           that trade gets offers: license, insurance coverages and minimums, and the
 *           skills check. Drives the application form, onboarding checklist, Hub
 *           verification, dispatch (specialty match, probation) and the /pros page.
 *           Launch market is Michigan; license notes are for Michigan (LARA / MDARD).
 *           Confirm requirements with counsel and your insurance broker before each new state.
 */

export type CoverageKey = "gl" | "auto" | "workers_comp" | "bond" | "liquor";

export const COVERAGES: Record<CoverageKey, { label: string; detail: string }> = {
  gl: { label: "General liability", detail: "Per-occurrence limit shown for your trade, $2M aggregate. Handled LLC named as additional insured." },
  auto: { label: "Commercial auto", detail: "$1M combined single limit on the vehicle used for jobs. Personal auto policies usually exclude business use." },
  workers_comp: { label: "Workers' comp", detail: "Required if you have employees (Michigan law). Solo owners sign a no-employees statement instead." },
  bond: { label: "Fidelity / janitorial bond", detail: "$10,000+ dishonesty bond for unsupervised in-home access. Usually about $100–200 a year." },
  liquor: { label: "Liquor liability", detail: "$1M, required whenever alcohol is served. Alcohol service also needs the proper MLCC license." },
};

export interface TradeProfile {
  /** What the pro actually does — shown on the application and to customers. */
  does: string;
  /** Specialties a pro can claim. `slug` links a specialty to a bookable service (dispatch match). */
  specialties: { id: string; label: string; slug?: string }[];
  /** State license required to do the work at all. */
  license: string | null;
  /** Licenses or certifications we prefer (ranked higher, not required). */
  preferred: string[];
  /** General liability minimum per occurrence, USD. */
  glMin: number;
  /** Coverages required on top of general liability. */
  requires: CoverageKey[];
  /** Coverages required only in some cases (e.g. alcohol served). */
  conditional: { key: CoverageKey; when: string }[];
  /** How we check the work is good before the first offer. */
  skillsCheck: string;
}

const GL1 = 1_000_000;
const GL2 = 2_000_000;

export const TRADE_PROFILES: Record<string, TradeProfile> = {
  cleaning: {
    does: "Recurring, deep, move-in/out and office cleaning.",
    specialties: [
      { id: "standard_clean", label: "Standard / recurring cleaning", slug: "house-cleaning" },
      { id: "deep_clean", label: "Deep cleaning" },
      { id: "move_out", label: "Move-in / move-out" },
      { id: "post_construction", label: "Post-construction" },
      { id: "office_clean", label: "Office & commercial" },
      { id: "green_clean", label: "Eco / fragrance-free products" },
    ],
    license: null, preferred: [], glMin: GL1, requires: ["bond"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Photos of 3 recent jobs, 2 client references, cleaning-standards quiz.",
  },
  windows: {
    does: "Interior and exterior window, screen and track cleaning; storefronts.",
    specialties: [{ id: "residential_windows", label: "Residential", slug: "window-cleaning" }, { id: "storefront", label: "Storefront / commercial" }, { id: "high_reach", label: "Water-fed pole / 3+ stories" }],
    license: null, preferred: [], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Photos of recent jobs, ladder-safety attestation, 2 references.",
  },
  carpet: {
    does: "Hot-water extraction, upholstery and rug cleaning, stain and pet-odor treatment.",
    specialties: [{ id: "carpet_hwe", label: "Carpet (hot-water extraction)", slug: "carpet-cleaning" }, { id: "upholstery", label: "Upholstery" }, { id: "area_rugs", label: "Area rugs" }, { id: "pet_odor", label: "Pet stain & odor" }],
    license: null, preferred: ["IICRC certification"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Equipment list (truck-mount or portable), IICRC cert if held, before/after photos.",
  },
  organizing: {
    does: "Decluttering, room and closet systems, move and downsizing organizing.",
    specialties: [{ id: "declutter", label: "Decluttering", slug: "organizing" }, { id: "closets", label: "Closets & pantries" }, { id: "move_org", label: "Move / downsizing" }, { id: "hoarding", label: "Hoarding-sensitive clean-outs" }],
    license: null, preferred: ["NAPO membership"], glMin: GL1, requires: ["bond"], conditional: [],
    skillsCheck: "Portfolio of 3 before/after projects, 2 client references, video interview.",
  },
  gutters: {
    does: "Gutter and downspout cleaning, flushing, guards and minor repair.",
    specialties: [{ id: "gutter_clean", label: "Cleaning & flushing", slug: "gutter-cleaning" }, { id: "gutter_guards", label: "Gutter guards" }, { id: "gutter_repair", label: "Minor repair / re-hanging" }],
    license: null, preferred: [], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Ladder-safety attestation, photos of recent jobs, 2 references.",
  },
  lawn: {
    does: "Mowing, edging, cleanups, aeration, seeding and leaf removal.",
    specialties: [
      { id: "mowing", label: "Mowing & edging", slug: "lawn-care" },
      { id: "leaf", label: "Leaf removal & fall cleanup", slug: "leaf-removal" },
      { id: "aeration", label: "Aeration & overseeding" },
      { id: "treatment", label: "Fertilizer & weed control" },
      { id: "landscaping", label: "Mulch, beds & landscaping" },
    ],
    license: null, preferred: ["MDARD commercial applicator certification (required if you apply fertilizer or pesticides)"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }, { key: "auto", when: "you tow a trailer to jobs" }],
    skillsCheck: "Equipment list, photos of 3 maintained properties, 2 references.",
  },
  tree: {
    does: "Tree removal, trimming, stump grinding and storm cleanup.",
    specialties: [{ id: "removal", label: "Removal", slug: "tree-removal" }, { id: "trimming", label: "Trimming & pruning" }, { id: "stump", label: "Stump grinding" }, { id: "storm", label: "Storm / emergency" }, { id: "crane", label: "Crane & near-structure removals" }],
    license: null, preferred: ["ISA Certified Arborist", "TCIA membership"], glMin: GL2, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees (nearly every tree crew does)" }],
    skillsCheck: "Equipment list (bucket truck, chipper, climbing gear), photos of complex removals, 3 references, safety-program attestation.",
  },
  snow: {
    does: "Driveway and lot plowing, shoveling, salting and ice control.",
    specialties: [{ id: "residential_plow", label: "Residential driveways", slug: "snow-removal" }, { id: "commercial_plow", label: "Commercial lots" }, { id: "sidewalks", label: "Sidewalk shoveling & salting" }],
    license: null, preferred: [], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Truck and plow details, route capacity per storm, 2 references from last season.",
  },
  pressure_washing: {
    does: "Pressure and soft washing of driveways, siding, basements, decks, patios and fences; sealing.",
    specialties: [
      { id: "flatwork", label: "Driveways & concrete", slug: "power-washing" },
      { id: "soft_wash", label: "House soft wash" },
      { id: "basement_wash", label: "Basements & interiors" },
      { id: "deck_stain", label: "Deck & fence staining" },
      { id: "commercial_wash", label: "Commercial / storefronts" },
    ],
    license: null, preferred: ["PWNA or UAMCC training"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }, { key: "auto", when: "you run a trailer or skid unit" }],
    skillsCheck: "Equipment list (PSI/GPM, surface cleaner, soft-wash setup), wastewater practice, photos of 3 recent jobs, 2 references.",
  },
  errands: {
    does: "Errands, pickups and drop-offs, shopping, and a personal assistant by the hour.",
    specialties: [
      { id: "runs", label: "Errand runs & drop-offs", slug: "errands" },
      { id: "assistant", label: "Assistant for the day", slug: "personal-assistant" },
      { id: "senior_help", label: "Seniors & appointment runs" },
      { id: "move_help", label: "Packing & move prep" },
    ],
    license: null, preferred: ["Clean driving record"], glMin: GL1, requires: ["bond"],
    conditional: [{ key: "auto", when: "you drive for jobs — your auto policy must cover business or delivery use" }],
    skillsCheck: "Motor-vehicle record check, 2 references, video interview.",
  },
  pet_waste: {
    does: "Weekly yard scooping, deodorizing and disposal.",
    specialties: [{ id: "scoop", label: "Yard scooping", slug: "pet-waste-removal" }, { id: "deodorize", label: "Deodorizing / sanitizing" }],
    license: null, preferred: [], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Gate and pet-safety attestation, sanitation routine, 1 reference.",
  },
  pet_care: {
    does: "Dog walking, drop-in visits and overnight pet sitting.",
    specialties: [{ id: "walking", label: "Dog walking", slug: "dog-walking" }, { id: "sitting", label: "Pet sitting / overnights", slug: "dog-sitting" }, { id: "large_dogs", label: "Large & reactive dogs" }, { id: "medication", label: "Medication & senior pets" }],
    license: null, preferred: ["Pet first aid & CPR", "PSI or NAPPS certification"], glMin: GL1, requires: ["bond"], conditional: [],
    skillsCheck: "Pet first-aid certificate or quiz, 2 pet-owner references, video interview. Your liability policy must include care, custody & control of animals.",
  },
  hauling: {
    does: "Junk removal, clean-outs and large-item pickup with proper disposal.",
    specialties: [{ id: "junk", label: "Junk & clean-outs", slug: "junk-removal" }, { id: "large_item", label: "Large single items", slug: "large-item-removal" }, { id: "appliances", label: "Appliances" }, { id: "construction_debris", label: "Construction debris" }, { id: "estate", label: "Estate clean-outs" }],
    license: null, preferred: [], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Truck/trailer capacity, disposal and recycling sites used, photos of recent jobs, 2 references.",
  },
  handyman: {
    does: "Repairs, mounting, assembly, drywall, doors, fixtures and small projects.",
    specialties: [
      { id: "general_repair", label: "General repairs", slug: "handyman" },
      { id: "mounting", label: "TV & shelf mounting" },
      { id: "assembly", label: "Furniture assembly" },
      { id: "drywall", label: "Drywall & paint touch-up" },
      { id: "disposal", label: "Garbage disposals", slug: "garbage-disposal" },
      { id: "doors", label: "Doors, locks & hardware" },
    ],
    license: null, preferred: ["Michigan Maintenance & Alteration license (lets you take jobs over $600 that need one)"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Skills interview, photos of 5 recent repairs, 2 references. Plumbing, electrical and HVAC work goes only to licensed pros.",
  },
  remodel: {
    does: "Bathroom, kitchen and whole-home remodels with permits and subs.",
    specialties: [{ id: "bath", label: "Bathrooms", slug: "bathroom-remodel" }, { id: "kitchen", label: "Kitchens", slug: "kitchen-remodel" }, { id: "whole_home", label: "Whole-home / additions", slug: "home-remodel" }, { id: "basement", label: "Basements" }, { id: "flooring", label: "Flooring & tile" }],
    license: "Michigan Residential Builder or Maintenance & Alteration Contractor license (LARA), required for residential work over $600",
    preferred: ["EPA RRP lead-safe certification (required for pre-1978 homes)"], glMin: GL1, requires: ["workers_comp"], conditional: [],
    skillsCheck: "License lookup on LARA, portfolio of 3 completed remodels, 3 client references, permit history.",
  },
  plumbing: {
    does: "Leaks, drains, fixtures, water heaters and repipes.",
    specialties: [{ id: "repair", label: "Repairs & leaks", slug: "plumbing" }, { id: "water_heater", label: "Water heaters (tank & tankless)", slug: "water-heater" }, { id: "drains", label: "Drain cleaning" }, { id: "repipe", label: "Repipes & remodel rough-in" }],
    license: "Michigan plumbing contractor license (LARA), with work done by a licensed master or journeyman plumber",
    preferred: [], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "License lookup on LARA, permit history, 2 references.",
  },
  electrical: {
    does: "Lighting, fixtures, outlets, panels and circuits.",
    specialties: [{ id: "lighting", label: "Lighting & fixtures", slug: "lighting-install" }, { id: "outlets", label: "Outlets & switches" }, { id: "panels", label: "Panels & circuits" }, { id: "ev", label: "EV chargers" }],
    license: "Michigan electrical contractor license (LARA), with work done by a licensed master or journeyman electrician",
    preferred: [], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "License lookup on LARA, permit history, 2 references.",
  },
  hvac: {
    does: "Furnace, AC and heat-pump installs, replacements and service.",
    specialties: [{ id: "install", label: "System installs", slug: "hvac-install" }, { id: "service", label: "Repair & maintenance" }, { id: "heat_pump", label: "Heat pumps" }, { id: "ductwork", label: "Ductwork" }],
    license: "Michigan mechanical contractor license (LARA), plus EPA Section 608 certification for refrigerant",
    preferred: ["NATE certification"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "License and EPA 608 check, permit history, 2 references.",
  },
  low_voltage: {
    does: "Security cameras, doorbells, Wi-Fi, networking and AV.",
    specialties: [{ id: "cameras", label: "Cameras & doorbells", slug: "camera-install" }, { id: "networking", label: "Wi-Fi & networking" }, { id: "av", label: "TV & home theater" }, { id: "smart_home", label: "Smart-home setup" }],
    license: null, preferred: ["Michigan electrical or alarm specialty license (needed for some alarm and line-voltage work)"], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Photos of recent installs, brands supported, 2 references. Any line-voltage work goes to a licensed electrician.",
  },
  event_planner: {
    does: "Event planning, vendor coordination and day-of management.",
    specialties: [{ id: "full_plan", label: "Full-service planning", slug: "event-planning" }, { id: "budget_plan", label: "Plan by budget", slug: "event-package" }, { id: "corporate", label: "Corporate events" }, { id: "weddings", label: "Weddings" }, { id: "kids", label: "Kids' parties" }],
    license: null, preferred: [], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Portfolio of 5 events, 3 client references, budget walkthrough interview.",
  },
  catering: {
    does: "Event catering: drop-off, buffet and full-service.",
    specialties: [{ id: "buffet", label: "Buffet & drop-off", slug: "catering" }, { id: "plated", label: "Plated / full-service" }, { id: "bar", label: "Bar service" }, { id: "dietary", label: "Halal, kosher, vegan & allergy-safe" }],
    license: "Food-service license from your county health department, with a certified food protection manager (e.g. ServSafe)",
    preferred: [], glMin: GL1, requires: [], conditional: [{ key: "liquor", when: "alcohol is served" }, { key: "auto", when: "you deliver" }],
    skillsCheck: "Health inspection report, tasting or menu review, 3 event references.",
  },
  food_truck: {
    does: "Food trucks and trailers for private and corporate events.",
    specialties: [{ id: "truck", label: "Food truck", slug: "food-truck" }, { id: "dessert", label: "Desserts & coffee" }, { id: "corporate_lunch", label: "Corporate lunches" }],
    license: "Mobile food establishment license (MDARD / county health department), with a certified food protection manager",
    preferred: [], glMin: GL1, requires: ["auto"], conditional: [{ key: "liquor", when: "alcohol is served" }],
    skillsCheck: "Mobile food license and latest inspection, photos of the truck, 2 event references.",
  },
  dj_music: {
    does: "DJs, MCs and live music with sound and lighting.",
    specialties: [{ id: "dj", label: "DJ / MC", slug: "dj-music" }, { id: "live_band", label: "Live band / musicians" }, { id: "lighting_av", label: "Event lighting & AV" }],
    license: null, preferred: [], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Demo mix or video, equipment list, 3 event references.",
  },
  rentals: {
    does: "Tables, chairs, tents, linens, staging and inflatables, delivered and set up.",
    specialties: [{ id: "tables_chairs", label: "Tables & chairs", slug: "event-rentals" }, { id: "tents", label: "Tents" }, { id: "inflatables", label: "Inflatables" }, { id: "linens", label: "Linens & décor" }],
    license: null, preferred: [], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Inventory list, photos of setups, tent permit experience, 2 references.",
  },
  venue: {
    does: "Event spaces for parties, meetings and celebrations.",
    specialties: [{ id: "venue_small", label: "Under 100 guests", slug: "event-venue" }, { id: "venue_large", label: "100+ guests" }, { id: "outdoor", label: "Outdoor / garden" }],
    license: null, preferred: [], glMin: GL2, requires: [], conditional: [{ key: "liquor", when: "alcohol is served" }],
    skillsCheck: "Certificate of occupancy with capacity, walkthrough photos or video, 3 event references.",
  },
};

/** A coverage entry counts when its expiry date hasn't passed ("exempt" only where the trade allows it). */
export function coverageValid(coverage: Record<string, string> | null | undefined, key: CoverageKey, today = new Date(), allowExempt = false): boolean {
  const v = coverage?.[key];
  if (!v) return false;
  if (v === "exempt") return allowExempt && key === "workers_comp";
  return new Date(`${v}T23:59:59`).getTime() >= today.getTime();
}

const profile = (trade: string): TradeProfile | undefined => TRADE_PROFILES[trade];

/** Coverages (beyond general liability) a pro must have verified for these trades. */
export function requiredCoverages(trades: string[]): CoverageKey[] {
  return [...new Set(trades.flatMap((t) => profile(t)?.requires ?? []))];
}

/** The highest general-liability minimum across the pro's trades. */
export function glMinimum(trades: string[]): number {
  return Math.max(GL1, ...trades.map((t) => profile(t)?.glMin ?? GL1));
}

/** Specialties a pro can choose from, across their trades. */
export function specialtiesFor(trades: string[]) {
  return trades.flatMap((t) => profile(t)?.specialties ?? []);
}

/** True when the pro claims a specialty that is exactly this service. */
export function specialtyMatch(specialties: string[] | null | undefined, slug: string): boolean {
  if (!specialties?.length) return false;
  return Object.values(TRADE_PROFILES).some((p) => p.specialties.some((s) => s.slug === slug && specialties.includes(s.id)));
}

/** Probation: a new pro's first jobs are capped in size and always get a human QA review. */
export const PROBATION = { jobs: 3, maxJobPrice: 750 };

/** The vetting pipeline, in order. Shown to applicants and used as the Hub checklist. */
export const VETTING_STEPS = [
  { t: "Apply (5 minutes)", b: "Trades, specialties, service area, crew, equipment, insurance and two references." },
  { t: "AI screen + quick call", b: "Our AI checks the application for fit and gaps; a coordinator calls within 2 business days." },
  { t: "Skills check", b: "A trade-specific check: photos of recent work, references, and for licensed trades a lookup on the state license database." },
  { t: "Documents", b: "W-9, contractor agreement, certificate of insurance naming Handled as additional insured, license and any trade-specific coverage. We verify each policy with the carrier." },
  { t: "Background check", b: "Criminal and sex-offender search through our screening provider. Driving trades also get a motor-vehicle record check. Re-run every year." },
  { t: "Probation jobs", b: `Your first ${PROBATION.jobs} jobs are under $${PROBATION.maxJobPrice}, and each one gets a human photo review and a follow-up call to the customer.` },
  { t: "Activated", b: "Full offers in your area and specialties. Insurance and licenses are tracked, and offers pause automatically if one lapses." },
];
