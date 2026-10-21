/*
 * FILE    : packages/core/src/gov-awards.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-19_2015 UTC
 * PURPOSE : Federal contract AWARDS from SAM.gov (the Contract Awards API — the FPDS data, now in SAM.gov), for the
 *           work our pros do. Opportunities (gov-contracts.ts) are open bids; awards tell us who already does the work,
 *           for how much, and when the contract ends — so we can get ready before it is re-bid.
 *             parseSamAward      — one `awardSummary[]` record → a flat row (tolerant: finds fields by name if the
 *                                  nesting moves)
 *             mergeAwards        — base award + modifications → one row per contract (latest dates, highest value)
 *             recompeteFit       — 0–100: our NAICS, Michigan / metro Detroit, months until the contract ends
 *                                  (3–18 months out is the sweet spot), set-aside we can claim
 *             incumbents         — who holds the work, by NAICS: contracts, total value, soonest end date
 *             awardSearchQuery   — the query string for one page (the API key is added server-side, never stored)
 *             nextAwardOffset    — works out whether SAM's `offset` counts pages or records from the first two pages
 *           SAM.gov API (OpenAPI spec "Contract Award API" 1.0): GET https://api.sam.gov/contract-awards/v1/search —
 *           limit (default 10, max 100), offset (spec default 1), naicsCode (several joined with "~" = OR, so one call
 *           covers every code), dateSigned=[MM/dd/yyyy,MM/dd/yyyy], placeOfPerformStateCode, awardeeUniqueEntityId,
 *           q = free text. Response: { totalRecords, limit, offset, awardSummary[{ contractId, coreData,
 *           awardDetails }] }. Only the first 400,000 records are returned. Same key and daily limit as Opportunities.
 * UPDATED : 2026-10-19_2105 UTC — checked against the published OpenAPI spec: exact field paths first (name lookup
 *           as the fallback), server-side state filter, SAM date formats, page-or-record offset detection.
 * UPDATED : 2026-10-19_2140 UTC — subcontracting: the prime's size (contracting officer's determination), its
 *           subcontracting plan, phone and address; subFit (how good a prime is to subcontract under, now) and
 *           primeTargets (one row per prime to call, best first) with a call / email pitch (subPitch).
 */
import { GOV_NAICS_BY_CODE, METRO_CITIES, SET_ASIDES, offeredNaics, remoteNaics, samDate, servicesForNaics } from "./gov-contracts.ts";

export interface GovAward {
  award_key: string;
  piid: string;
  referenced_idv_piid: string | null;
  modification_number: string | null;
  agency: string | null;
  subtier: string | null;
  office: string | null;
  awardee: string | null;
  awardee_uei: string | null;
  awardee_city: string | null;
  awardee_state: string | null;
  awardee_phone: string | null;
  awardee_address: string | null;
  /** Contracting officer's size call for this award: "S" small business, "O" other than small. */
  awardee_size: string | null;
  /** Small-business subcontracting plan on this award (FAR 19.7), as SAM describes it. */
  subcontract_plan: string | null;
  naics: string | null;
  naics_title: string | null;
  psc: string | null;
  psc_title: string | null;
  set_aside_code: string | null;
  set_aside: string | null;
  description: string | null;
  solicitation_id: string | null;
  offers_received: number | null;
  date_signed: string | null;
  pop_start: string | null;
  current_end: string | null;
  ultimate_end: string | null;
  obligated: number | null;
  total_value: number | null;
  pop_city: string | null;
  pop_state: string | null;
  pop_zip: string | null;
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return v != null && String(v).trim() !== "" && Number.isFinite(n) ? n : null; };

