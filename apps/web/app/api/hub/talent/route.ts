/*
 * FILE    : apps/web/app/api/hub/talent/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Staff controls for Handled Talent (Hub → Talent). POST JSON { action, … }:
 *             client · client_terms · search · search_update · assign · unassign · send_review_link · upload_url ·
 *             resume_link · add_candidate · submit · stage · hire · invoice · exit
 */
import { z } from "zod";
import { BRAND } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { sendEmail, siteUrl } from "@/lib/notify";
import {
  addCandidate, assignRecruiter, createSearch, invoicePlacement, invoiceRetainer, moveStage, recordHire, reportExit, resumeLink, resumeUploadUrl, saveSearch, submitToClient, unassignRecruiter,
} from "@/lib/talent";

const uuid = z.string().uuid();
const money = z.number().min(0).max(10_000_000).nullable();
const text = (max: number) => z.string().trim().max(max).nullable();
const search = { title: z.string().trim().min(2).max(160), location: text(160), workplace: z.enum(["onsite", "hybrid", "remote"]), salary_min: money, salary_max: money, openings: z.number().int().min(1).max(100), description: text(8000), must_haves: text(4000), type: z.enum(["contingency", "retained"]), exclusive: z.boolean().optional() };
const candidate = { full_name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: text(30), location: text(120), current_title: text(160), linkedin: text(300), resume_path: z.string().max(300).nullable(), summary: text(4000), source: text(80), expected_salary: money };

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("client"), company: z.string().trim().min(2).max(160), contact_name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: text(30), website: text(200), industry: text(80), city: text(80), notes: text(4000) }),
  z.object({ action: z.literal("client_terms"), client_id: uuid, feePct: z.number().min(1).max(50), recruiterPct: z.number().min(0).max(50), retainedPct: z.number().min(1).max(50), minimumFee: z.number().min(0).max(1_000_000), status: z.enum(["prospect", "active", "inactive"]) }),
  z.object({ action: z.literal("search"), client_id: uuid, ...search }),
  z.object({ action: z.literal("search_update"), search_id: uuid, ...Object.fromEntries(Object.entries(search).map(([k, v]) => [k, v.optional()])), status: z.enum(["intake", "open", "on_hold", "filled", "cancelled"]).optional(), fee_pct: z.number().min(1).max(50).optional(), recruiter_pct: z.number().min(0).max(50).optional(), minimum_fee: z.number().min(0).optional(), estimated_salary: money.optional(), fair_override: text(1000).optional() }),
  z.object({ action: z.literal("assign"), search_id: uuid, contractor_id: uuid, role: z.enum(["lead", "support"]) }),
  z.object({ action: z.literal("unassign"), search_id: uuid, contractor_id: uuid }),
  z.object({ action: z.literal("send_review_link"), search_id: uuid }),
  z.object({ action: z.literal("upload_url"), name: z.string().min(1).max(200) }),
  z.object({ action: z.literal("resume_link"), path: z.string().min(5).max(300) }),
  z.object({ action: z.literal("resume_link_sub"), submission_id: uuid }),
  z.object({ action: z.literal("add_candidate"), search_id: uuid, recruiter_id: uuid.nullable(), ...candidate }),
  z.object({ action: z.literal("submit"), submission_id: uuid, pitch: z.string().max(4000), consent: z.boolean(), consent_method: z.string().trim().min(3).max(200) }),
  z.object({ action: z.literal("stage"), submission_id: uuid, stage: z.enum(["sourced", "screened", "submitted", "client_review", "interview", "offer", "rejected", "withdrawn"]), note: text(1000) }),
  z.object({ action: z.literal("hire"), submission_id: uuid, base_salary: z.number().min(1000).max(10_000_000), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal("invoice"), placement_id: uuid.optional(), retainer_id: uuid.optional() }),
  z.object({ action: z.literal("exit"), placement_id: uuid, exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.enum(["resigned", "terminated_performance", "terminated_cause", "laid_off", "position_eliminated", "other"]), remedy: z.enum(["replacement", "refund"]) }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the form");
  const d = b.data;
  const actor = v!.email ?? "staff";
  const out = (r: { ok: boolean; [k: string]: unknown }) => Response.json(r, { status: r.ok ? 200 : 400 });
  const db = adminClient();
  switch (d.action) {
    case "client": {
      const { action: _a, ...c } = d;
      const { data, error } = await db.from("talent_clients").insert({ ...c, email: c.email.toLowerCase(), created_by: actor }).select("id").single();
      return out(error ? { ok: false, error: error.message } : { ok: true, id: data!.id });
    }
    case "client_terms": {
      if (d.recruiterPct > d.feePct) return deny(400, "The recruiter's share can't be more than the fee");
      await db.from("talent_clients").update({ terms: { feePct: d.feePct, recruiterPct: d.recruiterPct, retainedPct: d.retainedPct, minimumFee: d.minimumFee }, status: d.status }).eq("id", d.client_id);
      return out({ ok: true });
    }
    case "search": { const { action: _a, client_id, ...s } = d; return out(await createSearch(client_id, s, actor, "intake")); }
    case "search_update": { const { action: _a, search_id, ...p } = d; return out(await saveSearch(search_id, p as never, actor)); }
    case "assign": return out(await assignRecruiter(d.search_id, d.contractor_id, d.role, actor));
    case "unassign": await unassignRecruiter(d.search_id, d.contractor_id); return out({ ok: true });
    case "send_review_link": {
      const { data: s } = await db.from("talent_searches").select("title, review_token, talent_clients(contact_name, email, agreement_signed_at)").eq("id", d.search_id).single();
      const c = s?.talent_clients as unknown as { contact_name: string; email: string; agreement_signed_at: string | null };
      if (!s || !c) return deny(404, "Not found");
      await sendEmail(c.email, `Your ${BRAND.name} Talent search: ${s.title}`, `Hi ${c.contact_name.split(" ")[0]},\n\nHere is your private page for the ${s.title} search. ${c.agreement_signed_at ? "Candidates appear here as we submit them; choose interview, pass or hold for each." : "First, please review and accept the Handled Talent client agreement there; then candidates appear as we submit them."}\n\n${siteUrl()}/talent/review/${s.review_token}\n\nKeep this link private: anyone with it can see your candidates.\n\n— ${BRAND.name} Talent`);
      return out({ ok: true });
    }
    case "upload_url": return out(await resumeUploadUrl(d.name));
    case "resume_link": { const url = await resumeLink(d.path); return url ? out({ ok: true, url }) : deny(404, "Not found"); }
    case "resume_link_sub": {
      const { data: sub } = await db.from("talent_submissions").select("talent_candidates(resume_path)").eq("id", d.submission_id).maybeSingle();
      const url = await resumeLink((sub?.talent_candidates as unknown as { resume_path: string | null } | null)?.resume_path ?? null);
      return url ? out({ ok: true, url }) : deny(404, "No résumé");
    }
    case "add_candidate": { const { action: _a, search_id, recruiter_id, ...c } = d; return out(await addCandidate(search_id, c, recruiter_id, actor)); }
    case "submit": return out(await submitToClient(d.submission_id, { pitch: d.pitch, consent: d.consent, consentMethod: d.consent_method }, actor, null));
    case "stage": return out(await moveStage(d.submission_id, d.stage, "staff", actor, null, d.note));
    case "hire": return out(await recordHire(d.submission_id, { base_salary: d.base_salary, start_date: d.start_date }, actor));
    case "invoice": return out(d.placement_id ? await invoicePlacement(d.placement_id, actor) : d.retainer_id ? await invoiceRetainer(d.retainer_id, actor) : { ok: false, error: "Nothing to invoice" });
    case "exit": return out(await reportExit(d.placement_id, { exit_date: d.exit_date, reason: d.reason, remedy: d.remedy }, actor));
  }
}
