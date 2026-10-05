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
 */

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
}

export interface PricedLine extends CostLine {
  direct: number; loaded: number; unitPrice: number; unitProfit: number; marginPct: number;
  yearPrice: number; totalPrice: number; totalCost: number; totalProfit: number; flags: string[];
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
export function priceLine(line: CostLine, assumptions?: Partial<BidAssumptions> | null): PricedLine {
  const a = withDefaults(assumptions);
  const flags: string[] = [];
  const direct = Math.max(0, Number(line.pro_unit_cost) || 0) + Math.max(0, Number(line.materials_unit) || 0);
  if (!(Number(line.pro_unit_cost) > 0)) flags.push("No pro price yet");
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
  return {
    ...line, direct: r2(direct), loaded: r2(loaded), unitPrice, unitProfit, marginPct,
    yearPrice: r2(unitPrice * qty), totalPrice: r2(unitPrice * qty * years), totalCost: r2(loaded * qty * years), totalProfit: r2((unitPrice - loaded) * qty * years), flags,
  };
}

export function priceBid(lines: CostLine[], assumptions?: Partial<BidAssumptions> | null) {
  const a = withDefaults(assumptions);
  const priced = lines.map((l) => priceLine(l, a));
  const totalPrice = r2(priced.reduce((t, l) => t + l.totalPrice, 0));
  const totalCost = r2(priced.reduce((t, l) => t + l.totalCost, 0));
  const yearPrice = r2(priced.reduce((t, l) => t + l.yearPrice, 0));
  const totalProfit = r2(totalPrice - totalCost);
  const warnings: string[] = [];
  if (!lines.length) warnings.push("No price lines yet — add them from the agency's price form");
  const missing = priced.filter((l) => l.flags.includes("No pro price yet")).length;
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