/** Value at a dotted path, e.g. "contractId.piid". Arrays use their first item. */
function at(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const k of path.split(".")) {
    if (Array.isArray(cur)) cur = cur[0];
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}
/** First value found under any of these keys, searching the whole record breadth-first (nearest wins). */
function find(o: unknown, keys: string[]): unknown {
  const want = new Set(keys.map((k) => k.toLowerCase()));
  const queue: unknown[] = [o];
  for (let seen = 0; queue.length && seen < 5000; seen++) {
    const cur = queue.shift();
    if (Array.isArray(cur)) { queue.push(...cur); continue; }
    if (!isObj(cur)) continue;
    for (const [k, v] of Object.entries(cur)) if (want.has(k.toLowerCase()) && v != null && v !== "") return v;
    queue.push(...Object.values(cur));
  }
  return undefined;
}
/** SAM gives most coded fields as { code, name }; sometimes as a bare string. */
function codeName(v: unknown): { code: string | null; name: string | null } {
  if (Array.isArray(v)) v = v[0];
  if (isObj(v)) return { code: str(v.code), name: str(v.name) ?? str(v.description) };
  return { code: str(v), name: null };
}
/** SAM dates come as YYYY-MM-DD (often with a time) or MM/DD/YYYY: keep the calendar date as written. */
function date(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** One record from the Contract Awards search response (`awardSummary[]`) → our row. Null when there's no PIID. */
export function parseSamAward(r: Raw): GovAward | null {
  const cid = find(r, ["contractId"]);
  const piid = str(at(cid, "piid")) ?? str(find(r, ["piid"]));
  if (!piid) return null;
  const idv = str(at(cid, "referencedIDVPiid")) ?? str(find(r, ["referencedIDVPiid", "referencedIdvPiid"]));
  // exact paths from the OpenAPI spec first; a name search through the record if SAM moves something
  const contracting = at(r, "coreData.federalOrganization.contractingInformation") ?? find(r, ["contractingInformation"]) ?? r;
  const awardeeTree = at(r, "awardDetails.awardeeData") ?? find(r, ["awardeeData"]) ?? r;
  const header = at(awardeeTree, "awardeeHeader");
  const ueiInfo = at(awardeeTree, "awardeeUEIInformation");
  const loc = at(awardeeTree, "awardeeLocation") ?? find(awardeeTree, ["awardeeLocation"]);
  const pop = at(r, "coreData.principalPlaceOfPerformance") ?? find(r, ["principalPlaceOfPerformance", "placeOfPerformance"]);
  const psi = at(r, "awardDetails.productOrServiceInformation") ?? at(r, "coreData.productOrServiceInformation");
  const comp = at(r, "awardDetails.competitionInformation") ?? at(r, "coreData.competitionInformation");
  const dates = at(r, "awardDetails.dates");
  const naics = codeName(at(psi, "principalNaics") ?? find(r, ["principalNaics", "naicsCode"]));
  const psc = codeName(at(psi, "productOrService") ?? find(r, ["productOrService"]));
  const sa = codeName(at(comp, "typeOfSetAside") ?? find(r, ["typeOfSetAside"]));
  const total = at(r, "awardDetails.totalContractDollars") ?? find(r, ["totalContractDollars"]);
  const dollars = at(r, "awardDetails.dollars") ?? find(r, ["dollars"]);
  const prefs = at(r, "awardDetails.preferenceProgramsInformation") ?? at(r, "coreData.preferenceProgramsInformation") ?? find(r, ["preferenceProgramsInformation"]);
  const size = codeName(at(prefs, "contractingOfficerBusinessSizeDetermination"));
  const plan = codeName(at(prefs, "subcontractPlan"));
  const street = [str(at(loc, "streetAddress1")), str(at(loc, "streetAddress2"))].filter(Boolean).join(", ");
  const locState = codeName(find(loc, ["state", "stateCode"])).code;
  const locCity = codeName(find(loc, ["city"])).name ?? codeName(find(loc, ["city"])).code;
  const placeCity = find(pop, ["city"]);
  const placeState = find(pop, ["state", "stateCode"]);
  return {
    award_key: [idv, piid].filter(Boolean).join("/"),
    piid,
    referenced_idv_piid: idv,
    modification_number: str(at(cid, "modificationNumber")) ?? str(find(r, ["modificationNumber"])),
    agency: codeName(find(contracting, ["contractingDepartment", "department"])).name,
    subtier: codeName(find(contracting, ["contractingSubtier", "subtier"])).name ?? codeName(at(cid, "subtier")).name,
    office: codeName(find(contracting, ["contractingOffice", "office"])).name,
    awardee: str(at(header, "awardeeName")) ?? str(at(header, "legalBusinessName")) ?? str(find(awardeeTree, ["awardeeName", "legalBusinessName"])),
    awardee_uei: str(at(ueiInfo, "uniqueEntityId")) ?? str(find(awardeeTree, ["uniqueEntityId"])),
    awardee_city: locCity,
    awardee_state: locState,
    awardee_phone: str(at(loc, "phoneNumber")),
    awardee_address: [street, locCity, [locState, str(at(loc, "zip"))?.slice(0, 5)].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    awardee_size: size.code?.toUpperCase().slice(0, 1) ?? (size.name ? (/other than/i.test(size.name) ? "O" : /small/i.test(size.name) ? "S" : null) : null),
    subcontract_plan: plan.name ?? plan.code,
    naics: naics.code && /^\d{6}$/.test(naics.code) ? naics.code : null,
    naics_title: naics.name,
    psc: psc.code,
    psc_title: psc.name,
    set_aside_code: sa.code,
    set_aside: sa.name,
    description: str(at(psi, "descriptionOfContractRequirement") ?? find(r, ["descriptionOfContractRequirement"]))?.slice(0, 2000) ?? null,
    solicitation_id: str(at(r, "coreData.solicitationId") ?? find(r, ["solicitationId", "solicitationID"])),
    offers_received: num(at(comp, "numberOfOffersReceived") ?? find(r, ["numberOfOffersReceived"])),
    date_signed: date(at(dates, "dateSigned") ?? find(r, ["dateSigned"])),
    pop_start: date(at(dates, "periodOfPerformanceStartDate") ?? find(r, ["periodOfPerformanceStartDate"])),
    current_end: date(at(dates, "currentCompletionDate") ?? find(r, ["currentCompletionDate"])),
    ultimate_end: date(at(dates, "ultimateCompletionDate") ?? find(r, ["ultimateCompletionDate"])),
    obligated: num(at(total, "totalActionObligation")) ?? num(at(dollars, "actionObligation")) ?? num(find(r, ["totalActionObligation", "actionObligation"])),
    total_value: num(at(total, "totalBaseAndAllOptionsValue")) ?? num(at(dollars, "baseAndAllOptionsValue")) ?? num(find(r, ["totalBaseAndAllOptionsValue", "baseAndAllOptionsValue"])),
    pop_city: codeName(placeCity).name ?? codeName(placeCity).code,
    pop_state: codeName(placeState).code?.toUpperCase().slice(0, 2) ?? null,
    pop_zip: str(find(pop, ["zipCode", "zip"]))?.slice(0, 5) ?? null,
  };
}

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
const most = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));

