/*
 * FILE    : apps/web/lib/job-access.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_1900 UTC
 * PURPOSE : Need-to-know job reads for customers and pros (migration 20261106190000_need_to_know.sql removed their
 *           direct database reads of jobs and offers). The server reads with the service key, checks ownership, and
 *           returns only what each person needs:
 *             customerView() — the customer's own booking: everything about their job and price, never pro pay, the
 *                              referral partner fields or AI dispatch notes
 *             proView()      — what a pro needs to do the work, plus `pro_pay` (their NET pay). Never the job price,
 *                              Handled's take, the referral split, the customer's email, or internal AI notes. Contact
 *                              name/phone and the street address only once the job is theirs.
 *           Only admins see everything (Hub, with the service key on the server).
 * UPDATED : 2026-11-13_0030 UTC — Pro PIN: an assigned job's address and customer contact only on a device unlocked with
 *           the pro's PIN (lib/pro-pin.ts); otherwise pin_locked: true.
 */
import "server-only";
import { proNetPay, type Job } from "@handled/core";
import { adminClient } from "./supabase/server";

const db = () => adminClient();

/** Never shown to a customer. */
const CUSTOMER_HIDDEN = ["contractor_payout", "partner_id", "partner_tier", "partner_rate", "partner_sale", "partner_pro_fee", "ai_dispatch", "attribution", "stripe_customer_id", "stripe_payment_method", "balance_hold_intent"] as const;

export type CustomerJob = Omit<Job, (typeof CUSTOMER_HIDDEN)[number]>;

export function customerView(job: Job): CustomerJob {
  const out: Record<string, unknown> = { ...job };
  for (const k of CUSTOMER_HIDDEN) delete out[k];
  // the AI quote: the customer-facing summary only (ops notes and risk flags are internal)
  const ai = job.ai_quote as { customer_summary?: string } | null;
  out.ai_quote = ai?.customer_summary ? { customer_summary: ai.customer_summary } : null;
  return out as CustomerJob;
}

/** What a pro may see about a job (allow-list). */
const PRO_FIELDS = [
  "id", "ref", "status", "service_slug", "customer_type", "company_name", "city", "state", "zip", "lat", "lng", "scope_extra",
  "answers", "notes", "photos", "completion_photos", "frequency", "scheduled_date", "time_window", "contractor_id", "priority",
  "locale", "urgency", "needed_by", "en_route_at", "crew_member_id", "requested_crew_member_id", "checklist", "checklist_extra",
  "instructions", "payment_plan", "paid_at", "started_at", "completed_at", "created_at", "remedy", "parent_job_id", "plan_id", "updated_at",
] as const;
/** Only once the job is the pro's. */
const PRO_ASSIGNED_FIELDS = ["contact_name", "contact_phone", "address"] as const;

export type ProJob = Pick<Job, (typeof PRO_FIELDS)[number]> & Partial<Pick<Job, (typeof PRO_ASSIGNED_FIELDS)[number]>> & {
  /** The pro's NET pay for this job (any referral fee already out). The only pay number a pro sees. */
  pro_pay: number | null;
  /** The job is theirs but this device hasn't entered the Pro PIN: address and customer contact are withheld. */
  pin_locked?: boolean;
};

export function proView(job: Job, contractorId: string, agreementVersion: string | null | undefined, payout?: number | null, unlocked = true): ProJob {
  const out: Record<string, unknown> = {};
  for (const k of PRO_FIELDS) out[k] = (job as unknown as Record<string, unknown>)[k] ?? null;
  // the address and customer contact: only the pro the job belongs to, and only on a device unlocked with their Pro PIN
  if (job.contractor_id === contractorId) {
    if (unlocked) for (const k of PRO_ASSIGNED_FIELDS) out[k] = (job as unknown as Record<string, unknown>)[k] ?? null;
    else out.pin_locked = true;
  }
  const gross = payout ?? job.contractor_payout;
  out.pro_pay = gross != null && Number(gross) > 0 ? proNetPay(job, Number(gross), agreementVersion) : null;
  return out as ProJob;
}

