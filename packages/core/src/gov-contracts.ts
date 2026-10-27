/*
 * FILE    : packages/core/src/gov-contracts.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_1441 UTC
 * PURPOSE : Government contracts from SAM.gov (the federal Contract Opportunities API), matched to the work our pros do.
 *             GOV_NAICS          — the NAICS codes agencies use for work we offer, mapped to our services
 *             parseSamOpportunity — one SAM.gov search record → a flat row we store
 *             govFit             — 0–100 fit score: our NAICS, Michigan / metro Detroit place of performance, set-aside we
 *                                  can claim, time left to respond, and notice type (awards are research, not bids)
 *             samSearchQuery     — the search query string (the API key is added server-side, never stored)
 *             GOV_BID_CHECKLIST  — what has to be true before we bid: SAM registration, wage rules, subcontracting
 *                                  limits on set-asides, insurance, site access, invoicing and the 30-day payment gap
 *           SAM.gov API: GET https://api.sam.gov/opportunities/v2/search — postedFrom / postedTo (MM/dd/yyyy, at most a
 *           year apart) are required; ncode = NAICS, ptype = notice type, state, limit (≤ 1000), offset. A personal key
 *           allows about 10 calls a day (about 1,000 once the account has a role at a SAM-registered entity), so we
 *           cache every result and the daily run stays inside a call budget.
 *           Not legal advice: the bid checklist flags items for counsel and a government-contracts adviser.
 * UPDATED : 2026-10-19_2140 UTC — GOV_FOCUS: landscaping, painting, AI automation (541511 / 541512 / 541519 →
 *           our AI automation, AI agents and business operating system services; remote, so place doesn't count
 *           against them), window installation (238150), carpet cleaning (561740) and construction (236220
 *           commercial building, 236118 remodeling). Roofing 238160 and window installation are subcontracted work
 *           (no catalog service yet). offeredNaics(), remoteNaics().
 * UPDATED : 2026-10-19_2330 UTC — stateWide search (one call for the whole state, filtered to our codes on our side, plus
 *           one nationwide call per remote code) so the daily search fits a 10-call key; pickBidCandidates — the day's
 *           5 best notices we can still respond to (open, biddable, 5+ days left, good fit).
 * UPDATED : 2026-10-23_1900 UTC — roofing (238160) is now a catalog service; masonry (238140), poured concrete (238110) and
 *           site preparation & demolition (238910) added; landscaping joins 561730.
 * UPDATED : 2026-10-23_2100 UTC — codes for services 76–100: siding & gutters, flooring, insulation, fencing & paving, pest control,
 *           appliance repair, locksmiths, building inspection, water remediation; window installation now has a catalog service.
 * UPDATED : 2026-10-27_1600 UTC — finish carpentry (238350) maps to Carpentry.
 */
import { SERVICE_BY_SLUG } from "./services.ts";

export interface GovNaics {
  code: string; title: string; slugs: string[];
  /** Where we're going after government work first. */
  focus?: boolean;
  /** Work we fill only with subcontracted pros (no catalog service yet). */
  subcontracted?: boolean;
  /** Can be done remotely: the place of performance doesn't matter. */
  remote?: boolean;
}

