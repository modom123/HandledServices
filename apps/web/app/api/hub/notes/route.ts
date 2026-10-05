/*
 * FILE    : apps/web/app/api/hub/notes/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2141 UTC
 * UPDATED : 2026-10-05_2146 UTC — customers: subject_type "customer" with customer_email (the id is derived from the email).
 * PURPOSE : Add an account note (staff only): POST { subject_type, subject_id | customer_email, kind, body }. Append-only — there is no
 *           edit or delete; a correction is a new note.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { addNote, customerSubjectId } from "@/lib/notes";

const Body = z.object({
  subject_type: z.enum(["biz_lead", "business_account", "talent_client", "customer"]),
  subject_id: z.string().uuid().optional(),
  customer_email: z.string().email().optional(),
  kind: z.enum(["note", "call", "email", "meeting", "text"]),
  body: z.string().trim().min(1).max(8000),
});

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Write the note first");
  const id = b.data.subject_type === "customer" ? (b.data.customer_email ? customerSubjectId(b.data.customer_email) : null) : b.data.subject_id;
  if (!id) return deny(400, "Missing account");
  const r = await addNote(b.data.subject_type, id, b.data.kind, b.data.body, v!.fullName ? `${v!.fullName} <${v!.email}>` : v!.email);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
