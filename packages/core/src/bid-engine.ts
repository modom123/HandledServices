/*
 * FILE    : packages/core/src/bid-engine.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : The bid engine — how we decide, price and submit public contract bids the same careful way every time.
 *             GO_NO_GO / goDecision    — five must-pass questions (eligible, staffed, insured, profitable, time) + fit
 *             STANDARD_REQUIREMENTS    — compliance items every bid of a source needs (SAM, City of Detroit, other public)
 *             priceBid                 — bottom-up pricing: pro cost per unit + materials, loaded with supervision,
 *                                        insurance, admin, contingency, bonds and the cost of waiting to be paid,
 *                                        then margin on price; per-unit price, yearly and contract totals, warnings
 *             bestQuotes               — the lowest price pros committed to per line, and whether a backup pro exists
 *             REVIEW_CHECKS / submitGate — the review checklist and everything that must be true before "submitted"
 *             SOLICITATION_TYPES / RESUBMIT_REASONS / compareSubmissions — the archive: every RFP / RFQ kept, every
 *                                        submission frozen as a numbered version, and what changed between versions
 *           Pure functions: the Hub (Hub → Bids) and tests use the same math, so the number on screen is the number
 *           we bid. Pros are independent businesses: their prices are their own quotes, never set by us.
 * UPDATED : 2026-10-05_2043 UTC — archive: solicitation types, resubmission reasons, compareSubmissions.
 * UPDATED : 2026-10-07_0250 UTC — measurements and deal-making:
 *             catalogCost      — a line with a real measurement (12 acres, 40 cu yd, 600 lb, 8,000 sq ft) and one of our
 *                                services gets an estimated pro cost from our own pricing engine until a pro quotes
 *             dealStrategy     — walk-away (margin floor), target, and the recommended price that maximizes expected
 *                                profit = P(win) × profit, using the last award as the market anchor; bigger contracts
 *                                earn a slightly thinner target (volume), never below the floor
 *             negotiate        — an agency counter or BAFO: accept, counter (with what to trade instead of price), or walk
 *             learnMarketRates / marketBenchmark — what customers actually PAID us (paid jobs and invoices, last 12 months):
 *                                median job price per service and median price per measured unit ($/sq ft, $/cu yd…);
 *                                the deal-maker anchors on it when there's no award history, and blends it in when there is
 */
import { estimate, splitJob } from "./pricing.ts";
import { getService } from "./services.ts";

export type BidSource = "sam" | "city" | "county" | "state" | "school" | "private" | "other";
export const BID_SOURCES: Record<BidSource, string> = {
  sam: "Federal (SAM.gov)", city: "City", county: "County", state: "State of Michigan", school: "School / college", private: "Private / institutional", other: "Other public",
};

/** What kind of solicitation it is (shown on the archive and every record). */
export type SolicitationType = "rfq" | "rfp" | "ifb" | "rfi" | "sources_sought" | "other";
export const SOLICITATION_TYPES: Record<SolicitationType, string> = {
  rfq: "RFQ — request for quotes", rfp: "RFP — request for proposals", ifb: "IFB / ITB — invitation for bids", rfi: "RFI — request for information", sources_sought: "Sources sought", other: "Other",
};

/** Why a bid is being sent again. */
export type ResubmitReason = "correction" | "addendum" | "agency_request" | "bafo" | "price_update";
export const RESUBMIT_REASONS: Record<ResubmitReason, string> = {
  correction: "Correction before the deadline", addendum: "Addendum issued — revised response", agency_request: "Agency asked for clarification / revision",
  bafo: "Best and final offer (BAFO)", price_update: "Price or scope update",
};

export interface SnapshotLine { id: string; item: string; unit: string; qty: number; years: number; unitPrice: number; totalPrice: number; marginPct: number }

