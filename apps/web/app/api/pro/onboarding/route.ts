/*
 * FILE    : apps/web/app/api/pro/onboarding/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-02_0233 UTC — pros set their own daily job limit (dispatch never offers past it).
 * UPDATED : 2026-10-01_2109 UTC — specialties and trade-specific coverage steps.
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of person-facing texts, emails and push.
 * UPDATED : 2026-10-03_0041 UTC — signing records the full contract set (frozen copies) for the pro's My contracts.
 * UPDATED : 2026-10-06_2010 UTC — area step takes the pro's place of business (street, city, state, ZIP); distance is
 *           measured from that address (geocoded), ZIP centroid if the lookup fails.
 * PURPOSE : Pro self-onboarding (web portal + mobile). Multipart form with `step`:
 *             w9         legal_name, entity_type, tin_last4, address_line, city, state, zip, file
 *             coi        expires_on, file          (staff verifies → insured_until)
 *             license    license_number, expires_on, file (staff verifies → license_expires)
 *             agreement  signer_name, agree=true   (signs the current version)
 *             payout     payout_method, account_last4
 *             area       base_zip, service_radius_mi, service_zips ("48201, 481*"), zips_only ("on" = only those ZIPs), daily_capacity (jobs/day, never offered past it), days (repeat 0–6), windows (repeat), time_off (YYYY-MM-DD, comma-separated)
 *             specialties specialties (repeat the field once per specialty)
 *             coverage   coverage (auto | workers_comp | bond | liquor), expires_on, file —
 *                        or coverage=workers_comp + exempt=true for the no-employees statement
 *           Only the last 4 of the TIN is stored in the database; the W-9 itself is a
 *           private file staff can open.
 * UPDATED : 2026-10-12_0005 UTC — area step: the ZIP codes the pro wants to cover and "only these ZIP codes".
 * UPDATED : 2026-10-18_0248 UTC — resume (PDF or Word) and photo (profile photo) steps: step, file. Saved to the private
 *           pro-docs bucket as contractor_documents kinds 'resume' / 'photo' (staff open them in Hub → Pros).
 * UPDATED : 2026-10-18_0415 UTC — w9: LLCs taxed as S/C corporations (llc_s_corp, llc_c_corp). agreement: signed_for (the
 *           business's legal name, blank when signing as yourself) + signer_title — recorded on the pro and every signed copy.
 * UPDATED : 2026-10-27_2141 UTC — a crew company can't sign the no-employees statement (it needs a real workers' comp policy).
 * UPDATED : 2026-10-27_2300 UTC — owner only: an office manager (lib/pro-team.ts) can't do this.
 */
