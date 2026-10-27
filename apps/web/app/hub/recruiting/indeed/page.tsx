/*
 * FILE    : apps/web/app/hub/recruiting/indeed/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Hub → Recruiting → Indeed — our primary recruiting tool, in one place:
 *             · status: Indeed Apply connected or not, Indeed applicants in the last 30 days, openings posted
 *             · how an Indeed applicant flows into each pipeline (pros → pro pipeline; team and client roles → their search)
 *             · a post kit for every opening (title, job type, pay, description, screener questions, the tracked apply
 *               link and the jobMeta for Indeed Apply) with copy buttons, plus saving the Indeed link once it's posted
 *             · importing Indeed's candidate export (CSV) into the pro pipeline
 *             · connecting Indeed Apply (applications delivered to /api/indeed/apply)
 */
import Link from "next/link";
import { TRACK_ICON, TRACK_LABEL, TRADES, indeedPost } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/notify";
import { funnel, openings } from "@/lib/recruiting-division";
import { CopyField, PostingControls } from "@/components/RecruitingDivision";
import { RecruitingIntake } from "@/components/RecruitingIntake";

export const dynamic = "force-dynamic";

export default async function IndeedPage() {
  const v = await getViewer();
  if (!v) return null;
  const [ops, f] = await Promise.all([openings(), funnel()]);
  const site = siteUrl();
  const connected = Boolean(process.env.INDEED_API_SECRET);
  const indeed30 = f.sources.find(([k]) => k === "Indeed")?.[1] ?? 0;
  const live = ops.filter((o) => !o.paused);
  const posted = live.filter((o) => o.indeedUrl || o.postedAt).length;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Indeed</h1>
        <p className="text-sm text-ink-soft">Indeed is our primary recruiting tool. Post every opening from here; every applicant comes back into the right pipeline — whether they apply on our site or with Indeed Apply.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Openings on Indeed</div><div className="mt-1 text-3xl font-extrabold text-brand">{posted}/{live.length}</div><div className="text-xs text-ink-soft">{live.length - posted ? `${live.length - posted} still to post (below)` : "everything is posted"}</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Indeed applicants (30 days)</div><div className="mt-1 text-3xl font-extrabold text-brand">{indeed30}</div><div className="text-xs text-ink-soft">all tracks</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Indeed Apply</div><div className={`mt-1 text-2xl font-extrabold ${connected ? "text-brand" : "text-amber-700"}`}>{connected ? "Connected" : "Not connected"}</div><div className="text-xs text-ink-soft">{connected ? "applications arrive automatically" : "applicants use our apply link until it is (setup below)"}</div></div>
      </div>

      <section className="card text-sm">
        <h2 className="font-bold">How an Indeed applicant flows</h2>
        <ol className="mt-3 grid gap-2 md:grid-cols-4">
          {["You post the opening on Indeed with the kit below (title, description, pay, screener questions, apply link).", "They apply — on our site through the tracked apply link, or with Indeed Apply (once connected).", "They land in the right pipeline: pros in Pipeline → Independent pros (with the trade), team and client roles in their search.", "They get a confirmation email, then the usual screen → interview → decision → onboarding steps."].map((x, i) => (
            <li key={i} className="rounded-xl bg-paper p-3"><span className="font-bold text-brand">{i + 1}.</span> {x}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold">Post kits <span className="text-sm font-normal text-ink-soft">— one per opening</span></h2>
          <a href="https://employers.indeed.com/" target="_blank" rel="noreferrer" className="btn-primary text-sm">Open Indeed for Employers ↗</a>
        </div>
        <p className="text-sm text-ink-soft">On Indeed choose <b>Apply on company website</b> and paste the apply link, so we know which opening each applicant came from. Then paste the Indeed job link here to mark it posted.</p>
        {ops.map((o) => {
          const k = indeedPost(o, site);
          const done = Boolean(o.indeedUrl || o.postedAt);
          return (
            <details key={o.key} id={o.key} className="card scroll-mt-24 text-sm" open={!done && !o.paused && ops.indexOf(o) < 1}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                <span className="font-semibold">{TRACK_ICON[o.track]} {o.title} <span className="font-normal text-ink-soft">· {TRACK_LABEL[o.track]} · {o.location}</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${o.paused ? "bg-paper text-ink-soft" : done ? "bg-brand-tint text-brand-dark" : "bg-amber-50 text-amber-900"}`}>{o.paused ? "paused" : done ? "on Indeed" : "not posted"}</span>
              </summary>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <CopyField label="Job title" text={k.title} />
                  <div className="grid grid-cols-2 gap-3"><CopyField label="Job type" text={k.jobType} /><CopyField label="Location" text={k.location} /></div>
                  <CopyField label="Pay" text={k.pay} />
                  <CopyField label="Apply link (Apply on company website)" text={k.applyUrl} />
                  <CopyField label="Screener questions" text={k.screeners.join("\n")} multiline />
                  <CopyField label="jobMeta (Indeed Apply only)" text={k.jobMeta} />
                  {k.issues.length > 0 && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Contractor wording: avoid “{k.issues.join("”, “")}” in a 1099 post.</p>}
                </div>
                <div className="space-y-3">
                  <CopyField label="Description" text={k.description} multiline />
                  <PostingControls okey={o.key} indeedUrl={o.indeedUrl} paused={o.paused} isPublic={o.isPublic} track={o.track} />
                </div>
              </div>
            </details>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Import from Indeed</h2>
        <p className="text-sm text-ink-soft">Indeed → <b>Candidates</b> → select → <b>Export</b> (CSV), then import it here. Pro applicants join Pipeline → Independent pros; trades are read from the job title. For team or client roles, add candidates on the search page.</p>
        <RecruitingIntake trades={TRADES.map((x) => ({ id: x.id, label: x.label }))} />
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-bold">Connect Indeed Apply (automatic)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
          <li>Ask Indeed (your account rep or Indeed's integrations team) to turn on <b>Indeed Apply</b> for your jobs and deliver applications to <span className="select-all font-mono text-xs text-ink">{site}/api/indeed/apply</span>.</li>
          <li>They give you an API secret: add it in Vercel as <code>INDEED_API_SECRET</code> and redeploy. This page then shows “Connected”.</li>
          <li>Give each job the <b>jobMeta</b> from its kit (e.g. <code>opening=pro:cleaning</code>) so applications land in the right pipeline. Without it, trades are read from the job title and the applicant goes to the pro pipeline.</li>
        </ol>
        <p className="text-xs text-ink-soft">Every Indeed Apply application is signature-checked and de-duplicated, gets a confirmation email, and its résumé is kept in private storage. Questions about a candidate? Open them from <Link href="/hub/recruiting/pipeline" className="underline">Pipeline</Link>.</p>
      </section>
    </div>
  );
}