/** What changed between two submitted versions: per-line unit prices, lines added or removed, and the total. */
export function compareSubmissions(prev: { lines: SnapshotLine[]; total: number }, next: { lines: SnapshotLine[]; total: number }) {
  const key = (l: SnapshotLine) => `${l.item.trim().toLowerCase()}|${l.unit.trim().toLowerCase()}`;
  const before = new Map(prev.lines.map((l) => [key(l), l]));
  const after = new Map(next.lines.map((l) => [key(l), l]));
  const changed = next.lines.filter((l) => before.has(key(l)) && (before.get(key(l))!.unitPrice !== l.unitPrice || before.get(key(l))!.qty !== l.qty))
    .map((l) => { const b = before.get(key(l))!; return { item: l.item, unit: l.unit, from: b.unitPrice, to: l.unitPrice, qtyFrom: b.qty, qtyTo: l.qty }; });
  const added = next.lines.filter((l) => !before.has(key(l))).map((l) => l.item);
  const removed = prev.lines.filter((l) => !after.has(key(l))).map((l) => l.item);
  const diff = Math.round((next.total - prev.total) * 100) / 100;
  return { changed, added, removed, totalFrom: prev.total, totalTo: next.total, diff, pct: prev.total > 0 ? Math.round((diff / prev.total) * 1000) / 10 : 0 };
}

export type BidStatus = "draft" | "no_bid" | "pricing" | "review" | "ready" | "submitted" | "won" | "lost" | "cancelled";
export const BID_STATUS_LABEL: Record<BidStatus, string> = {
  draft: "Deciding", no_bid: "No bid", pricing: "Pricing", review: "In review", ready: "Ready to submit", submitted: "Submitted", won: "Won", lost: "Lost", cancelled: "Cancelled",
};

// ───────────────────────────── 1. Go / no-go ─────────────────────────────

export type GoAnswer = "yes" | "no" | "unsure";
export const GO_NO_GO: { id: string; q: string; help: string; mustPass: boolean }[] = [
  { id: "eligible", q: "Are we eligible to bid?", help: "Approved vendor list or schedule (e.g. a city supply schedule), set-aside and certifications, registrations (SAM.gov, the agency's supplier portal), tax clearances. Read the eligibility section first — an ineligible bid is thrown out unread.", mustPass: true },
  { id: "staffed", q: "Will pros commit to this work, in this area, for the whole term — with a backup?", help: "At least one pro per service line has sent a written price and capacity, and a second can cover if the first drops out.", mustPass: true },
  { id: "insured", q: "Can we meet the insurance and bonding requirements?", help: "Limits, additional insured wording, workers' comp, bid / performance / payment bonds. Check with the broker before pricing.", mustPass: true },
  { id: "profitable", q: "Can we make our target margin at a price that can win?", help: "Bottom-up price (pricing section) against what this work went for last time (award notices, published bid tabs).", mustPass: true },
  { id: "time", q: "Is there time to do it right?", help: "Pro quotes, every form, a second-person review and submitting a day early — before the deadline.", mustPass: true },
  { id: "fit", q: "Is it work we want?", help: "Our services, our area, a client worth keeping, a size we can handle without starving other customers.", mustPass: false },
];

export function goDecision(answers: Record<string, GoAnswer | undefined>) {
  const blockers = GO_NO_GO.filter((g) => g.mustPass && answers[g.id] === "no").map((g) => g.q);
  const open = GO_NO_GO.filter((g) => !answers[g.id] || answers[g.id] === "unsure").map((g) => g.q);
  const decision: "go" | "no_go" | "undecided" = blockers.length ? "no_go" : GO_NO_GO.filter((g) => g.mustPass).every((g) => answers[g.id] === "yes") ? "go" : "undecided";
  return { decision, blockers, open };
}

// ───────────────────────────── 2. Compliance ─────────────────────────────

export type ReqKind = "eligibility" | "form" | "requirement" | "insurance" | "price_form" | "deadline" | "question" | "attachment" | "evaluation";
export const REQ_KIND_LABEL: Record<ReqKind, string> = {
  eligibility: "Eligibility", form: "Forms & signatures", requirement: "Scope & response requirements", insurance: "Insurance & bonds", price_form: "Price form",
  deadline: "Dates & deadlines", question: "Questions to ask", attachment: "Attachments", evaluation: "How it's scored",
};

