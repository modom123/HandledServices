/*
 * FILE    : packages/core/src/workorder.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * UPDATED : 2026-10-02_1412 UTC — Spanish work orders (opts.locale / workOrderText(w, locale)) for pros who chose Spanish.
 * UPDATED : 2026-10-03_0117 UTC — "Customer requirements & access" (not instructions on how to do the work).
 * UPDATED : 2026-10-05_0221 UTC — the job checklist (checklists.ts) with special instructions is part of every work order (v3).
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
import { serviceText, t as tr, type Locale } from "./i18n.ts";
import { checklistText, resolveChecklist, type ChecklistExtra, type JobChecklist } from "./checklists.ts";

/** Bump when the per-job terms below change. */
export const WORK_ORDER_VERSION = "2026-10-v3"; // v3: job checklist

export interface WorkOrder {
  version: string;
  title: string;
  icon: string;
  payout: string;
  when: string;
  where: string;
  revealed: boolean;
  /** What "done" looks like for this job, special instructions first (checklists.ts). */
  checklist: JobChecklist;
  customer?: { name: string; phone: string | null; company: string | null };
  scope: { label: string; value: string }[];
  includes: string[];
  customerNotes: string | null;
  instructions: string | null;
  photos: string;
  terms: string[];
}

type WorkOrderJob = Pick<Job, "ref" | "service_slug" | "answers" | "notes" | "scheduled_date" | "time_window" | "address" | "city" | "state" | "zip" | "contact_name" | "contact_phone" | "company_name" | "contractor_payout"> & { instructions?: string | null; payment_plan?: string; paid_at?: string | null; checklist?: JobChecklist | null; checklist_extra?: ChecklistExtra[] | null };

/** Spanish for the fixed parts of a work order (pros who chose Spanish). */
const WO_ES: Record<string, string> = {
  "Arrive within the booked window. Running late? Message the customer in the app before the window starts.": "Llegue dentro del horario reservado. ¿Va con retraso? Envíe un mensaje al cliente en la app antes de que empiece el horario.",
  "Take before-and-after photos of every area you work on and upload them to complete the job.": "Tome fotos de antes y después de cada área en la que trabaje y súbalas para terminar el trabajo.",
  "The customer has paid a deposit; we collect the balance before your start date. Don't start until the app shows \"Paid in full\".": "El cliente pagó un depósito; cobramos el saldo antes de su fecha de inicio. No comience hasta que la app muestre \"Pagado en su totalidad\".",
  "Out-of-scope work: stop and tell us — we send the customer a change order. Do only what's on this work order.": "Trabajo fuera del alcance: deténgase y avísenos; le enviamos al cliente una orden de cambio. Haga solo lo que está en esta orden de trabajo.",
  "Parts not included in the price: upload the receipt in the app. Small amounts are approved automatically; call us before a big purchase. You're reimbursed at cost once the customer pays.": "Piezas no incluidas en el precio: suba el recibo en la app. Los montos pequeños se aprueban automáticamente; llámenos antes de una compra grande. Se le reembolsa al costo cuando el cliente pague.",
  "Can't get in? Tap “Can't get in?” in the app and wait 15 minutes while we call the customer. A confirmed lockout earns show-up pay.": "¿No puede entrar? Toque “¿No puede entrar?” en la app y espere 15 minutos mientras llamamos al cliente. Un acceso denegado confirmado recibe pago por presentarse.",
  "Don't solicit this customer to book directly with you for 12 months.": "No le pida a este cliente que reserve directamente con usted durante 12 meses.",
  "Licensed trade: your license must be valid for this work; pull permits where required.": "Oficio con licencia: su licencia debe ser válida para este trabajo; obtenga los permisos donde se requieran.",
  "Event work: be set up and ready before the start time; coordinate with the on-site planner.": "Trabajo de eventos: esté instalado y listo antes de la hora de inicio; coordine con el organizador en el lugar.",
  "Before and after photos of every area — required to complete the job and release your payout.": "Fotos de antes y después de cada área — necesarias para completar el trabajo y liberar su pago.",
  "Site visit": "Visita al sitio",
  "Start time": "Hora de inicio",
};

