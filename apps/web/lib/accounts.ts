/*
 * FILE    : apps/web/lib/accounts.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_1000 UTC
 * PURPOSE : ONE HANDLED ACCOUNT for everyone in the network — like one Amazon account for shopping, Prime and selling:
 *           the same account books services, sends referrals, gets paid, and works as a pro.
 *             ensureAccount() — the Handled account for an email: found, or created now (confirmed, no email sent —
 *                               the caller's own email carries the sign-in link). Name and phone fill in a blank profile.
 *                               Creating it runs handle_new_user(), which links the person's guest bookings, pro record
 *                               and referral partner record by email.
 *           Never throws: without Supabase admin access it returns null and the account is made at first sign-in.
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

const esc = (e: string) => e.replace(/[\\%_]/g, (c) => `\\${c}`); // "_" in an email is a wildcard to ilike

export async function ensureAccount(o: { email: string; name?: string | null; phone?: string | null }): Promise<string | null> {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const email = o.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return null;
  const db = adminClient();
  try {
    const find = async () => (await db.from("profiles").select("id, full_name, phone").ilike("email", esc(email)).limit(1).maybeSingle()).data as { id: string; full_name: string | null; phone: string | null } | null;
    let p = await find();
    if (!p) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: o.name ?? null, phone: o.phone ?? null } });
      if (error && !/already|registered|exists/i.test(error.message)) { console.error("[accounts] createUser", error.message); return null; }
      p = data?.user ? { id: data.user.id, full_name: o.name ?? null, phone: o.phone ?? null } : await find();
    }
    if (!p) return null;
    // fill a blank profile from what they just told us (never overwrite what they set themselves)
    const patch: Record<string, string> = {};
    if (!p.full_name && o.name?.trim()) patch.full_name = o.name.trim();
    if (!p.phone && o.phone?.trim()) patch.phone = o.phone.trim();
    if (Object.keys(patch).length) await db.from("profiles").update(patch).eq("id", p.id);
    return p.id;
  } catch (e) {
    console.error("[accounts]", e instanceof Error ? e.message : e);
    return null;
  }
}
