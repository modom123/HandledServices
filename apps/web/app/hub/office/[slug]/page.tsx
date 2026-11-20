/*
 * FILE    : apps/web/app/hub/office/[slug]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Front Office → an executive's office (admins only):
 *             /hub/office/odom   — Mark Odom, CEO: to-dos, email, Zoom, and the important ops tools (today's jobs, jobs
 *                                  without a pro, open alerts, legal reviews, the last 7 days' revenue)
 *             /hub/office/gulley — Cecilia Gulley, Chief Strategy & Recruiting: to-dos, email, Zoom (interviews), and the
 *                                  recruiting tools (pipeline by stage, new applications, pros in vetting, legal checks on pros)
 *           The to-do list is shared between the two offices and goes back and forth (lib/office-todos.ts).
 *           Setup (env names) in lib/offices.ts and lib/zoom.ts.
 * UPDATED : 2026-11-19_0000 UTC — Zoom moved to its own page (/hub/office/[slug]/zoom) so the email has the full width
 *           and messages are easy to read; a "Zoom" button at the top of the office links there.
 * UPDATED : 2026-11-17_2330 UTC — email reads in place (OfficeMail): opening an email stays on the office page, and Back
 *           (the link or the browser's) returns to the inbox instead of leaving the office. The page also loads faster:
 *           the inbox loads after the page instead of holding it up.
 * UPDATED : 2026-11-20_0400 UTC — tool links come from the Hub map (lib/hub-sections), so they stay current as pages are
 *           added or moved: the CEO's office lists every section, the recruiting office Recruiting and Pros. The CEO's
 *           office also shows the sales & marketing funnel (lib/clients-funnel).
 * UPDATED : 2026-11-20_0415 UTC — no repeats: today's jobs, alerts and revenue moved to the Dashboard (Today | This month);
 *           the CEO's ops tools keep links to it, legal reviews open, the sales funnel and every tool by section.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PIPELINE } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { adminOnly } from "@/components/AdminOnly";
import { Stat } from "@/components/ui";
import { OFFICES, officeBySlug, officeEmail, officeMail, type Office } from "@/lib/offices";
import { listTodos, otherOffice } from "@/lib/office-todos";
import { sectionsFor, type HubSection } from "@/lib/hub-sections";
import { clientsFunnel } from "@/lib/clients-funnel";
import { OfficeMail, TodoBoard, VerifyMailbox, type TodoView } from "@/components/Office";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The office's tool links come from the Hub's own map (lib/hub-sections), so they stay current as the organization
 * changes: a page added, renamed or moved in the Hub shows up here on its own (owner, 2026-11-20). Each section lists
 * its tabs and the pages merged under them.
 */
function SectionTools({ ids }: { ids?: string[] }) {
  const all = sectionsFor(true).filter((x) => x.id !== "front-office" && (!ids || ids.includes(x.id)));
  const pages = (x: HubSection) => {
    const seen = new Set<string>(), out: [string, string][] = [];
    for (const [href, label] of x.links) {
      for (const [h, l] of x.groups?.[href] ?? [[href, label] as const]) if (!seen.has(h)) { seen.add(h); out.push([h, l]); }
    }
    return out;
  };
  return (
    <div className="space-y-2">
      {all.map((x) => (
        <div key={x.id} className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="w-40 shrink-0 font-semibold">{x.icon} {x.label}</span>
          {pages(x).map(([href, label]) => <Link key={href} href={href} className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs hover:border-brand">{label}</Link>)}
        </div>
      ))}
    </div>
  );
}

async function OpsTools() {
  // today's jobs, alerts and the month's numbers live on the Dashboard (one place, no repeats); the office keeps what
  // is its own: legal reviews waiting, the sales & marketing funnel, and every tool by section
  const db = adminClient();
  const [{ count: legal }, { count: urgent }, funnel] = await Promise.all([
    db.from("agent_tasks").select("id", { count: "exact", head: true }).eq("agent", "legal").eq("status", "open"),
    db.from("ops_alerts").select("id", { count: "exact", head: true }).eq("resolved", false).in("severity", ["critical", "warn"]),
    clientsFunnel().catch(() => []),
  ]);
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">🧭 Ops tools</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/hub/briefing" className="btn-ghost">📊 Dashboard: today{urgent ? ` · ${urgent} alert${urgent === 1 ? "" : "s"}` : ""}</Link>
        <Link href="/hub" className="btn-ghost">📈 This month</Link>
        <Link href="/hub/agents" className="btn-ghost">⚖️ Legal reviews open: {legal ?? 0}</Link>
        <Link href="/hub/setup" className="btn-ghost">✅ Go-live setup</Link>
      </div>
      {funnel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Sales & marketing</h3>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">{funnel.map((f) => <Link key={f.href} href={f.href} title={f.hint} className="rounded-lg border border-line bg-white px-2.5 py-1 hover:border-brand"><b className="text-sm">{f.n ?? "—"}</b> <span className="text-ink-soft">{f.label}</span></Link>)}</div>
        </div>
      )}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Every tool, by section</h3>
        <SectionTools />
      </div>
    </section>
  );
}

