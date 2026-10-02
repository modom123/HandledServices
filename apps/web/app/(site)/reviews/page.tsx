/*
 * FILE    : apps/web/app/(site)/reviews/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Public customer reviews — the overall average (every rating counts) and recent
 *           comments, filterable by service.
 */
import Link from "next/link";
import { BRAND, SERVICES, getService } from "@handled/core";
import { publicReviews } from "@/lib/reviews";

export const revalidate = 1800;
export const metadata = { title: "Customer reviews", description: `Real reviews from ${BRAND.name} customers — every rating counts toward our average.` };

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

export default async function Reviews({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const svc = getService(service ?? "");
  const r = await publicReviews({ slug: svc?.slug, limit: 60 });
  return (
    <div className="wrap py-14">
      <h1 className="text-4xl font-extrabold tracking-tight">Customer reviews{svc ? ` — ${svc.name}` : ""}</h1>
      <p className="mt-2 text-ink-soft">Every customer is asked to rate their pro after the job. Every rating counts toward the average — we don’t hide the bad ones.</p>
      {r.average ? <p className="mt-4 text-lg"><span className="text-amber-500">{stars(r.average)}</span> <b>{r.average}</b> average from {r.count} reviews</p> : <p className="mt-4 rounded-xl bg-paper-deep p-4 text-sm">Reviews appear here as customers rate their finished jobs.</p>}
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href="/reviews" className={`rounded-full border px-3 py-1 ${!svc ? "border-brand bg-brand-tint font-semibold" : "border-line bg-white"}`}>All</Link>
        {SERVICES.slice(0, 18).map((s) => <Link key={s.slug} href={`/reviews?service=${s.slug}`} className={`rounded-full border px-3 py-1 ${svc?.slug === s.slug ? "border-brand bg-brand-tint font-semibold" : "border-line bg-white"}`}>{s.icon} {s.name}</Link>)}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {r.list.map((x) => (
          <div key={x.id} className="card"><div className="flex justify-between text-sm"><span className="text-amber-500">{stars(x.rating)}</span><span className="text-ink-soft">{getService(x.service)?.name}</span></div><p className="mt-2">“{x.comment}”</p><div className="mt-2 text-xs text-ink-soft">{x.name}{x.city ? ` · ${x.city}` : ""} · {x.date}</div></div>
        ))}
      </div>
    </div>
  );
}
