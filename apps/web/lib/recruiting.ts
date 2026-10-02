/*
 * FILE    : apps/web/lib/recruiting.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0006 UTC
 * PURPOSE : Automated pro recruiting & onboarding. Every touch is logged to recruiting_events.
 *             onApplication()        — AI screen → invite automatically, or ask staff to decide
 *             inviteApplicant()      — pro record + welcome email with a one-click sign-in link
 *             afterOnboardingStep()  — orders the background check, activates when complete
 *             orderBackgroundCheck() — Checkr invitation (CHECKR_API_KEY), else an ops task
 *             maybeActivate()        — all steps done + documents verified + background clear → live
 *             recruitingSweep()      — daily: setup reminders, stuck applicants, drop-offs
 */
import "server-only";
import { BRAND, COVERAGE_KINDS, STAGE_LABEL, autoInviteDecision, mergeRecruiting, onboardingChecklist, pipelineStage, reminderDue, shouldDrop, type Contractor, type RecruitingSettings } from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { notify } from "./push";
import { raiseAlert } from "./jobs";
import { aiScreenApplication } from "./ai/screen";

const db = () => adminClient();

// ─── settings & log ──────────────────────────────────────────────────────────

export async function getRecruitingSettings(): Promise<RecruitingSettings> {
  const { data } = await db().from("recruiting_settings").select("settings").eq("id", 1).maybeSingle();
  return mergeRecruiting((data?.settings ?? {}) as Partial<RecruitingSettings>);
}

export async function saveRecruitingSettings(s: Partial<RecruitingSettings>, who: string) {
  const merged = mergeRecruiting(s);
  await db().from("recruiting_settings").upsert({ id: 1, settings: merged, updated_at: new Date().toISOString(), updated_by: who });
  return merged;
}

export async function logRecruiting(kind: string, ids: { applicationId?: string | null; contractorId?: string | null }, note?: string | null, actor = "system") {
  await db().from("recruiting_events").insert({ application_id: ids.applicationId ?? null, contractor_id: ids.contractorId ?? null, kind, note: note ?? null, actor });
}

/**
 * A one-click sign-in link for emails (no "request a code" step). Falls back to the login
 * page when the auth admin API isn't available.
 */
export async function signInUrl(email: string, next = "/pro/onboarding"): Promise<string> {
  try {
    const { data, error } = await db().auth.admin.generateLink({ type: "magiclink", email });
    const hash = data?.properties?.hashed_token;
    if (!error && hash) return `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(hash)}&type=magiclink&next=${encodeURIComponent(next)}`;
  } catch { /* fall through */ }
  return `${siteUrl()}/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`;
}

function stepsList(c: Contractor) {
  return onboardingChecklist(c as never).steps.filter((s) => !s.done).map((s) => `• ${s.label}`).join("\n");
}

// ─── application → invite ────────────────────────────────────────────────────

/** After an application is saved: AI screen, then invite automatically or ask staff. */
export async function onApplication(appId: string) {
  const { data: app } = await db().from("contractor_applications").select("*").eq("id", appId).single();
  if (!app) return;
  // business qualifications only — no name, email, phone or anything that could bias the screen
  const facts = {
    trades: app.trades, specialties: app.specialties, service_zips: app.zips, years_experience: app.years_experience, crew_size: app.crew_size,
    has_general_liability: app.insured, license_number_given: Boolean(app.license_number), other_coverages: app.coverages_held,
    equipment: app.equipment, references_given: Boolean(app.references_text), work_links_given: Boolean(app.work_links), about: app.message,
  };
  const screen = await aiScreenApplication(facts).catch(() => null);
  if (screen) {
    await db().from("contractor_applications").update({ ai_screen: screen, stage: "screened", screened_at: new Date().toISOString() }).eq("id", appId);
    await logRecruiting("screened", { applicationId: appId }, `AI ${screen.recommendation} · score ${screen.score}`, "ai");
  }
  const settings = await getRecruitingSettings();
  const d = autoInviteDecision(settings, screen);
  if (d.invite) {
    await inviteApplicant(appId, "auto-invite", d.why);
    return;
  }
  await raiseAlert("recruiting", "info", `Decide: ${app.business_name} (${(app.trades as string[]).join(", ")})`, `${d.why}. Open Hub → Recruiting.`);
  if (opsEmail()) await sendEmail(opsEmail(), `New pro application: ${app.business_name}`, `Trades: ${(app.trades as string[]).join(", ")}\nAI: ${screen?.recommendation ?? "n/a"} (${screen?.score ?? "-"})\n${d.why}\n\nDecide in Hub → Recruiting: ${siteUrl()}/hub/recruiting`);
}

