/*
 * FILE    : packages/core/src/interview.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : The pro screening interview and the approval checklist — one source for the printable packet,
 *           the Hub scorecard (in-person / phone) and the AI interviewer. English and Spanish.
 *             COMPETENCIES      — six things we score, 1–5, with what 1 / 3 / 5 look like
 *             QUESTIONS         — everyone's questions + trade-specific ones, each with what a good answer has
 *             interviewPlan     — the questions for one candidate (their trades), in order
 *             DO_NOT_ASK        — topics no interviewer (person or AI) may raise; volunteered info is ignored
 *             scoreInterview    — the result from the scores: advance / follow up / not now (a person decides)
 *             approvalChecklist — every step from application to approved and first job
 *           Wording: pros are independent businesses (1099). They are "approved to receive job offers", never
 *           "hired"; we ask about their business, skills and how they treat customers — not about schedules we
 *           set, supervision, uniforms or training we require.
 * UPDATED : 2026-10-05_0432 UTC — approval checklist: "Pro account created" (signed in with the application email) after the invite.
 * UPDATED : 2026-10-05_0441 UTC — security trade group (agency license, de-escalation).
 */
import { BRAND } from "./brand.ts";

export type Competency = "skill" | "quality" | "reliability" | "customer" | "safety" | "business";

export const COMPETENCIES: Record<Competency, { en: string; es: string; anchors: { 1: string; 3: string; 5: string } }> = {
  skill: { en: "Skill & experience", es: "Habilidad y experiencia", anchors: { 1: "Vague or no real experience in the trades they chose", 3: "Clear, relevant experience; explains how they do common jobs", 5: "Deep experience; explains trade-offs and edge cases like a pro" } },
  quality: { en: "Quality standards", es: "Estándares de calidad", anchors: { 1: "\"Good enough\"; no way of checking their work", 3: "Checks their own work; takes photos; fixes misses", 5: "Clear personal standard, walkthroughs, owns and fixes issues without being asked" } },
  reliability: { en: "Reliability", es: "Confiabilidad", anchors: { 1: "Casual about lateness or cancelling; no plan when things change", 3: "Tells the customer early when running late; realistic about capacity", 5: "Plans ahead, rarely cancels, has a backup when something goes wrong" } },
  customer: { en: "Customer communication", es: "Comunicación con el cliente", anchors: { 1: "Argues, blames, or would do unpaid / off-app work", 3: "Polite, explains clearly, uses change orders for extra work", 5: "Calm under pressure, sets expectations, turns complaints into return customers" } },
  safety: { en: "Safety & property care", es: "Seguridad y cuidado de la propiedad", anchors: { 1: "Ignores hazards or would push through unsafe work", 3: "Protects floors and belongings; stops when something is unsafe", 5: "Proactive about hazards, knows the code / limits of their trade, protects people and property" } },
  business: { en: "Business readiness", es: "Preparación del negocio", anchors: { 1: "No insurance and unwilling to get it; no tools or transportation", 3: "Has or will get insurance; own tools and transportation; can use a phone app", 5: "Insured and licensed where needed, set up as a business, comfortable with app, photos and receipts" } },
};

export type TradeGroup = "cleaning" | "repair" | "outdoor" | "moving" | "painting" | "licensed" | "pets" | "transport" | "errands" | "events" | "security" | "recruiting";

const GROUP_OF: Record<string, TradeGroup> = {
  cleaning: "cleaning", windows: "cleaning", carpet: "cleaning", organizing: "cleaning", auto_detailing: "cleaning",
  gutters: "outdoor", lawn: "outdoor", tree: "outdoor", snow: "outdoor", pet_waste: "outdoor", pressure_washing: "outdoor",
  hauling: "moving", dumpster: "moving",
  handyman: "repair", remodel: "repair", low_voltage: "repair",
  painting: "painting",
  plumbing: "licensed", electrical: "licensed", hvac: "licensed",
  pet_care: "pets", transportation: "transport", errands: "errands", medical_courier: "errands",
  event_planner: "events", catering: "events", food_truck: "events", dj_music: "events", rentals: "events", venue: "events", security: "security", recruiter: "recruiting",
};
export const tradeGroups = (trades: string[]): TradeGroup[] => [...new Set(trades.map((t) => GROUP_OF[t]).filter(Boolean))] as TradeGroup[];

