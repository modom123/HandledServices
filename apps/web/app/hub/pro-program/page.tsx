/*
 * FILE    : apps/web/app/hub/pro-program/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * PURPOSE : Handled Hub → Pro Program: set who qualifies for each of the six pro benefits
 *           and their amounts, and see who qualifies today.
 */
import { PRO_POLICY_DEFAULTS, TRADES, benefitLines, qualifies, ruleText, type Contractor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getPolicy } from "@/lib/pro-benefits";
import { ProPolicyForm } from "@/components/HubActions";

export const dynamic = "force-dynamic";

export default async function ProProgramPage() {
  const v = await getViewer();
  if (!v) return null;
  const [policy, { data: pros }] = await Promise.all([getPolicy(), v.db.from("contractors").select("*").eq("status", "approved")]);
  const list = (pros ?? []) as Contractor[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pro Program</h1>
        <p className="text-sm text-ink-soft">The benefits that make great pros choose us. Set who qualifies; changes apply from the next job, cash-out or payout run.</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-soft"><th className="p-3">Benefit</th><th className="p-3">Who qualifies</th><th className="p-3">Active pros qualifying</th></tr></thead>
          <tbody>
            {benefitLines(policy).map((b) => (
              <tr key={b.key} className="border-t border-line"><td className="p-3 font-semibold">{b.title}</td><td className="p-3">{ruleText(b.rule)}</td><td className="p-3">{list.filter((c) => qualifies(b.rule, c)).length} of {list.length}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProPolicyForm initial={JSON.parse(JSON.stringify(policy ?? PRO_POLICY_DEFAULTS))} trades={TRADES} canEdit={v.role === "admin"} />
    </div>
  );
}