export async function inviteApplicant(appId: string, actor: string, why = "") {
  const { data: app } = await db().from("contractor_applications").select("*").eq("id", appId).single();
  if (!app) return { ok: false, error: "Not found" };
  if (app.stage === "invited" && app.contractor_id) return { ok: true, contractorId: app.contractor_id as string };
  const zips = String(app.zips ?? "").split(/[,\s]+/).filter((z: string) => /^\d{3,5}\*?$/.test(z));
  const now = new Date().toISOString();
  const { data: pro, error } = await db().from("contractors").upsert({
    business_name: app.business_name, contact_name: app.contact_name, email: String(app.email).toLowerCase(), phone: app.phone,
    trades: app.trades, specialties: app.specialties ?? [], service_zips: zips, license_number: app.license_number, status: "vetting",
    daily_capacity: Math.max(2, Math.min(10, (app.crew_size ?? 1) * 2)), application_id: app.id, invited_at: now, dropped_at: null,
  }, { onConflict: "email" }).select("*").single();
  if (error || !pro) return { ok: false, error: error?.message ?? "Couldn't create the pro" };
  await db().from("contractor_applications").update({ status: "approved", stage: "invited", invited_at: now, decided_by: actor, contractor_id: pro.id, last_contact_at: now }).eq("id", appId);
  await logRecruiting("invited", { applicationId: appId, contractorId: pro.id }, why || null, actor);
  const link = await signInUrl(pro.email);
  await sendEmail(pro.email, `You're invited to ${BRAND.name} — finish setup in about 15 minutes`,
    `Hi ${String(app.contact_name).split(" ")[0]},\n\nGood news — you're invited to join ${BRAND.name} as an independent pro (1099). Prepaid, pre-priced jobs in your area, paid weekly, no lead fees.\n\nOne click signs you in and opens your setup checklist:\n${link}\n\nWhat you'll need (have these handy):\n${stepsList(pro as Contractor)}\n\nYou can do it on your phone. Most pros finish in about 15 minutes, and offers start the day you're approved.\n\nQuestions? Reply to this email.\n\n— ${BRAND.name}`);
  return { ok: true, contractorId: pro.id as string };
}

export async function rejectApplicant(appId: string, actor: string, reason?: string) {
  const { data: app } = await db().from("contractor_applications").update({ status: "rejected", stage: "rejected", decided_by: actor, last_contact_at: new Date().toISOString() }).eq("id", appId).select("*").single();
  if (!app) return;
  await logRecruiting("rejected", { applicationId: appId }, reason ?? null, actor);
  await sendEmail(app.email, `Your ${BRAND.name} application`, `Hi ${String(app.contact_name).split(" ")[0]},\n\nThanks for applying. We can't offer work right now${reason ? ` (${reason})` : " in your trade and area"}. We'll keep your details and reach out if that changes.\n\n— ${BRAND.name}`);
}

// ─── onboarding progress → background check → activation ────────────────────

/** Call after any onboarding step or document decision. */
export async function afterOnboardingStep(contractorId: string, what: string, actor = "pro") {
  await logRecruiting("step", { contractorId }, what, actor);
  const { data: c } = await db().from("contractors").select("*").eq("id", contractorId).single();
  if (!c) return;
  const { steps } = onboardingChecklist(c as never);
  const done = (k: string) => steps.find((s) => s.key === k)?.done;
  // order the background check as soon as the W-9 and agreement are in (identity + consent)
  if (!c.background_checked && !c.background_status && done("w9") && done("agreement")) await orderBackgroundCheck(contractorId);
  await maybeActivate(contractorId);
}

