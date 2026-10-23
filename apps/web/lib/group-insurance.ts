/*
 * FILE    : apps/web/lib/group-insurance.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2345 UTC
 * PURPOSE : Handled group insurance, server side (the rules are in packages/core/src/group-insurance.ts):
 *             checklistOpts()        — the group settings to pass to onboardingChecklist() (null while the program is off)
 *             enrollGroupInsurance() — the pro signs the enrollment authorization (date, version and IP recorded)
 *             chargeGroupInsurance() — daily sweep: last month's fee for every enrolled pro, once, as a deduction row on
 *                                      their next payout (at most half a payout and never tips, like every deduction)
 */
import "server-only";
import { GROUP_INSURANCE_VERSION, groupFeeDue, lastMonth, money, type GroupInsurance } from "@handled/core";
import { adminClient } from "./supabase/server";
import { getPolicy } from "./pro-benefits";
import { raiseAlert } from "./jobs";

const db = () => adminClient();

/** The group settings for the onboarding checklist, or null while the program is off. */
export async function checklistOpts(): Promise<{ group: GroupInsurance | null }> {
  const g = (await getPolicy()).groupInsurance;
  return { group: g?.enabled ? g : null };
}

/** The pro signs the enrollment authorization. */
export async function enrollGroupInsurance(contractorId: string, ip: string | null) {
  const g = (await getPolicy()).groupInsurance;
  if (!g?.enabled) return { ok: false as const, error: "Group insurance isn't available yet" };
  await db().from("contractors").update({ group_insurance_enrolled_at: new Date().toISOString(), group_insurance_version: GROUP_INSURANCE_VERSION, group_insurance_ip: ip ?? "0.0.0.0" }).eq("id", contractorId);
  return { ok: true as const };
}

/** Daily: charge last month's fee to every enrolled pro who owes it (the unique index keeps it to once a month). */
export async function chargeGroupInsurance(now = new Date()) {
  const g = (await getPolicy()).groupInsurance;
  if (!g?.enabled || !(g.monthlyFee > 0)) return { charged: 0 };
  const month = lastMonth(now);
  const start = `${month}-01T00:00:00Z`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString();
  const { data: pros } = await db().from("contractors").select("id, group_insurance_enrolled_at").not("group_insurance_enrolled_at", "is", null).in("status", ["approved", "suspended"]);
  let charged = 0;
  for (const p of (pros ?? []) as { id: string; group_insurance_enrolled_at: string }[]) {
    const [{ data: done }, { count }] = await Promise.all([
      db().from("payouts").select("id").eq("contractor_id", p.id).eq("kind", "insurance").eq("insurance_month", month).maybeSingle(),
      db().from("payouts").select("id", { count: "exact", head: true }).eq("contractor_id", p.id).eq("kind", "job").neq("status", "clawback").gte("created_at", start).lt("created_at", end),
    ]);
    const fee = groupFeeDue(g, { enrolledAt: p.group_insurance_enrolled_at, month, jobsPaidInMonth: count ?? 0, alreadyCharged: Boolean(done) });
    if (!(fee > 0)) continue;
    const { error } = await db().from("payouts").insert({ contractor_id: p.id, amount: -fee, status: "clawback", kind: "insurance", insurance_month: month, reason: `Handled group insurance — ${month} (${money(fee)}, authorized by you)` });
    if (!error) charged++;
  }
  if (charged) await raiseAlert("payout", "info", `Group insurance: ${charged} pro(s) charged for ${month}`, `${money(g.monthlyFee)} each, taken from their next payout.`);
  return { charged, month };
}
