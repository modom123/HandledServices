/*
 * FILE    : apps/web/app/api/pro/talent/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Recruiter portal actions (approved pros with the "recruiter" trade, on searches they're assigned to):
 *           upload a résumé, add a candidate, move them through screening, submit to the client (consent + write-up,
 *           ownership checked), withdraw, and open a résumé.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { addCandidate, moveStage, recruiterFor, recruiterOnSearch, resumeLink, resumeUploadUrl, submitToClient } from "@/lib/talent";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max).nullable();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upload_url"), name: z.string().min(1).max(200) }),
  z.object({ action: z.literal("add_candidate"), search_id: uuid, full_name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: text(30), location: text(120), current_title: text(160), linkedin: text(300), resume_path: z.string().max(300).nullable(), summary: text(4000), source: text(80), expected_salary: z.number().min(0).max(10_000_000).nullable() }),
  z.object({ action: z.literal("stage"), submission_id: uuid, stage: z.enum(["sourced", "screened", "withdrawn"]), note: text(1000) }),
  z.object({ action: z.literal("submit"), submission_id: uuid, pitch: z.string().max(4000), consent: z.boolean(), consent_method: z.string().trim().min(3).max(200) }),
  z.object({ action: z.literal("resume_link"), submission_id: uuid }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  const rec = await recruiterFor(v?.contractorId ?? null);
  if (!v || !rec) return deny(403, "Recruiter access only — apply as a recruiter in Setup & documents");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the form");
  const d = b.data;
  const actor = `recruiter:${rec.business_name}`;
  const out = (r: { ok: boolean; [k: string]: unknown }) => Response.json(r, { status: r.ok ? 200 : 400 });
  if (d.action === "upload_url") return out(await resumeUploadUrl(d.name));
  if (d.action === "add_candidate") {
    if (!(await recruiterOnSearch(d.search_id, rec.id))) return deny(403, "You're not on this search");
    const { action: _a, search_id, ...c } = d;
    if (c.resume_path && !c.resume_path.startsWith("resumes/")) return deny(400, "Bad file");
    return out(await addCandidate(search_id, c, rec.id, actor));
  }
  const { data: sub } = await adminClient().from("talent_submissions").select("recruiter_id, talent_candidates(resume_path)").eq("id", d.submission_id).maybeSingle();
  if (!sub || sub.recruiter_id !== rec.id) return deny(403, "Not your candidate");
  if (d.action === "resume_link") { const url = await resumeLink((sub.talent_candidates as unknown as { resume_path: string | null } | null)?.resume_path ?? null); return url ? out({ ok: true, url }) : deny(404, "No résumé"); }
  if (d.action === "stage") return out(await moveStage(d.submission_id, d.stage, "recruiter", actor, rec.id, d.note));
  return out(await submitToClient(d.submission_id, { pitch: d.pitch, consent: d.consent, consentMethod: d.consent_method }, actor, rec.id));
}