/** One row per contract: the newest record's details, the latest end dates and the highest value seen. */
export function mergeAwards(rows: GovAward[]): GovAward[] {
  const by = new Map<string, GovAward>();
  for (const r of rows) {
    const p = by.get(r.award_key);
    if (!p) { by.set(r.award_key, r); continue; }
    const [newer, older] = (r.date_signed ?? "") >= (p.date_signed ?? "") ? [r, p] : [p, r];
    const fill = Object.fromEntries(Object.entries(newer).map(([k, v]) => [k, v ?? (older as unknown as Raw)[k] ?? null])) as unknown as GovAward;
    by.set(r.award_key, {
      ...fill,
      date_signed: older.date_signed ?? newer.date_signed, // when the contract was first signed
      pop_start: older.pop_start ?? newer.pop_start,
      current_end: later(r.current_end, p.current_end),
      ultimate_end: later(r.ultimate_end, p.ultimate_end),
      total_value: most(r.total_value, p.total_value),
      obligated: most(r.obligated, p.obligated),
    });
  }
  return [...by.values()];
}

/** Months from `now` until the contract (with every option) ends. Null when SAM doesn't say. */
export function monthsToEnd(a: Pick<GovAward, "ultimate_end" | "current_end">, now = new Date()): number | null {
  const end = a.ultimate_end ?? a.current_end;
  return end ? Math.round(((new Date(end).getTime() - now.getTime()) / (30.44 * 86400000)) * 10) / 10 : null;
}

export interface RecompeteFit { score: number; services: string[]; months: number | null; reasons: string[]; flags: string[] }

/**
 * How good a lead this contract is for us (0–100). Agencies usually post the follow-on 3–12 months before the end,
 * so a contract ending in 3–18 months is the window to research the incumbent, meet the contracting office and
 * answer the sources-sought notice.
 */
