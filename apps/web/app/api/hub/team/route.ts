/*
 * FILE    : apps/web/app/api/hub/team/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0434 UTC
 * PURPOSE : Hub → Team (admin only). The only way to give someone Hub access — nobody can choose "staff" themselves.
 *             POST { action: "add", email, role: admin|dispatcher, name? } — creates the account if needed, sets the role,
 *                                                                          emails a one-click sign-in link to the Hub
 *             POST { action: "remove", email }                            — back to customer (or pro, if they have a pro record)
 *           An admin can't remove their own admin role (so there's always one).
 */
import { z } from "zod";
import { BRAND } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notify";
import { signInUrl } from "@/lib/recruiting";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), email: z.string().trim().email(), role: z.enum(["admin", "dispatcher"]), name: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal("remove"), email: z.string().trim().email() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (v?.role !== "admin") return deny(403, "Only an admin can change the team");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the email");
  const db = adminClient();
  const email = b.data.email.toLowerCase();
  const { data: prof } = await db.from("profiles").select("id, role").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (b.data.action === "remove") {
    if (!prof) return deny(404, "No account with that email");
    if (prof.id === v.userId) return deny(409, "You can't remove your own admin access — ask another admin");
    const { count } = await db.from("contractors").select("id", { count: "exact", head: true }).eq("profile_id", prof.id);
    await db.from("profiles").update({ role: count ? "pro" : "customer" }).eq("id", prof.id);
    return Response.json({ ok: true });
  }
  let id = prof?.id as string | undefined;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: b.data.name ?? null } });
    if (error || !data.user) return deny(500, error?.message ?? "Couldn't create the account");
    id = data.user.id;
  }
  const { error } = await db.from("profiles").update({ role: b.data.role, ...(b.data.name ? { full_name: b.data.name } : {}) }).eq("id", id);
  if (error) return deny(500, error.message);
  const link = await signInUrl(email, "/hub");
  await sendEmail(email, `You've been added to the ${BRAND.name} Hub`, `Hi${b.data.name ? ` ${b.data.name.split(" ")[0]}` : ""},\n\n${v.fullName ?? v.email} added you to the ${BRAND.name} team as ${b.data.role === "admin" ? "an admin" : "a dispatcher"}.\n\nOne click signs you in to the Hub:\n${link}\n\nNext time, go to Sign in and choose "Handled team".\n\n— ${BRAND.name}`);
  return Response.json({ ok: true });
}
