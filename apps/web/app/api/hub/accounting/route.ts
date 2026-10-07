/*
 * FILE    : apps/web/app/api/hub/accounting/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_2215 UTC
 * PURPOSE : Hub → Accounting (Xero) controls, admins only. POST JSON:
 *             { action: "save", accounts?, sync_from?, reconciled? }  — account mapping and options
 *             { action: "check" }                                     — which mapped accounts exist in Xero
 *             { action: "create_accounts" }                           — add the missing Handled accounts to Xero
 *             { action: "preview", day }                              — the entries a day would make (writes nothing)
 *             { action: "sync", day? }                                — push now (one day, or everything due)
 *             { action: "disconnect" }
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { ACCOUNT_KEYS, DEFAULT_ACCOUNTS, checkAccounts, disconnect, ensureAccounts, getConnection, isUuid, saveSettings, type AccountKey } from "@/lib/xero";
import { previewDay, runAccountingSync } from "@/lib/accounting";

export const maxDuration = 300;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    accounts: z.record(z.string(), z.string().trim().max(64)).optional(),
    sync_from: day.nullable().optional(),
    reconciled: z.boolean().optional(),
  }),
  z.object({ action: z.literal("check") }),
  z.object({ action: z.literal("create_accounts") }),
  z.object({ action: z.literal("preview"), day }),
  z.object({ action: z.literal("sync"), day: day.optional() }),
  z.object({ action: z.literal("disconnect") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (v?.role !== "admin") return deny(403, "Admins only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data;
  try {
    if (d.action === "save") {
      const accounts: Partial<Record<AccountKey, string>> = {};
      for (const [k, val] of Object.entries(d.accounts ?? {})) {
        if (!(ACCOUNT_KEYS as string[]).includes(k)) continue;
        // line items need an account code; only bank accounts may be given by AccountID
        if (isUuid(val) && DEFAULT_ACCOUNTS[k as AccountKey].type !== "BANK") return deny(400, `${DEFAULT_ACCOUNTS[k as AccountKey].name}: use the account code, not its ID`);
        accounts[k as AccountKey] = val;
      }
      const settings = await saveSettings({ accounts, ...(d.sync_from !== undefined ? { sync_from: d.sync_from } : {}), ...(d.reconciled !== undefined ? { reconciled: d.reconciled } : {}) });
      return Response.json({ ok: true, settings });
    }
    if (d.action === "disconnect") { await disconnect(); return Response.json({ ok: true }); }
    const conn = await getConnection();
    if (d.action === "preview") return Response.json({ ok: true, preview: await previewDay(d.day) });
    if (!conn?.tenant_id) return deny(400, "Connect Xero first");
    if (d.action === "check") return Response.json({ ok: true, accounts: await checkAccounts(conn.settings) });
    if (d.action === "create_accounts") return Response.json({ ok: true, ...(await ensureAccounts(conn.settings)) });
    const r = await runAccountingSync(d.day ? { only: d.day } : { lookbackDays: 31 });
    return r.ok ? Response.json(r) : deny(400, r.error);
  } catch (e) {
    return deny(500, e instanceof Error ? e.message : String(e));
  }
}