export function recompeteFit(a: GovAward, opts: { homeState?: string; now?: Date; certifications?: string[] } = {}): RecompeteFit {
  const home = (opts.homeState ?? "MI").toUpperCase();
  const certs = new Set((opts.certifications ?? []).map((c) => c.toUpperCase()));
  const services = servicesForNaics(a.naics);
  const months = monthsToEnd(a, opts.now);
  const reasons: string[] = [];
  const flags: string[] = [];
  let score = 0;
  if (offeredNaics(a.naics)) { score += 35; reasons.push(`NAICS ${a.naics}: ${GOV_NAICS_BY_CODE[a.naics!].title}`); }
  else flags.push(`NAICS ${a.naics ?? "—"} isn't work we offer yet`);
  const city = (a.pop_city ?? "").toLowerCase();
  if (remoteNaics(a.naics)) { score += 35; reasons.push("Remote work: we can deliver it from anywhere"); }
  else if (a.pop_state === home) {
    score += 20; reasons.push(`In ${home}`);
    if (METRO_CITIES.some((c) => city.includes(c))) { score += 15; reasons.push(`Metro Detroit (${a.pop_city})`); }
  } else if (a.pop_state) flags.push(`Work is in ${a.pop_state}${a.pop_city ? ` (${a.pop_city})` : ""}`);
  if (months == null) flags.push("No end date listed");
  else if (months < 0) { score -= 30; flags.push("Already ended — check SAM.gov opportunities for the follow-on"); }
  else if (months < 3) { score += 5; flags.push(`Ends in ${months} months: the follow-on may already be posted`); }
  else if (months <= 18) { score += 25; reasons.push(`Ends in ${months} months: the re-bid window`); }
  else if (months <= 36) { score += 10; reasons.push(`Ends in ${months} months: watch it`); }
  else flags.push(`Runs another ${Math.round(months / 12)} years`);
  const sa = a.set_aside_code ? SET_ASIDES[a.set_aside_code] : undefined;
  if (!a.set_aside_code || /^(none|no set aside)/i.test(a.set_aside ?? a.set_aside_code)) { score += 5; reasons.push("Was open to all bidders"); }
  else if (sa?.kind === "small") { score += 5; reasons.push(`${sa.label}: small businesses (Handled once registered)`); }
  else if (sa && certs.has(a.set_aside_code)) { score += 5; reasons.push(`${sa.label}: we hold this certification`); }
  else if (sa) { score -= 15; flags.push(`${sa.label} last time — the re-bid may need that certification`); }
  if (a.offers_received === 1) { score += 5; reasons.push("Only one offer last time — little competition"); }
  if (a.total_value != null) reasons.push(`Worth up to ${usd(a.total_value)} with options`);
  return { score: Math.max(0, Math.min(100, score)), services, months, reasons, flags };
}

const usd = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;

export interface Incumbent { awardee: string; uei: string | null; contracts: number; total_value: number; naics: string[]; next_end: string | null }

/** Who holds the work: one row per awardee, biggest total value first. */
export function incumbents(rows: GovAward[], now = new Date()): Incumbent[] {
  const by = new Map<string, Incumbent>();
  const today = now.toISOString().slice(0, 10);
  for (const r of rows) {
    if (!r.awardee) continue;
    const k = r.awardee_uei ?? r.awardee.toLowerCase();
    const i = by.get(k) ?? { awardee: r.awardee, uei: r.awardee_uei, contracts: 0, total_value: 0, naics: [], next_end: null };
    i.contracts++;
    i.total_value += r.total_value ?? 0;
    if (r.naics && !i.naics.includes(r.naics)) i.naics.push(r.naics);
    const end = r.ultimate_end ?? r.current_end;
    if (end && end >= today && (!i.next_end || end < i.next_end)) i.next_end = end;
    by.set(k, i);
  }
  return [...by.values()].sort((a, b) => b.total_value - a.total_value || b.contracts - a.contracts);
}

export interface AwardSearch { naics?: string[]; state?: string | null; keywords?: string | null; monthsBack?: number; awardeeUei?: string | null; now?: Date }
export const AWARDS_PAGE_SIZE = 100;

/**
 * The query string for one page (without the API key). Every NAICS code goes in the same call (joined with "~"),
 * and the state is filtered by SAM (placeOfPerformStateCode), so a search costs one call per page of 100.
 */
