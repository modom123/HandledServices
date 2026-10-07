/*
 * FILE    : apps/web/app/api/talent/review/[token]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : The client's private search link: accept the client agreement, open a candidate's résumé, and decide
 *           interview / pass / hold with feedback. POST { action: "accept" | "resume" | "decide", … }.
 */
import { z } from "zod";
import { deny } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { adminClient } from "@/lib/supabase/server";
import { TALENT_AGREEMENT_VERSION, clientDecision, resumeLink, searchByReviewToken } from "@/lib/talent";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), name: z.string().trim().min(2).max(120), title: z.string().trim().max(120).nullable() }),
  z.object({ action: z.literal("resume"), submission_id: z.string().uuid() }),
  z.object({ action: z.literal("decide"), submission_id: z.string().uuid(), decision: z.enum(["interview", "pass", "hold"]), feedback: z.string().trim().max(2000).nullable() }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const { token } = await params;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const found = await searchByReviewToken(token);
  if (!found) return deny(404, "This link isn't valid");
  if (b.data.action === "accept") {
    const { data: s } = await adminClient().from("talent_searches").select("client_id").eq("id", found.search.id).single();
    await adminClient().from("talent_clients").update({ agreement_version: TALENT_AGREEMENT_VERSION, agreement_signed_at: new Date().toISOString(), agreement_signed_by: `${b.data.name}${b.data.title ? `, ${b.data.title}` : ""}`, agreement_ip: clientIp(req), status: "active" }).eq("id", s!.client_id).is("agreement_signed_at", null);
    return Response.json({ ok: true });
  }
  if (b.data.action === "resume") {
    const sub = found.submissions.find((x) => x.id === (b.data as { submission_id: string }).submission_id);
    const path = (sub?.talent_candidates as unknown as { resume_path: string | null } | null)?.resume_path ?? null;
    const url = await resumeLink(path);
    return url ? Response.json({ ok: true, url }) : deny(404, "No résumé on file");
  }
  const r = await clientDecision(token, b.data.submission_id, b.data.decision, b.data.feedback);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