const R = (kind: ReqKind, text: string) => ({ kind, text });
/** Items every bid from this source needs, whatever the solicitation says (the AI reading adds the rest). */
export function standardRequirements(source: BidSource): { kind: ReqKind; text: string }[] {
  const common = [
    R("form", "Every page / form that asks for a signature is signed and dated by an authorized officer"),
    R("form", "Every addendum acknowledged (signed acknowledgment or as the solicitation says)"),
    R("price_form", "Prices entered on the agency's own price form, in its units, totals rechecked"),
    R("insurance", "Certificate of insurance meets every limit and names the agency as additional insured (as required)"),
    R("attachment", "References and any required past-performance, staffing or subcontractor lists attached"),
    R("deadline", "Response uploaded at least one business day before the deadline; confirmation saved"),
  ];
  if (source === "sam") return [
    R("eligibility", "SAM.gov entity registration active (UEI), NAICS code listed, reps & certs current"),
    R("eligibility", "Size standard met for the NAICS code (if a small-business set-aside)"),
    R("eligibility", "Limits on subcontracting can be met (set-asides): pros' small-business status confirmed in writing"),
    R("requirement", "Wage determination (Service Contract Act / Davis-Bacon) priced in for every worker"),
    R("form", "SF-1449 / SF-18 / SF-33 (whichever the solicitation uses) completed and signed"),
    ...common,
  ];
  if (source === "city") return [
    R("eligibility", "Approved for the schedule / prequalified vendor list the solicitation requires"),
    R("eligibility", "Supplier portal registration current"),
    R("eligibility", "City income tax and property tax clearances current"),
    R("form", "City affidavits and disclosures in the package (equal opportunity, hiring policy, political contributions, other city-code disclosures)"),
    R("attachment", "Local business certification (e.g. Detroit-Based / Headquartered Business) attached if held"),
    ...common,
  ];
  return [R("eligibility", "Registered as a vendor with the agency (portal / vendor form) and on any required prequalified list"), ...common];
}

// ───────────────────────────── 3. Pricing ─────────────────────────────

export interface BidAssumptions {
  /** Supervision, scheduling and quality checks, % of direct cost. */
  supervisionPct: number;
  /** Extra insurance for this contract, % of direct cost. */
  insurancePct: number;
  /** Admin, reporting, invoicing, % of direct cost. */
  adminPct: number;
  /** Weather, re-dos, price creep over the term, % of direct cost. */
  contingencyPct: number;
  /** Bid / performance / payment bonds, % of direct cost (0 if none). */
  bondPct: number;
  /** Days between paying the pro and the agency paying us. */
  paymentDays: number;
  /** Yearly cost of carrying that money (line of credit rate), %. */
  costOfMoneyPct: number;
  /** Our margin, % of the price. */
  marginPct: number;
  /** Round each unit price up to this ($1 = whole dollars). */
  roundTo: number;
}
export const DEFAULT_ASSUMPTIONS: BidAssumptions = { supervisionPct: 8, insurancePct: 3, adminPct: 4, contingencyPct: 5, bondPct: 0, paymentDays: 45, costOfMoneyPct: 12, marginPct: 15, roundTo: 1 };
/** Never bid below this margin without an owner's override. */
export const MIN_MARGIN_PCT = 8;

export interface CostLine {
  id: string;
  item: string;
  unit: string;
  /** Expected units per year (visits, events, trees…). */
  qty: number;
  years: number;
  /** What the pro charges us per unit (their quote). */
  pro_unit_cost: number | null;
  /** Our materials / disposal per unit, if not in the pro's price. */
  materials_unit?: number | null;
  /** What this unit went for last time (award notice, bid tab), if known. */
  benchmark?: number | null;
  /** Our catalog service for this line (lets the engine estimate cost from a measurement). */
  slug?: string | null;
  /** The size of ONE unit of work: e.g. a mowing visit of 12 acres, a clean-out of 40 cu yd. */
  measure_size?: number | null;
  measure_unit?: string | null;
}

export interface PricedLine extends CostLine {
  direct: number; loaded: number; unitPrice: number; unitProfit: number; marginPct: number;
  yearPrice: number; totalPrice: number; totalCost: number; totalProfit: number; flags: string[];
  /** where the pro cost came from */
  costSource: "pro_quote" | "catalog_estimate" | "none";
  /** the deal-maker's advice for this line (when there's a cost) */
  deal: DealStrategy | null;
}

// ─── Measurements → cost ─────────────────────────────────────────────────────