export function awardSearchQuery(s: AwardSearch, offset: number): string {
  const now = s.now ?? new Date();
  const months = Math.min(60, Math.max(1, Math.round(s.monthsBack ?? 24)));
  const from = new Date(now); from.setUTCMonth(from.getUTCMonth() - months);
  const q: Record<string, string> = { dateSigned: `[${samDate(from)},${samDate(now)}]`, limit: String(AWARDS_PAGE_SIZE), offset: String(Math.max(0, Math.round(offset))) };
  const codes = [...new Set((s.naics ?? []).filter((c) => /^\d{6}$/.test(c)))].slice(0, 100);
  if (codes.length) q.naicsCode = codes.join("~");
  if (s.state && /^[A-Za-z]{2}$/.test(s.state.trim())) q.placeOfPerformStateCode = s.state.trim().toUpperCase();
  if (s.keywords?.trim()) q.q = s.keywords.trim().slice(0, 100);
  if (s.awardeeUei && /^[A-Z0-9]{12}$/i.test(s.awardeeUei.trim())) q.awardeeUniqueEntityId = s.awardeeUei.trim().toUpperCase();
  return new URLSearchParams(q).toString();
}

export type AwardOffsetMode = "page" | "record";

/**
 * The offset for the next call. The spec doesn't say whether `offset` counts pages or records, so we start as pages
 * (0, 1, 2…) and check the second page: if it brought back almost nothing new (records 1–100 instead of 101–200),
 * SAM counts records, and the next offset is how many we've seen. If it repeated page one exactly (pages start at
 * 1), the page count simply carries on.
 */
export function nextAwardOffset(o: { calls: number; mode: AwardOffsetMode; seen: number; newOnLastPage: number; lastPageSize: number }): { offset: number; mode: AwardOffsetMode } {
  let mode = o.mode;
  if (o.calls === 2 && mode === "page" && o.lastPageSize >= AWARDS_PAGE_SIZE && o.newOnLastPage > 0 && o.newOnLastPage <= 2) mode = "record";
  return { offset: mode === "record" ? o.seen : o.calls, mode };
}

/**
 * The award carries a small-business subcontracting plan (FAR 19.7) — the prime has goals for using small businesses.
 * SAM's values: Plan Not Included – No Subcontracting Possibilities, Plan Not Required, Plan Required – Incentive (Not)
 * Included, Plan Required (Pre 2004), Individual / Commercial / DoD Comprehensive Subcontract Plan.
 */
export const hasSubPlan = (a: Pick<GovAward, "subcontract_plan">) => Boolean(a.subcontract_plan && /required|individual|commercial|comprehensive/i.test(a.subcontract_plan) && !/not required|plan not included/i.test(a.subcontract_plan));

export interface SubFit { score: number; months: number | null; reasons: string[]; flags: string[] }

/**
 * How good this contract is for us to subcontract under, now (0–100). The prime is doing the work today; what
 * matters is our trade, the place, a big business that has to give small businesses a share (a subcontracting
 * plan), and enough time left on the contract to bring us in.
 */
export function subFit(a: GovAward, opts: { homeState?: string; now?: Date } = {}): SubFit {
  const home = (opts.homeState ?? "MI").toUpperCase();
  const months = monthsToEnd(a, opts.now);
  const reasons: string[] = [];
  const flags: string[] = [];
  let score = 0;
  if (offeredNaics(a.naics)) { score += 20; reasons.push(`${GOV_NAICS_BY_CODE[a.naics!].title} (NAICS ${a.naics})`); }
  else flags.push(`NAICS ${a.naics ?? "—"} isn't work we do yet`);
  if (remoteNaics(a.naics)) { score += 30; reasons.push("Remote work: we can deliver it from anywhere"); }
  else if (a.pop_state === home) {
    score += 20; reasons.push(`Work is in ${home}`);
    if (METRO_CITIES.some((c) => (a.pop_city ?? "").toLowerCase().includes(c))) { score += 10; reasons.push(`Metro Detroit (${a.pop_city})`); }
  } else if (a.pop_state) flags.push(`Work is in ${a.pop_state}`);
  if (a.awardee_size === "O") { score += 20; reasons.push("Large business prime: it counts small-business subcontracts toward its goals"); }
  else if (a.awardee_size === "S") { score += 5; reasons.push("Small-business prime: may need local crews to cover sites or surge work"); }
  if (hasSubPlan(a)) { score += 15; reasons.push("Has a small-business subcontracting plan"); }
  if (months == null) flags.push("No end date listed");
  else if (months < 0) flags.push("Contract has ended");
  else if (months >= 6) { score += 15; reasons.push(`${months} months left on the contract`); }
  else { score += 5; flags.push(`Only ${months} months left: pitch the prime for the re-bid instead`); }
  if (a.naics?.startsWith("23")) flags.push("Construction: Davis-Bacon wages with weekly certified payrolls, and the prime may require payment and performance bonds from subs");
  const sa = a.set_aside_code ? SET_ASIDES[a.set_aside_code] : undefined;
  if (sa) flags.push(`${sa.label}: the prime may only pass a limited share of the work to subcontractors that aren't similarly situated (FAR 52.219-14) — a small subcontractor is easier for them`);
  if (a.total_value != null && a.total_value >= 750_000) { score += 5; reasons.push(`Worth ${usd(a.total_value)} with options`); }
  if (months != null && months < 0) score = Math.min(score, 10); // the prime is done: nothing to subcontract on
  return { score: Math.max(0, Math.min(100, score)), months, reasons, flags };
}

