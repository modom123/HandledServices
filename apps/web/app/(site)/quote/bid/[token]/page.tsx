/*
 * FILE    : apps/web/app/(site)/quote/bid/[token]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : A pro's private link to a quote request: the job (description, photos, area, date) and their firm quote
 *           or decline. The customer's name and contact details are not shown before they book.
 */
import { notFound } from "next/navigation";
import { SERVICE_BY_SLUG } from "@handled/core";
import { bidByToken } from "@/lib/quotes";
import { BidForm } from "@/components/QuoteForms";

export const metadata = { title: "Quote request", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Bid({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await bidByToken(token);
  if (!found) notFound();
  const { bid, request: q, photoUrls } = found;
  const open = ["invited", "quoted"].includes(bid.status) && ["open", "quoted"].includes(String(q.status)) && new Date(String(q.expires_at)) > new Date();
  return (
    <div className="wrap max-w-3xl space-y-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Quote request: {SERVICE_BY_SLUG[String(q.service_slug)]?.name ?? String(q.service_slug)}</h1>
        <p className="text-sm text-ink-soft">{String(q.city ?? q.zip)}{q.preferred_date ? ` · around ${q.preferred_date}` : ""}</p>
      </div>
      <div className="card whitespace-pre-wrap text-sm">{String(q.description)}</div>
      {photoUrls.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{photoUrls.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="Job photo" className="aspect-square w-full rounded-lg object-cover" /></a>)}</div>}
      {open ? <BidForm token={token} slug={String(q.service_slug)} current={{ pay: bid.pay ? Number(bid.pay) : null, earliest_date: bid.earliest_date, note: bid.note }} />
        : <p className="card text-sm text-ink-soft">{bid.status === "chosen" ? "The customer booked your quote — the job is in your offers." : "This request has closed."}</p>}
    </div>
  );
}