/** NAICS codes agencies post work under, for services we already offer (2022 NAICS). */
export const GOV_NAICS: GovNaics[] = [
  { code: "561720", title: "Janitorial services", slugs: ["house-cleaning", "window-cleaning"] },
  { code: "561730", title: "Landscaping & grounds maintenance", slugs: ["lawn-care", "landscaping", "leaf-removal", "tree-removal"], focus: true },
  { code: "238160", title: "Roofing", slugs: ["roofing"] },
  { code: "238140", title: "Masonry", slugs: ["masonry"] },
  { code: "238350", title: "Finish carpentry contractors", slugs: ["carpentry"] },
  { code: "238110", title: "Poured concrete (steps, walks, flatwork)", slugs: ["concrete-repair"] },
  { code: "238910", title: "Site preparation & demolition", slugs: ["demolition"] },
  { code: "238170", title: "Siding", slugs: ["siding", "gutter-install"] },
  { code: "238330", title: "Flooring", slugs: ["flooring"] },
  { code: "238310", title: "Drywall & insulation", slugs: ["insulation"] },
  { code: "238990", title: "Specialty trades (fencing, paving & sealcoating)", slugs: ["fence-install", "driveway-sealcoating"] },
  { code: "561710", title: "Exterminating & pest control", slugs: ["pest-control", "wildlife-removal"] },
  { code: "811412", title: "Appliance repair", slugs: ["appliance-repair"] },
  { code: "561622", title: "Locksmiths", slugs: ["locksmith"] },
  { code: "541350", title: "Building inspection", slugs: ["property-inspection"] },
  { code: "562910", title: "Remediation (water damage)", slugs: ["water-damage"] },
  { code: "561740", title: "Carpet & upholstery cleaning", slugs: ["carpet-cleaning"], focus: true },
  { code: "561790", title: "Other services to buildings (snow removal, power washing, gutters)", slugs: ["snow-removal", "power-washing", "gutter-cleaning", "duct-cleaning", "chimney-sweep", "trash-bin-cleaning"] },
  { code: "561612", title: "Security guards & patrol", slugs: ["security-guard", "event-security"] },
  { code: "561210", title: "Facilities support (multi-service)", slugs: ["handyman", "unit-turnover", "house-cleaning", "lawn-care"] },
  { code: "562111", title: "Solid waste collection (junk & debris hauling)", slugs: ["junk-removal", "junk-container"] },
  { code: "484210", title: "Office & household moving", slugs: ["small-moves", "large-item-removal"] },
  { code: "238220", title: "Plumbing, heating & air conditioning", slugs: ["plumbing", "hvac-install", "water-heater"] },
  { code: "238210", title: "Electrical work", slugs: ["lighting-install", "camera-install"] },
  { code: "238320", title: "Painting", slugs: ["interior-painting", "exterior-painting"], focus: true },
  { code: "541511", title: "Custom computer programming (AI automation)", slugs: ["ai-automation", "ai-agents", "website-design"], focus: true, remote: true },
  { code: "541512", title: "Computer systems design (AI systems)", slugs: ["ai-automation", "business-operating-system", "ai-agents"], focus: true, remote: true },
  { code: "541519", title: "Other computer services (AI automation)", slugs: ["ai-automation"], focus: true, remote: true },
  { code: "236118", title: "Residential remodeling", slugs: ["bathroom-remodel", "kitchen-remodel", "home-remodel"], focus: true },
  { code: "236220", title: "Commercial & institutional building construction", slugs: ["home-remodel", "handyman"], focus: true },
  { code: "238150", title: "Window installation (glass & glazing)", slugs: ["window-door-install"], focus: true, subcontracted: true },
  { code: "492210", title: "Local couriers & delivery", slugs: ["courier", "medical-delivery"] },
  { code: "485320", title: "Limousine & car service", slugs: ["private-driver", "airport-transfer", "limousine"] },
  { code: "485510", title: "Charter bus", slugs: ["charter-bus", "event-shuttle"] },
  { code: "722320", title: "Catering", slugs: ["catering"] },
  { code: "561920", title: "Convention & event organizers", slugs: ["event-planning"] },
  { code: "811192", title: "Car washes & detailing", slugs: ["mobile-car-detailing"] },
];
export const GOV_NAICS_BY_CODE: Record<string, GovNaics> = Object.fromEntries(GOV_NAICS.map((n) => [n.code, n]));
/** Where we're going after government work first (and subcontracting under primes). */
export const GOV_FOCUS = GOV_NAICS.filter((n) => n.focus).map((n) => n.code);
/** Work we can deliver under this code: a catalog service, or a trade we fill with subcontracted pros. */
export const offeredNaics = (code: string | null | undefined) => Boolean(code && (GOV_NAICS_BY_CODE[code]?.subcontracted || servicesForNaics(code).length));
/** Remote work (AI automation): where the agency is doesn't matter. */
export const remoteNaics = (code: string | null | undefined) => Boolean(code && GOV_NAICS_BY_CODE[code]?.remote);

