/*
 * FILE    : apps/web/app/(site)/partner/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0135 UTC
 * PURPOSE : The referral partner's page: their link and short link, earnings (paid / ready / upcoming), Stripe payout
 *           setup, "send us a customer", the customers credited to them (and until when) and every commission.
 * UPDATED : 2026-10-22_0400 UTC — referral tickets for pros, clients and anyone: the ticket form, every ticket with its
 *           status, timeline and money split (customer → pro → you → Handled), commissions by type and rate, and a
 *           one-tap join for signed-in pros and clients.
 * UPDATED : 2026-10-22_0500 UTC — photo count on each ticket.
 * UPDATED : 2026-10-22_0600 UTC — the Standard Referral Ticket form, with a link to the printable blank ticket.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { COMMISSION_BASIS, PARTNER_PROGRAM, SERVICES, getService, money, moneySplit, partnerTerms, pctLabel, type CommissionBasis } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/notify";
import { partnerFor, partnerLink, partnerStats, payoutsReady, type Ticket } from "@/lib/partners";
import { Badge, Empty, Stat } from "@/components/ui";
import { CopyButton, JoinPartner, PartnerPayoutButton, ReferCustomer, ReferralTicket } from "@/components/PartnerUI";

export const metadata = { title: "Partner page" };
export const dynamic = "force-dynamic";

const P = PARTNER_PROGRAM;
const STATUS: Record<Ticket["status"], [string, "green" | "amber" | "red" | "brand" | undefined]> = {
  open: ["Waiting for the customer to book", "amber"], needs_review: ["Our team is reviewing it", "amber"], booked: ["Booked", "green"], expired: ["Expired (not booked)", undefined], cancelled: ["Cancelled", "red"],
};

type TicketRow = Pick<Ticket, "id" | "photos" | "customer_name" | "service_slug" | "frequency" | "status" | "basis" | "ai_summary" | "events" | "created_at" | "expires_at" | "pays_until">
  & { jobs: { ref: string; status: string; price_final: number | null; contractor_payout: number | null; amount_refunded: number | null } | null };

export default async function PartnerHome({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const q = await searchParams;
  const v = await getViewer();
  if (!v) redirect("/login?next=/partner");
  const partner = await partnerFor(v);
  if (!partner) return (
    <div className="wrap py-16"><div className="card mx-auto max-w-xl text-center">
      <h1 className="text-xl font-bold">{v.contractorId ? "Earn by sending us work" : "Get paid for referrals"}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Refer a person and earn {pctLabel(P.pctOfTake)}% of our fee on every job they book for {P.months} months. Send us a job on a referral ticket and earn {pctLabel(P.jobOncePct)}% on a one-time job, or {pctLabel(P.jobRecurringPct)}% on every visit of a recurring job for {P.months} months.
        {v.contractorId ? " Commissions go to the same Stripe account as your job payouts." : ""}
      </p>
      <div className="mt-4"><JoinPartner terms={partnerTerms()} /></div>
      <p className="mt-4 text-xs text-ink-soft">Signed in as {v.email}. Joined with a different email? <Link href="/partners#join" className="underline">Partner sign-up</Link></p>
    </div></div>
  );
  const db = adminClient();
  const [stats, ready, { data: customers }, { data: comms }, { data: tickets }] = await Promise.all([
    partnerStats(partner.id),
    payoutsReady(partner),
    db.from("referral_customers").select("customer_name, customer_email, service_slug, source, first_job_id, expires_at, created_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200),
    db.from("partner_commissions").select("*, jobs(ref, service_slug, completed_at)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200),
    db.from("referral_tickets").select("id, photos, customer_name, service_slug, frequency, status, basis, ai_summary, events, created_at, expires_at, pays_until, jobs!referral_tickets_job_id_fkey(ref, status, price_final, contractor_payout, amount_refunded)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(100).then((r) => r, () => ({ data: null })),
  ]);
  const link = partnerLink(partner.code), short = `${siteUrl()}/r/${partner.code}`;
  const services = SERVICES.map((s) => [s.slug, s.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a, b, c) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);
  const T = ((tickets ?? []) as unknown as TicketRow[]);
  return (
    <div className="wrap space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Hi {partner.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-ink-soft">Refer a person: {pctLabel(P.pctOfTake)}% of our fee on every job they book for {P.months} months. Referral ticket: {pctLabel(P.jobOncePct)}% on a one-time job, {pctLabel(P.jobRecurringPct)}% on every visit of a recurring job for {P.months} months. Paid weekly once each job is past our {P.holdDays}-day guarantee.{partner.status !== "active" && <b className="text-rose-700"> Your partner account is paused — contact us.</b>}</p>
      </div>
      {q.connect === "done" && <div className="card border-brand bg-brand-tint text-sm">{ready ? "Payouts are set up. You'll be paid every Monday." : "Thanks — Stripe is still checking your details. This page shows when payouts are ready."}</div>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="People & tickets" value={`${stats.customers} · ${stats.tickets}`} hint={`${stats.jobs} paying job(s)`} />
        <Stat label="Paid to you" value={money(stats.paid)} />
        <Stat label="Ready for next payout" value={money(stats.ready)} hint={stats.ready && stats.ready < P.minPayout ? `paid once it reaches ${money(P.minPayout)}` : "paid Monday"} />
        <Stat label="Upcoming" value={money(stats.upcoming)} hint={`in the ${P.holdDays}-day guarantee window`} />
      </div>

      <section className="card">
        <h2 className="font-bold">Standard Referral Ticket — send us a job <Link href="/partners/referral-ticket" className="text-xs font-normal text-brand underline" target="_blank">printable blank ticket</Link></h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">Tell us everything about one job. Our AI files it (service, size, how often), we send the customer a booking link with it all filled in, and once they pay we send it to our pros. You hear from us when it&apos;s booked, assigned and done.</p>
        <ReferralTicket services={services} isPro={Boolean(partner.contractor_id ?? v.contractorId)} rates={{ once: pctLabel(P.jobOncePct), recurring: pctLabel(P.jobRecurringPct), months: P.months }} />
      </section>

      <section>
        <h2 className="mb-2 font-bold">Your referral tickets</h2>
        {!T.length ? <Empty>No tickets yet. Send one above.</Empty> : (
          <div className="space-y-3">{T.map((t) => {
            const j = t.jobs;
            const pct = t.basis ? COMMISSION_BASIS[t.basis].pct : null;
            const split = j && pct && Number(j.price_final) > 0 ? moneySplit({ price: Number(j.price_final), payout: Number(j.contractor_payout ?? 0), refunded: Number(j.amount_refunded ?? 0) }, pct) : null;
            const [label, tone] = STATUS[t.status];
            return (
              <div key={t.id} className="card text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><b>{t.customer_name}</b> · {t.service_slug ? getService(t.service_slug)?.name : "Service to confirm"}{t.frequency !== "once" ? ` · ${t.frequency}` : ""}{j ? ` · ${j.ref}` : ""}{t.photos?.length ? ` · 📷 ${t.photos.length}` : ""}</div>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                {t.ai_summary && <p className="mt-2 text-ink-soft">{t.ai_summary}</p>}
                {split && <p className="mt-2 rounded-lg bg-paper p-2">Customer pays {money(split.customer)} → pro {money(split.pro)} · <b>you {money(split.referrer)}</b> ({pctLabel(pct!)}%{t.basis === "job_recurring" ? " per visit" : ""}) · Handled {money(split.handled)}</p>}
                <p className="mt-2 text-xs text-ink-soft">{t.status === "booked" && t.pays_until ? `Every visit pays you until ${t.pays_until.slice(0, 10)}. ` : ""}{["open", "needs_review"].includes(t.status) ? `The customer can book until ${t.expires_at.slice(0, 10)}. ` : ""}Sent {t.created_at.slice(0, 10)}.</p>
                {t.events?.length > 0 && <details className="mt-1 text-xs"><summary className="cursor-pointer text-ink-soft">Timeline</summary><ul className="mt-1 space-y-0.5">{t.events.map((e, i) => <li key={i}>{e.at.slice(0, 10)} — {e.text}</li>)}</ul></details>}
              </div>
            );
          })}</div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="font-bold">Your link — refer a person</h2>
          <p className="mt-1 text-sm text-ink-soft">Anyone new who books within {P.cookieDays} days of clicking it becomes your customer for {P.months} months.</p>
          <p className="mt-3 select-all break-all rounded-lg bg-paper p-2 font-mono text-sm">{link}</p>
          <CopyButton text={link} />
          <p className="mt-3 text-sm">Short link for cards and texts: <span className="select-all font-mono">{short}</span></p>
          <p className="mt-1 text-sm">Your code: <b className="font-mono">{partner.code}</b></p>
        </div>
        <div className="card">
          <h2 className="font-bold">Payouts</h2>
          <p className="mt-1 text-sm text-ink-soft">{ready ? "Ready — commissions go to your bank every Monday through Stripe." : "Set up payouts once through Stripe (bank account or debit card). Stripe also collects the tax details we need if you earn $600+ in a year."}</p>
          <div className="mt-3 flex items-center gap-3">{ready ? <Badge tone="green">Payouts ready</Badge> : <Badge tone="amber">Not set up</Badge>}<PartnerPayoutButton ready={ready} /></div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-bold">Send us a person</h2>
        <p className="mb-3 mt-1 text-sm text-ink-soft">No specific job yet? We email them a booking link from you. They&apos;re your customer for {P.months} months, even if they book later or on their phone.</p>
        <ReferCustomer services={services} />
      </section>

      <section>
        <h2 className="mb-2 font-bold">Your customers</h2>
        {!(customers ?? []).length ? <Empty>No customers yet. Share your link or send one above.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Customer</th><th className="p-3">Interested in</th><th className="p-3">How</th><th className="p-3">Booked?</th><th className="p-3">Earning until</th></tr></thead>
            <tbody>{((customers ?? []) as { customer_name: string | null; customer_email: string; service_slug: string | null; source: string; first_job_id: string | null; expires_at: string }[]).map((c) => (
              <tr key={c.customer_email} className="border-t border-line"><td className="p-3">{c.customer_name ?? mask(c.customer_email)}</td><td className="p-3">{c.service_slug ? getService(c.service_slug)?.name ?? "—" : "—"}</td><td className="p-3">{c.source === "direct" ? "You sent them" : c.source === "staff" ? "Credited by us" : "Your link"}</td><td className="p-3">{c.first_job_id ? <Badge tone="green">Booked</Badge> : <Badge>Not yet</Badge>}</td><td className="p-3">{c.expires_at.slice(0, 10)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold">Commissions</h2>
        {!(comms ?? []).length ? <Empty>Commissions show here when a job you referred is completed.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Job</th><th className="p-3">For</th><th className="p-3">Completed</th><th className="p-3">Commission</th><th className="p-3">Status</th></tr></thead>
            <tbody>{((comms ?? []) as unknown as { id: string; amount: number; status: string; eligible_at: string; paid_at: string | null; basis?: CommissionBasis; pct?: number | null; jobs: { ref: string; service_slug: string; completed_at: string | null } | null }[]).map((c) => (
              <tr key={c.id} className="border-t border-line"><td className="p-3">{c.jobs ? `${getService(c.jobs.service_slug)?.name ?? ""} · ${c.jobs.ref}` : "—"}</td><td className="p-3">{COMMISSION_BASIS[c.basis ?? "person"].label} · {pctLabel(c.pct != null ? Number(c.pct) : COMMISSION_BASIS[c.basis ?? "person"].pct)}%</td><td className="p-3">{c.jobs?.completed_at?.slice(0, 10) ?? "—"}</td><td className="p-3 font-semibold">{money(Number(c.amount))}</td>
                <td className="p-3">{c.status === "paid" ? <Badge tone="green">Paid {c.paid_at?.slice(0, 10)}</Badge> : c.status === "void" ? <Badge tone="red">Cancelled (refund)</Badge> : new Date(c.eligible_at) <= new Date() ? <Badge tone="brand">Ready</Badge> : <Badge tone="amber">Payable {c.eligible_at.slice(0, 10)}</Badge>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