export function buildWorkOrder(job: WorkOrderJob, opts: { reveal: boolean; payout?: number | null; locale?: Locale | string | null }): WorkOrder {
  const es = opts.locale === "es";
  const L = (s: string) => (es ? WO_ES[s] ?? tr("es", s) : s);
  const svc = getService(job.service_slug);
  const answers = (job.answers ?? {}) as Record<string, unknown>;
  const scope = (svc?.questions ?? []).map((q) => {
    const v = answers[q.id];
    const opt = q.type === "select" ? q.options.find((o) => o.value === v)?.label : undefined;
    const value = q.type === "select" ? (opt ? L(opt) : String(v ?? "—"))
      : q.type === "toggle" ? L(v ? "Yes" : "No")
      : `${typeof v === "number" ? v.toLocaleString("en-US") : v ?? "—"}${q.unit && q.unit !== "$" ? ` ${L(q.unit)}` : ""}`;
    return { label: L(q.label), value: q.type === "number" && q.unit === "$" ? `$${value}` : value };
  });
  if (answers.start_time) scope.push({ label: L("Start time"), value: String(answers.start_time) });
  const payout = opts.payout ?? job.contractor_payout;
  const date = job.scheduled_date ? new Date(`${job.scheduled_date}T12:00:00`).toLocaleDateString(es ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric" }) : es ? "Fecha por definir" : "Date TBD";
  const terms = [
    es ? `Pago ${payout ? money(payout) : "según la cotización final"} — se aprueba cuando el trabajo está completo y pasa la revisión de fotos, y se paga en el pago semanal. El cliente ya pagó; nunca cobre directamente.`
      : `Payout ${payout ? money(payout) : "per the firm quote"} — approved when the job is complete and passes photo review, paid on the weekly payout run. The customer has prepaid; never take payment directly.`,
    L("Arrive within the booked window. Running late? Message the customer in the app before the window starts."),
    L("Take before-and-after photos of every area you work on and upload them to complete the job."),
    ...(job.payment_plan === "deposit" && !job.paid_at ? [L("The customer has paid a deposit; we collect the balance before your start date. Don't start until the app shows \"Paid in full\".")] : []),
    es ? "Marque la lista del trabajo mientras avanza; si algo no aplica, márquelo N/A con el motivo. Los puntos obligatorios deben quedar marcados para enviar el trabajo." : "Check off the job checklist as you go; mark anything that doesn't apply N/A with the reason. Required items must be checked before you submit the job.",
    L("Out-of-scope work: stop and tell us — we send the customer a change order. Do only what's on this work order."),
    L("Parts not included in the price: upload the receipt in the app. Small amounts are approved automatically; call us before a big purchase. You're reimbursed at cost once the customer pays."),
    L("Can't get in? Tap “Can't get in?” in the app and wait 15 minutes while we call the customer. A confirmed lockout earns show-up pay."),
    es ? `Corrija cualquier problema de calidad dentro de ${BRAND.guaranteeDays} días sin pago adicional.` : `Fix any workmanship issue within ${BRAND.guaranteeDays} days at no extra payout.`,
    L("Don't solicit this customer to book directly with you for 12 months."),
    ...(svc?.licensed ? [L("Licensed trade: your license must be valid for this work; pull permits where required.")] : []),
    ...(svc?.category === "events" ? [L("Event work: be set up and ready before the start time; coordinate with the on-site planner.")] : []),
    es ? `Su Acuerdo de Contratista Independiente (v${AGREEMENT_VERSION}) aplica a este trabajo.` : `Your Independent Contractor Agreement (v${AGREEMENT_VERSION}) applies to this job.`,
  ];
  return {
    version: WORK_ORDER_VERSION,
    title: `${svc ? (es ? serviceText("es", svc.slug, svc).name : svc.name) : job.service_slug} · ${job.ref}`,
    icon: svc?.icon ?? "🧰",
    payout: payout ? money(payout) : L("Site visit"),
    when: `${date} · ${L(TIME_WINDOW_LABEL[job.time_window])}`,
    where: opts.reveal ? `${job.address}, ${job.city}, ${job.state} ${job.zip}` : `${job.city}, ${job.state} ${job.zip} ${es ? "(dirección exacta al aceptar)" : "(exact address after you accept)"}`,
    revealed: opts.reveal,
    checklist: resolveChecklist({ service_slug: job.service_slug, answers: job.answers as Record<string, unknown>, notes: job.notes, instructions: job.instructions, checklist: job.checklist, checklist_extra: job.checklist_extra }),
    customer: opts.reveal ? { name: job.contact_name, phone: job.contact_phone, company: job.company_name } : undefined,
    scope,
    includes: (svc?.includes ?? []).map(L),
    customerNotes: job.notes,
    instructions: job.instructions ?? null,
    photos: L("Before and after photos of every area — required to complete the job and release your payout."),
    terms,
  };
}

/** Plain-text work order for emails. */
export function workOrderText(w: WorkOrder, locale?: Locale | string | null): string {
  const es = locale === "es";
  return [
    `${w.icon} ${w.title}`,
    `${es ? "Pago" : "Payout"}: ${w.payout}`,
    `${es ? "Cuándo" : "When"}: ${w.when}`,
    `${es ? "Dónde" : "Where"}: ${w.where}`,
    ...(w.customer ? [`${es ? "Cliente" : "Customer"}: ${w.customer.name}${w.customer.company ? ` (${w.customer.company})` : ""} · ${w.customer.phone ?? ""}`] : []),
    "",
    es ? "ALCANCE" : "SCOPE",
    ...w.scope.map((s) => `• ${s.label}: ${s.value}`),
    `${es ? "Incluye" : "Included"}: ${w.includes.join("; ")}`,
    ...(w.customerNotes ? ["", `${es ? "Notas del cliente" : "Customer notes"}: "${w.customerNotes}"`] : []),
    ...(w.instructions ? ["", `${es ? "Requisitos del cliente y acceso" : "Customer requirements & access"}: ${w.instructions}`] : []),
    "",
    checklistText(w.checklist, es ? "es" : "en"),
    "",
    `${es ? "FOTOS" : "PHOTOS"}: ${w.photos}`,
    "",
    es ? `CONDICIONES DEL TRABAJO (orden de trabajo v${w.version})` : `JOB TERMS (work order v${w.version})`,
    ...w.terms.map((t) => `• ${t}`),
  ].join("\n");
}
