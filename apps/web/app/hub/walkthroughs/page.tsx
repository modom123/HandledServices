/*
 * FILE    : apps/web/app/hub/walkthroughs/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Handled Hub → Walkthroughs: free walkthroughs and calls businesses booked themselves (/walkthrough).
 * UPDATED : 2026-11-18_0015 UTC — trimmed: one list (coming up, plus past ones still open), each with Done / No-show / Cancel;
 *           two numbers; booking hours folded away.
 */
import Link from "next/link";
import { WALKTHROUGH_KINDS, walkthroughWhen, type WalkthroughKind } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getWalkthroughSettings } from "@/lib/walkthroughs";
import { WalkthroughRowActions, WalkthroughSettingsForm } from "@/components/WalkthroughAdmin";

export const dynamic = "force-dynamic";
type W = { id: string; kind: WalkthroughKind; starts_at: string; status: string; name: string; company: string; email: string; phone: string | null; address: string | null; city: string | null; needs: string | null; biz_lead_id: string | null };

export default async function Walkthroughs() {
  const db = adminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [s, { data, error }] = await Promise.all([getWalkthroughSettings(), db.from("walkthroughs").select("*").gte("starts_at", since).order("starts_at").limit(500)]);
  if (error) return <div className="card text-sm">Walkthroughs aren’t set up yet. Run <code>supabase/setup/ADD_WALKTHROUGHS_2026-11-17_2350.sql</code> in Supabase → SQL Editor.</div>;
  const all = (data ?? []) as W[];
  const open = all.filter((w) => w.status === "booked");
  const held = all.filter((w) => w.status === "done").length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Walkthroughs</h1>
        <p className="text-sm text-ink-soft">{open.length} coming up · {held} done in the last 30 days. Press <b>Done</b> after each visit; it emails them the link to order.</p>
      </div>
      {open.length ? (
        <div className="card divide-y divide-line p-0">
          {open.map((w) => {
            const past = new Date(w.starts_at).getTime() < Date.now();
            return (
              <div key={w.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="text-sm">
                  <div className={`font-semibold ${past ? "text-amber-800" : ""}`}>{walkthroughWhen(w.starts_at, s.time_zone).replace(/ \(.*\)$/, "")}{past ? " · close this out" : ""}</div>
                  <div>{w.company}{w.biz_lead_id && <Link href={`/hub/biz-leads/${w.biz_lead_id}`} className="ml-1 text-xs text-brand underline">lead</Link>} · {w.name} · {w.phone ? <a href={`tel:${w.phone}`} className="underline">{w.phone}</a> : <a href={`mailto:${w.email}`} className="underline">{w.email}</a>}</div>
                  <div className="text-xs text-ink-soft">{w.kind === "onsite" && w.address ? <a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(w.address)}`}>{[w.address, w.city].filter(Boolean).join(", ")}</a> : WALKTHROUGH_KINDS[w.kind].label}{w.needs ? ` · “${w.needs}”` : ""}</div>
                </div>
                <WalkthroughRowActions id={w.id} />
              </div>
            );
          })}
        </div>
      ) : <p className="card text-sm text-ink-soft">Nothing booked yet. Send a business <a href="/business/property-managers" target="_blank" className="underline">its page</a>, or the link <code>/walkthrough</code>.</p>}
      <details className="card"><summary className="cursor-pointer font-semibold">Booking hours</summary><div className="mt-3"><WalkthroughSettingsForm s={s} /></div></details>
    </div>
  );
}
