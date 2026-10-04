/*
 * FILE    : apps/web/app/api/hub/business/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : TSTAMP UTC
 * PURPOSE : Staff controls for a business account. POST JSON { action, id, ... }:
 *             terms     — billing_mode prepay | terms, terms_days, credit_limit, note (required to approve terms:
 *                         invoicing is decided case by case and the reason is kept)
 *             hold      — put invoicing on hold / lift it
 *             priority  — priority dispatch on / off
 *             pilot     — pilot discount % and number of jobs
 *             status    — lead | proposal | active | paused | lost
 *             member    — add an account member by email (admin | booker)
 *             property  — add a property for them
 *             dedicated — add / remove a dedicated pro (any approved pro)
 *             invoices  — run this month's invoices now (normally the 1st)
 */
import { z } from "zod";
import { BUSINESS_TERMS, TERMS_DAYS } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { runInvoices } from "@/lib/business";

const id = z.string().uuid();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("terms"), id, billing_mode: z.enum(["prepay", "terms"]), terms_days: z.number().int().refine((d) => (TERMS_DAYS as readonly number[]).includes(d)).default(30), credit_limit: z.number().min(0).max(1_000_000).default(BUSINESS_TERMS.defaultCreditLimit), note: z.string().trim().max(1000).default("") }),
  z.object({ action: z.literal("hold"), id, on: z.boolean() }),
  z.object({ action: z.literal("priority"), id, on: z.boolean() }),
  z.object({ action: z.literal("pilot"), id, pct: z.number().int().min(0).max(BUSINESS_TERMS.maxPilotPct), jobs: z.number().int().min(0).max(BUSINESS_TERMS.maxPilotJobs) }),
  z.object({ action: z.literal("status"), id, status: z.enum(["lead", "proposal", "active", "paused", "lost"]) }),
  z.object({ action: z.literal("member"), id, email: z.string().trim().email(), role: z.enum(["admin", "booker"]).default("booker") }),
  z.object({ action: z.literal("property"), id, name: z.string().trim().min(2).max(120), address: z.string().trim().min(3).max(200), city: z.string().trim().min(2).max(80), state: z.string().trim().length(2), zip: z.string().regex(/^\d{5}$/), access_notes: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("dedicated"), id, contractor_id: id, on: z.boolean() }),
  z.object({ action: z.literal("invoices") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const db = adminClient();
  const ok = (error: { message: string } | null) => (error ? Response.json({ ok: false, error: error.message }, { status: 500 }) : Response.json({ ok: true }));
  switch (d.action) {
    case "terms": {
      if (d.billing_mode === "terms" && d.note.length < 5) return Response.json({ ok: false, error: "Say why this account gets terms (history, size, references) — it's a case-by-case decision" }, { status: 400 });
      if (d.billing_mode === "terms" && !(d.credit_limit > 0)) return Response.json({ ok: false, error: "Set a credit limit" }, { status: 400 });
      const { error } = await db.from("business_accounts").update(d.billing_mode === "terms"
        ? { billing_mode: "terms", terms_days: d.terms_days, credit_limit: d.credit_limit, terms_note: d.note, terms_approved_by: v!.email, terms_approved_at: new Date().toISOString(), terms_hold: false }
        : { billing_mode: "prepay", terms_note: d.note || null }).eq("id", d.id);
      return ok(error);
    }
    case "hold": return ok((await db.from("business_accounts").update({ terms_hold: d.on }).eq("id", d.id)).error);
    case "priority": return ok((await db.from("business_accounts").update({ priority: d.on }).eq("id", d.id)).error);
    case "pilot": return ok((await db.from("business_accounts").update({ pilot_discount_pct: d.pct, pilot_jobs_left: d.jobs }).eq("id", d.id)).error);
    case "status": return ok((await db.from("business_accounts").update({ status: d.status }).eq("id", d.id)).error);
    case "member": return ok((await db.from("business_members").upsert({ account_id: d.id, email: d.email.toLowerCase(), role: d.role }, { onConflict: "account_id,email" })).error);
    case "property": return ok((await db.from("business_properties").insert({ account_id: d.id, name: d.name, address: d.address, city: d.city, state: d.state.toUpperCase(), zip: d.zip, access_notes: d.access_notes ?? null })).error);
    case "dedicated": return ok(d.on
      ? (await db.from("business_pros").upsert({ account_id: d.id, contractor_id: d.contractor_id, added_by: v!.email }, { onConflict: "account_id,contractor_id" })).error
      : (await db.from("business_pros").delete().eq("account_id", d.id).eq("contractor_id", d.contractor_id)).error);
    case "invoices": return Response.json({ ok: true, invoices: await runInvoices() });
  }
}
