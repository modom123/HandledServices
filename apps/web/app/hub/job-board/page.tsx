/*
 * FILE    : apps/web/app/hub/job-board/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0715 UTC
 * PURPOSE : Hub → Jobs → Job board: the internal version of the job board. Every open job waiting for a pro — name-your-
 *           price posts ($1 posts) and paid jobs nobody has taken — with the customer, the address, how long it's posted,
 *           offers out, and (admins only) the money: customer price, what the pro makes, what Handled makes.
 *           The public version is /job-board (city, ZIP, pro pay, scope only); pros see "Jobs near you" in their portal.
 *           Each row opens the job and its three tickets (customer / pro / Handled).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getService, isBoardPost, money, topPay, type Job } from "@handled/core";
import { getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HubJobBoard({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const v = await getViewer();
  if (!isStaff(v)) notFound();
  const admin = isAdmin(v);
  const { show } = await searchParams;
  const db = adminClient();
  const { data } = await db.from("jobs").select("*").is("contractor_id", null).in("status", ["dispatched", "scheduled", "requested"]).order("created_at", { ascending: false }).limit(300);
  let jobs = ((data ?? []) as (Job & { customer_offer?: number | null; suggested_price?: number | null; partner_pro_fee?: number | null })[])
    // waiting for a pro: paid (or on account / a $1 post) — unpaid bookings are in Jobs, not on the board
    .filter((j) => j.paid_at || j.deposit_paid_at || j.billed_on_terms || j.remedy);
  if (show === "posts") jobs = jobs.filter((j) => isBoardPost(j));
  const { data: offers } = jobs.length ? await db.from("job_offers").select("job_id, status").in("job_id", jobs.map((j) => j.id)) : { data: [] };
  const out: Record<string, number> = {};
  for (const o of (offers ?? []) as { job_id: string; status: string }[]) if (o.status === "offered") out[o.job_id] = (out[o.job_id] ?? 0) + 1;
  const totals = jobs.reduce((t, j) => { const price = Number(j.price_final ?? 0), pro = Number(j.contractor_payout ?? 0); return { price: t.price + price, pro: t.pro + pro, keep: t.keep + (price - pro) }; }, { price: 0, pro: 0, keep: 0 });
  const chip = (href: string, label: string, on: boolean) => <Link href={href} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{label}</Link>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Job board (internal)</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Every open job waiting for a pro. The website version (<Link href="/job-board" className="underline">/job-board</Link>) shows only the city, ZIP, scope and what the pro earns; pros see theirs in "Jobs near you". Here: the customer, the address and {admin ? "the money" : "the status"}.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chip("/hub/job-board", `All open (${jobs.length})`, show !== "posts")}
        {chip("/hub/job-board?show=posts", "Name-your-price posts", show === "posts")}
        {admin && jobs.length > 0 && <span className="ml-auto text-sm">Open value: customer {money(totals.price)} · pros {money(totals.pro)} · <b>Handled {money(totals.keep)}</b></span>}
      </div>
      {!jobs.length ? <p className="card text-sm text-ink-soft">No open jobs waiting for a pro.</p> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-ink-soft"><tr>
              <th className="p-2">Job</th><th className="p-2">Customer · where</th><th className="p-2">When / posted</th><th className="p-2">Offers out</th>
              {admin && <><th className="p-2 text-right">Customer pays</th><th className="p-2 text-right">Pro makes</th><th className="p-2 text-right">Handled makes</th></>}
              <th className="p-2">Tickets</th>
            </tr></thead>
            <tbody>{jobs.map((j) => {
              const svc = getService(j.service_slug);
              const price = Number(j.price_final ?? 0), pro = Number(j.contractor_payout ?? 0), keep = Math.round((price - pro) * 100) / 100;
              const post = isBoardPost(j);
              return (
                <tr key={j.id} className="border-t border-line align-top">
                  <td className="p-2"><Link href={`/hub/jobs/${j.id}`} className="font-semibold underline decoration-dotted">{j.ref}</Link><div className="text-xs">{svc?.icon} {svc?.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">{post && <span className="rounded bg-sky-100 px-1.5 text-[11px] text-sky-900">Posted ($1)</span>}{topPay(j) && <span className="rounded bg-emerald-100 px-1.5 text-[11px] text-emerald-800">Top pay</span>}{j.priority !== "normal" && <span className="rounded bg-amber-100 px-1.5 text-[11px]">{j.priority}</span>}</div></td>
                  <td className="p-2">{j.contact_name}{j.company_name ? ` · ${j.company_name}` : ""}<div className="text-xs text-ink-soft">{j.address}, {j.city} {j.zip}</div></td>
                  <td className="p-2 text-xs">{post ? `Posted until ${j.open_offer_until!.slice(0, 10)} (day set with the pro)` : `${j.scheduled_date ?? "—"} · ${j.time_window}`}<div className="text-ink-soft">booked {j.created_at.slice(0, 10)}</div></td>
                  <td className="p-2 text-xs">{out[j.id] ?? 0}</td>
                  {admin && <>
                    <td className="p-2 text-right">{money(price)}{j.customer_offer ? <div className="text-[11px] text-ink-soft">named · ours {money(j.suggested_price ?? 0)}</div> : null}</td>
                    <td className="p-2 text-right">{money(pro - Number(j.partner_pro_fee ?? 0))}</td>
                    <td className="p-2 text-right font-semibold text-brand-dark">{money(keep)}{price > 0 ? <div className="text-[11px] font-normal text-ink-soft">{Math.round((keep / price) * 100)}%</div> : null}</td>
                  </>}
                  <td className="p-2 text-xs"><Link className="underline" href={`/hub/jobs/${j.id}/ticket?v=customer`}>Customer</Link> · <Link className="underline" href={`/hub/jobs/${j.id}/ticket?v=pro`}>Pro</Link>{admin && <> · <Link className="underline" href={`/hub/jobs/${j.id}/ticket?v=handled`}>Handled</Link></>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