export interface InterviewQuestion { id: string; competency: Competency | null; group?: TradeGroup; en: string; es: string; lookFor: string; redFlag?: string }

const q = (id: string, competency: Competency | null, en: string, es: string, lookFor: string, redFlag?: string, group?: TradeGroup): InterviewQuestion => ({ id, competency, en, es, lookFor, redFlag, group });

export const QUESTIONS: InterviewQuestion[] = [
  // ── everyone ──
  q("intro", "skill", "Tell me about your business and the work you do most.", "Cuénteme sobre su negocio y el trabajo que hace con más frecuencia.", "Specific services, who their customers are, how long they've done it."),
  q("learned", "skill", "How long have you done this work, and how did you learn it?", "¿Cuánto tiempo lleva haciendo este trabajo y cómo lo aprendió?", "Years and real examples; apprenticeships, past companies or family business all count."),
  q("proud", "quality", "Describe a recent job you're proud of. What made it good?", "Describa un trabajo reciente del que esté orgulloso. ¿Qué lo hizo bueno?", "Concrete details; talks about the result for the customer, not just speed."),
  q("check", "quality", "Before you call a job done, how do you check your own work?", "Antes de dar un trabajo por terminado, ¿cómo revisa su propio trabajo?", "A walkthrough, photos, a list — some habit of checking.", "\"I just know\" / no habit of checking."),
  q("unhappy", "customer", "Tell me about a time a customer wasn't happy with the work. What did you do?", "Cuénteme de una vez que un cliente no quedó contento con el trabajo. ¿Qué hizo?", "Listened, fixed it, kept calm; owns mistakes.", "Blames the customer, argues, or walks away."),
  q("late", "reliability", "You're going to be 30 minutes late to a job. What do you do?", "Va a llegar 30 minutos tarde a un trabajo. ¿Qué hace?", "Tells the customer before the window starts, gives a real ETA.", "Doesn't tell anyone, or thinks lateness is normal."),
  q("capacity", "reliability", "Which areas and days do you want jobs in, and how many jobs a day can you do well?", "¿En qué zonas y días quiere trabajos, y cuántos trabajos al día puede hacer bien?", "Realistic capacity; knows their own limits. (They set this themselves.)"),
  q("cancel", "reliability", "What would make you cancel a job you'd already accepted, and how would you handle it?", "¿Qué haría que cancelara un trabajo que ya aceptó, y cómo lo manejaría?", "Only real emergencies; gives as much notice as possible.", "Would drop a job for a better-paying one."),
  q("extra", "customer", "At a job, the customer asks you to \"just do one more thing\" that wasn't booked. What do you do?", "En un trabajo, el cliente le pide que \"haga una cosa más\" que no estaba reservada. ¿Qué hace?", "Explains it's extra and sends a change order through the app before doing it.", "Does it off the books for cash."),
  q("cash", "business", `A customer offers you cash to come back next month without ${BRAND.name}. What do you say?`, `Un cliente le ofrece efectivo para regresar el próximo mes sin ${BRAND.name}. ¿Qué le dice?`, "Declines politely and keeps it on the app (their agreement has a 12-month non-solicit).", "Would take the cash job."),
  q("protect", "safety", "How do you protect a customer's home and belongings while you work?", "¿Cómo protege la casa y las pertenencias del cliente mientras trabaja?", "Covers floors, moves things carefully, asks before touching valuables."),
  q("unsafe", "safety", "You find something unsafe at a job — exposed wires, mold, a ladder or roof you don't trust. What do you do?", "Encuentra algo inseguro en un trabajo: cables expuestos, moho, una escalera o techo que no le da confianza. ¿Qué hace?", "Stops that part, tells the customer and us, doesn't work beyond their license.", "Pushes through anyway."),
  q("app", "business", "Our jobs use a phone app: you accept offers, follow a checklist and upload before-and-after photos. How comfortable are you with that?", "Nuestros trabajos usan una app: acepta ofertas, sigue una lista y sube fotos de antes y después. ¿Qué tan cómodo se siente con eso?", "Uses a smartphone daily, or has someone on their team who does."),
  q("insurance", "business", "Do you carry general liability insurance today? If not, are you willing to get it before your first job?", "¿Tiene hoy un seguro de responsabilidad civil general? Si no, ¿está dispuesto a obtenerlo antes de su primer trabajo?", "Yes, or a clear yes to getting it (we help with quotes).", "Won't carry insurance."),
  q("tools", "business", "What tools, equipment and transportation do you bring to a job?", "¿Qué herramientas, equipo y transporte lleva a un trabajo?", "Own tools and a way to get to jobs (and haul, if their trade needs it)."),
  q("crew", "business", "Do you work alone or with a crew? If you have helpers, who pays them and covers their insurance?", "¿Trabaja solo o con un equipo? Si tiene ayudantes, ¿quién les paga y cubre su seguro?", "Clear: their business pays and covers its own crew (workers' comp when they have employees)."),
  // ── by trade ──
  q("clean_deep", "skill", "Walk me through how a deep clean of a bathroom differs from a standard clean.", "Explíqueme en qué se diferencia una limpieza profunda de un baño de una limpieza estándar.", "Grout, glass and tracks, fixtures, baseboards, vents — and the time it takes.", undefined, "cleaning"),
  q("clean_surfaces", "safety", "Which products or methods do you avoid on natural stone, hardwood or stainless steel?", "¿Qué productos o métodos evita en piedra natural, madera o acero inoxidable?", "Knows acids/abrasives damage stone and finishes; tests in a hidden spot.", undefined, "cleaning"),
  q("repair_diagnose", "skill", "A door sticks and won't latch. How do you figure out what's wrong?", "Una puerta se atora y no cierra. ¿Cómo averigua qué está mal?", "Checks hinges and screws, strike plate, frame / settling — before planing.", undefined, "repair"),
  q("repair_limits", "safety", "When do you tell a customer a job needs a licensed electrician or plumber instead of you?", "¿Cuándo le dice a un cliente que un trabajo necesita un electricista o plomero con licencia en lugar de usted?", "Knows the line: new circuits, gas, main lines, permits.", "Would do licensed work without a license.", "repair"),
  q("outdoor_finish", "quality", "How do you make a yard look finished when you leave?", "¿Cómo deja un jardín con aspecto de terminado al irse?", "Edging, trimming around obstacles, blowing walks and drive, clippings off the street.", undefined, "outdoor"),
  q("outdoor_safety", "safety", "How do you keep rocks and debris from hitting cars, windows and people?", "¿Cómo evita que piedras y desechos golpeen autos, ventanas y personas?", "Walks the yard first, discharge direction, stops when people pass.", undefined, "outdoor"),
  q("moving_heavy", "safety", "How do you move a heavy dresser down a flight of stairs safely?", "¿Cómo baja un tocador pesado por una escalera de forma segura?", "Empty it, two people, straps/dolly, the strong person below, protect walls and floors.", undefined, "moving"),
  q("moving_damage", "customer", "You scratch a customer's floor while moving furniture. What do you do?", "Raya el piso de un cliente al mover un mueble. ¿Qué hace?", "Tells the customer right away, photos, reports it — never hides it.", "Hides it.", "moving"),
  q("paint_prep", "skill", "What prep do you do before painting a room?", "¿Qué preparación hace antes de pintar un cuarto?", "Move/cover furniture and floors, patch, sand, clean, tape or cut in, prime where needed.", undefined, "painting"),
  q("paint_lead", "safety", "What changes when the home was built before 1978?", "¿Qué cambia cuando la casa fue construida antes de 1978?", "Lead paint: EPA RRP certified firm, containment, no dry sanding.", undefined, "painting"),
  q("licensed_license", "business", "Which licenses do you hold, in which city or state, and when do they expire?", "¿Qué licencias tiene, en qué ciudad o estado, y cuándo vencen?", "Specific license types and numbers they can provide for verification.", undefined, "licensed"),
  q("licensed_permit", "safety", "When do you pull a permit, and how do you handle inspections?", "¿Cuándo saca un permiso y cómo maneja las inspecciones?", "Knows local rules; schedules inspections; doesn't skip them.", "Avoids permits.", "licensed"),
  q("pets_escape", "safety", "A dog slips out of its harness on a walk. What do you do?", "Un perro se zafa del arnés en un paseo. ¿Qué hace?", "Stays calm, doesn't chase into traffic, calls the owner and us right away.", undefined, "pets"),
  q("pets_sick", "customer", "During a visit, a pet seems sick. What do you do?", "Durante una visita, una mascota parece enferma. ¿Qué hace?", "Calls the owner, follows their vet instructions, documents it.", undefined, "pets"),
  q("transport_license", "business", "Who is the licensed operator for your vehicles, and what licenses and endorsements do your drivers hold?", "¿Quién es el operador con licencia de sus vehículos, y qué licencias y endosos tienen sus conductores?", "Named licensed operator; CDL / chauffeur license as required; commercial auto insurance.", undefined, "transport"),
  q("transport_rider", "safety", "A passenger is intoxicated and getting aggressive. What do you do?", "Un pasajero está ebrio y se pone agresivo. ¿Qué hace?", "Stays calm, stops safely, doesn't escalate, calls for help when needed and reports it.", undefined, "transport"),
  q("errands_proof", "quality", "How do you prove a delivery was made, and what do you do when nobody's there to receive it?", "¿Cómo comprueba que se hizo una entrega y qué hace cuando no hay nadie para recibirla?", "Photo, signature when required, follows instructions, never leaves sensitive items unattended.", undefined, "errands"),
  q("events_late", "reliability", "On event day you're running late or a piece of equipment fails. What do you do?", "El día del evento va tarde o falla un equipo. ¿Qué hace?", "Early arrival buffer, backup equipment, tells the planner right away.", undefined, "events"),
  q("security_license", "business", "Which security agency license do you hold, how do you register your guards, and do you provide armed officers?", "¿Qué licencia de agencia de seguridad tiene, cómo registra a sus guardias y ofrece oficiales armados?", "Michigan agency license (LARA) they can provide; guards are their employees and registered; armed only with proper authorization.", "Individual freelance guards, or no agency license.", "security"),
  q("security_deescalate", "safety", "A guest who's been drinking gets loud and pushes another guest. Walk me through what your guards do.", "Un invitado que ha estado bebiendo levanta la voz y empuja a otro invitado. Explíqueme qué hacen sus guardias.", "Calm de-escalation first, separate people, involve the host, call police when needed, never more force than the law allows, written incident report.", "Goes straight to force, or no incident reporting.", "security"),
  q("recruiting_placement", "skill", "Walk me through a recent hire you made, from the intake call to the start date. How did you find the person and close them?", "Cuénteme una contratación reciente que logró, desde la llamada de requisitos hasta el primer día. ¿Cómo encontró a la persona y cómo cerró la oferta?", "Clear intake, sourcing beyond job boards, real screening, managed both sides through offer, kept the candidate warm to the start date.", "Only posts ads and forwards résumés, or can't describe a close.", "recruiting"),
  q("recruiting_ethics", "customer", "A client asks you to send only candidates under 35 who are 'a good culture fit.' What do you do?", "Un cliente le pide que envíe solo candidatos menores de 35 años que 'encajen con la cultura'. ¿Qué hace?", "Declines the age requirement, explains it's illegal, steers the client to real job requirements, documents it.", "Goes along with it, or quietly filters candidates.", "recruiting"),
  q("questions", null, "What questions do you have for us?", "¿Qué preguntas tiene para nosotros?", "Not scored. Good questions about how offers, pay and support work are a plus."),
];

