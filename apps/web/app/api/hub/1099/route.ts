/*
 * FILE    : apps/web/app/api/hub/1099/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Staff: year-end 1099-NEC worksheet (CSV) — every pro paid in the tax year,
 *           net of clawbacks, flagged against the reporting threshold. TIN shows last 4
 *           only; your accountant (or Track1099 / Stripe Connect) completes filing from
 *           the W-9s on file.
 */
import { necThreshold } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  const { data } = await v!.db.from("contractor_1099").select("*").eq("tax_year", year).order("paid_total", { ascending: false });
  const threshold = necThreshold(year);
  const rows = [["Tax year", "Business name", "Legal name", "Entity type", "TIN last 4", "Address", "City", "State", "ZIP", "W-9 on file", "Paid (net)", "Still owed", "Payments", `Over $${threshold} (1099-NEC)`]];
  for (const r of data ?? [])
    rows.push([year, r.business_name, r.legal_name, r.entity_type, r.tin_last4, r.address_line, r.city, r.state, r.zip, r.w9_received_at ? "yes" : "MISSING",
      Number(r.paid_total ?? 0).toFixed(2), Number(r.owed_total ?? 0).toFixed(2), r.payments,
      Number(r.paid_total ?? 0) >= threshold ? (["c_corp", "s_corp"].includes(r.entity_type) ? "corp — usually exempt" : "YES") : "no"]);
  return new Response(rows.map((r) => r.map(csv).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="1099-worksheet-${year}_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1_$2")}.csv"` },
  });
}