/** Units a solicitation uses, converted to the units our catalog asks in. */
const UNIT_ALIASES: Record<string, { to: string; factor: number }> = {
  "sq ft": { to: "sq ft", factor: 1 }, sqft: { to: "sq ft", factor: 1 }, sf: { to: "sq ft", factor: 1 }, "square feet": { to: "sq ft", factor: 1 },
  "sq yd": { to: "sq ft", factor: 9 }, acre: { to: "sq ft", factor: 43560 }, acres: { to: "sq ft", factor: 43560 }, ac: { to: "sq ft", factor: 43560 },
  ft: { to: "ft", factor: 1 }, lf: { to: "ft", factor: 1 }, "linear ft": { to: "ft", factor: 1 }, feet: { to: "ft", factor: 1 },
  lb: { to: "lb", factor: 1 }, lbs: { to: "lb", factor: 1 }, pounds: { to: "lb", factor: 1 }, ton: { to: "lb", factor: 2000 }, tons: { to: "lb", factor: 2000 },
  "cu yd": { to: "cu yd", factor: 1 }, cy: { to: "cu yd", factor: 1 }, "cubic yards": { to: "cu yd", factor: 1 }, in: { to: "in", factor: 1 },
};
export const MEASURE_UNITS = ["sq ft", "acre", "sq yd", "ft", "lb", "ton", "cu yd", "in"] as const;

/**
 * Estimated cost of one unit of work from our own pricing engine: put the measurement into the service's matching
 * question (acres → sq ft, tons → lb), price it, and take the pro's share. null when the service has no such question.
 */
export function catalogCost(slug: string | null | undefined, size: number | null | undefined, unit: string | null | undefined): { retail: number; proCost: number; question: string } | null {
  const svc = slug ? getService(slug) : null;
  const conv = unit ? UNIT_ALIASES[unit.trim().toLowerCase()] : undefined;
  if (!svc || !conv || !(Number(size) > 0)) return null;
  const q = svc.questions.find((x) => x.type === "number" && (x.unit ?? "").toLowerCase() === conv.to);
  if (!q || q.type !== "number") return null;
  const value = Math.round(Number(size) * conv.factor);
  const retail = estimate({ slug: svc.slug, answers: { [q.id]: value } }).point;
  return { retail, proCost: splitJob(retail, svc.slug).payout, question: q.label };
}

// ─── Market learning (what customers actually paid) ──────────────────────────