/** Services (that exist in the catalog) an opportunity's NAICS code points to. */
export function servicesForNaics(code: string | null | undefined): string[] {
  return (GOV_NAICS_BY_CODE[String(code ?? "")]?.slugs ?? []).filter((s) => SERVICE_BY_SLUG[s]);
}
/** Pro trades that can do the work under this NAICS code. */
export function tradesForNaics(code: string | null | undefined): string[] {
  return [...new Set(servicesForNaics(code).flatMap((s) => SERVICE_BY_SLUG[s].trades))];
}

/** SAM.gov notice types (ptype). */
export const SAM_NOTICE_TYPES: Record<string, string> = {
  o: "Solicitation", k: "Combined synopsis/solicitation", p: "Presolicitation", r: "Sources sought", s: "Special notice",
  a: "Award notice", u: "Justification (J&A)", g: "Sale of surplus property", i: "Intent to bundle",
};
/** Notice types we can act on (bid or respond). Awards and justifications are research only. */
export const BIDDABLE_TYPES = ["o", "k", "p", "r", "s"];

/** Set-aside codes. `open` = anyone can bid; `small` = small businesses (Handled qualifies once registered); others need a certification. */
export const SET_ASIDES: Record<string, { label: string; kind: "small" | "cert" }> = {
  SBA: { label: "Total small business set-aside", kind: "small" },
  SBP: { label: "Partial small business set-aside", kind: "small" },
  "8A": { label: "8(a) set-aside", kind: "cert" },
  "8AN": { label: "8(a) sole source", kind: "cert" },
  HZC: { label: "HUBZone set-aside", kind: "cert" },
  HZS: { label: "HUBZone sole source", kind: "cert" },
  SDVOSBC: { label: "Service-disabled veteran-owned set-aside", kind: "cert" },
  SDVOSBS: { label: "Service-disabled veteran-owned sole source", kind: "cert" },
  WOSB: { label: "Women-owned small business set-aside", kind: "cert" },
  WOSBSS: { label: "Women-owned small business sole source", kind: "cert" },
  EDWOSB: { label: "Economically disadvantaged WOSB set-aside", kind: "cert" },
  EDWOSBSS: { label: "Economically disadvantaged WOSB sole source", kind: "cert" },
  VSA: { label: "Veteran-owned set-aside (VA)", kind: "cert" },
  VSS: { label: "Veteran-owned sole source (VA)", kind: "cert" },
  IEE: { label: "Indian economic enterprise set-aside", kind: "cert" },
  ISBEE: { label: "Indian small business economic enterprise set-aside", kind: "cert" },
};

/** Metro Detroit and nearby cities (place of performance) — the work our pros can reach. */
export const METRO_CITIES = ["detroit", "dearborn", "warren", "sterling heights", "troy", "southfield", "livonia", "pontiac", "ann arbor", "ypsilanti", "novi", "farmington hills", "royal oak", "westland", "taylor", "canton", "auburn hills", "rochester hills", "mount clemens", "selfridge", "romulus", "wyandotte", "grosse ile", "belleville", "allen park", "southgate", "roseville", "st. clair shores", "madison heights", "ferndale", "bloomfield hills", "west bloomfield", "waterford", "clarkston", "chesterfield", "macomb", "shelby township", "utica", "plymouth", "northville", "wayne", "inkster", "redford", "garden city", "hamtramck", "highland park", "harper woods", "eastpointe", "grosse pointe", "monroe", "brighton", "howell"];

export interface GovOpportunity {
  notice_id: string;
  title: string;
  solicitation_number: string | null;
  agency: string | null;
  office: string | null;
  notice_type: string | null;
  ptype: string | null;
  set_aside_code: string | null;
  set_aside: string | null;
  naics: string | null;
  psc: string | null;
  posted_date: string | null;
  response_deadline: string | null;
  archive_date: string | null;
  active: boolean;
  pop_city: string | null;
  pop_state: string | null;
  pop_zip: string | null;
  ui_link: string | null;
  description_url: string | null;
  contacts: { name: string | null; email: string | null; phone: string | null; type: string | null }[];
  award_amount: number | null;
  awardee: string | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});

