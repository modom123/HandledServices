/*
 * FILE    : apps/web/app/api/pro/onboarding/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-01_2109 UTC — specialties and trade-specific coverage steps.
 * PURPOSE : Pro self-onboarding (web portal + mobile). Multipart form with `step`:
 *             w9         legal_name, entity_type, tin_last4, address_line, city, state, zip, file
 *             coi        expires_on, file          (staff verifies → insured_until)
 *             license    license_number, expires_on, file (staff verifies → license_expires)
 *             agreement  signer_name, agree=true   (signs the current version)
 *             payout     payout_method, account_last4
 *             specialties specialties (repeat the field once per specialty)
 *             coverage   coverage (auto | workers_comp | bond | liquor), expires_on, file —
 *                        or coverage=workers_comp + exempt=true for the no-employees statement
 *           Only the last 4 of the TIN is stored in the database; the W-9 itself is a
 *           private file staff can open.
 */
import { z } from "zod";
import { AGREEMENT_VERSION, COVERAGES, requiredCoverages, specialtiesFor } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { uploadDoc } from "@/lib/photos";
import { raiseAlert } from "@/lib/jobs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Steps = z.discriminatedUnion("step", [
  z.object({ step: z.literal("w9"), legal_name: z.string().min(2).max(160), entity_type: z.enum(["individual", "sole_prop", "llc", "s_corp", "c_corp", "partnership"]),
    tin_last4: z.string().regex(/^\d{4}$/), address_line: z.string().min(3).max(200), city: z.string().min(2).max(80), state: z.string().length(2), zip: z.string().regex(/^\d{5}$/) }),
  z.object({ step: z.literal("coi"), expires_on: date }),
  z.object({ step: z.literal("license"), license_number: z.string().min(2).max(60), expires_on: date }),
  z.object({ step: z.literal("agreement"), signer_name: z.string().min(2).max(120), agree: z.literal("true") }),
  z.object({ step: z.literal("specialties") }),
  z.object({ step: z.literal("coverage"), coverage: z.enum(["auto", "workers_comp", "bond", "liquor"]), expires_on: date.optional(), exempt: z.literal("true").optional() }),
  z.object({ step: z.literal("payout"), payout_method: z.enum(["ach", "stripe_connect", "check"]), account_last4: z.string().regex(/^\d{4}$/).optional() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const form = await req.formData().catch(() => null);
  if (!form) return deny(400, "Send a form");
  const fields = Object.fromEntries([...form.entries()].filter(([, val]) => typeof val === "string"));
  const parsed = Steps.safeParse(fields);
  if (!parsed.success) return deny(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const file = form.get("file");
  const db = adminClient();
  const id = v.contractorId;
  const b = parsed.data;

  if (b.step === "specialties") {
    const { data: pro } = await db.from("contractors").select("trades").eq("id", id).single();
    const allowed = new Set(specialtiesFor((pro?.trades ?? []) as string[]).map((x) => x.id));
    const picked = form.getAll("specialties").map(String).filter((x) => allowed.has(x));
    if (!picked.length) return deny(400, "Pick at least one specialty");
    await db.from("contractors").update({ specialties: [...new Set(picked)] }).eq("id", id);
    return Response.json({ ok: true });
  }
  if (b.step === "coverage" && b.exempt) {
    if (b.coverage !== "workers_comp") return deny(400, "Only workers' comp has a no-employees statement");
    const { data: pro } = await db.from("contractors").select("trades, coverage").eq("id", id).single();
    if (requiredCoverages((pro?.trades ?? []) as string[]).includes("workers_comp")) return deny(400, "Your trade requires a workers' comp policy");
    const signedAt = new Date().toISOString();
    await db.from("contractors").update({ coverage: { ...(pro?.coverage ?? {}), workers_comp: "exempt" } }).eq("id", id);
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "workers_comp", status: "verified", verified_by: "attestation", verified_at: signedAt,
      notes: `No-employees statement signed · ip ${req.headers.get("x-forwarded-for") ?? "?"}. Must carry workers' comp before hiring anyone.` });
    return Response.json({ ok: true });
  }
  if (b.step === "coverage" && !b.expires_on) return deny(400, "Add the policy expiry date");

  let path: string | null = null;
  if (file instanceof File && file.size) {
    try { path = await uploadDoc(file, `${id}/${b.step}`); } catch (e) { return deny(400, e instanceof Error ? e.message : "Upload failed"); }
  } else if (["w9", "coi", "license", "coverage"].includes(b.step)) {
    return deny(400, "Attach the document (PDF or photo)");
  }

  if (b.step === "w9") {
    const { step: _s, ...profile } = b;
    await db.from("contractors").update({ ...profile, state: profile.state.toUpperCase(), w9_received_at: new Date().toISOString() }).eq("id", id);
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "w9", storage_path: path, status: "pending" });
  } else if (b.step === "coi") {
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "coi", storage_path: path, expires_on: b.expires_on, status: "pending" });
  } else if (b.step === "license") {
    await db.from("contractors").update({ license_number: b.license_number }).eq("id", id);
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "license", storage_path: path, expires_on: b.expires_on, status: "pending", notes: `#${b.license_number}` });
  } else if (b.step === "coverage") {
    await db.from("contractor_documents").insert({ contractor_id: id, kind: b.coverage, storage_path: path, expires_on: b.expires_on, status: "pending", notes: COVERAGES[b.coverage].label });
  } else if (b.step === "agreement") {
    const signedAt = new Date().toISOString();
    await db.from("contractors").update({ agreement_version: AGREEMENT_VERSION, agreement_signed_at: signedAt, agreement_signer: b.signer_name }).eq("id", id);
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "agreement", status: "verified", verified_by: "e-signature", verified_at: signedAt,
      notes: `Signed v${AGREEMENT_VERSION} by "${b.signer_name}" · ip ${req.headers.get("x-forwarded-for") ?? "?"}` });
  } else if (b.step === "payout") {
    await db.from("contractors").update({ payout_method: b.payout_method, payout_account_last4: b.account_last4 ?? null }).eq("id", id);
  }
  if (["coi", "license", "w9", "coverage"].includes(b.step)) await raiseAlert("pro_document", "info", `Verify ${b.step === "coverage" ? COVERAGES[b.coverage].label : b.step.toUpperCase()} for a pro`, `Contractor ${id} uploaded a ${b.step}. Review in Handled Hub → Pros.`);
  return Response.json({ ok: true });
}
