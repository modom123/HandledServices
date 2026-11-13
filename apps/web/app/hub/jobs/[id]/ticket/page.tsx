/*
 * FILE    : apps/web/app/hub/jobs/[id]/ticket/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0715 UTC
 * PURPOSE : One job's ticket in three versions, each showing only what that reader may see (need-to-know):
 *             Customer — what they ordered, when / where, the price they pay, what's paid and owed, the terms. No pro pay.
 *             Pro      — the work order exactly as the pro gets it: scope, checklist, photos, rules and their NET pay.
 *                        No customer price, no Handled take.
 *             Handled  — admins only: everything — customer price and discounts, payments and refunds, the pro's pay,
 *                        the referral partner's share, what Handled keeps (and after card fees), payout status, the
 *                        name-your-price / job-board details.
 *           ?v=customer | pro | handled. Printable (Print / save PDF). Staff only; the Handled copy is for admins.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { CARD_FEE, TIME_WINDOW_LABEL, buildWorkOrder, getService, isBoardPost, jobMoney, money, type Job } from "@handled/core";
import { getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { WorkOrderView } from "@/components/WorkOrderView";
import { PrintButton } from "@/components/PrintButton";
import { invoiceUrl } from "@/lib/invoice";

export const dynamic = "force-dynamic";

type View = "customer" | "pro" | "handled";
const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function JobTicket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const v = await getViewer();
  if (!isStaff(v)) notFound();
  const admin = isAdmin(v);
  const { id } = await params;
  const asked = (await searchParams).v;
  const view: View = asked === "pro" ? "pro" : asked === "handled" && admin ? "handled" : asked === "customer" ? "customer" : admin ? "handled" : "customer";
  const db = adminClient();
  const { data } = await db.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job & { partner_pro_fee?: number | null; customer_offer?: number | null; suggested_price?: number | null; tip_total?: number | null };
  const svc = getService(job.service_slug)!;
  const [{ data: pro }, { data: entry }, { data: payLines }, { data: pc }] = await Promise.all([
    job.contractor_id ? db.from("contractors").select("business_name, contact_name, phone, agreement_version").eq("id", job.contractor_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("job_access").select("access_info").eq("job_id", id).maybeSingle(),
    admin ? db.from("payouts").select("amount, status, kind, paid_at, week_of").eq("job_id", id) : Promise.resolve({ data: [] }),
    admin && job.partner_id ? db.from("partner_commissions").select("amount, from_pro, from_us, status, referral_partners(name, code)").eq("job_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const p = pro as { business_name: string; contact_name: string | null; phone: string | null; agreement_version: string | null } | null;
  const w = buildWorkOrder({ ...job, access_info: (entry as { access_info?: string } | null)?.access_info ?? null }, { reveal: true, payout: job.contractor_payout, agreementVersion: p?.agreement_version ?? undefined });
  const when = `${job.scheduled_date ?? "Date to set"} · ${TIME_WINDOW_LABEL[job.time_window]}`;
  const where = `${job.address}, ${job.city}, ${job.state} ${job.zip}`;
  const price = Number(job.price_final ?? 0), discount = Number(job.discount ?? 0), member = Number(job.member_benefit ?? 0);
  const listPrice = r2(price + discount + member);
  const paid = Number(job.amount_paid ?? 0), refunded = Number(job.amount_refunded ?? 0);
  const owed = Math.max(0, r2(price - paid));
  const post = isBoardPost(job);
  const tab = (k: View, label: string) => <Link key={k} href={`?v=${k}`} className={`rounded-full border px-3 py-1 text-sm ${view === k ? "border-brand bg-brand-tint font-semibold" : "border-line bg-white"}`}>{label}</Link>;
  const row = (k: string, val: React.ReactNode, strong = false) => <div className={`flex justify-between gap-4 py-1 ${strong ? "font-semibold" : ""}`}><span className="text-ink-soft">{k}</span><span className="text-right">{val}</span></div>;
  const head = (who: string) => (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
      <div><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{who}</div><h1 className="text-2xl font-bold">{svc.icon} {svc.name} · {job.ref}</h1><div className="text-sm text-ink-soft">{when} · {job.status}</div></div>
      <div className="print:hidden"><PrintButton /></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/hub/jobs/${id}`} className="text-xs text-ink-soft">← {job.ref}</Link>
        <span className="text-sm font-semibold">Ticket:</span>
        {tab("customer", "Customer copy")}{tab("pro", "Pro copy")}{admin && tab("handled", "Handled copy")}
      </div>

      {view === "customer" && (
        <div className="card space-y-3 text-sm">
          {head("Customer copy — what the customer sees")}
          {row("Customer", `${job.contact_name}${job.company_name ? ` · ${job.company_name}` : ""} · ${job.contact_phone} · ${job.contact_email}`)}
          {row("Where", where)}
          {row("When", post ? `Posted on the job board until ${job.open_offer_until!.slice(0, 10)} — the pro sets the day with the customer` : when)}
          <div><div className="font-semibold">What's being done</div><ul className="mt-1 grid gap-x-4 sm:grid-cols-2">{w.scope.map((x) => <li key={x.label}><span className="text-ink-soft">{x.label}:</span> {x.value}</li>)}</ul>
            <div className="mt-1 text-ink-soft">Includes: {w.includes.join(" · ")}</div>
            {job.notes && <div className="mt-1">Notes: “{job.notes}”</div>}</div>
          <div className="border-t border-line pt-2">
            {(discount > 0 || member > 0) && row("Price", money(listPrice))}
            {discount > 0 && row("Discount", `−${money(discount)}`)}
            {member > 0 && row("Handled Plus saving", `−${money(member)}`)}
            {row(post ? "Your price (named)" : "Total", money(price), true)}
            {row("Paid", money(paid))}
            {refunded > 0 && row("Refunded", money(refunded))}
            {row(post ? "Charged when a pro takes it" : "Balance", money(owed))}
            <div className="text-xs text-ink-soft">{post ? "$1 posted the job; the rest is charged to the same card only when a pro takes it." : job.payment_plan === "after" ? "25% booked it; the rest is charged when the job is done." : job.payment_plan === "deposit" ? "A deposit booked it; the balance is charged before the job." : "Paid in full up front."}</div>
          </div>
          <div className="text-xs text-ink-soft">The customer's own copy: <a className="underline" href={invoiceUrl(job.id)} target="_blank">invoice &amp; service agreement</a>. Never shows the pro's pay or Handled's take.</div>
        </div>
      )}

      {view === "pro" && (
        <div className="card space-y-3 text-sm">
          {head("Pro copy — what the pro sees")}
          {row("Pro", p ? `${p.business_name}${p.phone ? ` · ${p.phone}` : ""}` : "Not assigned yet — this is what the pro who takes it will see")}
          <WorkOrderView w={w} />
          <div className="text-xs text-ink-soft">Pros see only their net pay (any referral fee already out) — never the customer's price or Handled's take. Before accepting, the address and customer contact are hidden; after accepting they need their Pro PIN.</div>
        </div>
      )}

      {view === "handled" && admin && (() => {
        const jm = jobMoney(job as never, (payLines ?? []) as never);
        const pro0 = Number(job.contractor_payout ?? 0), partnerProFee = Number(job.partner_pro_fee ?? 0);
        const keepPlan = r2(price - pro0);
        const fee = price > 0 ? r2(price * CARD_FEE.pct + CARD_FEE.fixed) : 0;
        const pcr = pc as { amount: number; from_pro?: number | null; from_us?: number | null; status: string; referral_partners: { name: string; code: string } | null } | null;
        const usToPartner = pcr ? Number(pcr.from_us ?? 0) : 0;
        return (
          <div className="card space-y-3 text-sm">
            {head("Handled copy — internal, admins only")}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line p-3"><div className="text-xs text-ink-soft">Customer pays</div><div className="text-xl font-bold">{money(price)}</div></div>
              <div className="rounded-xl border border-line p-3"><div className="text-xs text-ink-soft">Pro makes</div><div className="text-xl font-bold">{money(r2(pro0 - partnerProFee))}</div><div className="text-xs text-ink-soft">{partnerProFee ? `${money(pro0)} agreed − ${money(partnerProFee)} referral fee` : "net pay"}</div></div>
              <div className="rounded-xl border border-brand bg-brand-tint p-3"><div className="text-xs text-brand-dark">Handled makes</div><div className="text-xl font-bold text-brand-dark">{money(r2(keepPlan - usToPartner))}</div><div className="text-xs text-brand-dark">{price > 0 ? `${Math.round(((keepPlan - usToPartner) / price) * 100)}% of the price` : ""}{usToPartner ? ` · after ${money(usToPartner)} to the partner` : ""}</div></div>
            </div>
            <div className="border-t border-line pt-2">
              <div className="font-semibold">Customer side</div>
              {row("List price", money(listPrice))}
              {discount > 0 && row("Discounts (our share: promo, pilot, pay-in-full)", `−${money(discount)}`)}
              {member > 0 && row("Handled Plus saving (our share)", `−${money(member)}`)}
              {row("Customer price", money(price), true)}
              {row("Paid / refunded", `${money(paid)} / ${money(refunded)}`)}
              {row("Still to collect", money(owed))}
              {row("Payment plan", post ? `job board post ($1, the rest when a pro takes it) · until ${job.open_offer_until!.slice(0, 10)}` : job.payment_plan ?? "full")}
              {job.customer_offer ? row("Name your price", `${money(job.customer_offer)} offered · our suggestion ${money(job.suggested_price ?? 0)}`) : null}
              {Number(job.tip_total ?? 0) > 0 && row("Tips (100% to the pro)", money(Number(job.tip_total)))}
            </div>
            <div className="border-t border-line pt-2">
              <div className="font-semibold">Pro side</div>
              {row("Pro", p ? p.business_name : "not assigned yet")}
              {row("Agreed pro pay", money(pro0))}
              {partnerProFee > 0 && row("Pro's half of the referral fee", `−${money(partnerProFee)}`)}
              {row("Pro net pay", money(r2(pro0 - partnerProFee)), true)}
              {row("Payout", `${jm.stage.replace(/_/g, " ")}${jm.payday ? ` · payday ${jm.payday}` : ""} · paid out ${money(jm.paidOut)}`)}
            </div>
            <div className="border-t border-line pt-2">
              <div className="font-semibold">Handled</div>
              {row("Customer price − agreed pro pay", money(keepPlan))}
              {pcr && row(`Referral partner ${pcr.referral_partners?.name ?? ""} (${pcr.status})`, `${money(Number(pcr.amount))} — ${money(usToPartner)} from us, ${money(Number(pcr.from_pro ?? 0))} from the pro`)}
              {row("Handled makes", money(r2(keepPlan - usToPartner)), true)}
              {row("Est. card fee", `−${money(fee)}`)}
              {row("Handled makes after card fees", money(r2(keepPlan - usToPartner - fee)), true)}
              {jm.issues.length > 0 && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">⚠ {jm.issues.join(" · ")}</div>}
            </div>
            <div className="text-xs text-ink-soft">Internal. Customers never see the pro's pay; pros never see the customer's price or our take; dispatchers don't see money.</div>
          </div>
        );
      })()}
    </div>
  );
}