/** One candidate's questions: the core questions plus two for each of their trade groups (max 6 trade questions). */
export function interviewPlan(trades: string[]): InterviewQuestion[] {
  const groups = tradeGroups(trades);
  const core = QUESTIONS.filter((x) => !x.group && x.id !== "questions");
  const trade = groups.flatMap((g) => QUESTIONS.filter((x) => x.group === g)).slice(0, 6);
  return [...core.slice(0, 2), ...trade, ...core.slice(2), QUESTIONS.find((x) => x.id === "questions")!];
}

/** Topics no interviewer — person or AI — may ask about. If a candidate volunteers it, don't follow up and don't use it. */
export const DO_NOT_ASK: { en: string; es: string }[] = [
  { en: "Age or date of birth", es: "Edad o fecha de nacimiento" },
  { en: "Race, color, ethnicity, national origin, birthplace or accent", es: "Raza, color, etnia, origen nacional, lugar de nacimiento o acento" },
  { en: "Citizenship or immigration status", es: "Ciudadanía o estatus migratorio" },
  { en: "Religion or religious holidays", es: "Religión o días religiosos" },
  { en: "Sex, gender identity, sexual orientation", es: "Sexo, identidad de género, orientación sexual" },
  { en: "Marriage, pregnancy, children or childcare", es: "Matrimonio, embarazo, hijos o cuidado de niños" },
  { en: "Disability, health, medical history, medications, workers' comp claims", es: "Discapacidad, salud, historial médico, medicamentos, reclamos de compensación laboral" },
  { en: "Height, weight or genetic information", es: "Estatura, peso o información genética" },
  { en: "Arrests or criminal history (the background check handles this, with notice and a chance to respond)", es: "Arrestos o antecedentes penales (la verificación de antecedentes se encarga de esto, con aviso y oportunidad de responder)" },
  { en: "Military discharge type", es: "Tipo de baja militar" },
  { en: "Credit, debts, bankruptcy, or past pay", es: "Crédito, deudas, bancarrota o pagos anteriores" },
  { en: "Union membership or political views", es: "Afiliación sindical u opiniones políticas" },
  { en: "Language ability beyond what the job needs (we work in English and Spanish)", es: "Habilidad con idiomas más allá de lo que el trabajo requiere (trabajamos en inglés y español)" },
];

