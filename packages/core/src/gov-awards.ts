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
 */
import { GOV_NAICS_BY_CODE, METRO_CITIES, SET_ASIDES, samDate, servicesForNaics } from "./gov-contracts.ts";

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
    awardee_city: codeName(find(loc, ["city"])).name ?? codeName(find(loc, ["city"])).code,
    awardee_state: codeName(find(loc, ["state", "stateCode"])).code,
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
  if (services.length) { score += 35; reasons.push(`NAICS ${a.naics}: ${GOV_NAICS_BY_CODE[a.naics!].title}`); }
  else flags.push(`NAICS ${a.naics ?? "—"} isn't work we offer yet`);
  const city = (a.pop_city ?? "").toLowerCase();
  if (a.pop_state === home) {
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
