/*
 * FILE    : apps/web/app/api/pro/onboarding/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-02_0233 UTC — pros set their own daily job limit (dispatch never offers past it).
 * UPDATED : 2026-10-01_2109 UTC — specialties and trade-specific coverage steps.
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of person-facing texts, emails and push.
 * UPDATED : 2026-10-03_0041 UTC — signing records the full contract set (frozen copies) for the pro's My contracts.
 * PURPOSE : Pro self-onboarding (web portal + mobile). Multipart form with `step`:
 *             w9         legal_name, entity_type, tin_last4, address_line, city, state, zip, file
 *             coi        expires_on, file          (staff verifies → insured_until)
 *             license    license_number, expires_on, file (staff verifies → license_expires)
 *             agreement  signer_name, agree=true   (signs the current version)
 *             payout     payout_method, account_last4
 *             area       base_zip, service_radius_mi, daily_capacity (jobs/day, never offered past it), days (repeat 0–6), windows (repeat), time_off (YYYY-MM-DD, comma-separated)
 *             specialties specialties (repeat the field once per specialty)
 *             coverage   coverage (auto | workers_comp | bond | liquor), expires_on, file —
 *                        or coverage=workers_comp + exempt=true for the no-employees statement
 *           Only the last 4 of the TIN is stored in the database; the W-9 itself is a
 *           private file staff can open.
 */
