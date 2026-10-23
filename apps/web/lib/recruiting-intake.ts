/*
 * FILE    : apps/web/lib/recruiting-intake.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1100 UTC
 * PURPOSE : One way in for candidates who didn't use the /pros form — Indeed Apply (api/indeed/apply), CSV imports and
 *           staff adding someone by hand (api/hub/recruiting/candidates). addCandidate():
 *             · already a pro → not added again (reported back)
 *             · same ATS application id → duplicate (Indeed re-delivers)
 *             · an open application with the same email → updated, not duplicated
 *             · else a new contractor_applications row, logged to recruiting_events
 *             · résumé (base64) → private pro-docs bucket, applications/<id>/…
 *             · optional confirmation email (English / Spanish) with what happens next
 *           The caller runs onApplication() afterwards (AI screen → interview / invite / ask staff), as the /pros form does.
 */
import "server-only";
import { BRAND, type Candidate } from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { logRecruiting } from "./recruiting";

export type AddResult = { status: "added" | "updated" | "duplicate" | "existing_pro"; id?: string; email: string; name: string; error?: string };

const RESUME_EXT: Record<string, string> = {
  "application/pdf": "pdf", "application/msword": "doc", "text/plain": "txt", "application/rtf": "rtf", "text/rtf": "rtf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

async function saveResume(appId: string, r: NonNullable<Candidate["resume"]>): Promise<string | null> {
  const bytes = Buffer.from(r.data, "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return null;
  const ext = RESUME_EXT[r.contentType] ?? (r.fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `applications/${appId}/resume-${Date.now()}.${ext}`;
  const { error } = await adminClient().storage.from("pro-docs").upload(path, bytes, { contentType: r.contentType });
  return error ? null : path;
}

export async function addCandidate(c: Candidate, opts: { actor: string; confirm: boolean; locale?: "en" | "es" }): Promise<AddResult> {
  const db = adminClient();
  const email = c.email.trim().toLowerCase();
  const base = { email, name: c.full_name };
  if (c.external_id) {
    const { data: dup } = await db.from("contractor_applications").select("id").eq("external_source", c.source).eq("external_id", c.external_id).maybeSingle();
    if (dup) return { ...base, status: "duplicate", id: dup.id };
  }
  const { data: pro } = await db.from("contractors").select("id").ilike("email", email).maybeSingle();
  if (pro) {
    await logRecruiting("reapplied", { contractorId: pro.id }, `via ${c.source}`, opts.actor);
    return { ...base, status: "existing_pro" };
  }
  const { data: prior } = await db.from("contractor_applications").select("id").ilike("email", email).in("stage", ["applied", "screened"]).maybeSingle();
  const message = [c.message, c.location && `Location: ${c.location}`].filter(Boolean).join("\n").slice(0, 2000) || null;
  const row = {
    business_name: c.business_name || c.full_name, contact_name: c.full_name, email, phone: c.phone || "",
    trades: c.trades, zips: c.zips ?? null, years_experience: c.years_experience ?? null, message,
    source: c.source, external_source: c.external_id ? c.source : null, external_id: c.external_id ?? null,
    external_job: c.external_job ?? null, screener: c.screener ?? null, added_by: opts.actor === "indeed" ? null : opts.actor,
    locale: opts.locale ?? "en", last_contact_at: new Date().toISOString(),
  };
  const { data, error } = prior
    ? await db.from("contractor_applications").update(row).eq("id", prior.id).select("id").single()
    : await db.from("contractor_applications").insert(row).select("id").single();
  if (error || !data) return { ...base, status: "added", error: error?.message ?? "Couldn't save" };
  const job = (c.external_job?.title as string | undefined) ?? null;
  await logRecruiting(prior ? "application_updated" : "applied", { applicationId: data.id }, [c.source, job && `job: ${job}`, c.trades.length ? null : "trade unknown: set it on the candidate page"].filter(Boolean).join(" · "), opts.actor);
  if (c.resume) {
    const path = await saveResume(data.id, c.resume).catch(() => null);
    if (path) await db.from("contractor_applications").update({ resume_path: path }).eq("id", data.id);
  }
  if (opts.confirm && !prior) await confirmEmail(email, c.full_name, opts.locale ?? "en");
  return { ...base, status: prior ? "updated" : "added", id: data.id };
}

async function confirmEmail(email: string, name: string, locale: "en" | "es") {
  const first = name.split(/[\s,]+/).filter(Boolean)[0] ?? "";
  if (locale === "es") return sendEmail(email, `Recibimos su solicitud en ${BRAND.name}`,
    `Hola ${first}:\n\nGracias por su interés en trabajar con ${BRAND.name} como profesional independiente. Revisamos su solicitud normalmente el mismo día. Si es una buena opción, recibirá un enlace para una breve entrevista y luego su lista de configuración (W-9, contrato, seguro, verificación de antecedentes y pago).\n\nCómo funciona para los profesionales: ${siteUrl()}/pros\n\n— ${BRAND.name}`);
  return sendEmail(email, `We got your ${BRAND.name} application`,
    `Hi ${first},\n\nThanks for your interest in working with ${BRAND.name} as an independent pro. We usually review applications the same day. If it's a fit, you'll get a link to a short interview, then your setup checklist (W-9, agreement, insurance, background check, payout).\n\nHow it works for pros: ${siteUrl()}/pros\n\n— ${BRAND.name}`);
}
