/*
 * FILE    : apps/web/lib/contracts/record.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Saves who accepted which contracts — with a frozen copy of the text and its hash —
 *           into contract_acceptances. Never blocks the booking or signing that triggered it.
 * UPDATED : 2026-10-03_0050 UTC — records the language read (locale) and keeps the Spanish text shown too.
 */
import "server-only";
import { adminClient } from "../supabase/server";
import { contractHash, spanishOf, type Contract } from "./index";

export interface AcceptanceContext {
  profileId?: string | null;
  contractorId?: string | null;
  email?: string | null;
  signerName?: string | null;
  jobId?: string | null;
  method: "booking" | "signature" | "checkout" | "click";
  /** Language the person read the contract in. */
  locale?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordAcceptance(contracts: Contract[], ctx: AcceptanceContext): Promise<void> {
  if (!contracts.length) return;
  const rows = contracts.map((c) => ({
    contract_key: c.key, version: c.version, title: c.title, audience: c.audience,
    profile_id: ctx.profileId ?? null, contractor_id: ctx.contractorId ?? null, email: ctx.email?.trim().toLowerCase() ?? null,
    signer_name: ctx.signerName ?? null, job_id: ctx.jobId ?? null, method: ctx.method, ip: ctx.ip ?? null, user_agent: ctx.userAgent?.slice(0, 300) ?? null,
    locale: ctx.locale === "es" ? "es" : "en",
    // English is the governing text (hashed); the Spanish they saw is kept alongside
    sections: { appliesTo: c.appliesTo, summary: c.summary, sections: c.sections, ...(ctx.locale === "es" && spanishOf(c) ? { es: spanishOf(c) } : {}) }, content_hash: contractHash(c),
  }));
  const { error } = await adminClient().from("contract_acceptances").insert(rows);
  if (error) console.error("[contracts] could not record acceptance", error.message);
}

export const requestMeta = (req: Request) => ({
  ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  userAgent: req.headers.get("user-agent"),
});