export type InterviewResult = "advance" | "follow_up" | "not_now";
export interface InterviewScore { competency: Competency; score: number; evidence?: string | null }

export const INTERVIEW_PASS = { average: 3.2, floor: 2 } as const;

/** The result from the scores and any knockout. It's a recommendation: a person makes the decision. */
export function scoreInterview(scores: InterviewScore[], knockouts: string[] = []): { result: InterviewResult; average: number; why: string } {
  const valid = scores.filter((s) => s.score >= 1 && s.score <= 5);
  const average = valid.length ? Math.round((valid.reduce((a, s) => a + s.score, 0) / valid.length) * 10) / 10 : 0;
  const missing = (Object.keys(COMPETENCIES) as Competency[]).filter((c) => !valid.some((s) => s.competency === c));
  if (knockouts.length) return { result: "not_now", average, why: `Knockout: ${knockouts.join("; ")}` };
  if (missing.length) return { result: "follow_up", average, why: `Not covered: ${missing.map((c) => COMPETENCIES[c].en).join(", ")}` };
  const low = valid.filter((s) => s.score < INTERVIEW_PASS.floor);
  if (low.length) return { result: average >= INTERVIEW_PASS.average ? "follow_up" : "not_now", average, why: `Low: ${low.map((s) => COMPETENCIES[s.competency].en).join(", ")}` };
  if (average >= INTERVIEW_PASS.average) return { result: "advance", average, why: `Average ${average} of 5` };
  return { result: average >= 2.6 ? "follow_up" : "not_now", average, why: `Average ${average} (needs ${INTERVIEW_PASS.average})` };
}

