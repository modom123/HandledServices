/*
 * FILE    : apps/web/app/api/uploads/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Photo upload for bookings (guest-safe: rate-limited by size/count, private bucket).
 */
import { uploadPhoto } from "@/lib/photos";
import { getViewer } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("photos") ?? []).filter((f): f is File => f instanceof File).slice(0, 8);
  if (!files.length) return Response.json({ error: "No photos" }, { status: 400 });
  const viewer = await getViewer(req);
  const folder = viewer?.contractorId ? `pro/${viewer.contractorId}` : `booking/${new Date().toISOString().slice(0, 10)}`;
  try {
    const paths = await Promise.all(files.map((f) => uploadPhoto(f, folder)));
    return Response.json({ paths });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
