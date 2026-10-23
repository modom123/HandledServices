/*
 * FILE    : apps/web/app/api/hub/applications/[id]/resume/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2300 UTC
 * PURPOSE : Staff upload (or replace) a candidate's résumé on their page in Hub → Recruiting (multipart: file).
 *           PDF, Word or text, up to 10 MB, saved to the private pro-docs bucket (applications/<id>/…); carried to the
 *           pro record when they're invited.
 */
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { logRecruiting } from "@/lib/recruiting";

const EXT: Record<string, string> = {
  "application/pdf": "pdf", "application/msword": "doc", "text/plain": "txt", "application/rtf": "rtf", "text/rtf": "rtf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return deny(400, "Choose the résumé file");
  const ext = EXT[file.type] ?? (/\.(pdf|docx?|txt|rtf)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "");
  if (!ext) return deny(400, "Upload a PDF, Word or text file");
  if (file.size > 10 * 1024 * 1024) return deny(400, "Résumés must be under 10 MB");
  const db = adminClient();
  const { data: app } = await db.from("contractor_applications").select("id").eq("id", id).maybeSingle();
  if (!app) return deny(404, "Candidate not found");
  const path = `applications/${id}/resume-${Date.now()}.${ext}`;
  const { error } = await db.storage.from("pro-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) return deny(500, error.message);
  const { error: e2 } = await db.from("contractor_applications").update({ resume_path: path }).eq("id", id);
  if (e2) return deny(500, /resume_path/.test(e2.message) ? "Run supabase/setup/ADD_RECRUITING_INTAKE_2026-10-23_1100.sql first" : e2.message);
  await logRecruiting("resume_added", { applicationId: id }, file.name.slice(0, 120), v!.fullName ?? v!.email ?? "staff");
  return Response.json({ ok: true });
}