/**
 * Background check through Checkr when CHECKR_API_KEY and CHECKR_PACKAGE are set (Checkr emails
 * the pro a consent link; results come back on /api/checkr/webhook). Otherwise an ops task.
 * Verify the package slug and work-location rules in your Checkr dashboard.
 */
export async function orderBackgroundCheck(contractorId: string) {
  const { data: c } = await db().from("contractors").select("*").eq("id", contractorId).single();
  if (!c || c.background_checked || c.background_status) return;
  const key = process.env.CHECKR_API_KEY, pkg = process.env.CHECKR_PACKAGE;
  if (!key || !pkg) {
    await db().from("contractors").update({ background_status: "pending" }).eq("id", contractorId);
    await raiseAlert("recruiting", "warn", `Order a background check: ${c.business_name}`, `${c.contact_name} · ${c.email}. Run it with your screening provider, then upload the report in Hub → Pros (or set CHECKR_API_KEY to automate).`);
    await logRecruiting("background_ordered", { contractorId }, "manual (no Checkr key)");
    return;
  }
  const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  const post = async (path: string, body: Record<string, unknown>) => {
    const r = await fetch(`https://api.checkr.com/v1/${path}`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? `Checkr ${path} ${r.status}`);
    return j as { id: string; invitation_url?: string };
  };
  try {
    const [first, ...rest] = String(c.legal_name || c.contact_name).split(" ");
    const cand = await post("candidates", { email: c.email, first_name: first, last_name: rest.join(" ") || first, phone: c.phone, zipcode: c.zip ?? c.base_zip ?? undefined, custom_id: c.id });
    await post("invitations", { candidate_id: cand.id, package: pkg, work_locations: [{ country: "US", state: c.state ?? "MI", city: c.city ?? undefined }] });
    await db().from("contractors").update({ background_provider_id: cand.id, background_status: "invited" }).eq("id", contractorId);
    await logRecruiting("background_ordered", { contractorId }, `Checkr candidate ${cand.id}`);
    await notify(c.profile_id, { title: "Background check: check your email", body: "Checkr sent you a secure link to consent and finish your check.", data: { type: "onboarding" },
      email: { to: c.email, subject: "Your background check link (from Checkr)", text: `Next step: Checkr — our screening provider — has emailed you a secure link to consent and complete your background check. It usually takes 1–3 business days.\n\n— ${BRAND.name}` } });
  } catch (e) {
    await db().from("contractors").update({ background_status: "pending" }).eq("id", contractorId);
    await raiseAlert("recruiting", "warn", `Background check didn't start: ${c.business_name}`, `${e instanceof Error ? e.message : e}. Order it by hand.`);
  }
}

/** Checkr (or ops) reported a result. */
export async function onBackgroundResult(contractorId: string, status: "clear" | "consider" | "suspended" | "canceled", actor = "checkr") {
  const clear = status === "clear";
  await db().from("contractors").update({ background_status: status, ...(clear ? { background_checked: true, background_checked_at: new Date().toISOString() } : {}) }).eq("id", contractorId);
  await logRecruiting(`background_${status}`, { contractorId }, null, actor);
  if (!clear) {
    const { data: c } = await db().from("contractors").select("business_name").eq("id", contractorId).single();
    await raiseAlert("recruiting", "warn", `Background check needs review: ${c?.business_name}`, `Result: ${status}. Review the report in Checkr and follow the adverse-action process before any decision.`);
    return;
  }
  await maybeActivate(contractorId);
}

