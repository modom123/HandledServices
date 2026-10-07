/*
 * FILE    : apps/web/lib/crew.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Crew accounts (rules in core crew.ts):
 *             signCrewAddendum   — the owner signs the Crew Addendum (right to work, I-9, workers' comp)
 *             addCrewMember      — list a person; their background check is ordered right away
 *             removeCrewMember   — the day they stop working for the company (unassigns upcoming jobs)
 *             assignCrew         — who the company is sending to a job (customer sees the name)
 *             setCrewBackground  — Checkr webhook or Hub result
 */
import "server-only";
import { BRAND, CREW_LIMITS, crewCanTake, crewReady, type Contractor, type CrewMember, type CrewRole } from "@handled/core";
import { adminClient } from "./supabase/server";
import { addEvent, raiseAlert } from "./jobs";
import { PRO_CREW_ADDENDUM } from "./contracts";
import { recordAcceptance } from "./contracts/record";
import { sendEmail } from "./notify";

const db = () => adminClient();
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function listCrew(contractorId: string, all = false): Promise<CrewMember[]> {
  let q = db().from("crew_members").select("*").eq("contractor_id", contractorId).order("created_at");
  if (!all) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as CrewMember[];
}

export async function signCrewAddendum(contractorId: string, signer: string, meta: { ip: string | null; userAgent: string | null; locale: string }): Promise<R> {
  const { data: c } = await db().from("contractors").select("email, profile_id").eq("id", contractorId).single();
  if (!c) return { ok: false, error: "Pro not found" };
  const at = new Date().toISOString();
  await db().from("contractors").update({ crew_attested_at: at, crew_attestation: { signer, version: PRO_CREW_ADDENDUM.version, ip: meta.ip, at } }).eq("id", contractorId);
  await recordAcceptance([PRO_CREW_ADDENDUM], { contractorId, profileId: c.profile_id, email: c.email, signerName: signer, method: "signature", locale: meta.locale, ip: meta.ip, userAgent: meta.userAgent });
  return { ok: true };
}

export interface NewCrewMember { full_name: string; phone?: string | null; email?: string | null; locale: "en" | "es"; role: CrewRole; trades: string[]; years_experience?: number | null; license_number?: string | null }

export async function addCrewMember(contractorId: string, m: NewCrewMember): Promise<R<{ id: string }>> {
  const { data: c } = await db().from("contractors").select("crew_attested_at, business_name, trades, state, city").eq("id", contractorId).single();
  if (!c?.crew_attested_at) return { ok: false, error: "Sign the Crew Addendum first" };
  const { count } = await db().from("crew_members").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).eq("active", true);
  if ((count ?? 0) >= CREW_LIMITS.maxActive) return { ok: false, error: `Up to ${CREW_LIMITS.maxActive} active crew members` };
  if (m.role === "licensed" && !m.license_number) return { ok: false, error: "Add the license number for a licensed tech" };
  if (!m.email) return { ok: false, error: "Add their email: the background check link goes there" };
  const trades = m.trades.filter((t) => (c.trades as string[]).includes(t));
  const { data, error } = await db().from("crew_members").insert({ contractor_id: contractorId, ...m, trades, email: m.email.trim().toLowerCase() }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not add" };
  await orderCrewCheck(data.id).catch((e) => console.error("[crew check]", e));
  return { ok: true, id: data.id };
}

export async function removeCrewMember(contractorId: string, id: string): Promise<R> {
  const { data } = await db().from("crew_members").update({ active: false, removed_at: new Date().toISOString() }).eq("id", id).eq("contractor_id", contractorId).select("id").maybeSingle();
  if (!data) return { ok: false, error: "Not on your crew" };
  // upcoming jobs they were going to: back to the owner to choose again
  await db().from("jobs").update({ crew_member_id: null }).eq("crew_member_id", id).in("status", ["assigned", "scheduled", "dispatched"]);
  return { ok: true };
}

