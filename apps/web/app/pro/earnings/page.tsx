/*
 * FILE    : apps/web/app/pro/earnings/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-01_2124 UTC — instant pay, payout kinds (show-up, stipend, materials, guarantee).
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 * PURPOSE : Pro earnings statement — this year by month, every payout, 1099 total so far.
 */
import { getService, instantPayFee, money, necThreshold, serviceText, t as tr, whyNot, type Contractor } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { availableBalance, getPolicy } from "@/lib/pro-benefits";
import { connectReady } from "@/lib/stripe";
import { InstantPay } from "@/components/ProActions";
import { getViewer } from "@/lib/auth";
import { Empty, Stat } from "@/components/ui";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function Earnings() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const l = await getLocale();
  const es = l === "es";
  const t = (s: string) => tr(l, s);
  const year = new Date().getFullYear();
  const [{ data: me }, policy, bal] = await Promise.all([v.db.from("contractors").select("*").eq("id", v.contractorId).single(), getPolicy(), availableBalance(v.contractorId)]);
  const instantNo = me ? whyNot(policy.instantPay, me as Contractor) : "pro not found";
  const ready = !instantNo && (await connectReady(me?.stripe_account_id ?? null));
  const { data } = await v.db.from("payouts").select("id, amount, status, kind, method, instant_fee, created_at, paid_at, reason, jobs(ref, service_slug, scheduled_date)").gte("created_at", `${year}-01-01`).order("created_at", { ascending: false });
  const rows = (data ?? []) as Rec[];
  const paid = rows.filter((r) => ["paid", "clawback"].includes(r.status)).reduce((sum, r) => sum + Number(r.amount), 0);
  const owed = rows.filter((r) => ["approved", "pending"].includes(r.status)).reduce((sum, r) => sum + Number(r.amount), 0);
  const byMonth = new Map<string, number>();
  for (const r of rows) if (r.status !== "held") byMonth.set(r.created_at.slice(0, 7), (byMonth.get(r.created_at.slice(0, 7)) ?? 0) + Number(r.amount));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Earnings")} {year}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("Paid to you (1099 total so far)")} value={money(paid)} hint={paid >= necThreshold(year) ? t("You'll receive a 1099-NEC in January") : es ? `El 1099-NEC se emite a partir de ${money(necThreshold(year))}` : `1099-NEC issued at ${money(necThreshold(year))}+`} />
        <Stat label={t("Approved, paying next run")} value={money(owed)} />
        <Stat label={t("Jobs paid")} value={rows.filter((r) => (r.kind ?? "job") === "job" && r.status !== "clawback").length} />
      </div>
      <InstantPay locale={l} balance={bal.total} fee={instantPayFee(policy, bal.total)} allowed={!instantNo} reason={instantNo} ready={ready} />
      <div className="card">
        <div className="font-semibold">{t("By month")}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">{[...byMonth.entries()].sort().map(([m, v]) => <div key={m} className="rounded-xl bg-paper p-2"><div className="text-xs text-ink-soft">{m}</div><div className="font-semibold">{money(v)}</div></div>)}</div>
      </div>
      {!rows.length && <Empty>{t("No payouts yet this year.")}</Empty>}
      <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-line first:border-0"><td className="p-3 text-xs text-ink-soft">{r.created_at.slice(0, 10)}</td><td className="p-3">{r.jobs ? `${r.jobs.ref} · ${(() => { const s = getService(r.jobs.service_slug ?? ""); return s ? serviceText(l, s.slug, s).name : ""; })()}` : r.reason}</td><td className="p-3">{t(r.status)}{r.method === "instant" ? (es ? " · inmediato" : " · instant") : ""}{Number(r.instant_fee) ? (es ? ` (cargo ${money(Number(r.instant_fee))})` : ` (fee ${money(Number(r.instant_fee))})`) : ""}{r.jobs && r.reason ? ` · ${r.reason}` : ""}</td><td className="p-3 text-right font-semibold">{money(Number(r.amount))}</td></tr>
        ))}
      </tbody></table></div>
      <p className="text-xs text-ink-soft">{t("You’re an independent business: we don’t withhold taxes. Keep this statement for your records and talk to a tax professional about quarterly estimated taxes.")}</p>
    </div>
  );
}