export type MarketRate = { slug: string; n: number; medianJob: number; perUnit: number | null; unit: string | null; nMeasured: number };
const median = (xs: number[]) => { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
/** Fewer paid jobs than this and a rate isn't trusted. */
export const MARKET_MIN_JOBS = 3;

/** From paid jobs (price the customer paid + their answers), learn each service's market price. */
export function learnMarketRates(rows: { slug: string; price: number; answers?: Record<string, unknown> | null }[]): Record<string, MarketRate> {
  const by = new Map<string, { prices: number[]; perUnit: number[]; unit: string | null }>();
  for (const r of rows) {
    const svc = getService(r.slug);
    if (!svc || !(Number(r.price) > 0)) continue;
    const e = by.get(r.slug) ?? { prices: [], perUnit: [], unit: null };
    e.prices.push(Number(r.price));
    // the service's main measurement (the first required one, else the first sized number question)
    const q = svc.questions.find((x) => x.type === "number" && x.required) ?? svc.questions.find((x) => x.type === "number" && ["sq ft", "ft", "lb", "cu yd"].includes(x.unit ?? ""));
    const size = q ? Number(r.answers?.[q.id] ?? 0) : 0;
    if (q && q.type === "number" && size > 0) { e.perUnit.push(Number(r.price) / size); e.unit = q.unit ?? null; }
    by.set(r.slug, e);
  }
  const out: Record<string, MarketRate> = {};
  for (const [slug, e] of by) {
    if (e.prices.length < MARKET_MIN_JOBS) continue;
    out[slug] = { slug, n: e.prices.length, medianJob: Math.round(median(e.prices) * 100) / 100, perUnit: e.perUnit.length >= MARKET_MIN_JOBS ? Math.round(median(e.perUnit) * 10000) / 10000 : null, unit: e.perUnit.length >= MARKET_MIN_JOBS ? e.unit : null, nMeasured: e.perUnit.length };
  }
  return out;
}

/** What the market pays for ONE unit of this line, from our paid jobs (sized when we can), or null. */
export function marketBenchmark(line: Pick<CostLine, "slug" | "measure_size" | "measure_unit">, rates?: Record<string, MarketRate> | null): number | null {
  const r = line.slug && rates ? rates[line.slug] : undefined;
  if (!r) return null;
  const conv = line.measure_unit ? UNIT_ALIASES[line.measure_unit.trim().toLowerCase()] : undefined;
  if (r.perUnit && r.unit && conv && conv.to === r.unit && Number(line.measure_size) > 0) return Math.round(r.perUnit * Number(line.measure_size) * conv.factor * 100) / 100;
  return r.medianJob;
}

// ─── Deal-making ─────────────────────────────────────────────────────────────

export interface DealStrategy {
  floorPrice: number;        // walk-away: the margin floor
  targetPrice: number;       // our target margin (thinner for big contracts)
  recommended: number;       // maximizes P(win) × profit
  winProb: number;           // 0–1 at the recommended price
  expectedProfit: number;    // per unit, P(win) × profit
  marginPct: number;         // at the recommended price
  notes: string[];
}

/** Chance of winning at a price: 50% at the market anchor (last award), steeper when we know the market. */
export function winProbability(price: number, anchor: number, known: boolean): number {
  if (!(anchor > 0)) return 0.5;
  const k = known ? 14 : 8;
  return 1 / (1 + Math.exp(k * (price / anchor - 1)));
}

/** Margin points we can give back on bigger contracts (steady volume, lower sales cost per dollar). */
export function volumeDiscountPts(annualValue: number): number {
  return annualValue >= 250000 ? 3 : annualValue >= 100000 ? 2 : annualValue >= 50000 ? 1 : 0;
}

/**
 * The deal-maker: never below the floor, never leave money on the table. Searches prices from the floor up and picks
 * the one with the best expected profit; explains the call in plain words.
 */
export function dealStrategy(o: { loaded: number; benchmark?: number | null; market?: number | null; targetMarginPct?: number; annualValue?: number; roundTo?: number }): DealStrategy | null {
  const loaded = Number(o.loaded) || 0;
  if (!(loaded > 0)) return null;
  const round = (n: number) => { const r = o.roundTo && o.roundTo > 0 ? o.roundTo : 1; return Math.ceil(n / r - 1e-9) * r; };
  const vol = volumeDiscountPts(o.annualValue ?? 0);
  const target = Math.max(MIN_MARGIN_PCT + 2, (o.targetMarginPct ?? DEFAULT_ASSUMPTIONS.marginPct) - vol);
  const floorPrice = round(loaded / (1 - MIN_MARGIN_PCT / 100));
  const targetPrice = round(loaded / (1 - target / 100));
  // anchor: the last award; what our customers pay when there's no award; both blended (award weighs more) when we have both
  const award = Number(o.benchmark) > 0 ? Number(o.benchmark) : 0, market = Number(o.market) > 0 ? Number(o.market) : 0;
  const known = Boolean(award || market);
  const anchor = award && market ? award * 0.7 + market * 0.3 : award || market || targetPrice;
  let best = { p: floorPrice, ev: -Infinity, win: 0 };
  const top = Math.max(targetPrice, anchor) * 1.3;
  for (let p = floorPrice; p <= top; p += Math.max(0.01, floorPrice * 0.005)) {
    const win = winProbability(p, anchor, known);
    const ev = win * (p - loaded);
    if (ev > best.ev) best = { p, ev, win };
  }
  const recommended = Math.max(floorPrice, round(best.p));
  const win = winProbability(recommended, anchor, known);
  const notes: string[] = [];
  if (vol) notes.push(`Big contract (~$${Math.round((o.annualValue ?? 0) / 1000)}k/yr): target margin trimmed ${vol} pts to ${target}% for steady volume.`);
  const src = award && market ? `last award $${award} and what our customers pay ($${market})` : award ? `the last award ($${award})` : `what our customers actually pay ($${market}, from paid jobs)`;
  const a2 = Math.round(anchor * 100) / 100;
  if (known && loaded > anchor) notes.push(`Our cost is above the market (${src}). Get a cheaper pro or a scope clarification before bidding — or pass.`);
  else if (known && recommended < targetPrice) notes.push(`The market (${src}) is below our target; bidding $${recommended} keeps a real chance to win with ${Math.round(((recommended - loaded) / recommended) * 100)}% margin.`);
  else if (known && recommended > targetPrice) notes.push(`The market (${src}, anchor $${a2}) pays more than our target, so the recommendation captures it.`);
  if (!award) notes.push(market ? "No award history yet — anchored on our own paid jobs. Add the last award price (bid tabs, award notices) to sharpen it." : "No award history or paid-job data for this item — add the last award price (bid tabs, award notices) to sharpen the price.");
  if (win < 0.25) notes.push("Low chance to win at any price that clears our floor; consider no-bid or teaming.");
  return { floorPrice, targetPrice, recommended, winProb: Math.round(win * 100) / 100, expectedProfit: Math.round(win * (recommended - loaded) * 100) / 100, marginPct: Math.round(((recommended - loaded) / recommended) * 1000) / 10, notes };
}

/**
 * An agency counter-offer or best-and-final request. Accept when it's close to our price; counter between the floor and
 * our price (meeting partway, plus what we can trade instead of price); walk away below the floor unless a concession
 * (faster payment, longer term, more scope) brings our cost down enough.
 */
export function negotiate(o: { loaded: number; ourPrice: number; counter: number; paymentDays?: number; costOfMoneyPct?: number }) {
  const floor = o.loaded / (1 - MIN_MARGIN_PCT / 100);
  const r2n = (n: number) => Math.round(n * 100) / 100;
  // what paying us in 15 days instead of the usual terms would save us, per unit
  const days = o.paymentDays ?? DEFAULT_ASSUMPTIONS.paymentDays, rate = (o.costOfMoneyPct ?? DEFAULT_ASSUMPTIONS.costOfMoneyPct) / 100;
  const fasterPaySaving = r2n(o.loaded * rate * Math.max(0, days - 15) / 365);
  const concessions = [
    fasterPaySaving > 0 ? `Net-15 payment instead of net-${days} (saves us ~$${fasterPaySaving}/unit)` : null,
    "A longer base term or guaranteed option years",
    "Bundling more locations or services (better routing, lower cost per visit)",
    "Fewer visits in the off-season, or a narrower scope on low-value items",
  ].filter(Boolean) as string[];
  if (o.counter >= o.ourPrice * 0.98) return { action: "accept" as const, price: r2n(o.counter), message: "Within 2% of our price — accept and lock it in.", concessions: [] };
  if (o.counter >= floor) {
    const price = r2n(Math.max(floor, (o.ourPrice + o.counter) / 2));
    return { action: "counter" as const, price, message: `Meet them partway at $${price} (our floor is $${r2n(floor)}). Offer a concession instead of more price.`, concessions };
  }
  if (o.counter + fasterPaySaving >= floor) return { action: "counter" as const, price: r2n(o.counter + 0.01 > floor ? o.counter : floor), message: `Their number works only with net-15 payment — accept on that condition.`, concessions: concessions.slice(0, 1) };
  return { action: "walk" as const, price: r2n(floor), message: `$${o.counter} is under our floor ($${r2n(floor)}) — decline politely, or reduce scope to make it work.`, concessions };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => Math.max(0, Number(n) || 0) / 100;

export function withDefaults(a?: Partial<BidAssumptions> | null): BidAssumptions {
  const out = { ...DEFAULT_ASSUMPTIONS };
  for (const k of Object.keys(out) as (keyof BidAssumptions)[]) { const v = Number(a?.[k]); if (a && a[k] !== undefined && a[k] !== null && Number.isFinite(v) && v >= 0) out[k] = v; }
  out.marginPct = Math.min(out.marginPct, 60);
  out.roundTo = out.roundTo > 0 ? out.roundTo : 0.01;
  return out;
}

/** Unit cost → unit price. Overheads load the direct cost; financing covers the wait to be paid; margin is on the price. */
export function priceLine(line: CostLine, assumptions?: Partial<BidAssumptions> | null, market?: Record<string, MarketRate> | null): PricedLine {
  const a = withDefaults(assumptions);
  const flags: string[] = [];
  // a pro's quote wins; otherwise a measured line is costed from our own pricing engine (clearly flagged)
  const est = Number(line.pro_unit_cost) > 0 ? null : catalogCost(line.slug, line.measure_size, line.measure_unit);
  const proCost = Number(line.pro_unit_cost) > 0 ? Number(line.pro_unit_cost) : est?.proCost ?? 0;
  const costSource: PricedLine["costSource"] = Number(line.pro_unit_cost) > 0 ? "pro_quote" : est ? "catalog_estimate" : "none";
  const direct = Math.max(0, proCost) + Math.max(0, Number(line.materials_unit) || 0);
  if (costSource === "none") flags.push("No pro price yet");
  if (costSource === "catalog_estimate") flags.push(`Estimated pro cost $${est!.proCost} from our pricing engine (${line.measure_size} ${line.measure_unit}) — get a pro quote before submitting`);
  const overhead = pct(a.supervisionPct) + pct(a.insurancePct) + pct(a.adminPct) + pct(a.contingencyPct) + pct(a.bondPct);
  const financing = pct(a.costOfMoneyPct) * (Math.max(0, a.paymentDays) / 365);
  const loaded = direct * (1 + overhead + financing);
  const raw = loaded / (1 - pct(a.marginPct));
  const unitPrice = direct > 0 ? r2(Math.ceil(raw / a.roundTo - 1e-9) * a.roundTo) : 0;
  const unitProfit = r2(unitPrice - loaded);
  const marginPct = unitPrice > 0 ? r2((unitProfit / unitPrice) * 100) : 0;
  const qty = Math.max(0, Number(line.qty) || 0), years = Math.max(0, Number(line.years) || 0);
  if (!qty) flags.push("No quantity — the total leaves this line out");
  if (unitPrice > 0 && marginPct < MIN_MARGIN_PCT) flags.push(`Margin ${marginPct}% is under the ${MIN_MARGIN_PCT}% floor`);
  if (line.benchmark && unitPrice > 0) {
    if (unitPrice > line.benchmark * 1.15) flags.push(`${Math.round((unitPrice / line.benchmark - 1) * 100)}% above the last award ($${line.benchmark}) — may lose on price`);
    else if (loaded > line.benchmark) flags.push(`Our cost is above the last award ($${line.benchmark}) — the winner may be cutting corners or we need a cheaper pro`);
  }
  const marketPrice = marketBenchmark(line, market);
  const deal = direct > 0 ? dealStrategy({ loaded, benchmark: line.benchmark, market: marketPrice, targetMarginPct: a.marginPct, annualValue: unitPrice * qty, roundTo: a.roundTo }) : null;
  if (marketPrice && unitPrice > marketPrice * 1.2) flags.push(`${Math.round((unitPrice / marketPrice - 1) * 100)}% above what our customers pay for this ($${marketPrice}) — check the scope or the pro's price`);
  if (deal && Math.abs(deal.recommended - unitPrice) / unitPrice > 0.03) flags.push(`Deal-maker suggests $${deal.recommended}/unit (${Math.round(deal.winProb * 100)}% est. win chance, ${deal.marginPct}% margin)`);
  return {
    ...line, direct: r2(direct), loaded: r2(loaded), unitPrice, unitProfit, marginPct,
    yearPrice: r2(unitPrice * qty), totalPrice: r2(unitPrice * qty * years), totalCost: r2(loaded * qty * years), totalProfit: r2((unitPrice - loaded) * qty * years), flags,
    costSource, deal,
  };
}

export function priceBid(lines: CostLine[], assumptions?: Partial<BidAssumptions> | null, market?: Record<string, MarketRate> | null) {
  const a = withDefaults(assumptions);
  const priced = lines.map((l) => priceLine(l, a, market));
  const totalPrice = r2(priced.reduce((t, l) => t + l.totalPrice, 0));
  const totalCost = r2(priced.reduce((t, l) => t + l.totalCost, 0));
  const yearPrice = r2(priced.reduce((t, l) => t + l.yearPrice, 0));
  const totalProfit = r2(totalPrice - totalCost);
  const warnings: string[] = [];
  if (!lines.length) warnings.push("No price lines yet — add them from the agency's price form");
  const missing = priced.filter((l) => l.costSource === "none").length;
  const estimated = priced.filter((l) => l.costSource === "catalog_estimate").length;
  if (estimated) warnings.push(`${estimated} line${estimated > 1 ? "s" : ""} priced from our pricing engine estimate — confirm with a pro quote before submitting`);
  if (missing) warnings.push(`${missing} line${missing > 1 ? "s" : ""} without a pro price`);
  if (a.marginPct < MIN_MARGIN_PCT) warnings.push(`Target margin ${a.marginPct}% is under the ${MIN_MARGIN_PCT}% floor`);
  // money out before money in: one payment cycle of pro pay we carry
  const cashGap = r2((totalCost / Math.max(1, Math.max(...priced.map((l) => Number(l.years) || 1), 1)) / 365) * a.paymentDays);
  return { lines: priced, assumptions: a, totals: { yearPrice, totalPrice, totalCost, totalProfit, marginPct: totalPrice > 0 ? r2((totalProfit / totalPrice) * 100) : 0, cashGap }, warnings };
}

// ───────────────────────────── 4. Pro quotes ─────────────────────────────

export interface ProQuote { contractor_id: string; status: "asked" | "committed" | "declined"; prices: Record<string, number | null | undefined> }

/** Per line: the lowest committed pro price, how many pros committed, and whether there's a backup. */
export function bestQuotes(lines: { id: string }[], quotes: ProQuote[]) {
  return Object.fromEntries(lines.map((l) => {
    const offers = quotes.filter((q) => q.status === "committed" && Number(q.prices?.[l.id]) > 0).map((q) => ({ contractor_id: q.contractor_id, price: Number(q.prices[l.id]) })).sort((x, y) => x.price - y.price);
    return [l.id, { best: offers[0] ?? null, count: offers.length, backup: offers.length >= 2, offers }];
  })) as Record<string, { best: { contractor_id: string; price: number } | null; count: number; backup: boolean; offers: { contractor_id: string; price: number }[] }>;
}

// ───────────────────────────── 5. Review & submit ─────────────────────────────

export const REVIEW_CHECKS: { id: string; text: string }[] = [
  { id: "matrix", text: "Every requirement in the compliance matrix is answered, and I checked it against the solicitation myself" },
  { id: "addenda", text: "I checked the agency's page for addenda today; all are acknowledged and reflected" },
  { id: "math", text: "I re-added the price form by hand: units, quantities and totals match the pricing sheet" },
  { id: "forms", text: "Every required form is complete, signed and dated by an authorized officer" },
  { id: "format", text: "File names, format, page limits and the submission method follow the instructions exactly" },
  { id: "pros", text: "Committed pros have the scope, the term and our price assumptions in writing" },
];

export interface GateInput {
  go: Record<string, GoAnswer | undefined>;
  requirements: { required: boolean; done: boolean }[];
  lines: CostLine[];
  assumptions?: Partial<BidAssumptions> | null;
  review: Record<string, boolean | undefined>;
  reviewer: string | null;
  owner: string | null;
  confirmationUploaded: boolean;
  dueAt: string | null;
  now?: Date;
  marginOverride?: boolean;
}

/** Everything that must be true to mark a bid submitted. `ready` = all but the confirmation upload. */
export function submitGate(g: GateInput) {
  const missing: string[] = [];
  const warnings: string[] = [];
  const go = goDecision(g.go);
  if (go.decision !== "go") missing.push(go.decision === "no_go" ? "Go / no-go says no" : "Go / no-go isn't answered yes on every must-pass question");
  const open = g.requirements.filter((r) => r.required && !r.done).length;
  if (!g.requirements.length) missing.push("No compliance matrix — upload the solicitation and have the AI read it, or add items");
  else if (open) missing.push(`${open} required compliance item${open > 1 ? "s" : ""} still open`);
  const p = priceBid(g.lines, g.assumptions);
  if (!g.lines.length) missing.push("No price lines");
  else if (p.lines.some((l) => !(Number(l.pro_unit_cost) > 0))) missing.push("Every price line needs a pro price");
  if (p.lines.some((l) => l.unitPrice > 0 && l.marginPct < MIN_MARGIN_PCT) && !g.marginOverride) missing.push(`A line is under the ${MIN_MARGIN_PCT}% margin floor (owner override needed)`);
  const unchecked = REVIEW_CHECKS.filter((c) => !g.review[c.id]).length;
  if (unchecked || !g.reviewer) missing.push(`Review not signed off${unchecked ? ` (${unchecked} check${unchecked > 1 ? "s" : ""} left)` : ""}`);
  else if (g.owner && g.reviewer.toLowerCase() === g.owner.toLowerCase()) warnings.push("Reviewed by the person who wrote it — a second person catches more");
  if (g.dueAt) {
    const hours = (new Date(g.dueAt).getTime() - (g.now ?? new Date()).getTime()) / 3600000;
    if (hours < 0) missing.push("The deadline has passed");
    else if (hours < 24) warnings.push(`Due in ${Math.round(hours)} hours — submit now; portals slow down at the deadline`);
  } else warnings.push("No due date entered");
  const ready = missing.length === 0;
  if (ready && !g.confirmationUploaded) return { ready, canMarkSubmitted: false, missing: ["Upload the submission confirmation (receipt, email or portal screenshot)"], warnings, pricing: p };
  return { ready, canMarkSubmitted: ready && g.confirmationUploaded, missing, warnings, pricing: p };
}
