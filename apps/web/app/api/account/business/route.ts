/*
 * FILE    : apps/web/app/api/account/business/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Business account portal actions for signed-in members. POST JSON { action, account_id, ... }:
 *             add_property / update_property   — name, address, city, state, zip, units, access notes, active
 *             add_member / remove_member       — admins invite colleagues by email (admin or booker)
 *             dedicated_pro                    — mark a pro who has worked for the account as dedicated (first look)
 *             billing_email                    — where invoices go (admin)
 *             request_terms                    — ask for invoicing on terms (staff decides case by case)
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { memberOf, requestTerms } from "@/lib/business";

const zip = z.string().regex(/^\d{5}$/);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_property"), account_id: z.string().uuid(), name: z.string().trim().min(2).max(120), address: z.string().trim().min(3).max(200), city: z.string().trim().min(2).max(80), state: z.string().trim().length(2), zip, units: z.number().int().min(0).max(10000).nullable().optional(), access_notes: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("update_property"), account_id: z.string().uuid(), id: z.string().uuid(), access_notes: z.string().max(1000).nullable().optional(), units: z.number().int().min(0).max(10000).nullable().optional(), active: z.boolean().optional() }),
  z.object({ action: z.literal("add_member"), account_id: z.string().uuid(), email: z.string().trim().email(), role: z.enum(["admin", "booker"]).default("booker") }),
  z.object({ action: z.literal("remove_member"), account_id: z.string().uuid(), id: z.string().uuid() }),
  z.object({ action: z.literal("dedicated_pro"), account_id: z.string().uuid(), contractor_id: z.string().uuid(), on: z.boolean() }),
  z.object({ action: z.literal("billing_email"), account_id: z.string().uuid(), email: z.string().trim().email() }),
  z.object({ action: z.literal("request_terms"), account_id: z.string().uuid(), note: z.string().max(1000).nullable().optional() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const mine = await memberOf(v, d.account_id);
  if (!mine) return deny(403, "Not a member of this account");
  const admin = mine.role === "admin";
  const db = adminClient();
  const fail = (m: string) => Response.json({ ok: false, error: m }, { status: 409 });

  switch (d.action) {
    case "add_property": {
      const { error } = await db.from("business_properties").insert({ account_id: d.account_id, name: d.name, address: d.address, city: d.city, state: d.state.toUpperCase(), zip: d.zip, units: d.units ?? null, access_notes: d.access_notes ?? null });
      return error ? fail(error.message) : Response.json({ ok: true });
    }
    case "update_property": {
      const patch = Object.fromEntries(Object.entries({ access_notes: d.access_notes, units: d.units, active: d.active }).filter(([, x]) => x !== undefined));
      const { error } = await db.from("business_properties").update(patch).eq("id", d.id).eq("account_id", d.account_id);
      return error ? fail(error.message) : Response.json({ ok: true });
    }
    case "add_member": {
      if (!admin) return fail("Only account admins can invite people");
      const { error } = await db.from("business_members").upsert({ account_id: d.account_id, email: d.email.toLowerCase(), role: d.role }, { onConflict: "account_id,email" });
      return error ? fail(error.message) : Response.json({ ok: true });
    }
    case "remove_member": {
      if (!admin) return fail("Only account admins can remove people");
      const { data: all } = await db.from("business_members").select("id, role").eq("account_id", d.account_id);
      const rows = (all ?? []) as { id: string; role: string }[];
      if (rows.find((r) => r.id === d.id)?.role === "admin" && rows.filter((r) => r.role === "admin").length <= 1) return fail("Keep at least one admin");
      await db.from("business_members").delete().eq("id", d.id).eq("account_id", d.account_id);
      return Response.json({ ok: true });
    }
    case "dedicated_pro": {
      if (!admin) return fail("Only account admins can choose dedicated pros");
      if (d.on) {
        const { count } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("business_account_id", d.account_id).eq("contractor_id", d.contractor_id).eq("status", "completed");
        if (!count) return fail("Pick a pro who has finished a job for you");
        await db.from("business_pros").upsert({ account_id: d.account_id, contractor_id: d.contractor_id, added_by: v.email }, { onConflict: "account_id,contractor_id" });
      } else await db.from("business_pros").delete().eq("account_id", d.account_id).eq("contractor_id", d.contractor_id);
      return Response.json({ ok: true });
    }
    case "billing_email": {
      if (!admin) return fail("Only account admins can change billing");
      await db.from("business_accounts").update({ billing_email: d.email.toLowerCase() }).eq("id", d.account_id);
      return Response.json({ ok: true });
    }
    case "request_terms": {
      if (mine.account.billing_mode === "terms") return fail("You're already invoiced");
      await requestTerms(mine.account, v.email, d.note ?? null);
      return Response.json({ ok: true });
    }
  }
}
