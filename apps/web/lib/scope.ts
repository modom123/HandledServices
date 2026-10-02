/*
 * FILE    : apps/web/lib/scope.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2334 UTC
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of customer and pro texts, emails, push and timeline.
 * PURPOSE : The last line against underbidding. The pro on site finds more work than booked
 *           (a bigger load, another room), updates the scope in the app, and the rules engine
 *           prices the difference. The customer gets a change order to approve and pay; the pro
 *           only does the extra work once it's paid (paying raises the price and the payout).
 */
import "server-only";
import { BRAND, applyCorrections, getService, isRush, money, scopeChange } from "@handled/core";
import { adminClient } from "./supabase/server";
import { addEvent, getJob, raiseAlert } from "./jobs";
import { notify } from "./push";
import { createCheckout } from "./stripe";

export async function requestScopeChange(jobId: string, contractorId: string, actual: Record<string, string | number | boolean>, note: string) {
  const job = await getJob(jobId);
  if (!job || job.contractor_id !== contractorId) return { ok: false, error: "Not your job" };
  if (!["assigned", "in_progress"].includes(job.status) || job.remedy) return { ok: false, error: "Scope changes are for active, paid jobs" };
  const svc = getService(job.service_slug)!;
  const booked = job.answers as Record<string, string | number | boolean>;
  const fixed = applyCorrections(svc.slug, booked, Object.entries(actual).map(([question_id, value]) => ({ question_id, value, reason: note })));
  if (!fixed.changes.length) return { ok: false, error: "Nothing changed — adjust the scope to what's really there" };
  const sc = scopeChange(svc.slug, booked, fixed.answers, job.frequency ?? "once", isRush(job.scheduled_date));
  if (sc.extra <= 0) return { ok: false, error: "That change doesn't add to the price — go ahead with the booked work." };
  const what = fixed.changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join("; ");
  const link = await createCheckout({
    amount: sc.extra, kind: "change_order", job, name: `Extra work — ${svc.name} ${job.ref}`,
    description: `${what}${note ? `. ${note}` : ""}`, customerEmail: job.contact_email, customerName: job.contact_name, createdBy: "pro (on site)",
  });
  await adminClient().from("jobs").update({ scope_extra: Number(job.scope_extra ?? 0) + sc.extra }).eq("id", jobId);
  await addEvent(jobId, "scope_change", `Your pro found more work than booked: ${what}. Extra ${money(sc.extra)} — approve to add it.`, "pro", true,
    `Su profesional encontró más trabajo del reservado: ${what}. Costo adicional de ${money(sc.extra)} — apruébelo para agregarlo.`);
  await notify(job.customer_id, {
    title: `Approve extra work: ${money(sc.extra)}`, body: `${what}. Your pro is on site.`, data: { type: "job", jobId },
    email: { to: job.contact_email, subject: `Your pro found more work — approve ${money(sc.extra)}? (${job.ref})`,
      text: `Your pro found more work than was booked: ${what}.${note ? `\n\nTheir note: ${note}` : ""}\n\nExtra cost at our standard prices: ${money(sc.extra)}.${link ? `\n\nApprove & pay: ${link.url}` : ""}\n\nIf you'd rather not, reply or call us — your pro will finish the work you booked at the price you paid.\n\n— ${BRAND.name}` },
    locale: job.locale,
    es: {
      title: `Apruebe el trabajo adicional: ${money(sc.extra)}`, body: `${what}. Su profesional está en el lugar.`,
      subject: `Su profesional encontró más trabajo — ¿aprueba ${money(sc.extra)}? (${job.ref})`,
      text: `Su profesional encontró más trabajo del que se reservó: ${what}.${note ? `\n\nSu nota: ${note}` : ""}\n\nCosto adicional según nuestros precios estándar: ${money(sc.extra)}.${link ? `\n\nAprobar y pagar: ${link.url}` : ""}\n\nSi prefiere no hacerlo, responda o llámenos — su profesional terminará el trabajo que reservó al precio que pagó.\n\n— ${BRAND.name}`,
    },
  });
  await raiseAlert("scope", "info", `${job.ref}: scope +${money(sc.extra)} on site`, `${what}. Change order sent to the customer${link ? "" : " — Stripe not configured, collect by hand"}.`, jobId);
  return { ok: true, extra: sc.extra, before: sc.before, after: sc.after, url: link?.url ?? null };
}
