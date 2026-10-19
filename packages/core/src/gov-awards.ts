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
 *             awardSearchQueries — the query strings (the API key is added server-side, never stored)
 *           SAM.gov API: GET https://api.sam.gov/contract-awards/v1/search — limit ≤ 100 per page, offset, naicsCode
 *           (several codes joined with "~" = OR, so one call covers every code), dateSigned=[MM/dd/yyyy,MM/dd/yyyy],
 *           q = free text. Only the first 400,000 records are returned. The same key and daily call limit as the
 *           Opportunities API. Place of performance is filtered on our side.
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
const date = (v: unknown) => { const s = str(v); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); };

/** One record from the Contract Awards search response (`awardSummary[]`) → our row. Null when there's no PIID. */
export function parseSamAward(r: Raw): GovAward | null {
  const cid = find(r, ["contractId"]);
  const piid = str(at(cid, "piid")) ?? str(find(r, ["piid"]));
  if (!piid) return null;
  const idv = str(at(cid, "referencedIDVPiid")) ?? str(find(r, ["referencedIDVPiid", "referencedIdvPiid"]));
  const contracting = find(r, ["contractingInformation"]) ?? r;
  const awardeeTree = find(r, ["awardeeData", "awardee"]) ?? r;
  const loc = find(awardeeTree, ["awardeeLocation", "physicalAddress", "address"]);
  const pop = find(r, ["placeOfPerformance", "principalPlaceOfPerformance"]);
  const naics = codeName(find(r, ["principalNaics", "naics", "naicsCode"]));
  const psc = codeName(find(r, ["productOrService", "productOrServiceCode", "psc"]));
  const sa = codeName(find(r, ["typeOfSetAside"]));
  const total = find(r, ["totalContractDollars"]);
  const dollars = find(r, ["dollars"]);
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
    awardee: str(find(awardeeTree, ["awardeeName", "legalBusinessName", "vendorName"])),
    awardee_uei: str(find(awardeeTree, ["uniqueEntityId", "awardeeUniqueEntityId", "uei"])),
    awardee_city: codeName(find(loc, ["city"])).name ?? codeName(find(loc, ["city"])).code,
    awardee_state: codeName(find(loc, ["state", "stateCode"])).code,
    naics: naics.code && /^\d{6}$/.test(naics.code) ? naics.code : null,
    naics_title: naics.name,
    psc: psc.code,
    psc_title: psc.name,
    set_aside_code: sa.code,
    set_aside: sa.name,
    description: str(find(r, ["descriptionOfContractRequirement", "description"]))?.slice(0, 2000) ?? null,
    solicitation_id: str(find(r, ["solicitationIdentifier", "solicitationId", "solicitationID"])),
    offers_received: num(find(r, ["numberOfOffersReceived"])),
    date_signed: date(find(r, ["dateSigned"])),
    pop_start: date(find(r, ["periodOfPerformanceStartDate", "effectiveDate"])),
    current_end: date(find(r, ["currentCompletionDate"])),
    ultimate_end: date(find(r, ["ultimateCompletionDate"])),
    obligated: num(at(total, "totalActionObligation")) ?? num(at(dollars, "actionObligation")) ?? num(find(r, ["totalActionObligation", "actionObligation"])),
    total_value: num(at(total, "totalBaseAndAllOptionsValue")) ?? num(at(dollars, "baseAndAllOptionsValue")) ?? num(find(r, ["totalBaseAndAllOptionsValue", "baseAndAllOptionsValue"])),
    pop_city: codeName(placeCity).name ?? codeName(placeCity).code,
    pop_state: codeName(placeState).code?.toUpperCase().slice(0, 2) ?? null,
    pop_zip: str(find(pop, ["zip", "zipCode", "zip5"])),
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

export interface AwardSearch { naics?: string[]; keywords?: string | null; monthsBack?: number; awardeeUei?: string | null; pages?: number; now?: Date }
export const AWARDS_PAGE_SIZE = 100;

/**
 * Query strings (without the API key), one per page. Every NAICS code goes in one call (joined with "~"), so a
 * search costs `pages` calls at most — callers stop early when a page comes back short.
 */
export function awardSearchQueries(s: AwardSearch): string[] {
  const now = s.now ?? new Date();
  const months = Math.min(60, Math.max(1, Math.round(s.monthsBack ?? 24)));
  const from = new Date(now); from.setUTCMonth(from.getUTCMonth() - months);
  const base: Record<string, string> = { dateSigned: `[${samDate(from)},${samDate(now)}]`, limit: String(AWARDS_PAGE_SIZE) };
  const codes = [...new Set((s.naics ?? []).filter((c) => /^\d{6}$/.test(c)))].slice(0, 100);
  if (codes.length) base.naicsCode = codes.join("~");
  if (s.keywords?.trim()) base.q = s.keywords.trim().slice(0, 100);
  if (s.awardeeUei && /^[A-Z0-9]{12}$/i.test(s.awardeeUei.trim())) base.awardeeUniqueEntityId = s.awardeeUei.trim().toUpperCase();
  const pages = Math.min(20, Math.max(1, Math.round(s.pages ?? 3)));
  return Array.from({ length: pages }, (_, i) => new URLSearchParams({ ...base, offset: String(i * AWARDS_PAGE_SIZE) }).toString());
}
