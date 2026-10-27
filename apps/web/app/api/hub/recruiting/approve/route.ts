/*
 * FILE    : apps/web/app/api/hub/recruiting/approve/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1900 UTC
 * PURPOSE : "I screened the résumé and did the phone interview — they're in." Staff enter an approved pro (Hub →
 *           Recruiting → Add an approved pro) and the system takes over from there: no AI screen or AI interview, the
 *           phone interview is recorded on their history (who, when, notes), their résumé goes into their pro file, and
 *           they're invited at once — one-click sign-in, the setup checklist and the road to their first paycheck by
 *           email (EN/ES), then the usual reminders, document checks, background check, auto-activation and job offers.
 *             POST { mode: "read", resume }  → the résumé reader's guesses for the form (name, email, trades, skills…)
 *             POST { mode: "approve", full_name, email, phone?, business_name?, trades[1..], specialties[], zips?,
 *                    years_experience?, interviewed: true, interview_notes?, resume?, source, locale }
 *                    → { ok, appId, contractorId }
 *           resume = { data (base64), fileName, contentType }: PDF, Word or a photo, up to 4 MB.
 */
import { z } from "zod";
import { MAX_TRADES, TRADES, cleanPhone, specialtiesFor } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { addCandidate } from "@/lib/recruiting-intake";
import { inviteApplicant, logRecruiting } from "@/lib/recruiting";
import { adminClient } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/ai/client";
import { aiReadResume, canReadResume } from "@/lib/ai/resume";

const RESUME_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"];
const Resume = z.object({
  data: z.string().min(1).max(5_600_000, "Résumé must be under 4 MB"), fileName: z.string().max(200).default("resume"),
  contentType: z.string().refine((t) => RESUME_TYPES.includes(t), "Résumé must be a PDF, Word document or photo"),
});
const ids = new Set(TRADES.map((t) => t.id));
const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("read"), resume: Resume }),
  z.object({
    mode: z.literal("approve"),
    full_name: z.string().trim().min(2, "Enter their name").max(120), email: z.string().trim().email("Enter a valid email"), phone: z.string().max(40).optional(),
    business_name: z.string().max(120).optional(), trades: z.array(z.string()).min(1, "Pick at least one trade").max(MAX_TRADES),
    specialties: z.array(z.string().max(40)).max(60).default([]), zips: z.string().max(400).optional(),
    years_experience: z.coerce.number().int().min(0).max(80).optional(),
    interviewed: z.literal(true, { message: "Confirm you did the phone interview" }), interview_notes: z.string().max(2000).optional(),
    resume: Resume.optional(), source: z.string().trim().min(1).max(60).default("indeed"), locale: z.enum(["en", "es"]).default("en"),
  }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, p.error.issues.map((i) => i.message).join("; "));
  const d = p.data, who = v!.fullName ?? v!.email ?? "staff";

  if (d.mode === "read") {
    if (!canReadResume(d.resume.contentType)) return Response.json({ ok: true, read: null, note: "Word files can't be read automatically — fill in the form; the résumé is still saved to their file." });
    if (!aiEnabled()) return Response.json({ ok: true, read: null, note: "The résumé reader is off (no AI key) — fill in the form; the résumé is still saved to their file." });
    const read = await aiReadResume(d.resume);
    return Response.json({ ok: true, read, note: read?.readable === false ? "That doesn't look like a readable résumé — check the file or fill in the form." : read ? "Filled in from the résumé — check everything before you approve." : "Couldn't read it this time — fill in the form." });
  }

  const trades = d.trades.filter((t) => ids.has(t));
  if (!trades.length) return deny(400, "Pick at least one trade");
  const skillIds = new Set(specialtiesFor(trades).map((s) => s.id));
  const added = await addCandidate({
    full_name: d.full_name, email: d.email.toLowerCase(), phone: cleanPhone(d.phone ?? ""), business_name: d.business_name || undefined,
    trades, specialties: d.specialties.filter((s) => skillIds.has(s)), zips: d.zips || undefined, years_experience: d.years_experience,
    message: d.interview_notes || undefined, source: d.source.toLowerCase(), resume: d.resume,
  }, { actor: who, confirm: false, locale: d.locale });
  if (added.status === "existing_pro") return deny(409, `${d.email} is already a pro — open them in Hub → Pros`);
  if (added.error || !added.id) return deny(500, added.error ?? "Couldn't save the candidate");
  await logRecruiting("phone_interview", { applicationId: added.id }, `Résumé screened and phone interview done by ${who}${d.interview_notes ? ` — ${d.interview_notes}` : ""}`, who);
  const inv = await inviteApplicant(added.id, who, "approved after résumé screen and phone interview");
  if (!inv.ok || !inv.contractorId) return deny(400, inv.error ?? "Couldn't invite");

  // the résumé goes straight into the pro's file, so "Resume uploaded" is already done on their checklist
  const db = adminClient();
  const { data: app } = await db.from("contractor_applications").select("resume_path").eq("id", added.id).single();
  if (app?.resume_path) {
    const at = new Date().toISOString();
    await db.from("contractor_documents").insert({ contractor_id: inv.contractorId, kind: "resume", storage_path: app.resume_path, status: "verified", verified_by: who, verified_at: at });
    await db.from("contractors").update({ resume_uploaded_at: at }).eq("id", inv.contractorId);
  }
  return Response.json({ ok: true, appId: added.id, contractorId: inv.contractorId, resumeFiled: Boolean(app?.resume_path) });
}