export interface PrimeTarget {
  awardee: string; uei: string | null; size: string | null; phone: string | null; address: string | null;
  contracts: number; active_value: number; sub_plan: boolean; naics: string[]; agencies: string[]; places: string[];
  best_score: number; next_end: string | null; keys: string[];
}

/** One row per prime contractor with active work we could subcontract on, best target first. */
export function primeTargets(rows: (GovAward & { sub_score?: number | null })[], now = new Date()): PrimeTarget[] {
  const by = new Map<string, PrimeTarget>();
  for (const r of rows) {
    if (!r.awardee) continue;
    const m = monthsToEnd(r, now);
    if (m != null && m < 0) continue;
    const k = r.awardee_uei ?? r.awardee.toLowerCase();
    const t = by.get(k) ?? { awardee: r.awardee, uei: r.awardee_uei, size: r.awardee_size, phone: r.awardee_phone, address: r.awardee_address, contracts: 0, active_value: 0, sub_plan: false, naics: [], agencies: [], places: [], best_score: 0, next_end: null, keys: [] };
    t.contracts++;
    t.active_value += r.total_value ?? 0;
    t.sub_plan ||= hasSubPlan(r);
    t.size ??= r.awardee_size; t.phone ??= r.awardee_phone; t.address ??= r.awardee_address;
    for (const [list, v] of [[t.naics, r.naics], [t.agencies, r.subtier ?? r.agency], [t.places, [r.pop_city, r.pop_state].filter(Boolean).join(", ")]] as const) if (v && !list.includes(v)) list.push(v);
    t.best_score = Math.max(t.best_score, r.sub_score ?? 0);
    const end = r.ultimate_end ?? r.current_end;
    if (end && (!t.next_end || end < t.next_end)) t.next_end = end;
    t.keys.push(r.award_key);
    by.set(k, t);
  }
  return [...by.values()].sort((a, b) => b.best_score - a.best_score || b.active_value - a.active_value);
}

/** A short call / email opener for a prime's small-business liaison or project manager. Plain text, no promises. */
export function subPitch(t: PrimeTarget, from: { company: string; city?: string; trades?: string[] }): string {
  const trades = (t.naics.map((c) => GOV_NAICS_BY_CODE[c]?.title.toLowerCase()).filter(Boolean) as string[]);
  const work = trades.length ? trades.join(", ") : (from.trades ?? []).join(", ");
  return [
    `Subject: Local ${work || "facility services"} subcontractor for your ${t.agencies[0] ?? "federal"} work${t.places[0] ? ` in ${t.places[0]}` : ""}`,
    "",
    "Hello,",
    "",
    `I'm with ${from.company}${from.city ? ` in ${from.city}` : ""}. We see ${t.awardee} holds federal ${work || "facility"} work${t.places.length ? ` in ${t.places.slice(0, 3).join("; ")}` : ""}. We're a small business with vetted local crews for ${work || "this work"}, and we'd like to support you as a subcontractor: covering sites, surge and weather work, or backup when your team is stretched.`,
    "",
    t.sub_plan ? "If you're tracking small-business subcontracting goals on these contracts, we can help you meet them." : "If you use small-business subcontractors, we'd like to be on your list.",
    "",
    "Who handles subcontractor onboarding for these contracts? I can send our capability statement, insurance certificates and references.",
    "",
    "Thank you,",
    from.company,
  ].join("\n");
}
