/*
 * FILE    : apps/web/app/(site)/quote/[token]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : The customer's private quotes page: their request and every firm quote so far (all-in price, pro, rating,
 *           earliest date, note), cheapest first; "Book this quote" goes to the normal checkout at that locked price.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { SERVICE_BY_SLUG, money } from "@handled/core";
import { requestByToken } from "@/lib/quotes";

export const metadata = { title: "Your quotes", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Quotes({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await requestByToken(token);
  if (!r) notFound();
  const { request: q, quotes, waiting } = r;
  const open = ["open", "quoted"].includes(q.status) && new Date(q.expires_at) > new Date();
  return (
    <div className="wrap max-w-3xl space-y-6 py-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Your quotes: {SERVICE_BY_SLUG[q.service_slug]?.name ?? q.service_slug}</h1>
        <p className="mt-2 text-sm text-ink-soft">“{String(q.description).slice(0, 300)}” · {q.city ?? q.zip}</p>
        {q.status === "booked" && <p className="mt-2 rounded-lg bg-green-50 p-2 text-sm">Booked — check your email for the details.</p>}
        {!open && q.status !== "booked" && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">This request has closed. <Link href="/quote-request" className="underline">Ask for new quotes</Link>.</p>}
      </div>
      {quotes.length ? (
        <div className="space-y-3">
          {quotes.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-bold">{money(Number(b.price))} <span className="text-sm font-normal text-ink-soft">all-in</span></div>
                <div className="font-semibold">{b.contractors?.business_name ?? "Vetted pro"}</div>
                <div className="text-xs text-ink-soft">★ {Number(b.contractors?.rating ?? 5).toFixed(1)} · {b.contractors?.jobs_completed ?? 0} jobs{b.earliest_date ? ` · can start ${new Date(`${b.earliest_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
                {b.note && <p className="mt-1 text-sm">{b.note}</p>}
              </div>
              {open && b.status === "quoted" && <Link href={`/book?quote=${token}&bid=${b.id}`} className="btn-primary">Book this quote</Link>}
              {b.status === "chosen" && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Booked</span>}
            </div>
          ))}
        </div>
      ) : <p className="card text-sm text-ink-soft">No quotes yet. {waiting ? `${waiting} pro${waiting === 1 ? " is" : "s are"} looking at your job — quotes usually arrive within 24 hours, and we'll email you each one.` : "We're finding the right pros and will email you."}</p>}
      <p className="text-xs text-ink-soft">Every quote is a firm, all-in price from a vetted, insured pro. You pay when you book; the pro is paid after the job is done and checked.</p>
    </div>
  );
}
