/*
 * FILE    : apps/web/app/hub/recruiting/openings/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Hub → Recruiting → Openings: every role we're filling, by track — independent pros (set by supply gaps and the
 *           trades we always recruit), the Handled team (our own staff roles) and client roles (Handled Talent searches).
 *           Each shows why it's open, how many we need, candidates so far and whether it's on Indeed, with links to post it
 *           and to its pipeline. New team roles are created here; client searches are created in Client searches.
 */
import Link from "next/link";
import { TRACK_ICON, TRACK_LABEL, type Track } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { openings } from "@/lib/recruiting-division";
import { NewRoleForm } from "@/components/RecruitingDivision";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

export default async function Openings() {
  const v = await getViewer();
  if (!v) return null;
  const ops = await openings();
  const tracks: { t: Track; blurb: string; add?: React.ReactNode }[] = [
    { t: "pro", blurb: "Independent pros (1099) for our network. A trade opens when Supply gaps shows we're short, and the trades we market most are always open." },
    { t: "staff", blurb: "People who work for Handled. Runs on the same pipeline as client searches, with no fees." },
    { t: "client", blurb: "Roles we fill for client companies (Handled Talent). New client searches start in Client searches.", add: <Link href="/hub/talent" className="btn-ghost text-sm">+ New client search</Link> },
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Openings</h1>
        <p className="text-sm text-ink-soft">Every role we're filling, top to bottom. Post each one on Indeed from the Indeed tab — applicants come back into the right pipeline on their own.</p>
      </div>
      {tracks.map(({ t, blurb, add }) => {
        const list = ops.filter((o) => o.track === t);
        return (
          <section key={t} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-lg font-bold">{TRACK_ICON[t]} {TRACK_LABEL[t]} <span className="text-sm font-normal text-ink-soft">({list.length})</span></h2><p className="text-sm text-ink-soft">{blurb}</p></div>
              {add}
            </div>
            {!list.length && <p className="card text-sm text-ink-soft">{t === "staff" ? "No open team roles. Create one below." : "None open."}</p>}
            <div className="space-y-2">
              {list.map((o) => (
                <div key={o.key} className={`card flex flex-wrap items-center justify-between gap-3 text-sm ${o.paused ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <div className="font-semibold">{o.title} {o.paused && <span className="ml-1 rounded-full bg-paper px-2 py-0.5 text-xs font-normal">paused</span>} {o.track !== "pro" && !o.isPublic && <span className="ml-1 rounded-full bg-paper px-2 py-0.5 text-xs font-normal">not on careers page</span>}</div>
                    <div className="text-xs text-ink-soft">{o.location} · {o.reason}{o.needed ? ` · ${o.needed} needed` : ""} · {o.candidates} candidate{o.candidates === 1 ? "" : "s"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.indeedUrl ? <a href={o.indeedUrl} target="_blank" rel="noreferrer" className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand-dark">✓ On Indeed {fmtDate(o.postedAt)}</a>
                      : o.postedAt ? <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand-dark">✓ Posted {fmtDate(o.postedAt)}</span>
                      : <Link href={`/hub/recruiting/indeed#${encodeURIComponent(o.key)}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">📣 Post on Indeed</Link>}
                    <Link href={o.track === "pro" ? "/hub/recruiting/pipeline" : `/hub/talent/${o.searchId}`} className="btn-ghost px-3 py-1 text-xs">Pipeline →</Link>
                  </div>
                </div>
              ))}
            </div>
            {t === "staff" && <details><summary className="btn-primary inline-flex cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">＋ New team role</summary><div className="mt-3 max-w-3xl"><NewRoleForm /></div></details>}
          </section>
        );
      })}
    </div>
  );
}
