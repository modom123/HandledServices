/*
 * FILE    : apps/web/app/api/xero/callback/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_2210 UTC
 * PURPOSE : Xero sends the admin back here after sign-in. Checks the state cookie, swaps the code for tokens
 *           (stored encrypted), remembers the organisation, and sets the sync start date to today if none is set
 *           (nothing before the connection is pushed unless an admin picks an earlier date).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { completeConnect, getConnection, saveSettings, BUSINESS_TZ } from "@/lib/xero";
import { localDay } from "@/lib/accounting";
import { siteUrl } from "@/lib/notify";

export async function GET(req: Request) {
  const back = (q: string) => {
    const res = NextResponse.redirect(`${siteUrl()}/hub/accounting?${q}`);
    res.cookies.set("xero_oauth_state", "", { path: "/api/xero", maxAge: 0 });
    return res;
  };
  const v = await getViewer(req);
  if (v?.role !== "admin") return back("xero=admin_only");
  const url = new URL(req.url);
  const state = (await cookies()).get("xero_oauth_state")?.value;
  if (url.searchParams.get("error")) return back(`xero=error&msg=${encodeURIComponent(url.searchParams.get("error_description") ?? url.searchParams.get("error")!)}`);
  if (!state || state !== url.searchParams.get("state")) return back("xero=error&msg=Sign-in%20expired%2C%20try%20again");
  const code = url.searchParams.get("code");
  if (!code) return back("xero=error&msg=No%20code%20from%20Xero");
  try {
    const r = await completeConnect(code, v.email ?? "admin");
    const conn = await getConnection();
    if (!conn?.settings.sync_from) await saveSettings({ sync_from: localDay(new Date(), conn?.settings.timezone || BUSINESS_TZ) });
    return back(`xero=connected&org=${encodeURIComponent(r.tenantName)}${r.others ? `&others=${r.others}` : ""}`);
  } catch (e) {
    return back(`xero=error&msg=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
  }
}
