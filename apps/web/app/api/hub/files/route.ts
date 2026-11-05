/*
 * FILE    : apps/web/app/api/hub/files/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0000 UTC
 * PURPOSE : Staff: universal person files (lib/person-files.ts).
 *             GET  ?type=&key=                          → { owner, files } every file that belongs to the person, with links
 *             GET  ?q=                                  → { people } find a customer, pro, staff member, partner or business
 *             POST { action: "ticket", type, key, name, mime, size }        → one-time signed upload (browser → storage)
 *             POST { action: "save", type, key, path, kind, label?, job_id? } → record it on the person's file
 *             POST { action: "hide", id }                                     → hide a file added to a person's file
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { FILE_KINDS, describeOwner, fileTicket, findPeople, hideFile, listPersonFiles, parseOwner, saveFile } from "@/lib/person-files";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny(403, "Staff only");
  const u = new URL(req.url);
  const q = u.searchParams.get("q");
  if (q !== null) return Response.json({ people: await findPeople(q) });
  const o = parseOwner(u.searchParams.get("type") ?? "", u.searchParams.get("key") ?? "");
  if (!o) return deny(400, "Unknown person");
  const [owner, files] = await Promise.all([describeOwner(o), listPersonFiles(o)]);
  return Response.json({ owner, files });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ticket"), type: z.string(), key: z.string(), name: z.string().max(240), mime: z.string().max(120), size: z.number().int().nonnegative() }),
  z.object({ action: z.literal("save"), type: z.string(), key: z.string(), path: z.string().max(400), kind: z.enum(FILE_KINDS), label: z.string().max(200).optional(), job_id: z.string().optional() }),
  z.object({ action: z.literal("hide"), id: z.string() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny(403, "Staff only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => i.message).join("; "));
  const by = { id: v!.userId, name: v!.fullName ?? v!.email };
  if (b.data.action === "hide") return (await hideFile(b.data.id, by.name)) ? Response.json({ ok: true }) : deny(400, "Couldn't remove that file");
  const o = parseOwner(b.data.type, b.data.key);
  if (!o) return deny(400, "Unknown person");
  if (!(await describeOwner(o))) return deny(404, "Nobody with that record");
  if (b.data.action === "ticket") {
    try { return Response.json(await fileTicket(o, b.data.name, b.data.mime, b.data.size)); }
    catch (e) { return deny(400, e instanceof Error ? e.message : "Upload failed"); }
  }
  const r = await saveFile(o, { path: b.data.path, kind: b.data.kind, label: b.data.label, jobId: b.data.job_id, source: "staff", by });
  return r.ok ? Response.json(r) : deny(400, r.error);
}
