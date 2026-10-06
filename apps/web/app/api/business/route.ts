/*
 * FILE    : apps/web/app/api/business/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — monthly budget and how soon they want to start.
 * UPDATED : 2026-10-02_0316 UTC — per-IP abuse limit (lib/ratelimit).
 * UPDATED : 2026-10-04_1934 UTC — the contact becomes the account admin (business portal); sales-engine leads marked converted.
 * UPDATED : 2026-10-06_0841 UTC — Request for Proposal scope of work (rfp_scope): per-service frequency and specifics,
 *           square footage, hours, current vendor, term, decision process, walkthrough times, preferred contact. The ops
 *           email carries the scope and the follow-up questions (rfpFollowUp) for the account manager's call.
 * PURPOSE : Commercial account inquiry (offices, property managers, retail, HOAs).
 */
import { z } from "zod";
import { INDUSTRIES, URGENCY, RFP_CONTACT, RFP_DECISION, RFP_FREQUENCIES, RFP_HOURS, RFP_TERMS, RFP_VENDOR, RFP_WALKTHROUGH, SQFT_RANGES, getService, rfpFollowUp, rfpSummary } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { opsEmail, sendEmail } from "@/lib/notify";
import { rateLimit } from "@/lib/ratelimit";

const ids = <T extends readonly { id: string }[]>(l: T) => z.enum(l.map((x) => x.id) as [T[number]["id"], ...T[number]["id"][]]);
const Scope = z.object({
  sqft: ids(SQFT_RANGES), site: z.string().trim().max(200).default(""),
  services: z.array(z.object({ slug: z.string().refine((x) => Boolean(getService(x)), "unknown service"), frequency: ids(RFP_FREQUENCIES), note: z.string().trim().max(300).optional() })).max(60),
  hours: z.array(ids(RFP_HOURS)).max(4).default([]), vendor: ids(RFP_VENDOR), pain: z.string().trim().max(1000).optional(),
  term: ids(RFP_TERMS), decision: ids(RFP_DECISION), bidDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  walkthrough: z.array(ids(RFP_WALKTHROUGH)).max(4).default([]), contact: ids(RFP_CONTACT),
});

const Body = z.object({
  company: z.string().min(2), contact_name: z.string().min(2), email: z.string().email(), phone: z.string().optional(),
  locations: z.coerce.number().int().min(1).max(5000).default(1), services_needed: z.array(z.string()).default([]), notes: z.string().max(2000).optional(),
  monthly_budget: z.coerce.number().min(0).max(10_000_000).nullable().optional(), start_by: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).nullable().optional(),
  /** From a sales-engine email link (/business?lead=…). */
  lead: z.string().max(40).nullable().optional(),
  industry: z.string().max(40).nullable().optional(),
  scope: Scope.optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the form" }, { status: 400 });
  const { lead, scope, industry, ...data } = parsed.data;
  const industryName = INDUSTRIES.find((i) => i.id === industry)?.name ?? null;
  const summary = scope ? rfpSummary(scope, { locations: data.locations, industry: industryName, startBy: URGENCY.find((u) => u.id === data.start_by)?.label ?? data.start_by, budget: data.monthly_budget }) : [];
  const followUp = scope ? rfpFollowUp(scope, { locations: data.locations, budget: data.monthly_budget, phone: data.phone }) : [];
  const { data: acct, error } = await adminClient().from("business_accounts").insert({
    ...data, email: data.email.toLowerCase(), industry: industryName, rfp_scope: scope ?? null, preferred_contact: scope?.contact ?? null,
    notes: data.notes ?? null,
  }).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // the person who asked becomes the account admin: signing in with this email opens the business portal
  await adminClient().from("business_members").upsert({ account_id: acct.id, email: data.email.toLowerCase(), role: "admin" }, { onConflict: "account_id,email" });
  if (lead) await (await import("@/lib/biz-leads")).leadConverted(lead, acct.id).catch(() => {});
  if (opsEmail()) {
    const who = `${data.contact_name} · ${data.email}${data.phone ? ` · ${data.phone}` : ""}`;
    const body = scope
      ? [`${data.company} — ${who}`, "", "SCOPE OF WORK", ...summary, "", "ASK ON THE FOLLOW-UP CALL", ...followUp.map((x) => `- ${x}`), data.notes ? `\nNotes: ${data.notes}` : ""].join("\n")
      : JSON.stringify(parsed.data, null, 2);
    await sendEmail(opsEmail(), `Proposal request: ${data.company}${scope?.decision === "formal_bid" && scope.bidDue ? ` (bid due ${scope.bidDue})` : ""}`, body);
  }
  return Response.json({ ok: true });
}
