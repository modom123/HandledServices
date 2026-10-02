/*
 * FILE    : apps/web/app/api/hub/recruiting/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0006 UTC
 * PURPOSE : Staff actions on the recruiting pipeline and its automation settings.
 *             POST { action: "nudge" | "revive" | "note" | "background_clear" | "order_background", contractor_id?, application_id?, note? }
 *             PUT  { autoInvite, minScore, autoActivate, reminderDays, dropAfterDays, decisionHours }  (admin)
 */
import { z } from "zod";
import { BRAND, onboardingChecklist } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/push";
import { afterOnboardingStep, logRecruiting, onBackgroundResult, orderBackgroundCheck, saveRecruitingSettings, signInUrl } from "@/lib/recruiting";

const Action = z.object({
  action: z.enum(["nudge", "revive", "note", "background_clear", "order_background"]),
  contractor_id: z.string().uuid().optional(), application_id: z.string().uuid().optional(), note: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const p = Action.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, "Invalid action");
  const who = v!.fullName ?? v!.email;
  const { action, contractor_id: cid, application_id: aid, note } = p.data;
  const db = adminClient();
  if (action === "note") { await logRecruiting("note", { contractorId: cid, applicationId: aid }, note ?? "", who); return Response.json({ ok: true }); }
  if (!cid) return deny(400, "contractor_id required");
  const { data: c } = await db.from("contractors").select("*").eq("id", cid).single();
  if (!c) return deny(404, "Not found");
  if (action === "nudge") {
    const left = onboardingChecklist(c as never).steps.filter((s) => !s.done);
    const link = await signInUrl(c.email);
    await notify(c.profile_id, { title: `Finish your ${BRAND.name} setup`, body: `${left.length} step(s) left`, data: { type: "onboarding" },
      email: { to: c.email, subject: "Quick note about your setup", text: `Hi ${String(c.contact_name).split(" ")[0]},\n\n${note ? `${note}\n\n` : ""}You're ${left.length} step${left.length === 1 ? "" : "s"} away from getting jobs:\n${left.map((s) => `• ${s.label}`).join("\n")}\n\nOne click signs you in: ${link}\n\nReply if you need help.\n\n— ${BRAND.name}` } });
    await db.from("contractors").update({ last_reminder_at: new Date().toISOString() }).eq("id", cid);
    await logRecruiting("nudge", { contractorId: cid }, note ?? null, who);
  } else if (action === "revive") {
    await db.from("contractors").update({ dropped_at: null, invited_at: new Date().toISOString(), onboarding_reminders: 0 }).eq("id", cid);
    await logRecruiting("revived", { contractorId: cid }, note ?? null, who);
  } else if (action === "order_background") {
    await db.from("contractors").update({ background_status: null }).eq("id", cid);
    await orderBackgroundCheck(cid);
  } else if (action === "background_clear") {
    await onBackgroundResult(cid, "clear", who);
    await afterOnboardingStep(cid, "background cleared by staff", who);
  }
  return Response.json({ ok: true });
}

const Settings = z.object({
  autoInvite: z.boolean(), minScore: z.number().int().min(0).max(100), autoActivate: z.boolean(),
  reminderDays: z.array(z.number().int().min(1).max(90)).min(1).max(8), dropAfterDays: z.number().int().min(7).max(180), decisionHours: z.number().int().min(1).max(240),
});

export async function PUT(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v) || v!.role !== "admin") return deny(403, "Only an admin can change recruiting automation");
  const p = Settings.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return Response.json(await saveRecruitingSettings({ ...p.data, reminderDays: [...p.data.reminderDays].sort((a, b) => a - b) }, v!.fullName ?? v!.email ?? "admin"));
}