import { after } from "next/server";
import { z } from "zod";
import { AGREEMENT_VERSION, COVERAGES, ENTITY_TYPES, COVERAGE_KINDS, parseZipList, requiredCoverages, specialtiesFor } from "@handled/core";
import { deny, getViewer, ownerOnly } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { UPLOAD_TYPES, uploadDoc } from "@/lib/photos";
import { raiseAlert } from "@/lib/jobs";
import { geocodeAddress } from "@/lib/geo";
import { afterOnboardingStep, docName, logRecruiting } from "@/lib/recruiting";
import { signedDocUrl } from "@/lib/photos";
import { aiCheckDocument } from "@/lib/ai/doccheck";
import { notify } from "@/lib/push";
import { siteUrl } from "@/lib/notify";
import { proSigningSet } from "@/lib/contracts";
import { recordAcceptance, requestMeta } from "@/lib/contracts/record";
import { localeOf } from "@/lib/push";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Steps = z.discriminatedUnion("step", [
  z.object({ step: z.literal("w9"), legal_name: z.string().min(2).max(160), entity_type: z.enum(ENTITY_TYPES),
    tin_last4: z.string().regex(/^\d{4}$/), address_line: z.string().min(3).max(200), city: z.string().min(2).max(80), state: z.string().length(2), zip: z.string().regex(/^\d{5}$/) }),
  z.object({ step: z.literal("coi"), expires_on: date }),
  z.object({ step: z.literal("license"), license_number: z.string().min(2).max(60), expires_on: date }),
  z.object({ step: z.literal("agreement"), signer_name: z.string().min(2).max(120), agree: z.literal("true"),
    signed_for: z.string().trim().max(160).optional(), signer_title: z.string().trim().max(80).optional() }),
  z.object({ step: z.literal("specialties") }),
  z.object({ step: z.literal("resume") }),
  z.object({ step: z.literal("photo") }),
  z.object({ step: z.literal("area"), base_address: z.string().trim().min(4).max(200), base_city: z.string().trim().min(2).max(80), base_state: z.string().trim().regex(/^[A-Za-z]{2}$/), base_zip: z.string().regex(/^\d{5}$/), service_radius_mi: z.coerce.number().int().min(1).max(150), service_zips: z.string().max(3000).optional(), zips_only: z.string().optional(), daily_capacity: z.coerce.number().int().min(1).max(20).optional(), time_off: z.string().max(2000).optional() }),
  z.object({ step: z.literal("coverage"), coverage: z.enum(COVERAGE_KINDS), expires_on: date.optional(), exempt: z.literal("true").optional() }),
  z.object({ step: z.literal("payout"), payout_method: z.enum(["ach", "stripe_connect", "check"]), account_last4: z.string().regex(/^\d{4}$/).optional() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const notOwner = ownerOnly(v);
  if (notOwner) return notOwner;
  const form = await req.formData().catch(() => null);
  if (!form) return deny(400, "Send a form");
  const fields = Object.fromEntries([...form.entries()].filter(([, val]) => typeof val === "string"));
  const parsed = Steps.safeParse(fields);
  if (!parsed.success) return deny(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  if (parsed.data.step === "agreement" && parsed.data.signed_for && !parsed.data.signer_title) return deny(400, "Add your title at the business (for example Owner)");
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
    const loc = await geocodeAddress({ address: b.base_address, city: b.base_city, state: b.base_state, zip: b.base_zip });
    // location lookup down → never leave a pro matching jobs everywhere: fall back to their ZIP area
    // ZIP codes the pro wants (typed list); with none typed, keep what's there, or fall back to their ZIP area if the lookup is down
    const typed = b.service_zips !== undefined ? parseZipList(b.service_zips) : null;
    const { data: cur } = await db.from("contractors").select("service_zips").eq("id", id).single();
    const zips = typed?.length ? typed : !loc && !(cur?.service_zips ?? []).length ? [b.base_zip, `${b.base_zip.slice(0, 3)}*`] : typed ? [] : undefined;
    if (b.zips_only === "on" && !typed?.length) return deny(400, "List the ZIP codes you want, or untick “Only these ZIP codes”");
    await db.from("contractors").update({
      ...(zips ? { service_zips: zips } : {}),
      base_address: b.base_address, base_city: b.base_city, base_state: b.base_state.toUpperCase(), base_located: loc ? (loc.exact ? "address" : "zip") : null,
      base_zip: b.base_zip, base_lat: loc?.lat ?? null, base_lng: loc?.lng ?? null, service_radius_mi: b.service_radius_mi,
      ...(b.daily_capacity ? { daily_capacity: b.daily_capacity } : {}),
      availability: { days: [...new Set(days)].sort(), windows: [...new Set(windows)] }, time_off: timeOff,
    }).eq("id", id);
    // separate so the rest still saves before the 2026-10-12 migration (zips_only) is run
    await db.from("contractors").update({ zips_only: b.zips_only === "on" && Boolean(typed?.length) }).eq("id", id).then(({ error }) => error && console.error("[onboarding] zips_only", error.message));
    return done({ located: Boolean(loc), exact: Boolean(loc?.exact) });
  }
  if (b.step === "specialties") {
    const { data: pro } = await db.from("contractors").select("trades").eq("id", id).single();
    const allowed = new Set(specialtiesFor((pro?.trades ?? []) as string[]).map((x) => x.id));
    const picked = form.getAll("specialties").map(String).filter((x) => allowed.has(x));
    if (!picked.length) return deny(400, "Pick at least one specialty");
    await db.from("contractors").update({ specialties: [...new Set(picked)] }).eq("id", id);
    return done();
  }
  if (b.step === "resume" || b.step === "photo") {
    if (!(file instanceof File && file.size)) return deny(400, b.step === "resume" ? "Attach your resume" : "Attach your photo");
    let filePath: string;
    try { filePath = await uploadDoc(file, `${id}/${b.step}`, UPLOAD_TYPES[b.step]); } catch (e) { return deny(400, e instanceof Error ? e.message : "Upload failed"); }
    const at = new Date().toISOString();
    await db.from("contractor_documents").insert({ contractor_id: id, kind: b.step, storage_path: filePath, status: "verified", verified_by: "pro upload", verified_at: at });
    await db.from("contractors").update(b.step === "resume" ? { resume_uploaded_at: at } : { photo_uploaded_at: at }).eq("id", id);
    return done();
  }
  if (b.step === "coverage" && b.exempt) {
    if (b.coverage !== "workers_comp") return deny(400, "Only workers' comp has a no-employees statement");
    const { data: pro } = await db.from("contractors").select("trades, coverage, account_type").eq("id", id).single();
    if (requiredCoverages((pro?.trades ?? []) as string[]).includes("workers_comp")) return deny(400, "Your trade requires a workers' comp policy");
    if (pro?.account_type === "crew") return deny(400, "You have a crew, so the no-employees statement doesn't apply: upload your workers' comp policy");
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
    // signing for a company: its legal name and the signer's title (blank business = signing as yourself)
    const signedFor = b.signed_for || null, title = signedFor ? b.signer_title || null : null;
    await db.from("contractors").update({ agreement_version: AGREEMENT_VERSION, agreement_signed_at: signedAt, agreement_signer: b.signer_name, agreement_signed_for: signedFor, agreement_signer_title: title }).eq("id", id);
    await db.from("contractor_documents").insert({ contractor_id: id, kind: "agreement", status: "verified", verified_by: "e-signature", verified_at: signedAt,
      notes: `Signed v${AGREEMENT_VERSION} by "${b.signer_name}"${signedFor ? `, ${title}, for ${signedFor}` : ""} · ip ${req.headers.get("x-forwarded-for") ?? "?"}` });
    // one e-signature covers the whole set: agreement, policies, consents and the addenda for their trades
    const { data: me } = await db.from("contractors").select("trades, email, profile_id").eq("id", id).single();
    await recordAcceptance(proSigningSet((me?.trades ?? []) as string[]), { contractorId: id, profileId: me?.profile_id ?? null, email: me?.email ?? null, signerName: b.signer_name, onBehalfOf: signedFor, signerTitle: title, method: "signature", locale: await localeOf(me?.profile_id ?? null), ...requestMeta(req) });
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
