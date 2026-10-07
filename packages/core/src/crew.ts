/*
 * FILE    : packages/core/src/crew.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1305 UTC
 * PURPOSE : Crew accounts and the proven-skill fast track — the rules both the web portal, the Hub
 *           and dispatch use.
 *             Crews: a pro company lists the people it sends to jobs. Everyone who enters a customer's
 *             home passes our background check first (Pro Agreement, helpers); licensed work goes to a
 *             crew member holding the license (or the owner). The company directs and pays its crew
 *             and handles their work authorization (I-9), payroll and workers' comp — we never employ,
 *             schedule or pay crew members (Crew Addendum). A crew can be sent only once the company has
 *             a workers' comp policy on file (not the no-employees statement).
 *             Fast track: someone who is already a master of their trade sends a portfolio of past work,
 *             does one paid trial job that we review by hand, and on approval starts at Pro+ (bigger pay,
 *             earlier offers) instead of working up from Pro. The floor holds while their numbers stay at
 *             Pro+ level (after a grace period of jobs), so it can't be gamed.
 */
import { coverageValid } from "./vetting.ts";
import { getService } from "./services.ts";
import type { Contractor } from "./types.ts";

// ─── Crews ────────────────────────────────────────────────────────────────────

export type CrewRole = "lead" | "helper" | "apprentice" | "licensed";
export const CREW_ROLES: { id: CrewRole; label: string; help: string }[] = [
  { id: "lead", label: "Crew lead", help: "Runs jobs on their own for your company (unlicensed work)." },
  { id: "licensed", label: "Licensed tech", help: "Holds their own Michigan trade license (journeyman or master)." },
  { id: "apprentice", label: "Apprentice", help: "Registered apprentice; works with a licensed tech on licensed jobs." },
  { id: "helper", label: "Helper", help: "Goes along with you or a crew lead; never sent alone." },
];

export type CrewBackground = "not_started" | "invited" | "pending" | "clear" | "consider" | "suspended" | "canceled";
export interface CrewMember {
  id: string;
  contractor_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  locale: "en" | "es";
  role: CrewRole;
  trades: string[];
  years_experience: number | null;
  license_number: string | null;
  background_status: CrewBackground;
  background_checked_at: string | null;
  active: boolean;
  created_at: string;
}

export const CREW_LIMITS = { maxActive: 25 } as const;

/** The company may send crew at all: attested (Crew Addendum signed) and a real workers' comp policy on file. */
export function crewReady(c: Pick<Contractor, "crew_attested_at" | "coverage">, today = new Date()): string | null {
  if (!c.crew_attested_at) return "Sign the Crew Addendum first";
  if (!coverageValid(c.coverage, "workers_comp", today, false)) return "Upload a current workers' comp policy (the no-employees statement doesn't cover a crew)";
  return null;
}

/**
 * Why this crew member can't be sent alone on a job of this service (null = they can).
 * Helpers never go alone; licensed work needs a licensed tech with a license number on file.
 */
export function crewCanTake(m: Pick<CrewMember, "active" | "role" | "background_status" | "license_number" | "trades">, slug: string): string | null {
  const svc = getService(slug);
  if (!m.active) return "Not active";
  if (m.background_status !== "clear") return "Background check not clear yet";
  if (m.role === "helper") return "Helpers go along with a lead, never alone";
  if (svc?.licensed) {
    if (m.role !== "licensed" || !m.license_number) return "Licensed work needs a licensed tech";
    if (m.trades.length && !svc.trades.some((t) => m.trades.includes(t))) return "Not licensed for this trade";
  }
  return null;
}

// ─── Fast track ───────────────────────────────────────────────────────────────

export const FAST_TRACK = {
  tier: "pro_plus" as const,
  minYears: 5,
  minPhotos: 3,
  maxPhotos: 10,
  /** The floor holds unconditionally for this many jobs, then only while rating / on-time stay at Pro+ level. */
  graceJobs: 10,
  /** The trial job: a normal paid job, reviewed by a person (photos + customer call); this rating or better passes. */
  trialMinRating: 4.8,
};

export type FastTrackStatus = "none" | "applied" | "trial" | "approved" | "declined";

/** The tier floor applies (see proTier): approved, and still inside the grace period or holding Pro+ numbers. */
export function fastTrackFloorHolds(
  c: Pick<Contractor, "tier_floor" | "jobs_completed" | "rating" | "on_time_rate">,
  min: { rating: number; onTime: number },
): boolean {
  if (c.tier_floor !== "pro_plus") return false;
  if (c.jobs_completed < FAST_TRACK.graceJobs) return true;
  return Number(c.rating) >= min.rating && Number(c.on_time_rate) >= min.onTime;
}

/** Whether a fast-track application is complete enough to send (returns the problem, or null). */
export function fastTrackProblem(a: { years: number; photos: number; summary: string }): string | null {
  if (!(a.years >= FAST_TRACK.minYears)) return `Fast track is for pros with ${FAST_TRACK.minYears}+ years in the trade`;
  if (a.photos < FAST_TRACK.minPhotos) return `Add at least ${FAST_TRACK.minPhotos} photos of your past work`;
  if (a.photos > FAST_TRACK.maxPhotos) return `Up to ${FAST_TRACK.maxPhotos} photos`;
  if (a.summary.trim().length < 40) return "Tell us about your experience in a few sentences";
  return null;
}