/** Everything done → activate (when auto-activate is on), and tell the pro they're live. */
export async function maybeActivate(contractorId: string, actor = "auto-activate") {
  const settings = await getRecruitingSettings();
  const { data: c } = await db().from("contractors").select("*").eq("id", contractorId).single();
  if (!c || c.status !== "vetting") return false;
  const { complete } = onboardingChecklist(c as never);
  if (!complete) return false;
  if (!settings.autoActivate) {
    await raiseAlert("recruiting", "info", `Ready to activate: ${c.business_name}`, "Every step is done and verified. Activate in Hub → Pros.");
    return false;
  }
  return activatePro(contractorId, actor);
}

/** Activate a pro whose setup is complete (any actor: auto, staff, IEBC). */
export async function activatePro(contractorId: string, actor: string) {
  const { data: c } = await db().from("contractors").select("*").eq("id", contractorId).single();
  if (!c) throw new Error("No such pro");
  if (c.status === "approved") return true;
  const { steps, complete } = onboardingChecklist(c as never);
  if (!complete) throw new Error(`Setup incomplete: ${steps.filter((x) => !x.done).map((x) => x.label).join(", ")}`);
  const { data: won } = await db().from("contractors").update({ status: "approved", onboarded_at: c.onboarded_at ?? new Date().toISOString(), dropped_at: null }).eq("id", contractorId).neq("status", "approved").select("id").maybeSingle();
  if (!won) return true;
  await logRecruiting("activated", { contractorId }, null, actor);
  await notify(c.profile_id, { title: "You're live 🎉", body: "Setup is complete. Job offers in your area start now.", data: { type: "pro_home" },
    email: { to: c.email, subject: `You're live on ${BRAND.name}`, text: `Welcome aboard, ${String(c.contact_name).split(" ")[0]} — your setup is complete and verified. You'll start getting job offers in your area and specialties right away.\n\nTurn on notifications in the ${BRAND.name} app so you never miss an offer.\nYour dashboard: ${siteUrl()}/pro\n\n— ${BRAND.name}` } });
  return true;
}

// ─── daily follow-up ──────────────────────────────────────────────────────────

/** Daily: reminders for unfinished setup, stuck applications, drop-offs. */
export async function recruitingSweep(now = new Date()) {
  const s = await getRecruitingSettings();
  let reminded = 0, dropped = 0, activated = 0, stuck = 0;
  const { data: pros } = await db().from("contractors").select("*").eq("status", "vetting").is("dropped_at", null);
  for (const c of (pros ?? []) as (Contractor & { invited_at: string | null; created_at: string; onboarding_reminders: number })[]) {
    if (await maybeActivate(c.id)) { activated++; continue; }
    const invited = c.invited_at ?? c.created_at;
    const due = reminderDue(s, invited, c.onboarding_reminders, now);
    const left = onboardingChecklist(c as never).steps.filter((x) => !x.done);
    // waiting only on us (documents being verified / background running) → no nagging the pro
    const onUs = left.every((x) => ["coi", "license", "background"].includes(x.key) || x.key.startsWith("coverage:"));
    if (due !== null && !onUs) {
      const link = await signInUrl(c.email);
      const n = due + 1;
      await notify(c.profile_id, {
        title: `Finish your ${BRAND.name} setup`, body: `${left.length} step${left.length > 1 ? "s" : ""} left — offers start when you're done.`, data: { type: "onboarding" },
        email: { to: c.email, subject: n === 1 ? "Your setup is waiting — about 15 minutes" : n === s.reminderDays.length ? "Last reminder: finish setup to start getting jobs" : `${left.length} steps left to start getting jobs`,
          text: `Hi ${String(c.contact_name).split(" ")[0]},\n\nYou're ${left.length} step${left.length > 1 ? "s" : ""} away from getting prepaid jobs:\n${left.map((x) => `• ${x.label}`).join("\n")}\n\nOne click signs you in:\n${link}\n\nStuck on something (insurance, license)? Just reply — we'll help.\n\n— ${BRAND.name}` },
      });
      await db().from("contractors").update({ onboarding_reminders: c.onboarding_reminders + 1, last_reminder_at: now.toISOString() }).eq("id", c.id);
      await logRecruiting("reminder", { contractorId: c.id }, `#${n} · ${left.length} steps left`);
      reminded++;
    } else if (!onUs && shouldDrop(s, invited, c.onboarding_reminders, now)) {
      await db().from("contractors").update({ dropped_at: now.toISOString() }).eq("id", c.id);
      await logRecruiting("dropped", { contractorId: c.id }, `${left.length} steps never finished`);
      await sendEmail(c.email, `We'll keep your ${BRAND.name} spot`, `Hi ${String(c.contact_name).split(" ")[0]},\n\nWe haven't heard from you, so we've paused your setup. Your progress is saved — sign in any time to pick up where you left off: ${await signInUrl(c.email)}\n\n— ${BRAND.name}`);
      dropped++;
    }
  }
  // applications waiting on a staff decision too long
  const cutoff = new Date(now.getTime() - s.decisionHours * 3600000).toISOString();
  const { data: waiting } = await db().from("contractor_applications").select("id, business_name, created_at").in("stage", ["applied", "screened"]).lt("created_at", cutoff);
  for (const a of waiting ?? []) {
    const { data: told } = await db().from("recruiting_events").select("id").eq("application_id", a.id).eq("kind", "decision_overdue").limit(1);
    if (told?.length) continue;
    await raiseAlert("recruiting", "warn", `Applicant waiting ${s.decisionHours}h+: ${a.business_name}`, "Invite or decline in Hub → Recruiting — good pros sign up elsewhere fast.");
    await logRecruiting("decision_overdue", { applicationId: a.id });
    stuck++;
  }
  return { reminded, dropped, activated, stuck };
}

