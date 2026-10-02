/*
 * FILE    : packages/core/src/types.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Domain types shared by the website, ops hub, portals and mobile app.
 *           Mirrors the enums in supabase/migrations/20261001172300_init.sql.
 */

export type Role = "customer" | "pro" | "dispatcher" | "admin";

export type CategoryId = "cleaning" | "outdoor" | "pets" | "removal" | "repair_remodel" | "errands" | "transport" | "events";

/** Lifecycle of a job. Order matters: it's the order the ops board shows columns. */
export const JOB_STATUSES = [
  "requested", // customer booked, price is an estimate
  "site_visit", // needs an on-site estimate before a firm quote (tree, remodel)
  "quoted", // firm quote sent, waiting on customer approval
  "scheduled", // approved + date set, no pro yet
  "dispatched", // offers out to pros
  "assigned", // a pro accepted
  "in_progress",
  "qa_review", // pro marked done, AI + ops checking photos
  "completed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  requested: "Requested",
  site_visit: "Site visit",
  quoted: "Quoted",
  scheduled: "Scheduled",
  dispatched: "Dispatching",
  assigned: "Pro assigned",
  in_progress: "In progress",
  qa_review: "QA review",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type OfferStatus = "offered" | "accepted" | "declined" | "expired" | "taken";
export type ContractorStatus = "applied" | "vetting" | "approved" | "suspended";
export type CustomerType = "residential" | "commercial";
export type TimeWindow = "morning" | "midday" | "afternoon" | "flexible";

export const TIME_WINDOW_LABEL: Record<TimeWindow, string> = {
  morning: "Morning (8–11am)",
  midday: "Midday (11am–2pm)",
  afternoon: "Afternoon (2–5pm)",
  flexible: "Any time that day",
};

export type Frequency = "once" | "weekly" | "biweekly" | "monthly" | "quarterly";

export interface Job {
  id: string;
  ref: string;
  status: JobStatus;
  service_slug: string;
  customer_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  customer_type: CustomerType;
  company_name: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  /** ZIP-centroid coordinates for dispatch distance. */
  lat?: number | null;
  lng?: number | null;
  /** Extra work the pro found on site (change orders). */
  scope_extra?: number;
  answers: Record<string, unknown>;
  notes: string | null;
  photos: string[];
  completion_photos: string[];
  frequency: Frequency;
  scheduled_date: string | null;
  time_window: TimeWindow;
  estimate_low: number;
  estimate_high: number;
  price_final: number | null;
  contractor_id: string | null;
  contractor_payout: number | null;
  ai_quote: unknown;
  ai_dispatch: unknown;
  ai_qa: unknown;
  priority: "normal" | "high" | "urgent";
  /** Language the booking was made in (texts, emails and timeline follow it for guests). */
  locale?: "en" | "es" | null;
  /** What the customer told us: how soon they need it, the last acceptable day, and their budget. */
  urgency?: "asap" | "this_week" | "two_weeks" | "month" | "flexible" | null;
  needed_by?: string | null;
  customer_budget?: number | null;
  // money features (growth.ts): promo / member savings come off our share; tips go 100% to the pro
  promo_code?: string | null;
  discount?: number | null;
  member_benefit?: number | null;
  tip_total?: number | null;
  attribution?: Record<string, string> | null;
  /** Pro tapped "On my way". */
  en_route_at?: string | null;
  disputed_at?: string | null;
  source: "web" | "mobile" | "business" | "phone" | "ai_chat";
  plan_id: string | null;
  instructions?: string | null;
  paid_at: string | null;
  payment_plan?: "full" | "deposit";
  deposit_amount?: number | null;
  deposit_paid_at?: string | null;
  balance_due_date?: string | null;
  amount_paid: number;
  amount_refunded: number;
  stripe_payment_intent: string | null;
  parent_job_id: string | null;
  remedy: "redo" | "complimentary" | null;
  stripe_customer_id: string | null;
  stripe_payment_method: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contractor {
  id: string;
  profile_id: string | null;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  trades: string[];
  service_zips: string[];
  status: ContractorStatus;
  rating: number;
  jobs_completed: number;
  acceptance_rate: number;
  on_time_rate: number;
  insured_until: string | null;
  license_number: string | null;
  background_checked: boolean;
  daily_capacity: number;
  notes: string | null;
  // 1099 / onboarding (independent contractor — never an employee)
  legal_name?: string | null;
  entity_type?: "individual" | "sole_prop" | "llc" | "s_corp" | "c_corp" | "partnership" | null;
  tin_last4?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  w9_received_at?: string | null;
  agreement_version?: string | null;
  agreement_signed_at?: string | null;
  agreement_signer?: string | null;
  license_expires?: string | null;
  background_checked_at?: string | null;
  payout_method?: "ach" | "stripe_connect" | "check" | null;
  payout_account_last4?: string | null;
  onboarded_at?: string | null;
  offboarded_at?: string | null;
  offboard_reason?: string | null;
  // specialties and trade-specific coverage (see vetting.ts)
  specialties?: string[] | null;
  /** Coverage key → verified expiry date (YYYY-MM-DD), or "exempt" (workers' comp, no employees). */
  coverage?: Record<string, string> | null;
  // where and when the pro works (dispatch + booking calendar)
  base_zip?: string | null;
  base_lat?: number | null;
  base_lng?: number | null;
  /** Furthest a pro will drive from base, miles. */
  service_radius_mi?: number | null;
  /** Weekdays (0 = Sun … 6 = Sat) and arrival windows the pro works. Null = any. */
  availability?: { days: number[]; windows: string[] } | null;
  /** Dates (YYYY-MM-DD) the pro is off. */
  time_off?: string[] | null;
  // live status (see roster.ts): on call until, and the last phone location while on call / on a job
  on_call_until?: string | null;
  last_lat?: number | null;
  last_lng?: number | null;
  last_located_at?: string | null;
}
