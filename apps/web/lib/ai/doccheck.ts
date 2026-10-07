/*
 * FILE    : apps/web/lib/ai/doccheck.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0006 UTC
 * PURPOSE : Read a pro's uploaded certificate of insurance, license or coverage document and
 *           check it against what their trades require (named insured, policy type, limits,
 *           expiry, Handled as additional insured, license type). Staff see the findings next
 *           to the document and verify in one click. Advisory only — a human verifies.
 */
import "server-only";
import { z } from "zod";
import { BRAND, COVERAGES, TRADE_PROFILES, glMinimum, type CoverageKey } from "@handled/core";
import { structured, type ContentBlocks } from "./client";

const DocSchema = z.object({
  readable: z.boolean().describe("False if the file is blurry, cut off, or not this kind of document"),
  document_type: z.string().describe("What the document actually is, e.g. 'ACORD 25 certificate of liability insurance', 'Michigan residential builder license'"),
  named_insured: z.string().describe("Business or person the document is issued to"),
  matches_pro: z.boolean().describe("Named insured matches the pro's business or legal name (allow DBA / LLC variations)"),
  expires_on: z.string().describe("Expiry date as YYYY-MM-DD, or empty if not shown"),
  per_occurrence_limit: z.number().describe("General liability per-occurrence limit in USD, 0 if not shown or not applicable"),
  additional_insured: z.boolean().describe(`${BRAND.legalName} (or ${BRAND.name}) is listed as certificate holder or additional insured`),
  license_number: z.string().describe("License number if this is a license, else empty"),
  meets_requirements: z.boolean(),
  problems: z.array(z.string()).describe("Each requirement not met, in plain words"),
});
export type DocCheck = z.infer<typeof DocSchema>;

export async function aiCheckDocument(o: { kind: string; url: string; isPdf: boolean; pro: { business_name: string; legal_name?: string | null; trades: string[] }; claimedExpiry?: string | null }): Promise<DocCheck | null> {
  const trades = o.pro.trades.map((t) => `${t}${TRADE_PROFILES[t]?.license ? ` (license: ${TRADE_PROFILES[t].license})` : ""}`).join("; ");
  const need =
    o.kind === "coi" ? `General liability, at least $${glMinimum(o.pro.trades).toLocaleString("en-US")} per occurrence, ${BRAND.legalName} named as additional insured or certificate holder, not expired.`
    : o.kind === "license" ? `A current state license that covers these trades: ${trades}.`
    : COVERAGES[o.kind as CoverageKey] ? `${COVERAGES[o.kind as CoverageKey].label}: ${COVERAGES[o.kind as CoverageKey].detail} Not expired.`
    : "A current, readable document of the type uploaded.";
  const block = o.isPdf ? { type: "document" as const, source: { type: "url" as const, url: o.url } } : { type: "image" as const, source: { type: "url" as const, url: o.url } };
  return structured({
    kind: "doc_check",
    schema: DocSchema,
    system: "You check contractor compliance documents for a home-services marketplace. Read only what the document shows; never guess numbers or dates. Today's date matters for expiry.",
    content: [block, { type: "text", text: `Today: ${new Date().toISOString().slice(0, 10)}\nPro: ${o.pro.business_name}${o.pro.legal_name ? ` (legal name ${o.pro.legal_name})` : ""}\nUploaded as: ${o.kind}${o.claimedExpiry ? `, pro says it expires ${o.claimedExpiry}` : ""}\nRequirement: ${need}` }] as ContentBlocks,
    effort: "low",
    maxTokens: 4000,
  });
}
