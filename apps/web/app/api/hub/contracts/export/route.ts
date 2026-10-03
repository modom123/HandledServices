/*
 * FILE    : apps/web/app/api/hub/contracts/export/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0043 UTC
 * PURPOSE : Staff download of the whole contract library as one Markdown file (for counsel).
 */
import { BRAND } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { ALL_CONTRACTS, contractMarkdown } from "@/lib/contracts";

export async function GET() {
  const v = await getViewer();
  if (!isStaff(v)) return deny();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const body = [`# ${BRAND.legalName} — Contract library`, `Exported ${stamp} UTC. Templates — have counsel review before use.`, ...ALL_CONTRACTS.map(contractMarkdown)].join("\n\n---\n\n");
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="HANDLED_CONTRACTS_${stamp}.md"` } });
}
