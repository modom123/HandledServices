/*
 * FILE    : apps/web/lib/ids.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0121 UTC
 * PURPOSE : ID numbers (migration 20261012012100_id_numbers.sql): jobs H-1001…, customers C-10001… (one per email,
 *           guests included), business clients B-501…, pros P-1001…, staff S-101…. Lookups for pages, and "find by ID"
 *           for the Hub. Every lookup returns null / empty before the migration is run, so pages keep working.
 */
import "server-only";
import { adminClient } from "./supabase/server";

export const ID_KINDS = [
  ["H", "Job"], ["C", "Customer"], ["B", "Business client"], ["P", "Pro"], ["S", "Staff"],
] as const;

/** "c 10001", "C10001", " c-10001 " → "C-10001"; null when it isn't an ID. */
export function normalizeId(q: string | null | undefined): string | null {
  const m = (q ?? "").trim().toUpperCase().match(/^([HCBPS])\s*-?\s*(\d{3,7})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Customer numbers for a list of emails (lower-cased keys). */
export async function customerNos(emails: (string | null | undefined)[]): Promise<Map<string, string>> {
  const list = [...new Set(emails.filter(Boolean).map((e) => e!.trim().toLowerCase()))];
  if (!list.length) return new Map();
  const { data, error } = await adminClient().from("customer_ids").select("email, customer_no").in("email", list.slice(0, 500));
  if (error) return new Map();
  return new Map(((data ?? []) as { email: string; customer_no: string }[]).map((r) => [r.email, r.customer_no]));
}

export async function customerNo(email: string | null | undefined): Promise<string | null> {
  return email ? (await customerNos([email])).get(email.trim().toLowerCase()) ?? null : null;
}

/** The signed-in person's customer number (their account, else their email). */
export async function myCustomerNo(profileId: string, email: string | null | undefined): Promise<string | null> {
  const { data, error } = await adminClient().from("customer_ids").select("customer_no").eq("profile_id", profileId).maybeSingle();
  if (!error && data) return (data as { customer_no: string }).customer_no;
  return customerNo(email);
}

/** Where an ID points in the Hub, or null when nothing has that number. */
export async function hubPathForId(id: string): Promise<string | null> {
  const db = adminClient();
  const kind = id[0];
  if (kind === "H") { const { data } = await db.from("jobs").select("id").eq("ref", id).maybeSingle(); return data ? `/hub/jobs/${data.id}` : null; }
  if (kind === "C") { const { data } = await db.from("customer_ids").select("email").eq("customer_no", id).maybeSingle(); return data ? `/hub/customers/${encodeURIComponent(data.email)}` : null; }
  if (kind === "B") { const { data } = await db.from("business_accounts").select("id").eq("client_no", id).maybeSingle(); return data ? `/hub/business/${data.id}` : null; }
  if (kind === "P") { const { data } = await db.from("contractors").select("id").eq("pro_no", id).maybeSingle(); return data ? `/hub/pros/${data.id}` : null; }
  if (kind === "S") { const { data } = await db.from("profiles").select("id").eq("staff_no", id).maybeSingle(); return data ? `/hub/team` : null; }
  return null;
}