/** Map SAM's notice "type" text back to its ptype letter. */
function ptypeOf(type: string | null): string | null {
  const t = (type ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("combined")) return "k";
  if (t.includes("presolicitation")) return "p";
  if (t.includes("sources sought")) return "r";
  if (t.includes("special")) return "s";
  if (t.includes("award")) return "a";
  if (t.includes("justification")) return "u";
  if (t.includes("surplus")) return "g";
  if (t.includes("bundle")) return "i";
  if (t.includes("solicitation")) return "o";
  return null;
}

/** One record from the SAM.gov search response (`opportunitiesData[]`) → our row. Tolerates missing fields. */
export function parseSamOpportunity(r: Raw): GovOpportunity | null {
  const id = str(r.noticeId);
  const title = str(r.title);
  if (!id || !title) return null;
  const path = (str(r.fullParentPathName) ?? "").split(".").map((x) => x.trim()).filter(Boolean);
  const pop = obj(r.placeOfPerformance);
  const award = obj(r.award);
  const type = str(r.type) ?? str(r.baseType);
  const amount = Number(String(award.amount ?? "").replace(/[^\d.]/g, ""));
  const contacts = (Array.isArray(r.pointOfContact) ? r.pointOfContact : []).slice(0, 4).map((c) => {
    const o = obj(c);
    return { name: str(o.fullName), email: str(o.email), phone: str(o.phone), type: str(o.type) };
  });
  const naics = str(r.naicsCode) ?? (Array.isArray(r.naicsCodes) ? str(r.naicsCodes[0]) : null);
  return {
    notice_id: id,
    title: title.slice(0, 500),
    solicitation_number: str(r.solicitationNumber),
    agency: path[0] ?? str(r.department),
    office: path.length > 1 ? path[path.length - 1] : str(r.office),
    notice_type: type,
    ptype: ptypeOf(type),
    set_aside_code: str(r.typeOfSetAside),
    set_aside: str(r.typeOfSetAsideDescription),
    naics,
    psc: str(r.classificationCode),
    posted_date: str(r.postedDate),
    response_deadline: str(r.responseDeadLine),
    archive_date: str(r.archiveDate),
    active: String(r.active ?? "Yes").toLowerCase() !== "no",
    pop_city: str(obj(pop.city).name),
    pop_state: str(obj(pop.state).code),
    pop_zip: str(pop.zip),
    ui_link: str(r.uiLink),
    description_url: str(r.description),
    contacts,
    award_amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    awardee: str(obj(award.awardee).name),
  };
}

export interface GovFit { score: number; services: string[]; reasons: string[]; flags: string[]; biddable: boolean }

