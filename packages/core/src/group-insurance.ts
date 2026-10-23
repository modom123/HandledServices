/*
 * FILE    : packages/core/src/group-insurance.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2345 UTC
 * PURPOSE : Handled group insurance: one master general-liability policy Handled buys at a group rate, and every pro
 *           pays a small share of it ($5 a month by default), taken from their weekly payout.
 *             groupCovers()          — the group policy is this pro's general liability (every trade they do that needs
 *                                      insurance is a covered, lower-risk trade, at a limit the policy meets): no COI needed
 *             groupFeeDue()          — this month's fee for one pro (only months they were paid for work, by default)
 *             groupEnrollmentText()  — the authorization the pro signs (coverage, the fee, the payout deduction)
 *           Higher-risk and licensed trades (roofing, tree, electrical, plumbing…) keep their own certificate; for them
 *           the group policy is backup coverage behind it. Other coverage (commercial auto, bonds, workers' comp) is not
 *           part of the group policy. The settings live in Hub → Pro Program (ProPolicy.groupInsurance).
 */
import { SERVICES } from "./services.ts";
import { glMinimum } from "./vetting.ts";
import { money } from "./pricing.ts";

/** Bump when the enrollment authorization changes: pros sign it again. */
export const GROUP_INSURANCE_VERSION = "2026-10-v1";

export interface GroupInsurance {
  /** Off until the master policy is bound with the carrier. */
  enabled: boolean;
  /** What each pro pays a month, taken from a payout. */
  monthlyFee: number;
  /** Charge only for months the pro was paid for at least one job (idle months are free). */
  onlyMonthsWorked: boolean;
  carrier: string;
  policyNumber: string;
  perOccurrence: number;
  aggregate: number;
  /** Trades the master policy covers as the pro's own general liability. */
  coversTrades: string[];
}

export const GROUP_INSURANCE_DEFAULTS: GroupInsurance = {
  enabled: false,
  monthlyFee: 5,
  onlyMonthsWorked: true,
  carrier: "",
  policyNumber: "",
  perOccurrence: 1_000_000,
  aggregate: 2_000_000,
  coversTrades: [
    "cleaning", "windows", "carpet", "organizing", "lawn", "snow", "pressure_washing", "errands", "auto_detailing", "pet_waste",
    "pet_care", "hauling", "small_engine", "appliance", "duct_cleaning", "irrigation", "pool", "laundry", "handyman", "assembly",
    "event_planner", "dj_music", "rentals",
  ],
};

/** Trades that need general liability at all (some service they can take isn't insurance-optional). */
const needsInsurance = (trade: string) => SERVICES.some((s) => s.trades.includes(trade) && !s.insuranceOptional);

/**
 * Is the group policy this pro's general liability? Every trade of theirs that needs insurance must be a covered trade,
 * and the policy's limit must meet their trades' minimum. A pro with no trade that needs insurance isn't "covered" — they
 * don't need it.
 */
export function groupCovers(g: Pick<GroupInsurance, "coversTrades" | "perOccurrence">, trades: string[]): boolean {
  const insured = trades.filter(needsInsurance);
  return insured.length > 0 && insured.every((t) => g.coversTrades.includes(t)) && g.perOccurrence >= glMinimum(insured);
}

/** "2026-10" for a date (UTC). */
export const feeMonth = (d: Date) => d.toISOString().slice(0, 7);

/** The month before `d`'s month, "YYYY-MM" — fees are charged after the month ends. */
export function lastMonth(d: Date): string {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return feeMonth(m);
}

/** This month's fee for one pro: enrolled before the month ended, and (by default) paid for work that month. */
export function groupFeeDue(g: GroupInsurance, o: { enrolledAt: string | null; month: string; jobsPaidInMonth: number; alreadyCharged: boolean }): number {
  if (!g.enabled || !(g.monthlyFee > 0) || !o.enrolledAt || o.alreadyCharged) return 0;
  if (o.enrolledAt.slice(0, 7) > o.month) return 0; // enrolled after that month
  if (g.onlyMonthsWorked && o.jobsPaidInMonth < 1) return 0;
  return Math.round(g.monthlyFee * 100) / 100;
}

/** The authorization the pro accepts to enroll (English / Spanish). */
export function groupEnrollmentText(g: GroupInsurance, covered: boolean, es = false): string[] {
  const fee = money(g.monthlyFee);
  const lim = `$${(g.perOccurrence / 1e6).toFixed(0)}M`, agg = `$${(g.aggregate / 1e6).toFixed(0)}M`;
  const carrier = g.carrier ? (es ? ` con ${g.carrier}` : ` with ${g.carrier}`) : "";
  if (es) return [
    `Handled compra una póliza colectiva de responsabilidad civil general${carrier} (${lim} por incidente, ${agg} en total) que cubre a los profesionales inscritos mientras hacen trabajos de Handled.`,
    covered
      ? "Para sus oficios, esta póliza es su seguro de responsabilidad civil: no necesita subir un certificado propio."
      : "Para sus oficios, esta póliza es una cobertura de respaldo: sigue necesitando su propio certificado de seguro.",
    `Su parte es de ${fee} al mes${g.onlyMonthsWorked ? ", solo en los meses en que le pagamos al menos un trabajo" : ""}. Autorizo a Handled a descontarla de mi pago semanal (nunca de las propinas). Es una deducción que yo autorizo por escrito, aparte de mi Acuerdo de Contratista Independiente.`,
    "No cubre: auto comercial, fianzas, compensación laboral, sus herramientas o equipo, ni trabajos fuera de Handled. Le avisaremos por escrito con 30 días de anticipación antes de cambiar la cuota o la cobertura.",
  ];
  return [
    `Handled buys a group general liability policy${carrier} (${lim} per occurrence, ${agg} aggregate) covering enrolled pros while they do Handled jobs.`,
    covered
      ? "For your trades, this policy is your general liability: you don't need to upload your own certificate."
      : "For your trades, this policy is backup coverage: you still need your own certificate of insurance.",
    `Your share is ${fee} a month${g.onlyMonthsWorked ? ", only in months we pay you for at least one job" : ""}. I authorize Handled to deduct it from my weekly payout (never from tips). This is a deduction I authorize in writing, separate from my Independent Contractor Agreement.`,
    "Not covered: commercial auto, bonds, workers' comp, your own tools or equipment, or work outside Handled. We'll give you 30 days' written notice before the fee or coverage changes.",
  ];
}
