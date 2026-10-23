/*
 * FILE    : packages/core/src/vetting.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2109 UTC
 * UPDATED : 2026-10-02_0251 UTC — transportation specialty: sporting events & concerts.
 * UPDATED : 2026-10-03_0117 UTC — additional insured uses the legal name (BRAND.legalName).
 * PURPOSE : What each trade does and specializes in, and what we require before a pro in
 *           that trade gets offers: license, insurance coverages and minimums, and the
 *           skills check. Drives the application form, onboarding checklist, Hub
 *           verification, dispatch (specialty match, probation) and the /pros page.
 *           Launch market is Michigan; license notes are for Michigan (LARA / MDARD).
 *           Confirm requirements with counsel and your insurance broker before each new state.
 * UPDATED : 2026-10-04_1934 UTC — vetting step names the photo ID check.
 * UPDATED : 2026-10-04_1950 UTC — grocery delivery replaced by Same-Day Courier.
 * UPDATED : 2026-10-05_0438 UTC — security trade (licensed agency, $2M GL, workers' comp).
 * UPDATED : 2026-10-05_1433 UTC — security trade: patrol, standing posts and fire watch (security-guard).
 * UPDATED : 2026-10-06_0526 UTC — wildlife trade: dead animal removal (dead-animal-removal).
 * UPDATED : 2026-10-06_0637 UTC — new trades: small engine, dock & door, fire extinguisher (state license), foundation (builder license), used oil (EPA ID, EGLE registration).
 * UPDATED : 2026-10-07_0310 UTC — cleaners: no license, no bond for residential work; a janitorial bond only for large commercial
 *           cleaning jobs ($1,500+) — TradeProfile.commercial, checked at dispatch.
 * UPDATED : 2026-10-11_0608 UTC — trade profiles for the remote specialists: web design, business formation, consulting, AI automation.
 * UPDATED : 2026-10-11_1405 UTC — freight trade (licensed motor carriers) and the cargo coverage (motor truck cargo, $100K per load).
 * UPDATED : 2026-10-12_0117 UTC — mold trade (certified remediation; no state license in MI or WA).
 * UPDATED : 2026-10-23_1900 UTC — lawn trade covers landscaping (more specialties: edging, shrubs, planting, sod, cleanups);
 *           new trades: furniture assembly, roofing, masonry, concrete, demolition (Michigan M&A or builder license).
 * UPDATED : 2026-10-23_2100 UTC — 20 trades for services 76–100: fences & decks, siding, gutter install, windows & doors, insulation,
 *           flooring (M&A licensed), pest (MDARD), live wildlife (DNR permit), paving, appliance, garage door, locksmith,
 *           inspection, water damage, duct cleaning, chimney sweep, irrigation, holiday lights, pool, laundry.
 */
import { BRAND } from "./brand.ts";

export type CoverageKey = "gl" | "auto" | "workers_comp" | "bond" | "liquor" | "passenger_auto" | "cargo";

/** Coverage kinds a pro uploads beyond general liability (documents, onboarding, applications). */
export const COVERAGE_KINDS = ["auto", "workers_comp", "bond", "liquor", "passenger_auto", "cargo"] as const;

