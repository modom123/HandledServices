/*
 * FILE    : packages/core/src/workorder.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * PURPOSE : The work order a pro sees with every job offer (app, web, email): payout, when,
 *           where, exact scope, customer notes, ops instructions, required photos and the
 *           job terms they agree to when they accept. Before acceptance only the area is
 *           shown (Uber-style); the full address and customer contact unlock on accept.
 */
import { AGREEMENT_VERSION } from "./compliance.ts";
import { BRAND } from "./brand.ts";
import { money } from "./pricing.ts";
import { getService } from "./services.ts";
import { TIME_WINDOW_LABEL, type Job } from "./types.ts";

/** Bump when the per-job terms below change. */
export const WORK_ORDER_VERSION = "2026-10-v1";

export interface WorkOrder {
  version: string;
  title: string;
  icon: string;
  payout: string;
  when: string;
  where: string;
  revealed: boolean;
  customer?: { name: string; phone: string | null; company: string | null };
  scope: { label: string; value: string }[];
  includes: string[];
  customerNotes: string | null;
  instructions: string | null;
  photos: string;
  terms: string[];
}

type WorkOrderJob = Pick<Job, "ref" | "service_slug" | "answers" | "notes" | "scheduled_date" | "time_window" | "address" | "city" | "state" | "zip" | "contact_name" | "contact_phone" | "company_name" | "contractor_payout"> & { instructions?: string | null };

export function buildWorkOrder(job: WorkOrderJob, opts: { reveal: boolean; payout?: number | null }): WorkOrder {
  const svc = getService(job.service_slug);
  const answers = (job.answers ?? {}) as Record<string, unknown>;
  const scope = (svc?.questions ?? []).map((q) => {
    const v = answers[q.id];
    const value = q.type === "select" ? q.options.find((o) => o.value === v)?.label ?? String(v ?? "—")
      : q.type === "toggle" ? (v ? "Yes" : "No")
      : `${typeof v === "number" ? v.toLocaleString("en-US") : v ?? "—"}${q.unit && q.unit !== "$" ? ` ${q.unit}` : ""}`;
    return { label: q.label, value: q.type === "number" && q.unit === "$" ? `$${value}` : value };
  });
  if (answers.start_time) scope.push({ label: "Start time", value: String(answers.start_time) });
  const payout = opts.payout ?? job.contractor_payout;
  const date = job.scheduled_date ? new Date(`${job.scheduled_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Date TBD";
  const terms = [
    `Payout ${payout ? money(payout) : "per the firm quote"} — approved when the job is complete and passes photo review, paid on the weekly payout run. The customer has prepaid; never take payment directly.`,
    "Arrive within the booked window. Running late? Message the customer in the app before the window starts.",
    "Take before-and-after photos of every area you work on and upload them to complete the job.",
    "Out-of-scope work: stop and tell us — we send the customer a change order. Do only what's on this work order.",
    `Fix any workmanship issue within ${BRAND.guaranteeDays} days at no extra payout.`,
    "Don't solicit this customer to book directly with you for 12 months.",
    ...(svc?.licensed ? ["Licensed trade: your license must be valid for this work; pull permits where required."] : []),
    ...(svc?.category === "events" ? ["Event work: be set up and ready before the start time; coordinate with the on-site planner."] : []),
    `Your Independent Contractor Agreement (v${AGREEMENT_VERSION}) applies to this job.`,
  ];
  return {
    version: WORK_ORDER_VERSION,
    title: `${svc?.name ?? job.service_slug} · ${job.ref}`,
    icon: svc?.icon ?? "🧰",
    payout: payout ? money(payout) : "Site visit",
    when: `${date} · ${TIME_WINDOW_LABEL[job.time_window]}`,
    where: opts.reveal ? `${job.address}, ${job.city}, ${job.state} ${job.zip}` : `${job.city}, ${job.state} ${job.zip} (exact address after you accept)`,
    revealed: opts.reveal,
    customer: opts.reveal ? { name: job.contact_name, phone: job.contact_phone, company: job.company_name } : undefined,
    scope,
    includes: svc?.includes ?? [],
    customerNotes: job.notes,
    instructions: job.instructions ?? null,
    photos: "Before and after photos of every area — required to complete the job and release your payout.",
    terms,
  };
}

/** Plain-text work order for emails. */
export function workOrderText(w: WorkOrder): string {
  return [
    `${w.icon} ${w.title}`,
    `Payout: ${w.payout}`,
    `When: ${w.when}`,
    `Where: ${w.where}`,
    ...(w.customer ? [`Customer: ${w.customer.name}${w.customer.company ? ` (${w.customer.company})` : ""} · ${w.customer.phone ?? ""}`] : []),
    "",
    "SCOPE",
    ...w.scope.map((s) => `• ${s.label}: ${s.value}`),
    `Included: ${w.includes.join("; ")}`,
    ...(w.customerNotes ? ["", `Customer notes: "${w.customerNotes}"`] : []),
    ...(w.instructions ? ["", `Instructions from ${BRAND.name}: ${w.instructions}`] : []),
    "",
    `PHOTOS: ${w.photos}`,
    "",
    `JOB TERMS (work order v${w.version})`,
    ...w.terms.map((t) => `• ${t}`),
  ].join("\n");
}