export const RESULT_LABEL: Record<InterviewResult, string> = { advance: "Advance — invite", follow_up: "Follow up — a short call first", not_now: "Not now" };

/** What the AI interviewer may tell candidates about us (and nothing it isn't sure of). */
export const INTERVIEW_FAQ = [
  `${BRAND.name} sends paid, upfront-priced job offers to independent pros through an app. You choose which jobs to take; passing never counts against you.`,
  "Pros are independent businesses (1099), not employees. You set your own days, area and daily job limit, and use your own methods and tools.",
  "The pay for each job is shown before you accept. Pay is sent weekly; instant cash-out is optional for a small fee. Any pay figures before you're approved are estimates.",
  "To be approved: this interview, a W-9, the independent contractor agreement, general liability insurance (and trade licenses where required), a photo ID check and a background check.",
  "Jobs come with a checklist and need before-and-after photos in the app.",
  "If you have a crew, your business pays and directs them and handles their insurance; each person who goes into a home passes our background check.",
  "We work in English and Spanish.",
];

// ── Approval checklist: application → approved → first job ─────────────────

export interface ApprovalStep { key: string; en: string; es: string; done: boolean; detail?: string | null; who: "candidate" | "staff" | "system" }

export interface ApprovalInput {
  applied_at?: string | null;
  ai_screen?: { score?: number; recommendation?: string } | null;
  interview?: { status: string; result?: InterviewResult | null; decided?: string | null; mode?: string | null } | null;
  invited_at?: string | null;
  /** The pro signed in with their application email (their pro account exists and is linked). */
  account_linked?: boolean;
  onboarding?: { key: string; label: string; done: boolean; detail?: string }[];
  approved?: boolean;
  first_job_done?: boolean;
}

