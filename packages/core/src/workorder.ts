/*
 * FILE    : packages/core/src/workorder.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * UPDATED : 2026-10-02_1412 UTC — Spanish work orders (opts.locale / workOrderText(w, locale)) for pros who chose Spanish.
 * UPDATED : 2026-10-03_0117 UTC — "Customer requirements & access" (not instructions on how to do the work).
 * UPDATED : 2026-10-05_0221 UTC — the job checklist (checklists.ts) with special instructions is part of every work order (v3).
 * UPDATED : 2026-10-12_0005 UTC — entry & keys from the customer's saved home (access_info) on accepted work orders only.
 * PURPOSE : The work order a pro sees with every job offer (app, web, email): payout, when,
 *           where, exact scope, customer notes, ops instructions, required photos and the
 *           job terms they agree to when they accept. Before acceptance only the area is
 *           shown (Uber-style); the full address and customer contact unlock on accept.
 * UPDATED : 2026-10-15_0300 UTC — "pay after" jobs: the pro can start once the 25% is in; their payout never waits on the customer.
 * UPDATED : 2026-10-28_0122 UTC — referred jobs: the pro's half of the partner's share is a job term (v4).
 * UPDATED : 2026-11-06_1800 UTC — the referral fee uses the rate locked on the job (partner-v4, jobs.partner_rate).
 * UPDATED : 2026-11-06_1800 UTC — the payout shown is the pro's NET pay; no referral-fee term or math on the work order.
 * UPDATED : 2026-11-13_1800 UTC — offerEmailText(): every offer email (new job, backup call, standby) opens with an
 *           "at a glance" summary (pay, job, when, where + miles, est. time on site, answer-by) and how to respond,
 *           then the full work order — pros were getting offer emails without enough detail to decide.
 * UPDATED : 2026-11-13_1830 UTC — before acceptance, codes/PINs and the street address typed into customer notes or
 *           instructions are masked (hideBeforeAccept); they show in full on the accepted work order.
 */
import { AGREEMENT_VERSION } from "./compliance.ts";
import { proNetPay, type ProPayJob } from "./pro-pay.ts";
import { BRAND } from "./brand.ts";
import { money, moneyCents } from "./pricing.ts";
import { applyMeasurements, getService, type Answers } from "./services.ts";
import { TIME_WINDOW_LABEL, type Job } from "./types.ts";
import { serviceText, t as tr, type Locale } from "./i18n.ts";
import { checklistText, resolveChecklist, type ChecklistExtra, type JobChecklist } from "./checklists.ts";

/** Bump when the per-job terms below change. */
export const WORK_ORDER_VERSION = "2026-10-v4"; // v4: referral partner fee (pro's half) on referred jobs; v3: job checklist

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
  /** Entry details from the customer's saved home (lockbox, key, key holder) — only on a revealed (accepted) work order. */
  access?: string | null;
  scope: { label: string; value: string }[];
  includes: string[];
  customerNotes: string | null;
  instructions: string | null;
  photos: string;
  terms: string[];
}

type WorkOrderJob = Pick<Job, "ref" | "service_slug" | "answers" | "notes" | "scheduled_date" | "time_window" | "address" | "city" | "state" | "zip" | "contact_name" | "contact_phone" | "company_name" | "contractor_payout"> & Partial<Pick<Job, "price_final" | "partner_tier" | "partner_rate" | "partner_sale" | "partner_id" | "partner_pro_fee" | "amount_refunded" | "status">> & { instructions?: string | null; payment_plan?: string; paid_at?: string | null; checklist?: JobChecklist | null; checklist_extra?: ChecklistExtra[] | null; access_info?: string | null };

