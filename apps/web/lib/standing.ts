/*
 * FILE    : apps/web/lib/standing.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0122 UTC
 * PURPOSE : Pro standing, exactly as the Pro Deactivation Policy describes:
 *             proReleaseJob    — a pro can hand back an accepted job; inside 24h of the window
 *                                it's recorded as a late cancel. The job goes straight back out.
 *             markNoShow       — staff record a no-show (a person decides — never automatic)
 *             standingSweep    — daily: objective thresholds → a written WARNING with reasons and
 *                                30 days to improve; still over after that → a person reviews.
 *                                Never deactivates by itself. Also orders the yearly background re-check.
 *             setStanding      — staff: warn, suspend (safety/fraud only, immediate), deactivate,
 *                                reinstate, decide an appeal — always with a written reason
 *             appealStanding   — the pro appeals within 14 days; a person decides within 7
 *           Money earned is always paid, whatever the standing.
 */
import "server-only";
import { BRAND, DEACTIVATION_RULES as R, standingIssues, type Job } from "@handled/core";
import { adminClient } from "./supabase/server";
import { addEvent, dispatchJob, getJob, raiseAlert } from "./jobs";
import { notify } from "./push";
import { siteUrl } from "./notify";
import { orderBackgroundCheck } from "./recruiting";

const db = () => adminClient();
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const WINDOW_START: Record<string, number> = { morning: 8, midday: 11, afternoon: 14, flexible: 8 };

export async function recordStanding(contractorId: string, kind: string, o: { jobId?: string | null; note?: string | null; actor?: string } = {}) {
  await db().from("pro_standing_events").insert({ contractor_id: contractorId, kind, job_id: o.jobId ?? null, note: o.note ?? null, actor: o.actor ?? "system" });
}

async function tellPro(contractorId: string, en: { title: string; body: string; email: string }, es: { title: string; body: string; email: string }) {
  const { data: c } = await db().from("contractors").select("profile_id, email").eq("id", contractorId).single();
  await notify(c?.profile_id, {
    title: en.title, body: en.body, data: { type: "standing" },
    email: c?.email ? { to: c.email, subject: `${BRAND.name}: ${en.title}`, text: `${en.email}\n\n${siteUrl()}/pro\n\n— ${BRAND.name}` } : null,
    es: { title: es.title, body: es.body, subject: `${BRAND.name}: ${es.title}`, text: `${es.email}\n\n${siteUrl()}/pro\n\n— ${BRAND.name}` },
  });
}

/** Hours until the start of the job's arrival window (local time is close enough for the 24h rule). */
function hoursUntil(job: Pick<Job, "scheduled_date" | "time_window">) {
  if (!job.scheduled_date) return Infinity;
  const start = new Date(`${job.scheduled_date}T${String(WINDOW_START[job.time_window] ?? 8).padStart(2, "0")}:00:00`);
  return (start.getTime() - Date.now()) / 3600000;
}

/** The pro can't do a job they accepted: it goes back out right away. Inside 24h it counts as a late cancel. */
export async function proReleaseJob(jobId: string, contractorId: string, reason: string) {
  const job = await getJob(jobId);
  if (!job || job.contractor_id !== contractorId || !["assigned", "scheduled"].includes(job.status)) return { ok: false, error: "You can only hand back an upcoming job that's yours" };
  const late = hoursUntil(job) < R.lateCancelHours;
  await db().from("jobs").update({ contractor_id: null, status: "dispatched" }).eq("id", jobId);
  await db().from("job_offers").update({ status: "declined" }).eq("job_id", jobId).eq("contractor_id", contractorId);
  if (late) await recordStanding(contractorId, "late_cancel", { jobId, note: reason, actor: "pro" });
  await addEvent(jobId, "pro_released", `Pro handed the job back${late ? " (inside 24h — late cancel)" : ""}: ${reason}`, "pro", false);
  await addEvent(jobId, "reassigning", "We're confirming a new pro for your booking — same time, nothing changes for you.", "system", true, "Estamos confirmando un nuevo profesional para su reserva — misma hora, no cambia nada para usted.");
  await dispatchJob(jobId, { exclude: [contractorId] }).catch((e) => console.error("[release]", e));
  if (late) await raiseAlert("pro_late_cancel", "warn", `${job.ref}: pro cancelled inside 24h`, `${reason}. Re-dispatched; watch it until a new pro accepts.`, jobId);
  return { ok: true, late };
}

