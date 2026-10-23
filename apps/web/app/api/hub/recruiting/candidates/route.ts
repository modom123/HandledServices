/*
 * FILE    : apps/web/app/api/hub/recruiting/candidates/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1100 UTC
 * PURPOSE : Staff add candidates to the pro recruiting pipeline by hand (Hub → Recruiting → Add candidates).
 *             POST { mode: "one", full_name, email, phone?, business_name?, trades[], zips?, years_experience?, notes?, source,
 *                    confirm, screen }
 *             POST { mode: "csv", csv, source, confirm, screen }  — up to 500 rows (Indeed's candidate export works as-is)
 *           confirm = email them what happens next; screen = run the usual AI screen → interview / invite / ask staff.
 *           Returns what happened to each candidate (added, updated, already a pro, skipped and why).
 */
import { after } from "next/server";
import { z } from "zod";
import { MAX_TRADES, TRADES, cleanPhone, inferTrades, parseCandidatesCsv, type Candidate } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { addCandidate, type AddResult } from "@/lib/recruiting-intake";
import { onApplication } from "@/lib/recruiting";

const ids = new Set(TRADES.map((t) => t.id));
const Common = { source: z.string().trim().min(1).max(60).default("added by staff"), confirm: z.boolean().default(false), screen: z.boolean().default(true), locale: z.enum(["en", "es"]).default("en") };
const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("one"), ...Common,
    full_name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: z.string().max(40).optional(),
    business_name: z.string().max(120).optional(), trades: z.array(z.string()).max(MAX_TRADES).default([]),
    zips: z.string().max(400).optional(), years_experience: z.coerce.number().int().min(0).max(80).optional(), notes: z.string().max(2000).optional(),
  }),
  z.object({ mode: z.literal("csv"), ...Common, csv: z.string().min(1).max(2_000_000) }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, p.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join("; "));
  const d = p.data, who = v!.fullName ?? v!.email ?? "staff";
  const source = d.source.toLowerCase();
  let list: Candidate[], skipped: { row: number; reason: string }[] = [];
  if (d.mode === "one") {
    const trades = d.trades.filter((t) => ids.has(t));
    list = [{ full_name: d.full_name, email: d.email.toLowerCase(), phone: cleanPhone(d.phone ?? ""), business_name: d.business_name || undefined,
      trades: trades.length ? trades : inferTrades(d.notes), zips: d.zips || undefined, years_experience: d.years_experience, message: d.notes || undefined, source }];
  } else {
    ({ candidates: list, skipped } = parseCandidatesCsv(d.csv, source));
    if (list.length > 500) return deny(400, `${list.length} candidates — import up to 500 at a time`);
  }
  const results: AddResult[] = [];
  for (const c of list) results.push(await addCandidate(c, { actor: who, confirm: d.confirm, locale: d.locale }));
  if (d.screen) {
    const toScreen = results.filter((r) => r.status === "added" && r.id && !r.error).map((r) => r.id!);
    after(async () => { for (const id of toScreen) await onApplication(id).catch((e) => console.error("[recruiting import]", e)); });
  }
  const n = (s: AddResult["status"]) => results.filter((r) => r.status === s && !r.error).length;
  return Response.json({ ok: true, added: n("added"), updated: n("updated"), existing_pro: n("existing_pro"), duplicate: n("duplicate"), failed: results.filter((r) => r.error).map((r) => `${r.email}: ${r.error}`), skipped, results });
}