/** How well an opportunity fits us (0–100), with plain reasons and red flags. */
export function govFit(o: GovOpportunity, opts: { homeState?: string; now?: Date; certifications?: string[] } = {}): GovFit {
  const home = (opts.homeState ?? "MI").toUpperCase();
  const now = opts.now ?? new Date();
  const certs = new Set((opts.certifications ?? []).map((c) => c.toUpperCase()));
  const services = servicesForNaics(o.naics);
  const reasons: string[] = [];
  const flags: string[] = [];
  let score = 0;
  const biddable = Boolean(o.active && (!o.ptype || BIDDABLE_TYPES.includes(o.ptype)));
  if (offeredNaics(o.naics)) { score += 40; reasons.push(`NAICS ${o.naics}: ${GOV_NAICS_BY_CODE[o.naics!].title}`); }
  else flags.push(`NAICS ${o.naics ?? "—"} isn't work we offer yet`);
  const city = (o.pop_city ?? "").toLowerCase();
  if (remoteNaics(o.naics)) { score += 40; reasons.push("Remote work: we can deliver it from anywhere"); }
  else if (o.pop_state?.toUpperCase() === home) {
    score += 25; reasons.push(`In ${home}`);
    if (METRO_CITIES.some((c) => city.includes(c))) { score += 15; reasons.push(`Metro Detroit (${o.pop_city})`); }
  } else if (o.pop_state) flags.push(`Work is in ${o.pop_state}${o.pop_city ? ` (${o.pop_city})` : ""}: we'd need pros there`);
  else flags.push("No place of performance listed: check the notice");
  const sa = o.set_aside_code ? SET_ASIDES[o.set_aside_code] : undefined;
  if (!o.set_aside_code || /none/i.test(o.set_aside_code)) { score += 10; reasons.push("Open to all bidders"); }
  else if (sa?.kind === "small") { score += 10; reasons.push(`${sa.label}: Handled qualifies as a small business once registered`); flags.push("Small-business set-aside: limits on subcontracting apply (see bid checklist)"); }
  else if (sa && certs.has(o.set_aside_code)) { score += 10; reasons.push(`${sa.label}: we hold this certification`); }
  else { score -= 30; flags.push(`${sa?.label ?? o.set_aside ?? o.set_aside_code}: only firms with that certification can bid`); }
  if (o.response_deadline) {
    const days = (new Date(o.response_deadline).getTime() - now.getTime()) / 86400000;
    if (days < 0) { score -= 40; flags.push("Response deadline has passed"); }
    else if (days < 3) { score -= 10; flags.push(`Due in ${Math.max(0, Math.round(days * 24))} hours`); }
    else if (days >= 7) { score += 10; reasons.push(`${Math.floor(days)} days to respond`); }
  }
  if (o.ptype === "r") reasons.push("Sources sought: a capability response (no price) puts us on the agency's radar");
  if (!biddable) { flags.push(o.ptype === "a" ? `Award notice${o.awardee ? ` (won by ${o.awardee})` : ""}: research only — note who wins this work and when it comes back` : "Not open for bids"); score = Math.min(score, 15); }
  return { score: Math.max(0, Math.min(100, score)), services, reasons, flags, biddable };
}

