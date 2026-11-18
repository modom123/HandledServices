/*
 * FILE    : apps/web/lib/legal-intake.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2200 UTC
 * PURPOSE : Sign-ups trigger the Legal & Compliance team (owner, 2026-11-17). When a pro applies or a partner signs up,
 *           core signupLegalChecks() decides what needs reviewing (license for their trade and state, insurance,
 *           strict worker-classification states, a first pro in a new state, partner agreement version, real-estate
 *           referral-fee rules, conflicts). Each item becomes an agent task for "legal" (agent_tasks), which the IEBC
 *           legal agents read with legal.signup_queue and close with legal.task_done; items that need a licensed
 *           attorney also raise one Hub alert per sign-up. One task per person per check (re-sign-ups don't duplicate).
 *           Never throws: a sign-up must never fail because this step did.
 *             legalOnProApplication(appId), legalOnPartnerSignup(partnerId)
 */
import "server-only";
import { LICENSED_TRADES, PARTNER_PROGRAM, signupLegalChecks, stateForZip, type LegalCheck } from "@handled/core";
import { adminClient } from "./supabase/server";
import { assignTask } from "./ai/agent-tasks";
import { raiseAlert } from "./jobs";

const db = () => adminClient();
export const LEGAL_AGENT = "legal";
const ACTOR = "sign-up trigger";

async function file(checks: LegalCheck[], target: string, who: string, link: string) {
  if (!checks.length) return 0;
  const { data: open } = await db().from("agent_tasks").select("title, target").eq("agent", LEGAL_AGENT).like("target", `${target}%`).limit(200);
  const have = new Set(((open ?? []) as { target: string | null }[]).map((t) => t.target));
  let made = 0;
  for (const c of checks) {
    const tgt = `${target}#${c.key}`;
    if (have.has(tgt)) continue;
    const due = new Date(Date.now() + (c.severity === "warn" ? 2 : 7) * 86400000).toISOString().slice(0, 10);
    await assignTask({ agent: LEGAL_AGENT, title: c.title, target: tgt, due_date: due, note: `${c.todo}${c.attorney ? "\n\nNeeds a licensed attorney's review before anything binding is done." : ""}\n\n${link}` }, ACTOR);
    made++;
  }
  const forCounsel = checks.filter((c) => c.attorney && !have.has(`${target}#${c.key}`));
  if (forCounsel.length) {
    await raiseAlert("legal_regulations", "warn", `Legal review: ${who}`, `${forCounsel.map((c) => `• ${c.title}`).join("\n")}\n\nThe Legal & Compliance agents have these as tasks and will draft their findings. A licensed attorney decides anything binding.\n${link}`);
  }
  return made;
}

/** A pro applied (from /api/applications → onApplication). */
export async function legalOnProApplication(appId: string): Promise<number> {
  try {
    const { data: app } = await db().from("contractor_applications").select("id, business_name, contact_name, email, zips, trades, insured, license_number").eq("id", appId).maybeSingle();
    if (!app) return 0;
    const a = app as { id: string; business_name: string | null; contact_name: string | null; email: string | null; zips: string[] | null; trades: string[] | null; insured: boolean | null; license_number: string | null };
    const zips = a.zips ?? [];
    const st = stateForZip(zips.find((z) => /^\d{5}$/.test(z)) ?? null);
    let firstInState: boolean | undefined;
    if (st) {
      const { count } = await db().from("contractors").select("id", { count: "exact", head: true }).eq("status", "approved").eq("base_state", st);
      firstInState = (count ?? 0) === 0;
    }
    const name = a.business_name || a.contact_name || a.email || "new pro";
    const checks = signupLegalChecks({ kind: "pro", name, zips, state: st, trades: a.trades ?? [], licensedTrades: LICENSED_TRADES, licenseGiven: Boolean(a.license_number), insured: Boolean(a.insured), firstInState });
    const target = `pro:${a.email ? a.email.toLowerCase() : a.id}`;
    return await file(checks, target, name, `Hub → Recruiting → Pipeline (application ${a.id})`);
  } catch (e) {
    console.error("legalOnProApplication", e);
    return 0;
  }
}

/** A partner signed up (signUp in lib/partners.ts — the partner form, the pro portal, or Post & earn). */
export async function legalOnPartnerSignup(partnerId: string): Promise<number> {
  try {
    const { data: p } = await db().from("referral_partners").select("id, name, email, company, kind, terms_version").eq("id", partnerId).maybeSingle();
    if (!p) return 0;
    const r = p as { id: string; name: string; email: string; company: string | null; kind: string; terms_version: string | null };
    const checks = signupLegalChecks({ kind: "partner", name: r.name, partnerKind: r.kind, company: r.company, agreementVersion: r.terms_version, currentVersion: PARTNER_PROGRAM.termsVersion });
    return await file(checks, `partner:${r.email.toLowerCase()}`, r.name, `Hub → Partners (code for ${r.email})`);
  } catch (e) {
    console.error("legalOnPartnerSignup", e);
    return 0;
  }
}