import { after } from "next/server";
import { z } from "zod";
import { AGREEMENT_VERSION, COVERAGES, COVERAGE_KINDS, requiredCoverages, specialtiesFor } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { uploadDoc } from "@/lib/photos";
import { raiseAlert } from "@/lib/jobs";
import { zipCentroid } from "@/lib/geo";
import { afterOnboardingStep, docName, logRecruiting } from "@/lib/recruiting";
import { signedDocUrl } from "@/lib/photos";
import { aiCheckDocument } from "@/lib/ai/doccheck";
import { notify } from "@/lib/push";
import { siteUrl } from "@/lib/notify";
import { proSigningSet } from "@/lib/contracts";
import { recordAcceptance, requestMeta } from "@/lib/contracts/record";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Steps = z.discriminatedUnion("step", [
  z.object({ step: z.literal("w9"), legal_name: z.string().min(2).max(160), entity_type: z.enum(["individual", "sole_prop", "llc", "s_corp", "c_corp", "partnership"]),
    tin_last4: z.string().regex(/^\d{4}$/), address_line: z.string().min(3).max(200), city: z.string().min(2).max(80), state: z.string().length(2), zip: z.string().regex(/^\d{5}$/) }),
  z.object({ step: z.literal("coi"), expires_on: date }),
  z.object({ step: z.literal("license"), license_number: z.string().min(2).max(60), expires_on: date }),
  z.object({ step: z.literal("agreement"), signer_name: z.string().min(2).max(120), agree: z.literal("true") }),
  z.object({ step: z.literal("specialties") }),
  z.object({ step: z.literal("area"), base_zip: z.string().regex(/^\d{5}$/), service_radius_mi: z.coerce.number().int().min(1).max(150), daily_capacity: z.coerce.number().int().min(1).max(20).optional(), time_off: z.string().max(2000).optional() }),
  z.object({ step: z.literal("coverage"), coverage: z.enum(COVERAGE_KINDS), expires_on: date.optional(), exempt: z.literal("true").optional() }),
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
  // every saved step: log it, start the background check when ready, activate when complete
  const done = (extra: Record<string, unknown> = {}) => {
    after(() => afterOnboardingStep(id, b.step === "coverage" ? `coverage:${b.coverage}` : b.step).catch((e) => console.error("[onboarding]", e)));
    return Response.json({ ok: true, ...extra });
  };
  let docId: string | null = null;

  if (b.step === "area") {
    const days = form.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    const windows = form.getAll("windows").map(String).filter((w) => ["morning", "midday", "afternoon"].includes(w));
    if (!days.length || !windows.length) return deny(400, "Pick at least one day and one time of day");
    const timeOff = (b.time_off ?? "").split(/[,\s]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 120);
    const loc = await zipCentroid(b.base_zip);
    // location lookup down → never leave a pro matching jobs everywhere: fall back to their ZIP area
    const { data: cur } = await db.from("contractors").select("service_zips").eq("id", id).single();
    const zips = !loc && !(cur?.service_zips ?? []).length ? [b.base_zip, `${b.base_zip.slice(0, 3)}*`] : undefined;
    await db.from("contractors").update({
      ...(zips ? { service_zips: zips } : {}),
      base_zip: b.base_zip, base_lat: loc?.lat ?? null, base_lng: loc?.lng ?? null, service_radius_mi: b.service_radius_mi,
      ...(b.daily_capacity ? { daily_capacity: b.daily_capacity } : {}),
      availability: { days: [...new Set(days)].sort(), windows: [...new Set(windows)] }, time_off: timeOff,
    }).eq("id", id);
    return done({ located: Boolean(loc) });
  }
  if (b.step === "specialties") {
    const { data: pro } = await db.from("contractors").select("trades").eq("id", id).single();
    const allowed = new Set(specialtiesFor((pro?.trades ?? []) as string[]).map((x) => x.id));
    const picked = form.getAll("specialties").map(String).filter((x) => allowed.has(x));
    if (!picked.length) return deny(400, "Pick at least one specialty");
    await db.from("contractors").update({ specialties: [...new Set(picked)] }).eq("id", id);
    return done();
  }
  if (b.step === "coverage" && b.exempt) {
    if (b.coverage !== "workers_comp") return deny(400, "Only workers' comp has a no-employees statement");
    const { data: pro } = await db.from("contractors").select("trades, coverage").eq("id", id).single();
    if (requiredCoverages((pro?.trades ?? []) as string[]).includes("workers_comp")) return deny(400, "Your trade requires a workers' comp policy");
    const signedAt = new Date().toISOString();
    await db.from("contractors").update({ coverage: { ...(pro?.coverage ?? {}), workers_comp: "exempt" } }).eq("id", id);
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "workers_comp", status: "verified", verified_by: "attestation", verified_at: signedAt,
      notes: `No-employees statement signed · ip ${req.headers.get("x-forwarded-for") ?? "?"}. Must carry workers' comp before hiring anyone.` });
    return done();
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
    docId = (await db.from("contractor_documents").insert({ contractor_id: id, kind: "coi", storage_path: path, expires_on: b.expires_on, status: "pending" }).select("id").single()).data?.id ?? null;
  } else if (b.step === "license") {
    await db.from("contractors").update({ license_number: b.license_number }).eq("id", id);
    docId = (await db.from("contractor_documents").insert({ contractor_id: id, kind: "license", storage_path: path, expires_on: b.expires_on, status: "pending", notes: `#${b.license_number}` }).select("id").single()).data?.id ?? null;
  } else if (b.step === "coverage") {
    docId = (await db.from("contractor_documents").insert({ contractor_id: id, kind: b.coverage, storage_path: path, expires_on: b.expires_on, status: "pending", notes: COVERAGES[b.coverage].label }).select("id").single()).data?.id ?? null;
  } else if (b.step === "agreement") {
    const signedAt = new Date().toISOString();
    await db.from("contractors").update({ agreement_version: AGREEMENT_VERSION, agreement_signed_at: signedAt, agreement_signer: b.signer_name }).eq("id", id);
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "agreement", status: "verified", verified_by: "e-signature", verified_at: signedAt,
      notes: `Signed v${AGREEMENT_VERSION} by "${b.signer_name}" · ip ${req.headers.get("x-forwarded-for") ?? "?"}` });
    // one e-signature covers the whole set: agreement, policies, consents and the addenda for their trades
    const { data: me } = await db.from("contractors").select("trades, email, profile_id").eq("id", id).single();
    await recordAcceptance(proSigningSet((me?.trades ?? []) as string[]), { contractorId: id, profileId: me?.profile_id ?? null, email: me?.email ?? null, signerName: b.signer_name, method: "signature", ...requestMeta(req) });
  } else if (b.step === "payout") {
    await db.from("contractors").update({ payout_method: b.payout_method, payout_account_last4: b.account_last4 ?? null }).eq("id", id);
  }
  if (["coi", "license", "w9", "coverage"].includes(b.step)) await raiseAlert("pro_document", "info", `Verify ${b.step === "coverage" ? COVERAGES[b.coverage].label : b.step.toUpperCase()} for a pro`, `Contractor ${id} uploaded a ${b.step}. The AI reading is next to it in Handled Hub → Pros.`);
  // AI reads the certificate/license now, so staff verify in one click and the pro hears fast if it's unusable
  if (docId && path && !path.endsWith(".heic")) {
    const docPath = path, theDoc = docId, kind = b.step === "coverage" ? b.coverage : b.step;
    const claimed = "expires_on" in b ? b.expires_on ?? null : null;
    after(async () => {
      const [{ data: pro }, url] = await Promise.all([db.from("contractors").select("business_name, legal_name, trades, profile_id, email").eq("id", id).single(), signedDocUrl(docPath, 900)]);
      if (!pro || !url) return;
      const check = await aiCheckDocument({ kind, url, isPdf: docPath.endsWith(".pdf"), pro, claimedExpiry: claimed });
      if (!check) return;
      await db.from("contractor_documents").update({ ai_check: check }).eq("id", theDoc);
      await logRecruiting("doc_ai_check", { contractorId: id }, `${kind}: ${check.meets_requirements ? "looks good" : check.problems.join("; ")}`, "ai");
      if (!check.readable) await notify(pro.profile_id, { title: "Please re-upload your document", body: "We couldn't read it — try a clearer photo or the PDF.", data: { type: "onboarding" },
        email: { to: pro.email, subject: "Please re-upload your document", text: `We couldn't read the ${kind.toUpperCase()} you uploaded. Please upload a clearer photo or the PDF from your insurer or the state.\n\nYour setup: ${siteUrl()}/pro/onboarding` },
        es: { title: "Vuelva a subir su documento", body: "No pudimos leerlo: intente con una foto más clara o el PDF.",
          subject: "Vuelva a subir su documento", text: `No pudimos leer el documento (${docName(kind, "es")}) que subió. Suba una foto más clara o el PDF de su aseguradora o del estado.\n\nSu configuración: ${siteUrl()}/pro/onboarding` } });
    });
  }
  return done();
}