export function approvalChecklist(a: ApprovalInput): { steps: ApprovalStep[]; next: ApprovalStep | null; pct: number } {
  const steps: ApprovalStep[] = [
    { key: "applied", en: "Application received", es: "Solicitud recibida", done: Boolean(a.applied_at), detail: a.applied_at?.slice(0, 10) ?? null, who: "candidate" },
    { key: "screen", en: "Application screened", es: "Solicitud revisada", done: Boolean(a.ai_screen), detail: a.ai_screen ? `AI ${a.ai_screen.score ?? "?"} · ${String(a.ai_screen.recommendation ?? "").replace(/_/g, " ")}` : null, who: "system" },
    { key: "interview", en: "Screening interview done", es: "Entrevista realizada", done: a.interview?.status === "completed", detail: a.interview ? `${a.interview.mode === "human" ? "In person / phone" : "AI"} · ${a.interview.status}${a.interview.result ? ` · ${RESULT_LABEL[a.interview.result]}` : ""}` : "Send the AI interview link or interview them yourself", who: "candidate" },
    { key: "decision", en: "Decision by a person: invite", es: "Decisión de una persona: invitar", done: Boolean(a.invited_at), detail: a.invited_at ? `Invited ${a.invited_at.slice(0, 10)}` : null, who: "staff" },
    { key: "account", en: "Pro account created: signed in with the application email", es: "Cuenta de profesional creada: inició sesión con el correo de su solicitud", done: Boolean(a.account_linked), detail: a.account_linked ? null : a.invited_at ? "The invite email has a one-click sign-in link; or they choose “I'm a pro” at Sign in" : null, who: "candidate" },
    ...(a.onboarding ?? []).map((s) => ({ key: `setup:${s.key}`, en: s.label, es: s.label, done: s.done, detail: s.detail ?? null, who: (s.key === "background" || s.key === "coi" || s.key === "license" || s.key.startsWith("coverage:") ? "staff" : "candidate") as ApprovalStep["who"] })),
    { key: "approved", en: "Approved — receiving job offers", es: "Aprobado: recibe ofertas de trabajo", done: Boolean(a.approved), who: "system" },
    { key: "first_job", en: "First job completed and reviewed", es: "Primer trabajo completado y revisado", done: Boolean(a.first_job_done), who: "candidate" },
  ];
  const next = steps.find((s) => !s.done) ?? null;
  return { steps, next, pct: Math.round((steps.filter((s) => s.done).length / steps.length) * 100) };
}