async function RecruitingTools() {
  const db = adminClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: apps }, { count: vetting }, { count: approved }, { count: legal }] = await Promise.all([
    db.from("contractor_applications").select("id, business_name, contact_name, stage, trades, created_at").order("created_at", { ascending: false }).limit(1000),
    db.from("contractors").select("id", { count: "exact", head: true }).eq("status", "vetting"),
    db.from("contractors").select("id", { count: "exact", head: true }).eq("status", "approved"),
    db.from("agent_tasks").select("id", { count: "exact", head: true }).eq("agent", "legal").eq("status", "open").like("target", "pro:%"),
  ]);
  const list = (apps ?? []) as { id: string; business_name: string | null; contact_name: string | null; stage: string; trades: string[] | null; created_at: string }[];
  const byStage = PIPELINE.map((s) => [s, list.filter((a) => a.stage === s).length] as const);
  const fresh = list.filter((a) => a.created_at >= weekAgo);
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">🎯 Recruiting tools</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New applications, 7 days" value={fresh.length} />
        <Stat label="Interviews to do" value={list.filter((a) => a.stage === "interview").length} hint="schedule them on Zoom here" />
        <Stat label="Pros in vetting" value={vetting ?? 0} hint={`${approved ?? 0} approved pros`} />
        <Stat label="Pro compliance checks" value={legal ?? 0} hint="license, insurance, classification" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Pipeline</h3>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">{byStage.map(([s, n]) => <Link key={s} href="/hub/recruiting/pipeline" className="rounded bg-paper px-2 py-1">{s} <b>{n}</b></Link>)}</div>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Latest applications</h3>
        <ul className="mt-1 divide-y divide-line text-sm">
          {list.slice(0, 8).map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <Link href={`/hub/recruiting/${a.id}`} className="font-medium text-brand underline">{a.business_name || a.contact_name || "Applicant"}</Link>
              <span className="text-xs text-ink-soft">{(a.trades ?? []).join(", ")} · {a.stage} · {when(a.created_at)}</span>
            </li>
          ))}
          {!list.length && <li className="py-1.5 text-ink-soft">No applications yet.</li>}
        </ul>
      </div>
      <SectionTools ids={["recruiting", "pros"]} />
    </section>
  );
}

function Mail({ o }: { o: Office }) {
  const acct = officeMail(o);
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">✉️ Email{officeEmail(o) ? ` · ${officeEmail(o)}` : ""}</h2>
        {acct && <VerifyMailbox office={o.slug} />}
      </div>
      {acct ? <OfficeMail office={o.slug} first={o.first} /> : (
        <p className="rounded bg-amber-50 p-2 text-sm">Not connected yet. In Vercel → Environment Variables add <code>OFFICE_{o.key}_EMAIL</code> ({o.first}&apos;s mailbox address) and <code>OFFICE_{o.key}_PASSWORD</code>, then redeploy.</p>
      )}
    </section>
  );
}

export default async function OfficePage({ params }: { params: Promise<{ slug: string }> }) {
  const gate = await adminOnly();
  if (gate) return gate;
  const { slug } = await params;
  const o = officeBySlug(slug);
  if (!o) notFound();
  const other = otherOffice(o.slug);
  const names = Object.fromEntries(OFFICES.map((x) => [x.slug, x.name]));
  const todos = await listTodos().catch((e: Error) => ({ open: [], done: [], error: e.message }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{o.icon} {o.name}</h1>
          <p className="text-sm text-ink-soft">{o.title} · <Link href={`/hub/office/${other}`} className="text-brand underline">{names[other]}&apos;s office →</Link></p>
        </div>
        <Link href={`/hub/office/${o.slug}/zoom`} className="btn-ghost">🎥 Zoom{o.tools === "recruiting" ? " (interviews)" : ""}</Link>
      </div>
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">📝 To-do list <span className="text-sm font-normal text-ink-soft">— shared with {names[other]}; send items back and forth</span></h2>
        <TodoBoard office={o.slug} other={other} names={names} todos={todos.open as TodoView[]} done={todos.done as TodoView[]} error={todos.error} />
      </section>
      {o.tools === "ops" ? <OpsTools /> : <RecruitingTools />}
      <Mail o={o} />
    </div>
  );
}