/** Pipeline rows for the Hub. */
export async function pipeline() {
  const [{ data: apps }, { data: pros }, { data: docs }] = await Promise.all([
    db().from("contractor_applications").select("*").order("created_at", { ascending: false }).limit(500),
    db().from("contractors").select("*"),
    db().from("contractor_documents").select("contractor_id, status").eq("status", "pending"),
  ]);
  const byId = new Map(((pros ?? []) as (Contractor & Record<string, unknown>)[]).map((c) => [c.id, c]));
  const byEmail = new Map(((pros ?? []) as (Contractor & Record<string, unknown>)[]).map((c) => [String(c.email).toLowerCase(), c]));
  const pending = new Map<string, number>();
  for (const d of docs ?? []) pending.set(d.contractor_id, (pending.get(d.contractor_id) ?? 0) + 1);
  const seen = new Set<string>();
  const rows = ((apps ?? []) as Record<string, unknown>[]).map((a) => {
    const c = (a.contractor_id ? byId.get(String(a.contractor_id)) : byEmail.get(String(a.email).toLowerCase())) ?? null;
    if (c) seen.add(c.id);
    const steps = c ? onboardingChecklist(c as never).steps : [];
    const stage = pipelineStage({ appStage: String(a.stage), contractorStatus: c?.status ?? null, steps, pendingDocs: c ? pending.get(c.id) ?? 0 : 0, droppedAt: (c?.dropped_at as string | null) ?? null });
    return { app: a, pro: c, stage, label: STAGE_LABEL[stage], done: steps.filter((x) => x.done).length, total: steps.length, left: steps.filter((x) => !x.done).map((x) => x.label) };
  });
  // pros added directly (no application) still show up
  for (const c of byId.values()) if (!seen.has(c.id) && c.status !== "approved") {
    const steps = onboardingChecklist(c as never).steps;
    const stage = pipelineStage({ contractorStatus: c.status, steps, pendingDocs: pending.get(c.id) ?? 0, droppedAt: (c.dropped_at as string | null) ?? null });
    rows.push({ app: { id: null, business_name: c.business_name, contact_name: c.contact_name, email: c.email, phone: c.phone, trades: c.trades, created_at: c.created_at, source: "added by staff" }, pro: c, stage, label: STAGE_LABEL[stage], done: steps.filter((x) => x.done).length, total: steps.length, left: steps.filter((x) => !x.done).map((x) => x.label) });
  }
  return rows;
}

