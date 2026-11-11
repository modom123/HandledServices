/*
 * FILE    : apps/web/app/api/hub/recruiting/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0006 UTC
 * PURPOSE : Staff actions on the recruiting pipeline and its automation settings.
 *             POST { action: "nudge" | "revive" | "note" | "background_clear" | "order_background", contractor_id?, application_id?, note? }
 *             PUT  { instantSignup, autoInvite, minScore, interviewRequired, autoInviteAfterInterview, reminderDays, dropAfterDays, decisionHours }  (admin)
 * UPDATED : 2026-10-05_0246 UTC — screening interview settings.
 * UPDATED : 2026-11-11_0030 UTC — DELETE (admin): delete someone who didn't make it through onboarding (lib/recruiting-delete.ts).
 *             { application_id?, contractor_id?, reason?, confirm: "DELETE" } — one person
 *             { bulk: "not_a_fit" | "dropped" | "both", older_than_days?, reason?, confirm: "DELETE" } — everyone in those stages
 *           Approved pros, and anyone with jobs or payouts on record, are never deleted (offboard them instead).
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { deleteCandidate } from "@/lib/recruiting-delete";
import { afterOnboardingStep, logRecruiting, nudgePro, onBackgroundResult, orderBackgroundCheck, pipeline, revivePro, saveRecruitingSettings } from "@/lib/recruiting";

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
    await nudgePro(cid, note, who);
  } else if (action === "revive") {
    await revivePro(cid, who, note);
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
  instantSignup: z.boolean().default(true), interviewRequired: z.boolean().default(false), autoInviteAfterInterview: z.boolean().default(false),
  autoInvite: z.boolean(), minScore: z.number().int().min(0).max(100),
  reminderDays: z.array(z.number().int().min(1).max(90)).min(1).max(8), dropAfterDays: z.number().int().min(7).max(180), decisionHours: z.number().int().min(1).max(240),
});

export async function PUT(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v) || v!.role !== "admin") return deny(403, "Only an admin can change recruiting automation");
  const p = Settings.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return Response.json(await saveRecruitingSettings({ ...p.data, reminderDays: [...p.data.reminderDays].sort((a, b) => a - b) }, v!.fullName ?? v!.email ?? "admin"));
}

const Delete = z.object({
  confirm: z.literal("DELETE"), reason: z.string().max(300).optional(),
  application_id: z.string().uuid().optional(), contractor_id: z.string().uuid().optional(),
  bulk: z.enum(["not_a_fit", "dropped", "both"]).optional(), older_than_days: z.number().int().min(0).max(3650).optional(),
});

export async function DELETE(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v) || v!.role !== "admin") return deny(403, "Only an admin can delete applicants");
  const p = Delete.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, 'Type DELETE to confirm');
  const who = v!.fullName ?? v!.email ?? "admin";
  const { bulk, older_than_days, reason } = p.data;
  if (!bulk) {
    if (!p.data.application_id && !p.data.contractor_id) return deny(400, "application_id or contractor_id required");
    const r = await deleteCandidate({ applicationId: p.data.application_id, contractorId: p.data.contractor_id }, who, reason);
    return r.ok ? Response.json(r) : deny(409, r.error);
  }
  const stages = bulk === "both" ? ["rejected", "dropped"] : bulk === "dropped" ? ["dropped"] : ["rejected"];
  const cutoff = Date.now() - (older_than_days ?? 0) * 86400000;
  const rows = (await pipeline()).filter((r) => stages.includes(r.stage) && new Date(String(r.app.created_at ?? 0)).getTime() <= cutoff);
  let deleted = 0;
  const skipped: string[] = [];
  const done = new Set<string>();
  for (const r of rows) {
    const key = String(r.pro?.id ?? r.app.id);
    if (done.has(key)) continue;
    done.add(key);
    const res = await deleteCandidate({ applicationId: (r.app.id as string | null) ?? null, contractorId: (r.pro?.id as string | undefined) ?? null }, who, reason ?? `bulk: ${bulk.replace(/_/g, " ")}`);
    if (res.ok) deleted++; else skipped.push(`${String(r.app.contact_name ?? r.app.business_name ?? "someone")}: ${res.error}`);
  }
  return Response.json({ ok: true, deleted, skipped });
}
