/*
 * FILE    : apps/web/app/api/hub/office-docs/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_2100 UTC
 * PURPOSE : Front Office documents (lib/office-docs.ts). Staff only; each action checks the person's access to the document.
 *             GET  ?office=odom|gulley             → { docs, team } an office's documents (admins)
 *             GET  ?mine=1                         → { docs } what this person can open (everything for admins)
 *             GET  ?history=<id>                   → { events } who uploaded, shared, opened (full access)
 *             POST { action: "ticket", office, name, mime, size }                      → one-time signed upload
 *             POST { action: "save", office, path, title, file_name?, folder?, note?, share? } → record and share
 *             POST { action: "share", id, profile_id, level } / { action: "unshare", id, profile_id }
 *             POST { action: "edit", id, title?, folder?, note? } / { action: "remove", id }
 *             POST { action: "open", id, download? }   → { url } a 5-minute link
 */
import { z } from "zod";
import { deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { docHistory, docTeam, docTicket, listOfficeDocs, listSharedWith, openDoc, removeDoc, renameDoc, saveDoc, shareDoc, unshareDoc } from "@/lib/office-docs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny(403, "Staff only");
  const u = new URL(req.url);
  const office = u.searchParams.get("office");
  const history = u.searchParams.get("history");
  try {
    if (history) return Response.json({ events: await docHistory(v!, history) });
    if (office) {
      if (!isAdmin(v)) return deny(403, "The offices are for admins");
      const [r, team] = await Promise.all([listOfficeDocs(v!, office), docTeam()]);
      return Response.json({ ...r, team });
    }
    const [r, team] = await Promise.all([listSharedWith(v!), docTeam()]);
    return Response.json({ ...r, team });
  } catch (e) { return deny(400, e instanceof Error ? e.message : "Failed"); }
}

const Level = z.enum(["view", "full"]);
const Office = z.enum(["odom", "gulley"]);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ticket"), office: Office, name: z.string().max(240), mime: z.string().max(160), size: z.number().int().nonnegative() }),
  z.object({ action: z.literal("save"), office: Office, path: z.string().max(400), title: z.string().max(200), file_name: z.string().max(240).optional(), folder: z.string().max(80).optional(), note: z.string().max(2000).optional(),
    share: z.array(z.object({ profile_id: z.string().uuid(), level: Level })).max(100).optional() }),
  z.object({ action: z.literal("share"), id: z.string().uuid(), profile_id: z.string().uuid(), level: Level }),
  z.object({ action: z.literal("unshare"), id: z.string().uuid(), profile_id: z.string().uuid() }),
  z.object({ action: z.literal("edit"), id: z.string().uuid(), title: z.string().max(200).optional(), folder: z.string().max(80).nullable().optional(), note: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal("remove"), id: z.string().uuid() }),
  z.object({ action: z.literal("open"), id: z.string().uuid(), download: z.boolean().optional() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny(403, "Staff only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => i.message).join("; "));
  const d = b.data;
  try {
    switch (d.action) {
      case "ticket": if (!isAdmin(v)) return deny(403, "Documents are uploaded from an office (admins)"); return Response.json(await docTicket(d.office, d.name, d.mime, d.size));
      case "save": {
        if (!isAdmin(v)) return deny(403, "Documents are uploaded from an office (admins)");
        const r = await saveDoc(v!, { office: d.office, path: d.path, title: d.title, fileName: d.file_name, folder: d.folder, note: d.note, share: d.share });
        return r.ok ? Response.json(r) : deny(400, r.error);
      }
      case "share": return Response.json(await shareDoc(v!, d.id, d.profile_id, d.level));
      case "unshare": return Response.json(await unshareDoc(v!, d.id, d.profile_id));
      case "edit": return Response.json(await renameDoc(v!, d.id, d));
      case "remove": return Response.json(await removeDoc(v!, d.id));
      case "open": return Response.json(await openDoc(v!, d.id, d.download));
    }
  } catch (e) { return deny(400, e instanceof Error ? e.message : "Failed"); }
}
