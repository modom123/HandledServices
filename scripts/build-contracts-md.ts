/*
 * FILE    : scripts/build-contracts-md.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0042 UTC
 * PURPOSE : Writes the whole contract library (apps/web/lib/contracts) to
 *           docs/CONTRACTS_<UTC stamp>.md for attorney review, replacing the previous export.
 *           Run: npx jiti scripts/build-contracts-md.ts
 * UPDATED : 2026-10-03_0052 UTC — also writes docs/CONTRATOS_ES_<stamp>.md (Spanish translations).
 */
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { BRAND } from "@handled/core";
import { ALL_CONTRACTS, AUDIENCE_LABEL, contractMarkdown, localized } from "../apps/web/lib/contracts/index.ts";

const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
const docs = new URL("../docs/", import.meta.url);
for (const f of readdirSync(docs)) if (f.startsWith("CONTRACTS_") || f.startsWith("CONTRATOS_ES_")) rmSync(new URL(f, docs));

const toc = (["customer", "business", "pro"] as const).map((g) => `**${AUDIENCE_LABEL[g]}**\n${ALL_CONTRACTS.filter((c) => c.audience === g).map((c) => `- ${c.title} (v${c.version})`).join("\n")}`).join("\n\n");
const flagged = ALL_CONTRACTS.flatMap((c) => c.sections.filter((s) => s.p.includes("[Confirm with counsel.]")).map((s) => `- ${c.title} → ${s.h}`));

const out = [
  `<!--\n  FILE    : docs/CONTRACTS_${stamp}.md   (generated — edit apps/web/lib/contracts/*.ts, then re-run)\n  PROJECT : Handled (myhumanai) — AI-run home & business services\n  CREATED : ${stamp} UTC\n  PURPOSE : Every customer, business and pro contract, for attorney review.\n-->`,
  `# ${BRAND.legalName} — Contract library`,
  `Plain-English templates. **Not legal advice** — have counsel licensed in each state we operate in review and approve before use. The same text appears on the website (/terms), on invoices, in pro onboarding, and as frozen signed copies in each person's account (My contracts) and Hub → Contract library.`,
  `## Contents\n\n${toc}`,
  `## Paragraphs that need counsel's decision (${flagged.length})\n\n${flagged.join("\n") || "- none"}`,
  ...ALL_CONTRACTS.map(contractMarkdown),
].join("\n\n---\n\n");
writeFileSync(new URL(`CONTRACTS_${stamp}.md`, docs), out);
console.log(`wrote docs/CONTRACTS_${stamp}.md (${ALL_CONTRACTS.length} contracts, ${flagged.length} flagged for counsel)`);

// Spanish translations (English governs) — same order, for the translator / counsel review
const es = ALL_CONTRACTS.map((c) => ({ c, v: localized(c, "es") }));
const missing = es.filter((x) => !x.v.translated).map((x) => x.c.title);
const outEs = [
  `<!--\n  FILE    : docs/CONTRATOS_ES_${stamp}.md   (generated — edit apps/web/lib/contracts/es-*.ts, then re-run)\n  PROJECT : Handled (myhumanai) — AI-run home & business services\n  CREATED : ${stamp} UTC\n  PURPOSE : Spanish translations of every contract, for review by a certified legal translator.\n-->`,
  `# ${BRAND.legalName} — Biblioteca de contratos (traducción al español)`,
  `Traducciones para comodidad de clientes y profesionales. **Si hay diferencias, prevalece la versión en inglés** (docs/CONTRACTS_${stamp}.md). Recomendamos que un traductor jurídico certificado y un abogado las revisen antes de usarlas.`,
  missing.length ? `Sin traducción todavía: ${missing.join(", ")}` : "",
  ...es.filter((x) => x.v.translated).map(({ c, v }) => [`## ${v.title}`, `Versión ${c.version} · ${v.appliesTo}`, `### La versión corta\n${v.summary.map((x) => `- ${x}`).join("\n")}`, ...v.sections.map((x) => `### ${x.h}\n${x.p}`)].join("\n\n")),
].filter(Boolean).join("\n\n---\n\n");
writeFileSync(new URL(`CONTRATOS_ES_${stamp}.md`, docs), outEs);
console.log(`wrote docs/CONTRATOS_ES_${stamp}.md (${es.length - missing.length} of ${es.length} translated)`);