/** Background check for a crew member: Checkr invitation when configured, else an ops task. */
export async function orderCrewCheck(id: string) {
  const { data: m } = await db().from("crew_members").select("*, contractors(business_name, state, city)").eq("id", id).single();
  if (!m || !["not_started", "canceled"].includes(m.background_status)) return;
  const company = (m.contractors as { business_name: string; state: string | null; city: string | null } | null);
  const key = process.env.CHECKR_API_KEY, pkg = process.env.CHECKR_PACKAGE;
  if (!key || !pkg) {
    await db().from("crew_members").update({ background_status: "pending" }).eq("id", id);
    await raiseAlert("recruiting", "warn", `Order a background check: ${m.full_name} (crew of ${company?.business_name})`, `${m.email ?? "no email"} · ${m.phone ?? ""}. Run it with your screening provider, then record the result in Hub → Pros → ${company?.business_name} → Crew.`);
    return;
  }
  const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  const post = async (path: string, body: Record<string, unknown>) => {
    const r = await fetch(`https://api.checkr.com/v1/${path}`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? `Checkr ${path} ${r.status}`);
    return j as { id: string };
  };
  try {
    const [first, ...rest] = String(m.full_name).split(" ");
    const cand = await post("candidates", { email: m.email, first_name: first, last_name: rest.join(" ") || first, phone: m.phone ?? undefined, custom_id: `crew:${m.id}` });
    await post("invitations", { candidate_id: cand.id, package: pkg, work_locations: [{ country: "US", state: company?.state ?? "MI", city: company?.city ?? undefined }] });
    await db().from("crew_members").update({ background_provider_id: cand.id, background_status: "invited" }).eq("id", id);
    if (m.email) {
      const es = m.locale === "es";
      await sendEmail(m.email,
        es ? `${company?.business_name}: su verificación de antecedentes (de Checkr)` : `${company?.business_name}: your background check (from Checkr)`,
        es ? `${company?.business_name} le registró como parte de su equipo para trabajos de ${BRAND.name}. Checkr, nuestro proveedor de verificación, le envió por correo un enlace seguro para dar su consentimiento y completar la verificación. Normalmente tarda de 1 a 3 días hábiles.\n\n— ${BRAND.name}`
          : `${company?.business_name} listed you on their crew for ${BRAND.name} jobs. Checkr, our screening provider, has emailed you a secure link to consent and complete your background check. It usually takes 1–3 business days.\n\n— ${BRAND.name}`).catch(() => {});
    }
  } catch (e) {
    await db().from("crew_members").update({ background_status: "pending" }).eq("id", id);
    await raiseAlert("recruiting", "warn", `Crew background check didn't start: ${m.full_name}`, `${e instanceof Error ? e.message : e}. Order it by hand.`);
  }
}

export async function setCrewBackground(id: string, status: "clear" | "consider" | "suspended" | "canceled" | "pending", actor = "checkr") {
  const clear = status === "clear";
  const { data: m } = await db().from("crew_members").update({ background_status: status, ...(clear ? { background_checked_at: new Date().toISOString() } : {}) }).eq("id", id).select("full_name, contractor_id").maybeSingle();
  if (!m) return;
  if (!clear && status !== "pending") {
    await raiseAlert("recruiting", "warn", `Crew background check needs review: ${m.full_name}`, `Result: ${status} (${actor}). Review the report and follow the adverse-action process before any decision. They can't be sent to jobs meanwhile.`);
    await db().from("jobs").update({ crew_member_id: null }).eq("crew_member_id", id).in("status", ["assigned", "scheduled", "dispatched"]);
  }
}

/** The company picks who goes (null = the owner). Checks the company and the person for this job. */
export async function assignCrew(jobId: string, contractorId: string, crewMemberId: string | null): Promise<R> {
  const { data: job } = await db().from("jobs").select("id, ref, service_slug, status, contractor_id").eq("id", jobId).maybeSingle();
  if (!job || job.contractor_id !== contractorId || !["assigned", "scheduled", "dispatched", "in_progress"].includes(job.status)) return { ok: false, error: "Not an upcoming job of yours" };
  if (!crewMemberId) {
    await db().from("jobs").update({ crew_member_id: null }).eq("id", jobId);
    await addEvent(jobId, "crew", "The pro is doing this job themself", "pro", true, "El profesional hará este trabajo personalmente");
    return { ok: true };
  }
  const [{ data: c }, { data: m }] = await Promise.all([
    db().from("contractors").select("crew_attested_at, coverage").eq("id", contractorId).single(),
    db().from("crew_members").select("*").eq("id", crewMemberId).eq("contractor_id", contractorId).maybeSingle(),
  ]);
  if (!m) return { ok: false, error: "Not on your crew" };
  const notReady = crewReady((c ?? {}) as Pick<Contractor, "crew_attested_at" | "coverage">);
  if (notReady) return { ok: false, error: notReady };
  const why = crewCanTake(m as CrewMember, job.service_slug);
  if (why) return { ok: false, error: why };
  await db().from("jobs").update({ crew_member_id: crewMemberId }).eq("id", jobId);
  const first = String(m.full_name).split(" ")[0];
  await addEvent(jobId, "crew", `${first} from your pro's crew is doing this job (background-checked)`, "pro", true, `${first}, del equipo de su profesional, hará este trabajo (con verificación de antecedentes)`);
  return { ok: true };
}