export const COVERAGES: Record<CoverageKey, { label: string; detail: string }> = {
  gl: { label: "General liability", detail: `Per-occurrence limit shown for your trade, $2M aggregate. ${BRAND.legalName} named as additional insured.` },
  auto: { label: "Commercial auto", detail: "$1M combined single limit on the vehicle used for jobs. Personal auto policies usually exclude business use." },
  workers_comp: { label: "Workers' comp", detail: "Required if you have employees (Michigan law). Solo owners sign a no-employees statement instead." },
  bond: { label: "Fidelity / janitorial bond", detail: "$10,000+ dishonesty bond for unsupervised in-home access. Usually about $100–200 a year." },
  passenger_auto: { label: "Passenger carrier auto liability", detail: "$1.5M combined single limit for vehicles seating up to 15 passengers, $5M for 16 or more (federal minimums for interstate passenger carriers; venues and corporate clients expect it for local trips too). Every vehicle and driver listed." },
  liquor: { label: "Liquor liability", detail: "$1M, required whenever alcohol is served. Alcohol service also needs the proper MLCC license." },
  cargo: { label: "Motor truck cargo", detail: "$100,000 per load minimum for the freight you carry (refrigerated freight needs a reefer-breakdown endorsement). Handled named as certificate holder." },
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
  /** Extra requirements only for large commercial jobs (e.g. a janitorial bond for big office contracts). */
  commercial?: { requires: CoverageKey[]; minPrice: number; note: string };
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
    // residential cleaners need no license and no bond (owner rule 2026-10-07); big commercial jobs need a janitorial bond
    license: null, preferred: [], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }, { key: "bond", when: "you take large commercial cleaning jobs ($1,500+)" }],
    commercial: { requires: ["bond"], minPrice: 1500, note: "Large commercial cleaning jobs ($1,500+, offices and janitorial contracts) need a janitorial / fidelity bond; some buildings also ask for your business registration." },
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
    does: "Mowing, edging and trimming, landscaping and bed care (mulch, edging, shrubs, planting, sod), cleanups, aeration, seeding and leaf removal.",
    specialties: [
      { id: "mowing", label: "Mowing & edging", slug: "lawn-care" },
      { id: "string_trim", label: "String trimming & blowing" },
      { id: "landscaping", label: "Mulch, beds & landscaping", slug: "landscaping" },
      { id: "bed_edging", label: "Bed edging (spade-cut or installed)" },
      { id: "shrubs", label: "Shrub & hedge trimming" },
      { id: "planting", label: "Planting shrubs & perennials" },
      { id: "sod", label: "Sod & seeding" },
      { id: "cleanups", label: "Spring & fall cleanups" },
      { id: "leaf", label: "Leaf removal & fall cleanup", slug: "leaf-removal" },
      { id: "aeration", label: "Aeration & overseeding" },
      { id: "treatment", label: "Fertilizer & weed control" },
      { id: "commercial_grounds", label: "Commercial grounds & HOAs" },
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
    does: "Errands, same-day courier runs, pickups and drop-offs, and a personal assistant by the hour.",
    specialties: [
      { id: "runs", label: "Errand runs & drop-offs", slug: "errands" },
      { id: "assistant", label: "Assistant for the day", slug: "personal-assistant" },
      { id: "courier", label: "Same-day courier & business routes", slug: "courier" },
      { id: "senior_help", label: "Seniors & appointment runs" },
      { id: "move_help", label: "Packing & move prep" },
    ],
    license: null, preferred: ["Clean driving record"], glMin: GL1, requires: ["bond"],
    conditional: [{ key: "auto", when: "you drive for jobs — your auto policy must cover business or delivery use" }],
    skillsCheck: "Motor-vehicle record check, 2 references, video interview.",
  },
  medical_courier: {
    does: "Medical deliveries: prescription pickups for patients, medical supplies and equipment, lab specimens and records for clinics, pharmacies and labs.",
    specialties: [
      { id: "rx", label: "Prescription delivery", slug: "medical-delivery" },
      { id: "specimens", label: "Lab specimens (UN3373)" },
      { id: "dme", label: "Medical equipment (DME)" },
      { id: "cold_chain", label: "Cold chain / temperature-controlled" },
      { id: "stat", label: "STAT & after-hours runs" },
    ],
    license: "HIPAA training certificate (enter its number and expiry date); couriers who carry lab specimens also need OSHA bloodborne-pathogens training",
    preferred: ["OSHA bloodborne-pathogens training for specimen runs", "DOT hazmat awareness for UN3373 Category B specimens", "Insulated / validated cold-chain containers"],
    glMin: GL1, requires: ["auto", "bond"],
    conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Motor-vehicle record check, HIPAA and (for specimens) bloodborne-pathogen certificates, chain-of-custody walkthrough, 2 references (pharmacy, clinic or courier).",
  },
  auto_detailing: {
    does: "Mobile car detailing at the customer's home or workplace: hand wash and wax, interiors, full details, paint correction and ceramic coating.",
    specialties: [
      { id: "full_detail", label: "Full details", slug: "mobile-car-detailing" },
      { id: "ceramic", label: "Ceramic coating & paint correction" },
      { id: "fleet", label: "Fleets & dealership lots" },
      { id: "interior", label: "Interior shampoo & odor" },
    ],
    license: null,
    preferred: ["Garagekeepers / care-custody-control coverage for customer vehicles", "Self-contained water tank and generator", "Ceramic coating manufacturer certification", "Water-runoff practices that meet local rules"],
    glMin: GL1, requires: [],
    conditional: [{ key: "workers_comp", when: "you have employees" }, { key: "auto", when: "you drive a work van or trailer to jobs" }],
    skillsCheck: "Photos of 5 recent details (before/after), equipment and product list, 2 references.",
  },
  dumpster: {
    does: "Roll-off container delivery, swap and pickup for clean-outs, moves and remodels; landfill disposal.",
    specialties: [
      { id: "residential_roll_off", label: "Residential roll-offs", slug: "junk-container" },
      { id: "construction_roll_off", label: "Construction & roofing" },
      { id: "heavy_debris", label: "Concrete, brick & dirt" },
    ],
    license: null, preferred: ["Municipal hauler registration where your city requires it"], glMin: GL1, requires: ["auto"],
    conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Truck and container inventory by size, landfill / transfer-station accounts, sample weigh tickets, 2 references.",
  },
  transportation: {
    does: "Chauffeured transportation by licensed operators: private drivers and black cars, airport transfers, game day and concert rides, limousines, party buses, tour and charter buses, corporate and event shuttles.",
    specialties: [
      { id: "black_car", label: "Black car / executive", slug: "private-driver" },
      { id: "airport", label: "Airport transfers", slug: "airport-transfer" },
      { id: "limo", label: "Limousines", slug: "limousine" },
      { id: "party_bus", label: "Party buses", slug: "party-bus" },
      { id: "coach", label: "Tour & charter coaches", slug: "charter-bus" },
      { id: "shuttle", label: "Corporate & event shuttles", slug: "event-shuttle" },
      { id: "game_day", label: "Sporting events & concerts", slug: "game-day-rides" },
      { id: "weddings_transport", label: "Weddings & proms" },
    ],
    license: "Michigan passenger-for-hire / limousine carrier authority (MDOT), plus a USDOT number and FMCSA operating authority for interstate trips or vehicles seating 16+. Operator companies only — no individual drivers in personal cars",
    preferred: ["Drivers with a clean motor-vehicle record; CDL with passenger endorsement and DOT drug & alcohol testing for 16+ passenger vehicles", "Vehicle list with seats, year and current inspections", "NLA or UMA membership"],
    glMin: GL1, requires: ["passenger_auto"],
    conditional: [{ key: "workers_comp", when: "you have employee drivers (most operators do)" }],
    skillsCheck: "Authority lookups (MDOT; FMCSA/USDOT where required), fleet list and inspection records, driver roster with motor-vehicle records, safety rating, 3 corporate or event references.",
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
  waste_oil: {
    does: "Pickup of used motor and hydraulic oil, used oil filters and antifreeze from shops, fleets and businesses, delivered to a permitted recycler.",
    specialties: [{ id: "used_oil", label: "Used oil pickup", slug: "waste-oil-collection" }, { id: "filters", label: "Used oil filters" }, { id: "antifreeze", label: "Antifreeze" }],
    license: "EPA identification number as a used-oil transporter, Michigan EGLE registration to haul liquid industrial by-products, and the DOT requirements for the truck",
    preferred: ["Spill kit and response plan on every truck"], glMin: GL2, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "EPA ID and EGLE registration lookup, where the oil is taken, sample shipping papers, pollution liability coverage, 2 references.",
  },
  wildlife: {
    does: "Dead animal removal from yards, under decks, crawlspaces, attics and walls, with sanitizing, odor treatment and same-day disposal at an approved site.",
    specialties: [{ id: "dead_animal", label: "Dead animal removal", slug: "dead-animal-removal" }, { id: "crawl_attic", label: "Crawlspaces, attics & walls" }, { id: "odor", label: "Sanitizing & odor treatment" }, { id: "large_animal", label: "Deer & large animals" }],
    license: null,
    preferred: ["Michigan DNR nuisance animal control permit (needed for live trapping, which Handled doesn't book)", "NWCOA membership or wildlife control certification"],
    glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Protective gear and bagging routine (gloves, respirator, sealed double bags), where carcasses are disposed of, crawlspace and attic experience, 2 references.",
  },
  small_engine: {
    does: "Tune-ups and repairs for mowers, riding mowers, snow blowers, generators and handheld power equipment, mobile or with pickup.",
    specialties: [{ id: "mowers", label: "Lawn mowers & tractors", slug: "small-engine-repair" }, { id: "snowblowers", label: "Snow blowers" }, { id: "generators", label: "Generators" }, { id: "handheld", label: "Chainsaws, trimmers & blowers" }],
    license: null, preferred: ["Manufacturer service training (Briggs & Stratton, Honda, Kohler, Toro or similar)"], glMin: GL1, requires: [], conditional: [{ key: "auto", when: "you pick up and return equipment" }, { key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Tools and diagnostic gear, photos of recent repairs, how parts are sourced, 2 references.",
  },
  dock_door: {
    does: "Inspection, preventive maintenance and repair of commercial overhead, rolling steel and high-speed doors, dock levelers, seals and restraints.",
    specialties: [{ id: "overhead", label: "Sectional overhead doors", slug: "dock-door-service" }, { id: "rolling", label: "Rolling steel & high-speed doors" }, { id: "levelers", label: "Dock levelers & restraints" }, { id: "springs", label: "Springs & cables" }],
    license: null, preferred: ["IDEA door dealer or DASMA training", "Manufacturer certification (Rite-Hite, Overhead Door, Wayne Dalton or similar)"], glMin: GL2, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Spring and cable safety procedure, lift or ladder safety, sample inspection report, 3 commercial references.",
  },
  fire_safety: {
    does: "Annual fire extinguisher inspections and tagging, recharges, hydrostatic tests and new extinguisher sales and mounting.",
    specialties: [{ id: "extinguishers", label: "Fire extinguisher inspection", slug: "fire-extinguisher-inspection" }, { id: "hydro", label: "Hydrostatic testing" }, { id: "kitchen", label: "Kitchen (K-class) extinguishers" }],
    license: "Michigan Bureau of Fire Services fire extinguisher firm license, with each technician certified by the state",
    preferred: ["NAFED certification"], glMin: GL2, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "State license and technician certification lookup, sample tag and report, NFPA 10 procedure, 2 commercial references.",
  },
  foundation: {
    does: "Foundation crack injection, wall bracing, piers for settling, and interior drain tile and sumps for wet basements.",
    specialties: [{ id: "cracks", label: "Crack injection", slug: "foundation-repair" }, { id: "bracing", label: "Wall bracing & anchors" }, { id: "piers", label: "Piers & underpinning" }, { id: "waterproofing", label: "Interior drain tile & sumps" }],
    license: "Michigan residential builder license (LARA); local permits for structural work",
    preferred: ["Manufacturer-certified installer for the pier or bracing system used"], glMin: GL2, requires: ["auto", "workers_comp"], conditional: [],
    skillsCheck: "LARA license lookup, a sample written estimate and warranty, photos of recent jobs, 3 homeowner references.",
  },
  roofing: {
    does: "Roof leak and storm repairs, shingle and flashing work, inspections, and full tear-off and replacement (asphalt shingles and flat-roof membranes).",
    specialties: [{ id: "roof_repair", label: "Leak & shingle repair", slug: "roofing" }, { id: "reroof", label: "Tear-off & replacement" }, { id: "flat_roof", label: "Flat roofs (EPDM, modified bitumen)" }, { id: "flashing", label: "Chimney & skylight flashing" }, { id: "roof_storm", label: "Storm & insurance claims" }],
    license: "Michigan Residential Builder or Maintenance & Alteration Contractor license with the roofing trade (LARA), required for residential work over $600; local permits for reroofs",
    preferred: ["Shingle manufacturer certification (GAF, Owens Corning, CertainTeed)", "OSHA fall-protection training"], glMin: GL2, requires: ["auto", "workers_comp"], conditional: [],
    skillsCheck: "LARA license lookup, fall-protection plan, a sample written estimate and warranty, photos of 3 recent roofs, 3 homeowner references.",
  },
  masonry: {
    does: "Tuckpointing, brick and block repair, chimney crowns and rebuilds, brick steps and retaining walls.",
    specialties: [{ id: "tuckpointing", label: "Tuckpointing & brick repair", slug: "masonry" }, { id: "chimney", label: "Chimney crowns & rebuilds" }, { id: "retaining", label: "Block retaining & garden walls" }, { id: "brick_steps", label: "Brick steps & porches" }, { id: "stone", label: "Stone & veneer" }],
    license: "Michigan Maintenance & Alteration Contractor license with the masonry trade, or a Residential Builder license (LARA), required for residential work over $600",
    preferred: ["Scaffold or lift experience for 2-story work"], glMin: GL1, requires: ["workers_comp"], conditional: [{ key: "auto", when: "you haul a trailer or mixer to jobs" }],
    skillsCheck: "LARA license lookup, photos of 3 recent repairs showing the mortar and brick match, 2 references.",
  },
  concrete: {
    does: "Concrete steps, patios, sidewalks and driveway sections: resurfacing, break-out and new pours, slab lifting and crack sealing.",
    specialties: [{ id: "steps", label: "Steps & stoops", slug: "concrete-repair" }, { id: "concrete_flat", label: "Patios, walks & driveways" }, { id: "slab_lift", label: "Slab lifting (mudjacking / foam)" }, { id: "stamped", label: "Stamped & decorative" }, { id: "crack_seal", label: "Crack repair & sealing" }],
    license: "Michigan Maintenance & Alteration Contractor license with the concrete trade, or a Residential Builder license (LARA), required for residential work over $600; city permits for sidewalks and drive approaches",
    preferred: ["ACI flatwork finisher certification"], glMin: GL1, requires: ["auto", "workers_comp"], conditional: [],
    skillsCheck: "LARA license lookup, photos of 3 recent pours (forms and finish), 2 references.",
  },
  demolition: {
    does: "Interior tear-outs, sheds, decks, porches, above-ground pools, slabs and detached garages, with haul-away.",
    specialties: [{ id: "interior_demo", label: "Interior tear-outs", slug: "demolition" }, { id: "structures", label: "Sheds, decks & garages" }, { id: "pools", label: "Above-ground pools" }, { id: "slab_breakout", label: "Concrete break-out" }],
    license: "Michigan Maintenance & Alteration Contractor license with the wrecking trade, or a Residential Builder license (LARA); local demolition permits, utility disconnects and asbestos survey where required",
    preferred: ["Asbestos awareness training", "Own dump trailer or roll-off account"], glMin: GL2, requires: ["auto", "workers_comp"], conditional: [],
    skillsCheck: "LARA license lookup, equipment list (skid steer, dump trailer), disposal receipts from a recent job, 2 references.",
  },
  fence_deck: {
    does: "Fences and decks: new builds with footings and permits, and repairs to posts, boards, railings and stairs.",
    specialties: [{ id: "fence_new", label: "Fence installation", slug: "fence-install" }, { id: "fence_repair", label: "Fence repair" }, { id: "deck_new", label: "Deck building", slug: "deck-build" }, { id: "deck_repair", label: "Deck & railing repair" }, { id: "composite", label: "Composite decking" }],
    license: "Michigan Maintenance & Alteration Contractor license with the carpentry trade, or a Residential Builder license (LARA), required for residential work over $600",
    preferred: ["Trex or TimberTech certified installer"], glMin: GL1, requires: ["workers_comp"], conditional: [{ key: "auto", when: "you haul materials or a trailer to jobs" }],
    skillsCheck: "LARA license lookup, photos of 3 recent fences or decks, a sample permit, 2 references.",
  },
  siding: {
    does: "Vinyl and fiber cement siding repair and replacement, soffit, fascia and trim.",
    specialties: [{ id: "siding_repair", label: "Siding repair", slug: "siding" }, { id: "reside", label: "Full re-siding" }, { id: "fiber_cement", label: "Fiber cement (Hardie)" }, { id: "soffit_fascia", label: "Soffit, fascia & trim wrap" }],
    license: "Michigan Maintenance & Alteration Contractor license with the siding trade, or a Residential Builder license (LARA), required for residential work over $600",
    preferred: ["James Hardie or manufacturer certification", "EPA RRP lead-safe certification (pre-1978 homes)"], glMin: GL1, requires: ["workers_comp"], conditional: [{ key: "auto", when: "you haul materials or a trailer to jobs" }],
    skillsCheck: "LARA license lookup, photos of 3 recent jobs, 2 references.",
  },
  gutter_install: {
    does: "Seamless gutter installation, downspouts and gutter guards.",
    specialties: [{ id: "seamless", label: "Seamless gutters", slug: "gutter-install" }, { id: "guards_install", label: "Gutter guard installation" }, { id: "downspouts", label: "Downspouts & drainage" }],
    license: "Michigan Maintenance & Alteration Contractor license with the gutters trade, or a Residential Builder license (LARA), required for residential work over $600",
    preferred: ["Own seamless gutter machine"], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "LARA license lookup, photos of 3 recent installs, 2 references.",
  },
  windows_doors: {
    does: "Replacement windows, entry doors, storm doors and patio doors, installed and trimmed.",
    specialties: [{ id: "windows_replace", label: "Replacement windows", slug: "window-door-install" }, { id: "entry_doors", label: "Entry doors" }, { id: "storm_doors", label: "Storm doors" }, { id: "patio_doors", label: "Patio doors" }],
    license: "Michigan Maintenance & Alteration Contractor license with the carpentry or screen & storm sash trade, or a Residential Builder license (LARA), required for residential work over $600",
    preferred: ["EPA RRP lead-safe certification (required for pre-1978 homes)", "Manufacturer-certified installer (Pella, Andersen, ProVia or similar)"], glMin: GL1, requires: ["workers_comp"], conditional: [{ key: "auto", when: "you haul materials or a trailer to jobs" }],
    skillsCheck: "LARA license lookup, EPA RRP certificate, photos of 3 recent installs, 2 references.",
  },
  insulation: {
    does: "Blown-in attic insulation, air sealing and dense-pack wall insulation.",
    specialties: [{ id: "attic_blown", label: "Blown-in attic insulation", slug: "insulation" }, { id: "air_sealing", label: "Air sealing" }, { id: "walls_dense", label: "Dense-pack walls" }, { id: "spray_foam", label: "Spray foam" }, { id: "insulation_removal", label: "Insulation removal" }],
    license: "Michigan Maintenance & Alteration Contractor license with the insulation trade, or a Residential Builder license (LARA), required for residential work over $600",
    preferred: ["BPI Building Analyst or Envelope certification", "Utility rebate program contractor (DTE, Consumers Energy)"], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "LARA license lookup, equipment list (blowing machine), photos of 3 recent attics with depth markers, 2 references.",
  },
  flooring: {
    does: "Luxury vinyl plank, laminate, hardwood, carpet and floor tile installation, with removal and subfloor prep.",
    specialties: [{ id: "lvp", label: "Luxury vinyl plank & laminate", slug: "flooring" }, { id: "hardwood_install", label: "Hardwood (install & refinish)" }, { id: "carpet_install", label: "Carpet installation" }, { id: "floor_tile", label: "Floor tile" }, { id: "floor_stairs", label: "Stairs" }],
    license: "Michigan Maintenance & Alteration Contractor license with the carpentry or tile & marble trade, or a Residential Builder license (LARA), required for residential work over $600",
    preferred: ["CFI or NWFA certification"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }, { key: "auto", when: "you haul materials or a trailer to jobs" }],
    skillsCheck: "LARA license lookup (for jobs over $600), photos of 3 recent floors, 2 references.",
  },
  paving: {
    does: "Asphalt driveway and lot sealcoating, crack filling, patching and line striping.",
    specialties: [{ id: "sealcoat", label: "Sealcoating", slug: "driveway-sealcoating" }, { id: "crack_fill", label: "Hot crack filling" }, { id: "asphalt_patch", label: "Patching & potholes" }, { id: "striping", label: "Line striping" }],
    license: null,
    preferred: [], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Equipment list (sealer rig, crack-fill kettle), photos of 3 recent jobs, 2 references.",
  },
  appliance: {
    does: "Diagnosis and repair of washers, dryers, refrigerators, dishwashers, ranges and microwaves; hook-up of new appliances.",
    specialties: [{ id: "laundry_appl", label: "Washers & dryers", slug: "appliance-repair" }, { id: "refrigeration", label: "Refrigerators & freezers" }, { id: "dishwasher_repair", label: "Dishwashers" }, { id: "cooking", label: "Ovens, ranges & cooktops" }, { id: "appliance_install", label: "New appliance hook-up" }],
    license: null,
    preferred: ["EPA Section 608 certification (required to open a sealed refrigeration system)", "Factory-authorized for major brands"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }, { key: "auto", when: "you drive a company vehicle to jobs" }],
    skillsCheck: "EPA 608 card if you do refrigeration, brands you service, 2 references.",
  },
  garage_door: {
    does: "Home garage doors: springs, cables, off-track doors, openers and new door installs.",
    specialties: [{ id: "gd_springs", label: "Springs & cables", slug: "garage-door" }, { id: "openers", label: "Openers" }, { id: "door_install", label: "New garage doors" }],
    license: null,
    preferred: ["IDEA door dealer or DASMA training"], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Photos of recent installs, spring-safety attestation, 2 references.",
  },
  locksmith: {
    does: "Home and car lockouts, rekeying, lock installs and smart locks.",
    specialties: [{ id: "lockouts", label: "Home & car lockouts", slug: "locksmith" }, { id: "rekeying", label: "Rekeying" }, { id: "lock_install", label: "Lock & deadbolt installs" }, { id: "smart_locks", label: "Smart locks" }],
    license: null,
    preferred: ["ALOA membership or certification"], glMin: GL1, requires: ["auto"], conditional: [],
    skillsCheck: "Background check, ID-verification procedure for lockouts, 2 references. Michigan has no state locksmith license.",
  },
  inspection: {
    does: "Visual home inspections with photo reports for buyers, sellers, landlords and insurers; radon and sewer scopes.",
    specialties: [{ id: "home_inspection", label: "Home inspections", slug: "property-inspection" }, { id: "multi_unit", label: "2–4 unit buildings" }, { id: "radon", label: "Radon testing" }, { id: "sewer_scope", label: "Sewer scopes" }, { id: "municipal", label: "Municipal & lender condition surveys" }],
    license: null,
    preferred: ["InterNACHI or ASHI certification", "Michigan has no home inspector license; errors & omissions insurance preferred"], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Certification card, 2 sample reports, 3 references (agents or clients).",
  },
  water_damage: {
    does: "Water extraction, removal of wet materials, drying with dehumidifiers and air movers, moisture logs for insurance.",
    specialties: [{ id: "extraction", label: "Water extraction & drying", slug: "water-damage" }, { id: "sewage", label: "Sewage backups (category 3)" }, { id: "insurance_claims", label: "Insurance documentation" }],
    license: null,
    preferred: ["IICRC WRT (Water Damage Restoration Technician) certification", "Moisture meter and thermal camera on every job"], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "IICRC WRT certificate, equipment list (extractor, dehumidifiers, air movers), photos and drying logs from 2 recent jobs, 2 references.",
  },
  duct_cleaning: {
    does: "Air duct cleaning with negative-pressure equipment, furnace compartment cleaning and dryer vent cleaning.",
    specialties: [{ id: "ducts", label: "Air duct cleaning", slug: "duct-cleaning" }, { id: "dryer_vents", label: "Dryer vent cleaning" }, { id: "duct_sanitize", label: "Duct sanitizing" }],
    license: null,
    preferred: ["NADCA ASCS certification"], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Equipment list (negative-air machine or truck mount), before & after duct photos from 2 jobs, 2 references.",
  },
  chimney_sweep: {
    does: "Chimney sweeping, Level 1 and Level 2 inspections and chimney caps.",
    specialties: [{ id: "sweeping", label: "Sweeping & Level 1 inspection", slug: "chimney-sweep" }, { id: "level2", label: "Level 2 camera inspections" }, { id: "caps", label: "Caps & dampers" }],
    license: null,
    preferred: ["CSIA Certified Chimney Sweep"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "CSIA certificate, sample inspection report, 2 references.",
  },
  irrigation: {
    does: "Sprinkler start-ups, winterization blowouts, repairs and backflow testing.",
    specialties: [{ id: "startup", label: "Spring start-ups", slug: "sprinkler-service" }, { id: "blowout", label: "Winterization blowouts" }, { id: "sprinkler_repair", label: "Heads, valves & leaks" }, { id: "backflow", label: "Backflow testing" }],
    license: null,
    preferred: ["Certified backflow tester (required for backflow tests)", "Irrigation Association certification"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }, { key: "auto", when: "you tow a compressor" }],
    skillsCheck: "Equipment list (tow-behind compressor), photos of recent repairs, 2 references.",
  },
  holiday_lights: {
    does: "Holiday light installation, service during the season and takedown.",
    specialties: [{ id: "rooflines", label: "Rooflines & gutters", slug: "holiday-lights" }, { id: "trees_wrap", label: "Tree & bush wrapping" }, { id: "commercial_displays", label: "Commercial displays" }],
    license: null,
    preferred: [], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Ladder-safety attestation, photos of 3 recent displays, 2 references.",
  },
  pool: {
    does: "Pool openings, closings, weekly cleaning and green-to-clean recovery.",
    specialties: [{ id: "open_close", label: "Openings & closings", slug: "pool-service" }, { id: "weekly_pool", label: "Weekly cleaning" }, { id: "green_pool", label: "Green-to-clean" }, { id: "pool_equipment", label: "Pumps & filters" }],
    license: null,
    preferred: ["CPO (Certified Pool Operator)"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "CPO card if held, photos of recent pools, 2 references.",
  },
  pest: {
    does: "General pest, rodent, bed bug and stinging insect control.",
    specialties: [{ id: "general_pest", label: "Ants, roaches & spiders", slug: "pest-control" }, { id: "rodent", label: "Mice & rats" }, { id: "bedbug", label: "Bed bugs" }, { id: "stinging_insects", label: "Wasps & hornets" }],
    license: "Michigan commercial pesticide applicator certification (MDARD, category 7A) and a licensed pesticide application business",
    preferred: ["QualityPro or NPMA membership"], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "MDARD certification and business license lookup, product list with labels, 2 references.",
  },
  nuisance_wildlife: {
    does: "Live nuisance wildlife trapping and relocation, bat exclusion, entry-point sealing and attic cleanup.",
    specialties: [{ id: "trapping", label: "Trapping & relocation", slug: "wildlife-removal" }, { id: "bat_exclusion", label: "Bat exclusion" }, { id: "exclusion_repair", label: "Entry-point sealing" }, { id: "attic_restore", label: "Attic cleanup" }],
    license: "Michigan DNR Nuisance Animal Control Permit (required to trap and relocate wildlife for pay)",
    preferred: ["NWCOA certification"], glMin: GL1, requires: ["auto"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "DNR permit, photos of 3 recent exclusion repairs, 2 references.",
  },
  laundry: {
    does: "Wash & fold laundry with pickup and delivery.",
    specialties: [{ id: "wash_fold", label: "Wash & fold", slug: "laundry-pickup" }, { id: "bedding", label: "Comforters & bedding" }, { id: "commercial_laundry", label: "Commercial accounts (salons, gyms, Airbnb)" }],
    license: null,
    preferred: [], glMin: GL1, requires: [], conditional: [{ key: "auto", when: "you pick up and deliver in your own vehicle" }],
    skillsCheck: "Where you wash (home, laundromat or your own shop), turnaround capacity per day, 2 references.",
  },
  mold: {
    does: "Mold remediation: containment with negative air, removal of moldy drywall, insulation and carpet, HEPA vacuuming, antimicrobial treatment, drying, and finding the moisture source.",
    specialties: [{ id: "remediation", label: "Mold remediation", slug: "mold-removal" }, { id: "attic_crawl", label: "Attics & crawlspaces" }, { id: "hvac_mold", label: "Furnace & duct mold" }, { id: "testing", label: "Mold inspection & air testing" }],
    license: null,
    preferred: ["IICRC AMRT (Applied Microbial Remediation Technician) or NORMI certification", "Contractor's pollution liability (mold) insurance", "Moisture meter and thermal camera on every job"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Remediation certificate (IICRC AMRT or equal), certificate for pollution liability that covers mold, photos of containment from 3 recent jobs, and 2 references. Michigan and Washington have no state mold license.",
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
  assembly: {
    does: "Flat-pack furniture, office furniture, cribs, patio sets, playsets and home gyms assembled and anchored; TVs mounted.",
    specialties: [{ id: "flatpack", label: "Flat-pack furniture (IKEA, Wayfair, Amazon)", slug: "furniture-assembly" }, { id: "office_furniture", label: "Office furniture & cubicles" }, { id: "outdoor_assembly", label: "Playsets, trampolines & sheds" }, { id: "gym_equipment", label: "Home gym equipment" }, { id: "tv_mount", label: "TV mounting" }],
    license: null, preferred: [], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Photos of 3 recent assemblies, own drill and tools, 2 references.",
  },
  remodel: {
    does: "Bathroom, kitchen and whole-home remodels with permits and subs.",
    specialties: [{ id: "bath", label: "Bathrooms", slug: "bathroom-remodel" }, { id: "kitchen", label: "Kitchens", slug: "kitchen-remodel" }, { id: "whole_home", label: "Whole-home / additions", slug: "home-remodel" }, { id: "basement", label: "Basements" }, { id: "flooring", label: "Flooring & tile" }],
    license: "Michigan Residential Builder or Maintenance & Alteration Contractor license (LARA), required for residential work over $600",
    preferred: ["EPA RRP lead-safe certification (required for pre-1978 homes)"], glMin: GL1, requires: ["workers_comp"], conditional: [],
    skillsCheck: "License lookup on LARA, portfolio of 3 completed remodels, 3 client references, permit history.",
  },
  painting: {
    does: "Interior and exterior painting of rooms, homes, offices and buildings; prep, patching and staining.",
    specialties: [
      { id: "interior", label: "Interior rooms & homes", slug: "interior-painting" },
      { id: "exterior", label: "Exterior homes & buildings", slug: "exterior-painting" },
      { id: "commercial_paint", label: "Offices & commercial" },
      { id: "cabinets", label: "Cabinets & trim" },
      { id: "drywall_finish", label: "Drywall repair & finishing" },
      { id: "stain", label: "Decks, fences & staining" },
    ],
    license: "Michigan Maintenance & Alteration Contractor license (painting & decorating) or Residential Builder license (LARA), required for residential work over $600",
    preferred: ["EPA RRP lead-safe certification (required for pre-1978 homes)", "PDCA membership"], glMin: GL1, requires: [],
    conditional: [{ key: "workers_comp", when: "you have employees (most paint crews do)" }, { key: "auto", when: "you haul ladders or lifts on a trailer" }],
    skillsCheck: "License lookup on LARA, EPA RRP certificate, portfolio of 5 recent jobs (interior and exterior), 3 client references.",
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
  security: {
    does: "Licensed security guard agencies: event security, standing guard posts, mobile patrols and fire watch, door and ID checks, crowd and parking control, armed officers where licensed.",
    specialties: [{ id: "event_security", label: "Event security", slug: "event-security" }, { id: "door_id", label: "Door & ID checks" }, { id: "armed", label: "Armed officers" }, { id: "patrol", label: "Property patrol / standing posts", slug: "security-guard" }, { id: "fire_watch", label: "Fire watch" }],
    license: "Michigan security guard agency license (LARA, Private Security Business and Security Alarm Act). Guards are the agency's employees and registered with it; armed officers need the agency's armed authorization and a concealed pistol license",
    preferred: ["Crowd-management or de-escalation training", "First aid / CPR"], glMin: GL2, requires: ["workers_comp"], conditional: [],
    skillsCheck: "LARA license lookup, certificate of insurance (GL $2M, workers' comp), guard training and use-of-force policy, 3 event or venue references.",
  },
  recruiter: {
    does: "Independent recruiters for Handled Talent: sourcing, screening and submitting candidates for client searches (contingency and retained).",
    specialties: [{ id: "trades_ops", label: "Skilled trades & operations" }, { id: "tech", label: "Technical / IT" }, { id: "office", label: "Office, admin & finance" }, { id: "sales", label: "Sales & customer service" }, { id: "healthcare", label: "Healthcare" }, { id: "exec", label: "Leadership / executive search" }],
    license: null, preferred: ["2+ years agency or in-house recruiting", "Applicant tracking and sourcing tools", "AIRS / CIR / CDR or similar certification"], glMin: GL1, requires: [], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "Two recent placements with salary range and role (no client names needed), a sample candidate write-up, and a 20-minute mock intake call.",
  },
  freight: {
    does: "Licensed motor carriers moving business freight: pallets and parcels in cargo vans, 26-ft box trucks with liftgates, and 53-ft full truckloads. Dock to dock, curbside or inside delivery, one-time or on a weekly route.",
    specialties: [{ id: "pallets", label: "Pallet & LTL delivery", slug: "freight-delivery" }, { id: "box_truck", label: "Box truck with liftgate" }, { id: "truckload", label: "Full truckload (53-ft)" }, { id: "final_mile", label: "Final-mile & white glove" }],
    license: "USDOT number with active operating authority (FMCSA MC number for interstate freight), and CDL drivers for vehicles over 26,000 lb",
    preferred: ["Satisfactory FMCSA safety rating", "ELD and live GPS tracking", "Hazmat-free freight policy"], glMin: GL1, requires: ["auto", "cargo"], conditional: [{ key: "workers_comp", when: "you have employees" }],
    skillsCheck: "FMCSA SAFER lookup (authority active, insurance on file, out-of-service rates), certificates for commercial auto ($1M) and cargo ($100K), the driver list with CDL classes, and 2 shipper references.",
  },
  web_design: {
    does: "Remote web designers and developers: business websites, online stores, landing pages, Google setup and site care.",
    specialties: [{ id: "business_site", label: "Business websites", slug: "website-design" }, { id: "ecommerce", label: "Online stores" }, { id: "branding", label: "Logos & brand kits" }, { id: "seo", label: "Google & search setup" }],
    license: null, preferred: ["Professional liability (E&O) insurance", "Accessibility (WCAG) experience", "Spanish-language sites"], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Portfolio with 3 live sites they built, 2 client references, and a short review of a sample brief.",
  },
  business_formation: {
    does: "Remote business formation specialists: LLC, corporation and nonprofit filings, EINs, registered agent, licenses and permits. Paperwork only — no legal or tax advice.",
    specialties: [{ id: "llc_corp", label: "LLC & corporation filings", slug: "business-formation" }, { id: "nonprofit", label: "Nonprofit filings" }, { id: "licenses", label: "Business licenses & permits" }, { id: "registered_agent", label: "Registered agent service" }],
    license: null, preferred: ["Professional liability (E&O) insurance", "Paralegal or enrolled agent background", "Notary public"], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Three recent filings (redacted), the states they file in, and a walkthrough of how they keep client data private.",
  },
  consulting: {
    does: "Remote business consultants: strategy sessions, startup and business plans, growth and operations, marketing plans and bid / RFP writing.",
    specialties: [{ id: "strategy", label: "Strategy & business plans", slug: "business-consulting" }, { id: "operations", label: "Operations & growth" }, { id: "marketing", label: "Marketing plans" }, { id: "bids", label: "Bid & RFP writing" }, { id: "finance", label: "Financial projections" }],
    license: null, preferred: ["Professional liability (E&O) insurance", "5+ years running or advising small businesses", "Government contracting experience"], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Two sample deliverables (redacted), 2 client references, and a 20-minute mock consultation.",
  },
  ai_automation: {
    does: "Remote AI automation builders: workflow automations between business apps, AI chat and voice agents, and integrations with CRMs, calendars and invoicing.",
    specialties: [{ id: "workflows", label: "Workflow automation", slug: "ai-automation" }, { id: "agents", label: "AI chat & voice agents", slug: "ai-agents" }, { id: "integrations", label: "CRM & app integrations" }, { id: "data", label: "Reports & dashboards" }],
    license: null, preferred: ["Professional liability (E&O) / cyber insurance", "Security and data-privacy practices", "Spanish-language agents"], glMin: GL1, requires: [], conditional: [],
    skillsCheck: "Two automations or agents they built (demo or recording), how they handle client logins and data, and 2 client references.",
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
export function requiredCoverages(trades: string[], job?: { customer_type?: string | null; price_final?: number | null } | null): CoverageKey[] {
  const bigCommercial = (t: string) => {
    const c = profile(t)?.commercial;
    return Boolean(c && job?.customer_type === "commercial" && Number(job.price_final ?? 0) >= c.minPrice);
  };
  return [...new Set(trades.flatMap((t) => [...(profile(t)?.requires ?? []), ...(bigCommercial(t) ? profile(t)!.commercial!.requires : [])]))];
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
  { t: "Documents", b: `W-9, contractor agreement, certificate of insurance naming ${BRAND.legalName} as additional insured, license and any trade-specific coverage. We verify each policy with the carrier.` },
  { t: "Photo ID + background check", b: "A photo of your ID matched to a selfie, then a criminal and sex-offender search through our screening provider. Driving trades also get a motor-vehicle record check. Re-run every year." },
  { t: "Probation jobs", b: `Your first ${PROBATION.jobs} jobs are under $${PROBATION.maxJobPrice}, and each one gets a human photo review and a follow-up call to the customer.` },
  { t: "Activated", b: "Full offers in your area and specialties. Insurance and licenses are tracked, and offers pause automatically if one lapses." },
];
