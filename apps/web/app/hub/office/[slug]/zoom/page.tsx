/*
 * FILE    : apps/web/app/hub/office/[slug]/zoom/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-19_0000 UTC
 * PURPOSE : Front Office → an executive's Zoom page (admins only): one-click Personal Meeting Room, schedule a meeting
 *           (interviews for the recruiting office), and upcoming meetings. Split out of the office page so the email
 *           there has the full width. Setup (env names) in lib/offices.ts and lib/zoom.ts.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminOnly } from "@/components/AdminOnly";
import { officeBySlug, officeZoomLink, officeZoomUser, type Office } from "@/lib/offices";
import { upcomingZoomMeetings, zoomReady } from "@/lib/zoom";
import { ZoomScheduler } from "@/components/Office";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function Zoom({ o }: { o: Office }) {
  const link = officeZoomLink(o);
  const user = officeZoomUser(o);
  const ready = zoomReady() && Boolean(user);
  let error: string | null = null;
  const upcoming = ready ? await upcomingZoomMeetings(user!).catch((e: Error) => { error = e.message; return []; }) : [];
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">🎥 Zoom</h2>
      {link ? <a href={link} target="_blank" rel="noreferrer" className="btn-primary inline-block">Open my Zoom room</a> : <p className="text-sm text-ink-soft">Add <code>OFFICE_{o.key}_ZOOM_LINK</code> ({o.first}&apos;s Personal Meeting Room link) for a one-click room.</p>}
      <ZoomScheduler office={o.slug} ready={ready} defaultTopic={o.tools === "recruiting" ? "Interview: " : ""} />
      {error && <p className="text-xs text-rose-700">Couldn&apos;t load upcoming meetings: {error}</p>}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Coming up</h3>
          <ul className="mt-1 divide-y divide-line text-sm">{upcoming.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-2 py-1.5"><a href={m.join_url} target="_blank" rel="noreferrer" className="text-brand underline">{m.topic}</a><span className="text-xs text-ink-soft">{when(m.start_time)}</span></li>)}</ul>
        </div>
      )}
      {!zoomReady() && <p className="text-xs text-ink-soft">Setup: a Zoom Server-to-Server OAuth app (scopes to create and read meetings) → <code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_CLIENT_ID</code>, <code>ZOOM_CLIENT_SECRET</code> in Vercel. Meetings go on <code>OFFICE_{o.key}_ZOOM_USER</code> (defaults to the office email).</p>}
    </section>
  );
}

export default async function OfficeZoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const gate = await adminOnly();
  if (gate) return gate;
  const { slug } = await params;
  const o = officeBySlug(slug);
  if (!o) notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/hub/office/${o.slug}`} className="text-sm text-brand underline">← {o.name}&apos;s office</Link>
        <h1 className="text-2xl font-bold">🎥 Zoom · {o.name}</h1>
        <p className="text-sm text-ink-soft">{o.title}</p>
      </div>
      <Zoom o={o} />
    </div>
  );
}
