/*
 * FILE    : apps/web/app/invoice/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2030 UTC
 * UPDATED : 2026-10-03_0042 UTC — prints the service-specific addenda and links the Terms of Use.
 * PURPOSE : Invoice & Service Agreement for one job — what was booked, the price, payment
 *           status and the full customer terms it was accepted under. Opens from the
 *           signed link in every email (no login), or for the signed-in customer / staff.
 *           Printable.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND, SERVICE_AGREEMENT_VERSION, TIME_WINDOW_LABEL, estimate, getService, money, type Job } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getViewer, isStaff } from "@/lib/auth";
import { validInvoiceToken } from "@/lib/invoice";
import { SERVICE_AGREEMENT, SERVICE_AGREEMENT_TITLE } from "@/lib/service-agreement";
import { addendaForService } from "@/lib/contracts";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice & Service Agreement", robots: { index: false } };

export default async function Invoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  let allowed = validInvoiceToken(id, t);
  if (!allowed) {
    const v = await getViewer();
    if (isStaff(v)) allowed = true;
    else if (v) allowed = Boolean((await v.db.from("jobs").select("id").eq("id", id).maybeSingle()).data);
  }
  if (!allowed) notFound();
  const { data } = await adminClient().from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job & { terms_version: string | null; terms_accepted_at: string | null };
  const svc = getService(job.service_slug)!;
  const price = Number(job.price_final ?? 0);
  const base = job.remedy ? null : estimate({ slug: svc.slug, answers: job.answers as never, frequency: job.frequency, rush: job.priority === "high" });
  const lines = !job.price_final ? [] : job.remedy
    ? [{ label: job.remedy === "redo" ? "Return visit to make it right" : "Complimentary service", amount: 0 }]
    : svc.siteVisit
      ? [{ label: `${svc.name} — firm quote after site visit`, amount: price }]
      : [...base!.items, ...(Math.round(price) !== base!.point ? [{ label: "Adjustment after review of your notes & photos", amount: price - base!.point }] : [])];
  const due = job.remedy ? 0 : Math.max(0, price - Number(job.amount_paid ?? 0));
  const fmtD = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—");

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-sm print:max-w-none print:p-0 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2 text-lg font-extrabold"><span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-white">✓</span>{BRAND.name}</div>
          <div className="mt-1 text-xs text-ink-soft">{BRAND.legalName} · {BRAND.supportEmail} · {BRAND.supportPhone}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">Invoice & Service Agreement</div>
          <div className="text-ink-soft">No. {job.ref} · issued {fmtD(job.created_at)}</div>
          <div className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${job.remedy || job.paid_at ? "bg-green-100 text-green-800" : job.price_final ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
            {job.remedy ? "NO CHARGE" : job.paid_at ? `PAID ${fmtD(job.paid_at)}` : job.price_final ? "PAYMENT DUE — work is scheduled once paid" : "ESTIMATE — free site visit"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
        <div><div className="label">Customer</div><div className="font-semibold">{job.company_name ?? job.contact_name}</div>{job.company_name && <div>{job.contact_name}</div>}<div className="text-ink-soft">{job.contact_email} · {job.contact_phone}</div></div>
        <div><div className="label">Service address & time</div><div>{job.address}, {job.city}, {job.state} {job.zip}</div><div className="text-ink-soft">{fmtD(job.scheduled_date)} · {TIME_WINDOW_LABEL[job.time_window]}{job.frequency !== "once" ? ` · ${job.frequency} plan` : ""}</div></div>
      </div>

      <div className="border-b border-line py-6">
        <div className="label">Scope of work — {svc.name}</div>
        <ul className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">{svc.questions.map((q) => {
          const v = (job.answers as Record<string, unknown>)[q.id];
          const shown = q.type === "select" ? q.options.find((o) => o.value === v)?.label ?? String(v ?? "—") : q.type === "toggle" ? (v ? "Yes" : "No") : `${v ?? "—"}${q.unit ? ` ${q.unit}` : ""}`;
          return <li key={q.id}><span className="text-ink-soft">{q.label}:</span> {shown}</li>;
        })}</ul>
        <div className="mt-2"><span className="text-ink-soft">Included:</span> {svc.includes.join(" · ")}</div>
        {job.notes && <div className="mt-2"><span className="text-ink-soft">Your notes:</span> “{job.notes}”</div>}
      </div>

      <table className="my-6 w-full">
        <tbody>
          {lines.map((l) => <tr key={l.label} className="border-b border-line"><td className="py-2">{l.label}</td><td className="py-2 text-right">{money(l.amount)}</td></tr>)}
          {!lines.length && <tr><td className="py-2 text-ink-soft">Firm price issued after the free site visit (estimate {money(job.estimate_low)} – {money(job.estimate_high)}).</td><td /></tr>}
          <tr className="font-bold"><td className="py-2">Total</td><td className="py-2 text-right">{money(price)}</td></tr>
          {Number(job.amount_paid) > 0 && <tr><td className="py-1 text-ink-soft">Paid {fmtD(job.paid_at)}</td><td className="py-1 text-right">−{money(Number(job.amount_paid))}</td></tr>}
          {Number(job.amount_refunded) > 0 && <tr><td className="py-1 text-ink-soft">Refunded</td><td className="py-1 text-right">{money(Number(job.amount_refunded))}</td></tr>}
          <tr className="text-base font-bold"><td className="py-2">Balance due{due > 0 && job.balance_due_date ? ` by ${fmtD(job.balance_due_date)}` : ""}</td><td className="py-2 text-right">{money(due)}</td></tr>
          {job.payment_plan === "deposit" && due > 0 && <tr><td colSpan={2} className="pt-1 text-xs text-ink-soft">Deposit plan: the balance is charged automatically to the card used for the deposit{job.balance_due_date ? ` on ${fmtD(job.balance_due_date)}` : ""}. Work begins once paid in full.</td></tr>}
        </tbody>
      </table>
      {due > 0 && <p className="mb-6 rounded-xl bg-brand-tint p-3 print:hidden">Pay from <Link href="/account" className="font-semibold underline">My Bookings</Link> or the link in your email. Your pro is dispatched as soon as payment clears.</p>}

      <div className="border-t border-line pt-6">
        <h2 className="text-base font-bold">{SERVICE_AGREEMENT_TITLE}</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{SERVICE_AGREEMENT.map((s) => <div key={s.h}><span className="font-semibold">{s.h}.</span> <span className="whitespace-pre-line text-ink-soft">{s.p}</span></div>)}</div>
        {addendaForService(job.service_slug).map((ad) => (
          <div key={ad.key} className="mt-6">
            <h3 className="text-base font-bold">{ad.title} (v{ad.version})</h3>
            <div className="mt-2 space-y-3 text-[15px] leading-relaxed">{ad.sections.map((s) => <div key={s.h}><span className="font-semibold">{s.h}.</span> <span className="whitespace-pre-line text-ink-soft">{s.p}</span></div>)}</div>
          </div>
        ))}
        <p className="mt-4 text-xs text-ink-soft">Also part of this agreement: the <a href="/terms/terms-of-use" className="underline">Terms of Use</a> (including how disputes are resolved). All current terms: /terms. Your signed copies: My account → My contracts.</p>
        <div className="mt-6 rounded-xl border border-line p-4">
          {job.terms_accepted_at
            ? <>Accepted electronically by <b>{job.contact_name}</b> on {new Date(job.terms_accepted_at).toLocaleString("en-US")} (version {job.terms_version}).</>
            : <>These terms (version {SERVICE_AGREEMENT_VERSION}) apply to this job. Paying this invoice confirms your acceptance.</>}
        </div>
      </div>
      <div className="mt-6 flex gap-2 print:hidden"><PrintButton /><Link href="/account" className="btn-ghost">My Bookings</Link></div>
    </div>
  );
}