// ─── shared staff / IEBC actions ─────────────────────────────────────────────

/** Personal reminder now (email + push, one-click link, the steps left). */
export async function nudgePro(contractorId: string, note: string | null | undefined, actor: string) {
  const { data: c } = await db().from("contractors").select("*").eq("id", contractorId).single();
  if (!c) throw new Error("No such pro");
  const left = onboardingChecklist(c as never).steps.filter((s) => !s.done);
  const link = await signInUrl(c.email);
  await notify(c.profile_id, { title: `Finish your ${BRAND.name} setup`, body: `${left.length} step(s) left`, data: { type: "onboarding" },
    email: { to: c.email, subject: "Quick note about your setup", text: `Hi ${String(c.contact_name).split(" ")[0]},\n\n${note ? `${note}\n\n` : ""}You're ${left.length} step${left.length === 1 ? "" : "s"} away from getting jobs:\n${left.map((s) => `• ${s.label}`).join("\n")}\n\nOne click signs you in: ${link}\n\nReply if you need help.\n\n— ${BRAND.name}` } });
  await db().from("contractors").update({ last_reminder_at: new Date().toISOString() }).eq("id", contractorId);
  await logRecruiting("nudge", { contractorId }, note ?? null, actor);
  return { sent: true, steps_left: left.map((s) => s.label) };
}

export async function revivePro(contractorId: string, actor: string, note?: string | null) {
  await db().from("contractors").update({ dropped_at: null, invited_at: new Date().toISOString(), onboarding_reminders: 0 }).eq("id", contractorId);
  await logRecruiting("revived", { contractorId }, note ?? null, actor);
}

/**
 * Verify or reject a pro's document. Verifying a COI sets insured_until; a license sets
 * license_expires; trade coverage sets coverage[kind]; a background report clears the check.
 * Then setup is re-checked (background check / auto-activate).
 */
export async function decideDocument(contractorId: string, docId: string, decision: "verify" | "reject", actor: string, notes?: string | null) {
  const { data: doc } = await db().from("contractor_documents").select("*").eq("id", docId).eq("contractor_id", contractorId).single();
  if (!doc) throw new Error("No such document");
  const now = new Date().toISOString();
  await db().from("contractor_documents").update({ status: decision === "verify" ? "verified" : "rejected", verified_by: actor, verified_at: now, notes: notes ?? doc.notes }).eq("id", docId);
  if (decision === "verify") {
    if (doc.kind === "coi" && doc.expires_on) await db().from("contractors").update({ insured_until: doc.expires_on }).eq("id", contractorId);
    if (doc.kind === "license" && doc.expires_on) await db().from("contractors").update({ license_expires: doc.expires_on }).eq("id", contractorId);
    if ((COVERAGE_KINDS as readonly string[]).includes(doc.kind) && doc.expires_on) {
      const { data: c } = await db().from("contractors").select("coverage").eq("id", contractorId).single();
      await db().from("contractors").update({ coverage: { ...(c?.coverage ?? {}), [doc.kind]: doc.expires_on } }).eq("id", contractorId);
    }
    if (doc.kind === "background") await db().from("contractors").update({ background_checked: true, background_checked_at: now, background_status: "clear" }).eq("id", contractorId);
  } else {
    const { data: c } = await db().from("contractors").select("profile_id, email").eq("id", contractorId).single();
    if (c) await notify(c.profile_id, { title: "Please re-upload a document", body: `Your ${String(doc.kind).toUpperCase()} wasn't accepted${notes ? `: ${notes}` : ""}.`, data: { type: "onboarding" },
      email: { to: c.email, subject: "Please re-upload a document", text: `Your ${String(doc.kind).toUpperCase()} wasn't accepted${notes ? `: ${notes}` : ""}.\n\nUpload a new one here: ${await signInUrl(c.email)}\n\n— ${BRAND.name}` } });
  }
  await afterOnboardingStep(contractorId, `${doc.kind} ${decision === "verify" ? "verified" : "rejected"}`, actor);
  return { document: doc.kind, decision };
}