/** Staff record a no-show after checking with the customer. */
export async function markNoShow(jobId: string, actor: string, note: string) {
  const job = await getJob(jobId);
  if (!job?.contractor_id) return { ok: false, error: "No pro on this job" };
  const pro = job.contractor_id;
  await recordStanding(pro, "no_show", { jobId, note, actor });
  await db().from("jobs").update({ contractor_id: null, status: "dispatched" }).eq("id", jobId);
  await addEvent(jobId, "no_show", `Pro no-show recorded: ${note}`, actor, false);
  await dispatchJob(jobId, { exclude: [pro] }).catch((e) => console.error("[no-show]", e));
  await tellPro(pro,
    { title: `No-show recorded for ${job.ref}`, body: "Tell us if this is wrong.", email: `We recorded a no-show for ${job.ref}: ${note}\n\nIf this is wrong (for example, the customer wasn't there), reply to this email and we'll correct it.` },
    { title: `Se registró una ausencia en ${job.ref}`, body: "Avísenos si es un error.", email: `Registramos una ausencia (no se presentó) en ${job.ref}: ${note}\n\nSi es un error (por ejemplo, el cliente no estaba), responda a este correo y lo corregimos.` });
  return { ok: true };
}

/** Daily: written warnings from objective thresholds, review flags after the improvement period, yearly re-checks. */
export async function standingSweep() {
  const since = new Date(Date.now() - R.windowDays * 86400000).toISOString();
  const { data: pros } = await db().from("contractors").select("id, business_name, standing, improve_by, background_checked, background_checked_at, background_recheck_due").eq("status", "approved");
  let warned = 0, reviews = 0, rechecks = 0;
  for (const c of (pros ?? []) as { id: string; business_name: string; standing: string; improve_by: string | null; background_checked: boolean; background_checked_at: string | null; background_recheck_due: string | null }[]) {
    const [{ data: ev }, { data: revs }, { data: mine }] = await Promise.all([
      db().from("pro_standing_events").select("kind").eq("contractor_id", c.id).in("kind", ["late_cancel", "no_show"]).gte("created_at", since),
      db().from("reviews").select("rating").eq("contractor_id", c.id).order("created_at", { ascending: false }).limit(R.ratedJobs),
      db().from("jobs").select("id").eq("contractor_id", c.id).is("remedy", null).gte("completed_at", since).limit(2000),
    ]);
    // quality problems that reached the customer: a redo was needed on this pro's job
    const ids = ((mine ?? []) as { id: string }[]).map((j) => j.id);
    const { data: qa } = ids.length ? await db().from("jobs").select("id").eq("remedy", "redo").in("parent_job_id", ids) : { data: [] };
    const issues = standingIssues({
      ratings: ((revs ?? []) as { rating: number }[]).map((r) => r.rating),
      lateCancels: ((ev ?? []) as { kind: string }[]).filter((e) => e.kind === "late_cancel").length,
      noShows: ((ev ?? []) as { kind: string }[]).filter((e) => e.kind === "no_show").length,
      qaFailures: (qa ?? []).length,
    });
    const today = day(0);
    if (issues.length && c.standing === "good") {
      await db().from("contractors").update({ standing: "warned", standing_reason: issues.join("; "), warned_at: new Date().toISOString(), improve_by: day(R.improveDays) }).eq("id", c.id);
      await recordStanding(c.id, "warning", { note: issues.join("; ") });
      await tellPro(c.id,
        { title: "A written warning about your standing", body: `You have ${R.improveDays} days to improve.`, email: `This is a written warning under the Pro Deactivation Policy. What we see over the last ${R.windowDays} days:\n• ${issues.join("\n• ")}\n\nYou keep getting offers. You have ${R.improveDays} days (until ${day(R.improveDays)}) to bring these back within the limits; then a person reviews your account. If any of this is wrong — for example a late cancel caused by a customer — reply and we'll correct it. You can also appeal within ${R.appealDays} days.` },
        { title: "Advertencia por escrito sobre su estado", body: `Tiene ${R.improveDays} días para mejorar.`, email: `Esta es una advertencia por escrito según la Política de desactivación de profesionales. Lo que vemos en los últimos ${R.windowDays} días:\n• ${issues.join("\n• ")}\n\nSigue recibiendo ofertas. Tiene ${R.improveDays} días (hasta el ${day(R.improveDays)}) para volver a estar dentro de los límites; después una persona revisa su cuenta. Si algo es un error — por ejemplo, una cancelación tardía causada por un cliente — responda y lo corregimos. También puede apelar dentro de ${R.appealDays} días.` });
      await raiseAlert("pro_standing", "info", `Written warning sent: ${c.business_name}`, issues.join("; "));
      warned++;
    } else if (c.standing === "warned" && c.improve_by && c.improve_by < today) {
      if (issues.length) {
        await db().from("contractors").update({ improve_by: null }).eq("id", c.id); // flag once
        await raiseAlert("pro_standing", "warn", `Review standing: ${c.business_name}`, `Still over the limits ${R.improveDays} days after a written warning: ${issues.join("; ")}. A person decides in Hub → Pros (deactivate with a written reason, or keep).`);
        reviews++;
      } else {
        await db().from("contractors").update({ standing: "good", standing_reason: null, improve_by: null }).eq("id", c.id);
        await recordStanding(c.id, "note", { note: "Back in good standing after the improvement period." });
        await tellPro(c.id, { title: "You're back in good standing", body: "Thanks — the warning is closed.", email: "Your numbers are back within the limits, so the warning is closed. Thank you." },
          { title: "Volvió a estar en buen estado", body: "Gracias — la advertencia está cerrada.", email: "Sus cifras volvieron a estar dentro de los límites, así que la advertencia está cerrada. Gracias." });
      }
    }
    // yearly background re-check (the pro keeps working while it runs)
    const lastCheck = c.background_checked_at ? new Date(c.background_checked_at).getTime() : null;
    if (c.background_checked && lastCheck && Date.now() - lastCheck > R.recheckDays * 86400000 && (!c.background_recheck_due || c.background_recheck_due < today)) {
      await db().from("contractors").update({ background_recheck_due: day(14), background_status: null }).eq("id", c.id);
      await orderBackgroundCheck(c.id, { recheck: true });
      rechecks++;
    }
  }
  // appeals waiting past the 7-day promise
  const { data: late } = await db().from("contractors").select("business_name, appeal_decide_by").not("appeal_decide_by", "is", null).lt("appeal_decide_by", day(0));
  for (const a of (late ?? []) as { business_name: string }[]) await raiseAlert("pro_standing", "critical", `Appeal overdue: ${a.business_name}`, `We promise a decision within ${R.decisionDays} days. Decide in Hub → Pros.`);
  return { warned, reviews, rechecks };
}

