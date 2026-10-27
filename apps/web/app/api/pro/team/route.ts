/*
 * FILE    : apps/web/app/api/pro/team/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2300 UTC
 * PURPOSE : Pro company → office team (lib/pro-team.ts). Web and app.
 *             GET                                                   — who I am (owner | office) and the team
 *             POST { action: "invite", full_name, email, phone?, locale } — owner only
 *             POST { action: "remove", id }                         — owner only
 */
import { z } from "zod";
import { deny, getViewer, ownerOnly } from "@/lib/auth";
import { inviteTeam, listTeam, removeTeam, TEAM_LIMIT } from "@/lib/pro-team";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), full_name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: z.string().trim().max(30).optional().nullable(), locale: z.enum(["en", "es"]).default("en") }),
  z.object({ action: z.literal("remove"), id: z.string().uuid() }),
]);

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  return Response.json({ me: v.proRole, limit: TEAM_LIMIT, team: v.proRole === "owner" ? await listTeam(v.contractorId) : [] });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const notOwner = ownerOnly(v);
  if (notOwner) return notOwner;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const r = d.action === "invite"
    ? await inviteTeam(v.contractorId, { full_name: d.full_name, email: d.email, phone: d.phone ?? null, locale: d.locale }, v.email)
    : await removeTeam(v.contractorId, d.id);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