/** Money internals removed — for anything a dispatcher (staff, not admin) sees. Only admins see everything. */
const STAFF_HIDDEN = ["contractor_payout", "partner_id", "partner_tier", "partner_rate", "partner_sale", "partner_pro_fee", "ai_dispatch"] as const;
export function staffView<T extends object>(job: T): T {
  const out: Record<string, unknown> = { ...(job as Record<string, unknown>) };
  for (const k of STAFF_HIDDEN) delete out[k];
  return out as T;
}

// ─── customers ────────────────────────────────────────────────────────────────

export async function customerJobs(userId: string): Promise<CustomerJob[]> {
  const { data } = await db().from("jobs").select("*").eq("customer_id", userId).order("created_at", { ascending: false }).limit(500);
  return ((data ?? []) as Job[]).map(customerView);
}

export async function customerJob(userId: string, id: string): Promise<CustomerJob | null> {
  const { data } = await db().from("jobs").select("*").eq("id", id).eq("customer_id", userId).maybeSingle();
  return data ? customerView(data as Job) : null;
}

/** Is this the customer's job? (ownership check for the account APIs) */
export async function customerOwnsJob(userId: string, id: string): Promise<boolean> {
  const { data } = await db().from("jobs").select("id").eq("id", id).eq("customer_id", userId).maybeSingle();
  return Boolean(data);
}

/** The customer-facing timeline of the customer's job. */
export async function customerEvents(userId: string, id: string) {
  if (!(await customerOwnsJob(userId, id))) return [];
  const { data } = await db().from("job_events").select("id, message, message_es, created_at").eq("job_id", id).eq("visible_to_customer", true).order("created_at");
  return data ?? [];
}

// ─── pros ─────────────────────────────────────────────────────────────────────

async function agreementOf(contractorId: string): Promise<string | null> {
  const { data } = await db().from("contractors").select("agreement_version").eq("id", contractorId).maybeSingle();
  return (data?.agreement_version as string | null) ?? null;
}

/** The pro's jobs (theirs, any status), newest scheduled first. */
export async function proJobs(contractorId: string, statuses?: string[], unlocked = true): Promise<ProJob[]> {
  const ver = await agreementOf(contractorId);
  let q = db().from("jobs").select("*").eq("contractor_id", contractorId);
  if (statuses?.length) q = q.in("status", statuses);
  const { data } = await q.order("scheduled_date").limit(500);
  return ((data ?? []) as Job[]).map((j) => proView(j, contractorId, ver, undefined, unlocked));
}

/** One job the pro works (or was offered) — null when it's neither. */
export async function proJob(contractorId: string, id: string, unlocked = true): Promise<ProJob | null> {
  const { data } = await db().from("jobs").select("*").eq("id", id).maybeSingle();
  const job = data as Job | null;
  if (!job) return null;
  if (job.contractor_id !== contractorId) {
    const { data: o } = await db().from("job_offers").select("id").eq("job_id", id).eq("contractor_id", contractorId).eq("status", "offered").maybeSingle();
    if (!o) return null;
  }
  return proView(job, contractorId, await agreementOf(contractorId), undefined, unlocked);
}

/** The pro's open offers, each with the job as the pro may see it and their net pay. */
export async function proOffers(contractorId: string) {
  const ver = await agreementOf(contractorId);
  const { data } = await db().from("job_offers").select("id, job_id, kind, status, payout, expires_at, offered_at, jobs(*)").eq("contractor_id", contractorId).eq("status", "offered").order("offered_at", { ascending: false }).limit(200);
  type Row = { id: string; job_id: string; kind: string | null; status: string; payout: number | null; expires_at: string; offered_at: string; jobs: Job | null };
  return ((data ?? []) as unknown as Row[]).filter((o) => o.jobs).map((o) => {
    const job = proView(o.jobs!, contractorId, ver, o.payout);
    return { id: o.id, job_id: o.job_id, kind: o.kind, status: o.status, expires_at: o.expires_at, offered_at: o.offered_at, pro_pay: job.pro_pay, jobs: job };
  });
}