/** MM/dd/yyyy, the date format SAM.gov expects. */
export function samDate(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export interface GovSearch { naics?: string[]; state?: string | null; keywords?: string | null; ptypes?: string[]; setAside?: string | null; daysBack?: number; limit?: number; offset?: number; now?: Date;
  /** One call for every notice in the state (filter to our codes after), plus one nationwide call per remote code. */
  stateWide?: boolean }

/**
 * Query strings for one search (without the API key). SAM takes one NAICS code per call, so a search across
 * several codes is several calls — callers keep that inside the daily call budget.
 */
export function samSearchQueries(s: GovSearch): string[] {
  const now = s.now ?? new Date();
  const days = Math.min(364, Math.max(1, Math.round(s.daysBack ?? 14)));
  const base: Record<string, string> = {
    postedFrom: samDate(new Date(now.getTime() - days * 86400000)),
    postedTo: samDate(now),
    limit: String(Math.min(1000, Math.max(1, s.limit ?? 200))),
    offset: String(Math.max(0, s.offset ?? 0)),
  };
  if (s.state) base.state = s.state.toUpperCase().slice(0, 2);
  if (s.keywords?.trim()) base.title = s.keywords.trim().slice(0, 100);
  if (s.ptypes?.length) base.ptype = s.ptypes.filter((p) => p in SAM_NOTICE_TYPES).join(",");
  if (s.setAside && s.setAside in SET_ASIDES) base.typeOfSetAside = s.setAside;
  const codes = (s.naics ?? []).filter((c) => /^\d{6}$/.test(c));
  if (s.stateWide && base.state && codes.length) {
    const local = codes.filter((c) => !remoteNaics(c));
    const { state: _st, ...national } = base;
    const list = [
      ...(local.length ? [{ ...base, limit: "1000" }] : []),
      ...codes.filter((c) => remoteNaics(c)).map((ncode) => ({ ...national, ncode })),
    ];
    return list.map((q) => new URLSearchParams(q).toString());
  }
  const list = codes.length ? codes.map((ncode) => ({ ...base, ncode })) : [base];
  return list.map((q) => new URLSearchParams(q).toString());
}

export interface BidCandidate { notice_id: string; status: string; fit_score: number; response_deadline: string | null; active: boolean; ptype: string | null; naics: string | null; picked_at?: string | null }

/**
 * The day's best notices to propose on: new, open, a type we can respond to (solicitation, combined, presolicitation,
 * sources sought), work we do, at least `minDays` to respond, fit `minScore`+. Best fit first, then soonest due.
 */
export function pickBidCandidates<T extends BidCandidate>(rows: T[], o: { n?: number; now?: Date; minDays?: number; minScore?: number } = {}): T[] {
  const now = (o.now ?? new Date()).getTime();
  const minMs = (o.minDays ?? 5) * 86400000;
  return rows
    .filter((r) => r.status === "new" && !r.picked_at && r.active && ["o", "k", "p", "r"].includes(r.ptype ?? "") && offeredNaics(r.naics) && r.fit_score >= (o.minScore ?? 55))
    .filter((r) => !r.response_deadline || new Date(r.response_deadline).getTime() - now >= minMs)
    .sort((a, b) => b.fit_score - a.fit_score || (a.response_deadline ?? "9999").localeCompare(b.response_deadline ?? "9999"))
    .slice(0, o.n ?? 5);
}

/** What has to be true before we bid on a government contract. Flags for counsel / a contracts adviser. */
export const GOV_BID_CHECKLIST: { id: string; title: string; detail: string; counsel?: boolean }[] = [
  { id: "sam", title: "Handled is registered in SAM.gov (UEI) and active", detail: "Free at SAM.gov (entity registration). Takes about 2–4 weeks the first time; renew every year. List every NAICS code above in the registration and complete the reps & certs. Without an active registration we can't be awarded a federal contract." },
  { id: "size", title: "We're small for this NAICS code", detail: "Each NAICS code has an SBA size standard (average annual receipts). Check it at sba.gov before claiming a small-business set-aside." },
  { id: "subcontracting", title: "Limits on subcontracting (set-asides)", detail: "On a small-business set-aside for services, no more than 50% of what the government pays us may go to subcontractors that aren't 'similarly situated' (FAR 52.219-14). Pros who are themselves small businesses for that NAICS count as similarly situated — confirm each pro's size in writing before we bid. Open (unrestricted) contracts don't have this limit.", counsel: true },
  { id: "wages", title: "Wage rules: Service Contract Act / Davis-Bacon", detail: "Most federal service contracts over $2,500 attach a wage determination (minimum hourly rates plus fringe benefits) that applies to the people doing the work, including subcontractors' workers. Construction (painting, remodels, electrical, plumbing) over $2,000 falls under Davis-Bacon with weekly certified payrolls. Price the bid so every pro is paid at least the wage determination, and flow the clauses down.", counsel: true },
  { id: "ic", title: "Pros stay independent businesses", detail: "Pros are subcontractors under a written subcontract that flows down the required clauses. They choose their own methods; we check results against the contract's performance standards. Never call them employees or 'hired'.", counsel: true },
  { id: "insurance", title: "Insurance & bonding meet the contract", detail: "Read the solicitation's insurance section (often higher GL limits, auto, workers' comp) and any bid, performance or payment bond. Get certificates from the pros who will do the work." },
  { id: "access", title: "Site access and background checks", detail: "Federal sites may need escorts, a background investigation, a PIV card or base access (e.g. DBIDS) for each worker. Build the lead time into the start date." },
  { id: "capacity", title: "Pros lined up with capacity", detail: "Before bidding, confirm enough approved pros near the site who want the work at our price, for the whole period of performance (and a backup)." },
  { id: "price", title: "Price covers wages, our costs and the payment gap", detail: "The government pays about 30 days after a proper invoice (Prompt Payment Act), through its invoicing system (e.g. Invoice Processing Platform or PIEE/WAWF). We pay pros sooner, so plan the cash for at least one billing cycle." },
  { id: "deadline", title: "Questions and response are in on time", detail: "Send questions by the Q&A deadline in the notice; submit exactly the way the notice says (email, portal) before the response deadline, in the agency's time zone." },
];
