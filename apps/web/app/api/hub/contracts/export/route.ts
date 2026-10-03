/*
 * FILE    : apps/web/app/api/hub/contracts/export/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0043 UTC
 * PURPOSE : Staff download of the whole contract library as one Markdown file (for counsel).
 * UPDATED : 2026-10-03_0052 UTC — ?lang=es downloads the Spanish translations.
 */
import { BRAND } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { ALL_CONTRACTS, contractMarkdown, localized } from "@/lib/contracts";

export async function GET(req: Request) {
  const v = await getViewer();
  if (!isStaff(v)) return deny();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const es = new URL(req.url).searchParams.get("lang") === "es";
  const body = es
    ? [`# ${BRAND.legalName} — Biblioteca de contratos (español)`, `Exportado ${stamp} UTC. Traducción; si hay diferencias, prevalece la versión en inglés.`,
       ...ALL_CONTRACTS.map((c) => { const v = localized(c, "es"); return [`## ${v.title}`, `Versión ${c.version} · ${v.appliesTo}${v.translated ? "" : " · (sin traducción — texto en inglés)"}`, `### La versión corta\n${v.summary.map((x) => `- ${x}`).join("\n")}`, ...v.sections.map((x) => `### ${x.h}\n${x.p}`)].join("\n\n"); })].join("\n\n---\n\n")
    : [`# ${BRAND.legalName} — Contract library`, `Exported ${stamp} UTC. Templates — have counsel review before use.`, ...ALL_CONTRACTS.map(contractMarkdown)].join("\n\n---\n\n");
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="HANDLED_${es ? "CONTRATOS_ES" : "CONTRACTS"}_${stamp}.md"` } });
}