type StandingAction = "warn" | "suspend" | "deactivate" | "reinstate" | "uphold_appeal";

/** Staff decisions — always with a written reason that goes to the pro. */
export async function setStanding(contractorId: string, action: StandingAction, reason: string, actor: string) {
  const { data: c } = await db().from("contractors").select("business_name, standing").eq("id", contractorId).single();
  if (!c) return { ok: false, error: "Pro not found" };
  const patch: Record<string, unknown> =
    action === "warn" ? { standing: "warned", standing_reason: reason, warned_at: new Date().toISOString(), improve_by: day(R.improveDays) }
    : action === "suspend" ? { status: "suspended", standing: "suspended", standing_reason: reason, appeal_by: day(R.appealDays) }
    : action === "deactivate" ? { status: "suspended", standing: "deactivated", standing_reason: reason, appeal_by: day(R.appealDays) }
    : action === "reinstate" ? { status: "approved", standing: "good", standing_reason: null, improve_by: null, appeal_by: null, appeal_decide_by: null }
    : { appeal_decide_by: null };
  await db().from("contractors").update(patch).eq("id", contractorId);
  const kind = { warn: "warning", suspend: "suspension", deactivate: "deactivation", reinstate: "reinstated", uphold_appeal: "appeal_upheld" }[action];
  await recordStanding(contractorId, kind, { note: reason, actor });
  const appeal = `You can appeal within ${R.appealDays} days from your pro portal; a person decides within ${R.decisionDays} days. Everything you've earned is still paid on the normal schedule.`;
  const appealEs = `Puede apelar dentro de ${R.appealDays} días desde su portal; una persona decide dentro de ${R.decisionDays} días. Todo lo que ganó se le paga en el calendario normal.`;
  const msg = {
    warn: [{ title: "A written warning about your standing", body: `You have ${R.improveDays} days to improve.`, email: `Written warning: ${reason}\n\nYou keep getting offers. You have ${R.improveDays} days to improve before a review. ${appeal}` },
      { title: "Advertencia por escrito sobre su estado", body: `Tiene ${R.improveDays} días para mejorar.`, email: `Advertencia por escrito: ${reason}\n\nSigue recibiendo ofertas. Tiene ${R.improveDays} días para mejorar antes de una revisión. ${appealEs}` }],
    suspend: [{ title: "Your account is paused", body: "Offers are paused while we look into something.", email: `We've paused new offers while we look into this: ${reason}\n\n${appeal}` },
      { title: "Su cuenta está en pausa", body: "Las ofertas están en pausa mientras revisamos algo.", email: `Pausamos las ofertas nuevas mientras revisamos esto: ${reason}\n\n${appealEs}` }],
    deactivate: [{ title: "Your account has been deactivated", body: "You can appeal within 14 days.", email: `We've stopped sending you offers. Reason: ${reason}\n\n${appeal}` },
      { title: "Su cuenta fue desactivada", body: "Puede apelar dentro de 14 días.", email: `Dejamos de enviarle ofertas. Motivo: ${reason}\n\n${appealEs}` }],
    reinstate: [{ title: "You're active again", body: "Offers are back on.", email: `Your account is active again and offers are back on. ${reason}` },
      { title: "Está activo de nuevo", body: "Las ofertas se reactivaron.", email: `Su cuenta está activa de nuevo y las ofertas se reactivaron. ${reason}` }],
    uphold_appeal: [{ title: "Appeal decision", body: "We reviewed your appeal.", email: `We reviewed your appeal and the decision stands. Why: ${reason}\n\nEverything you've earned is still paid on the normal schedule.` },
      { title: "Decisión sobre su apelación", body: "Revisamos su apelación.", email: `Revisamos su apelación y la decisión se mantiene. Motivo: ${reason}\n\nTodo lo que ganó se le paga en el calendario normal.` }],
  }[action];
  await tellPro(contractorId, msg[0], msg[1]);
  return { ok: true };
}

/** The pro appeals a warning, suspension, deactivation or deduction decision. */
export async function appealStanding(contractorId: string, text: string) {
  const { data: c } = await db().from("contractors").select("business_name, standing, appeal_by, appeal_decide_by").eq("id", contractorId).single();
  if (!c || c.standing === "good") return { ok: false, error: "There's nothing to appeal right now" };
  if (c.appeal_decide_by) return { ok: false, error: "Your appeal is already with us — we'll decide by " + c.appeal_decide_by };
  if (c.appeal_by && c.appeal_by < day(0)) return { ok: false, error: "The appeal window has closed — reply to our email and we'll still look" };
  await db().from("contractors").update({ appeal_decide_by: day(R.decisionDays) }).eq("id", contractorId);
  await recordStanding(contractorId, "appeal", { note: text.slice(0, 4000), actor: "pro" });
  await raiseAlert("pro_standing", "warn", `Appeal from ${c.business_name} — decide by ${day(R.decisionDays)}`, `"${text.slice(0, 600)}"\n\nDecide in Hub → Pros: reinstate, or keep the decision with a written reason.`);
  return { ok: true };
}