/** Spanish for the fixed parts of a work order (pros who chose Spanish). */
const WO_ES: Record<string, string> = {
  "Arrive within the booked window. Running late? Message the customer in the app before the window starts.": "Llegue dentro del horario reservado. ¿Va con retraso? Envíe un mensaje al cliente en la app antes de que empiece el horario.",
  "Take before-and-after photos of every area you work on and upload them to complete the job.": "Tome fotos de antes y después de cada área en la que trabaje y súbalas para terminar el trabajo.",
  "The customer has paid a deposit; we collect the balance before your start date. Don't start until the app shows \"Paid in full\".": "El cliente pagó un depósito; cobramos el saldo antes de su fecha de inicio. No comience hasta que la app muestre \"Pagado en su totalidad\".",
  "The customer paid 25% to book; we collect the rest when the job is done. You can start — your payout doesn't change and doesn't wait on the customer's payment.": "El cliente pagó el 25% para reservar; cobramos el resto cuando el trabajo esté terminado. Puede comenzar: su pago no cambia y no depende del pago del cliente.",
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

export function buildWorkOrder(job: WorkOrderJob, opts: { reveal: boolean; payout?: number | null; locale?: Locale | string | null; agreementVersion?: string | null }): WorkOrder {
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
  // the pro sees one number: their net pay (any referral fee already taken out — never the math or our numbers)
  const gross = opts.payout ?? job.contractor_payout;
  // pros sign the current agreement before they can accept an offer, so that is the default
  const payout = gross ? proNetPay(job as ProPayJob, gross, opts.agreementVersion ?? AGREEMENT_VERSION) : gross;
  const date = job.scheduled_date ? new Date(`${job.scheduled_date}T12:00:00`).toLocaleDateString(es ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric" }) : es ? "Fecha por definir" : "Date TBD";
  const terms = [
    es ? `Pago ${payout ? money(payout) : "según la cotización final"} — se aprueba cuando el trabajo está completo y pasa la revisión de fotos, y se paga en el pago semanal. El cliente ya pagó; nunca cobre directamente.`
      : `Payout ${payout ? money(payout) : "per the firm quote"} — approved when the job is complete and passes photo review, paid on the weekly payout run. The customer has prepaid; never take payment directly.`,
    L("Arrive within the booked window. Running late? Message the customer in the app before the window starts."),
    L("Take before-and-after photos of every area you work on and upload them to complete the job."),
    ...(job.payment_plan === "deposit" && !job.paid_at ? [L("The customer has paid a deposit; we collect the balance before your start date. Don't start until the app shows \"Paid in full\".")] : []),
    ...(job.payment_plan === "after" && !job.paid_at ? [L("The customer paid 25% to book; we collect the rest when the job is done. You can start — your payout doesn't change and doesn't wait on the customer's payment.")] : []),
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
    checklist: resolveChecklist({ service_slug: job.service_slug, answers: job.answers as Record<string, unknown>, notes: opts.reveal ? job.notes : hideBeforeAccept(job.notes, job.address), instructions: opts.reveal ? job.instructions : hideBeforeAccept(job.instructions, job.address), checklist: job.checklist, checklist_extra: job.checklist_extra }),
    customer: opts.reveal ? { name: job.contact_name, phone: job.contact_phone, company: job.company_name } : undefined,
    access: opts.reveal ? job.access_info ?? null : null,
    scope,
    includes: (svc?.includes ?? []).map(L),
    customerNotes: opts.reveal ? job.notes : hideBeforeAccept(job.notes, job.address),
    instructions: opts.reveal ? job.instructions ?? null : hideBeforeAccept(job.instructions, job.address),
    photos: L("Before and after photos of every area — required to complete the job and release your payout."),
    terms,
  };
}

/**
 * Before a pro accepts, nothing in free text may give away the exact address or a way in: entry codes, PINs, lockbox
 * and alarm codes, passwords, and the street address itself are masked. The accepted work order shows them in full.
 */
export function hideBeforeAccept(text: string | null | undefined, address?: string | null): string | null {
  if (!text) return text ?? null;
  let out = text.replace(/\b(pin|code|passcode|password|pass|combo|combination|lock ?box|key ?box|gate|garage|alarm|door|keypad|wifi|wi-fi)\b([^\n\d]{0,20})[\w#*-]*\d[\w#*-]*/gi, (_m, k: string, gap: string) => `${k}${gap}[shown after you accept]`);
  const street = address?.split(",")[0]?.trim();
  if (street && street.length >= 5) out = out.split(new RegExp(street.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig")).join("[address shown after you accept]");
  return out.replace(/\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Za-z0-9.' -]{2,30}\s(?:st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|ct|court|way|pl|place|ter|terrace|pkwy|parkway|cir|circle|hwy|highway)\b\.?/gi, "[address shown after you accept]");
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
    ...(w.access ? ["", `${es ? "ENTRADA Y LLAVES (solo para usted — no lo comparta)" : "ENTRY & KEYS (for you only — don't share)"}:`, w.access] : []),
    "",
    checklistText(w.checklist, es ? "es" : "en"),
    "",
    `${es ? "FOTOS" : "PHOTOS"}: ${w.photos}`,
    "",
    es ? `CONDICIONES DEL TRABAJO (orden de trabajo v${w.version})` : `JOB TERMS (work order v${w.version})`,
    ...w.terms.map((t) => `• ${t}`),
  ].join("\n");
}

/** Rough time on site for one crew (the service's own labor-hours estimate), rounded to the half hour. Null when unknown. */
export function estimatedJobHours(job: Pick<Job, "service_slug" | "answers">): number | null {
  const svc = getService(job.service_slug);
  if (!svc || svc.remote) return null;
  try {
    const h = svc.price(applyMeasurements(svc.questions, (job.answers ?? {}) as Answers)).hours;
    return Number.isFinite(h) && h > 0 ? Math.max(0.5, Math.round(h * 2) / 2) : null;
  } catch { return null; }
}

/**
 * The full offer email a pro gets: a short "at a glance" block they can decide from in ten seconds, how to answer,
 * then the full work order. Used for new job offers, backup calls and standby requests.
 */
export function offerEmailText(w: WorkOrder, o: {
  locale?: Locale | string | null;
  /** One or two lines on why this offer came to them (favorite, recurring, backup #2…). */
  intro?: string | null;
  /** Miles from the pro's base (or live location). */
  miles?: number | null;
  hours?: number | null;
  /** "3:15 PM ET" etc. */
  answerBy?: string | null;
  /** "First to accept gets it." / "Accept within 10 minutes or it goes to the next backup." */
  rule?: string | null;
  url: string;
  /** Standby requests: the pay is only earned if they're called. */
  standby?: boolean;
}): string {
  const es = o.locale === "es";
  const scope = w.scope.filter((s) => s.value && s.value !== "—" && !/^(No|0)$/.test(s.value)).slice(0, 4).map((s) => `${s.label}: ${s.value}`).join(" · ");
  const miles = o.miles != null && Number.isFinite(o.miles) ? Math.max(1, Math.round(o.miles)) : null;
  const hrs = o.hours ? `${o.hours % 1 ? o.hours.toFixed(1) : o.hours} ${es ? (o.hours === 1 ? "hora" : "horas") : o.hours === 1 ? "hour" : "hours"}` : null;
  const glance = es
    ? [
        "RESUMEN",
        `• Usted gana: ${w.payout}${o.standby ? " si lo llamamos y hace el trabajo" : ""} (el cliente ya pagó; nunca cobre directamente)`,
        `• Trabajo: ${w.icon} ${w.title}`,
        ...(scope ? [`• Detalles: ${scope}`] : []),
        `• Cuándo: ${w.when}`,
        `• Dónde: ${w.where}${miles ? ` — a unas ${miles} millas de su base` : ""}`,
        ...(w.revealed ? [] : ["• La dirección exacta y los códigos de entrada (PIN, caja de llaves) se le envían en cuanto acepte."]),
        ...(hrs ? [`• Tiempo estimado en el sitio: unas ${hrs}`] : []),
        ...(o.answerBy ? [`• Responda antes de: ${o.answerBy}`] : []),
      ]
    : [
        "AT A GLANCE",
        `• You earn: ${w.payout}${o.standby ? " if you're called and do the job" : ""} (the customer has prepaid; never collect payment)`,
        `• Job: ${w.icon} ${w.title}`,
        ...(scope ? [`• Details: ${scope}`] : []),
        `• When: ${w.when}`,
        `• Where: ${w.where}${miles ? ` — about ${miles} mi from your base` : ""}`,
        ...(w.revealed ? [] : ["• The exact address and entry details (PIN, lockbox or gate code) are sent the moment you accept."]),
        ...(hrs ? [`• Est. time on site: about ${hrs}`] : []),
        ...(o.answerBy ? [`• Answer by: ${o.answerBy}`] : []),
      ];
  const respond = o.standby
    ? es
      ? ["CÓMO RESPONDER", `Confirme que puede dejar ese horario libre, o pase sin costo: ${o.url}`, "Pasar nunca cuenta en su contra."]
      : ["HOW TO RESPOND", `Confirm you can keep that time open, or pass at no cost: ${o.url}`, "Passing never counts against you."]
    : es
      ? ["CÓMO RESPONDER", `${o.rule ? `${o.rule} ` : ""}Abra la oferta para Aceptar, Pasar o hacer una Contraoferta con el pago que quiere:`, o.url, `o abra la app ${BRAND.name} Pro. Pasar o dejar vencer una oferta nunca cuenta en su contra.`]
      : ["HOW TO RESPOND", `${o.rule ? `${o.rule} ` : ""}Open the offer to Accept, Pass, or Counter with the pay you want:`, o.url, `or open the ${BRAND.name} Pro app. Passing or letting an offer expire never counts against you.`];
  return [
    ...(o.intro ? [o.intro, ""] : []),
    ...glance,
    "",
    ...respond,
    "",
    es ? "─── ORDEN DE TRABAJO COMPLETA ───" : "─── FULL WORK ORDER ───",
    workOrderText(w, o.locale),
    "",
    `${es ? "¿Preguntas sobre este trabajo? Responda a este correo o llame" : "Questions about this job? Reply to this email or call"} ${BRAND.supportPhone}.`,
    `— ${BRAND.name}`,
  ].join("\n");
}
