/*
 * FILE    : apps/web/app/hub/recruiting/files/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1800 UTC
 * PURPOSE : One subcontractor's digital file, in one place and printable: photo, who they are, trades and skills, work
 *           area; identity (ID check), tax (W-9, masked), contracts they signed (with the exact version), insurance,
 *           coverages and licenses (status, expiry, the AI's read, open the file), résumé, background check and payout;
 *           what's missing and what's expiring; and every document version ever uploaded. Documents to verify can be
 *           verified right here. Everything comes from the pro's own setup (core onboardingChecklist) — no double entry.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRO_FILE_ITEMS, TRADES, onboardingChecklist, proFileStatus, type Contractor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { signedDocUrl } from "@/lib/photos";
import { proAcceptances } from "@/lib/contracts/records";
import { DocDecision } from "@/components/HubActions";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = { w9: "W-9", coi: "Insurance certificate (COI)", license: "Trade license", background: "Background report", agreement: "Signed agreement", auto: "Commercial auto", workers_comp: "Workers' comp", bond: "Bond", liquor: "Liquor liability", passenger_auto: "Passenger carrier auto", cargo: "Cargo insurance", certification: "Certification", skills: "Skills check", resume: "Résumé", photo: "Profile photo", other: "Other" };
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default async function ProFile({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = adminClient();
  const [{ data: c }, { data: docs }, signed] = await Promise.all([
    db.from("contractors").select("*").eq("id", id).maybeSingle(),
    db.from("contractor_documents").select("*").eq("contractor_id", id).order("created_at", { ascending: false }),
    proAcceptances(id).catch(() => []),
  ]);
  if (!c) notFound();
  const pro = c as Contractor & Record<string, unknown>;
  const { steps } = onboardingChecklist(pro as never);
  const file = proFileStatus(steps);
  type Doc = { id: string; kind: string; status: string; storage_path: string | null; expires_on: string | null; created_at: string; verified_by: string | null; ai_check: { meets_requirements?: boolean; problems?: string[] } | null };
  const all = (docs ?? []) as Doc[];
  const latest = (kind: string) => all.find((d) => d.kind === kind && d.storage_path);
  const [photoUrl, resumeUrl] = await Promise.all([latest("photo")?.storage_path ? signedDocUrl(latest("photo")!.storage_path!, 3600) : null, latest("resume")?.storage_path ? signedDocUrl(latest("resume")!.storage_path!, 3600) : null]);
  const step = (k: string) => steps.find((s) => s.key === k);
  const tradeName = (t: string) => TRADES.find((x) => x.id === t)?.label ?? t;
  const Row = ({ label, s, extra }: { label: string; s?: { done: boolean; detail?: string; expiring?: boolean; optional?: boolean }; extra?: React.ReactNode }) => (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line py-2 last:border-0">
      <div><div className="font-semibold">{label}</div>{s?.detail && <div className="text-xs text-ink-soft">{s.detail}</div>}{extra}</div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${!s ? "bg-paper text-ink-soft" : !s.done ? "bg-rose-50 text-rose-700" : s.expiring ? "bg-amber-50 text-amber-900" : "bg-brand-tint text-brand-dark"}`}>{!s ? "not needed" : !s.done ? (s.optional ? "optional" : "missing") : s.expiring ? "expiring soon" : "on file"}</span>
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/hub/recruiting/files" className="text-sm text-brand underline">← Pro files</Link>
        <div className="flex gap-2"><Link href={`/hub/pros/${id}`} className="btn-ghost text-sm">Pro record, jobs & pay →</Link><PrintButton /></div>
      </div>

      <section className="card flex flex-wrap items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photoUrl ? <img src={photoUrl} alt={`${String(pro.contact_name)}`} className="h-24 w-24 rounded-2xl object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-paper text-3xl">👤</div>}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{String(pro.business_name)}</h1>
          <div className="text-sm text-ink-soft">{String(pro.contact_name)}{pro.legal_name ? ` (legal: ${String(pro.legal_name)})` : ""} · {String(pro.email)} · {String(pro.phone ?? "")}</div>
          <div className="mt-1 text-sm">{(pro.trades ?? []).map(tradeName).join(" · ")}</div>
          <div className="text-xs text-ink-soft">{pro.status === "approved" ? `Live since ${fmt(pro.onboarded_at as string)}` : "In setup"} · {step("area")?.detail ?? ""}</div>
        </div>
        <div className="text-right"><div className={`text-4xl font-extrabold ${file.pct === 100 ? "text-brand" : file.pct < 60 ? "text-rose-700" : ""}`}>{file.pct}%</div><div className="text-xs text-ink-soft">file complete</div></div>
      </section>

      {(file.missing.length > 0 || file.expiring.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {file.missing.length > 0 && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Missing: <b>{file.missing.join(", ")}</b>. {pro.status === "vetting" ? "The pro gets daily reminders." : "The pro gets reminders."}</p>}
          {file.expiring.length > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Expiring within 30 days: <b>{file.expiring.join(", ")}</b>. The pro is reminded at 30 and 7 days; offers pause the day it lapses.</p>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card text-sm">
          <h2 className="mb-1 font-bold">Identity, tax & contracts</h2>
          <Row label="Photo ID" s={step("id")} />
          <Row label="W-9" s={step("w9")} extra={pro.tin_last4 ? <div className="text-xs text-ink-soft">{String(pro.entity_type ?? "")} · TIN •••{String(pro.tin_last4)}</div> : null} />
          <Row label="Independent contractor agreement" s={step("agreement")} />
          <Row label="Background check" s={step("background")} extra={pro.background_status ? <div className="text-xs text-ink-soft">Provider status: {String(pro.background_status)}</div> : null} />
          <Row label="Payout method" s={step("payout")} />
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Contracts signed ({signed.length})</div>
            <ul className="mt-1 space-y-1">{signed.slice(0, 12).map((a) => <li key={a.id}><Link href={`/hub/contracts/signed/${a.id}`} className="underline">{a.title}</Link> <span className="text-xs text-ink-soft">v{a.version} · {fmt(a.accepted_at)} · {a.method}</span></li>)}{!signed.length && <li className="text-ink-soft">None recorded yet.</li>}</ul>
          </div>
        </section>
        <section className="card text-sm">
          <h2 className="mb-1 font-bold">Insurance & licenses</h2>
          {steps.filter((s) => s.key === "coi" || s.key.startsWith("coverage:") || s.key === "license").map((s) => <Row key={s.key} label={s.label} s={s} />)}
          {!steps.some((s) => s.key === "license") && <Row label="Trade license" />}
          <h2 className="mb-1 mt-4 font-bold">Skills & experience</h2>
          <Row label="Skills (specialties)" s={step("specialties")} extra={pro.specialties?.length ? <div className="mt-1 flex flex-wrap gap-1">{pro.specialties.map((x: string) => <span key={x} className="rounded-full bg-paper px-2 py-0.5 text-xs">{x.replace(/_/g, " ")}</span>)}</div> : null} />
          <Row label="Résumé" s={step("resume")} extra={resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand underline">📄 Open résumé</a> : null} />
          <Row label="Profile photo" s={step("photo")} />
        </section>
      </div>

      <section className="card text-sm">
        <h2 className="font-bold">Every document on file ({all.length})</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft"><th className="py-2 pr-3">Document</th><th className="py-2 pr-3">Uploaded</th><th className="py-2 pr-3">Expires</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">AI read</th><th className="py-2"></th></tr></thead>
            <tbody>
              {!all.length && <tr><td colSpan={6} className="py-3 text-ink-soft">Nothing uploaded yet.</td></tr>}
              {all.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-medium">{DOC_LABEL[d.kind] ?? d.kind}</td>
                  <td className="py-2 pr-3">{fmt(d.created_at)}</td>
                  <td className="py-2 pr-3">{fmt(d.expires_on)}</td>
                  <td className="py-2 pr-3">{d.status}{d.verified_by ? <span className="text-xs text-ink-soft"> · {d.verified_by}</span> : null}</td>
                  <td className="py-2 pr-3 text-xs">{d.ai_check ? (d.ai_check.meets_requirements ? "✓ meets requirements" : `⚠ ${d.ai_check.problems?.join("; ") || "check"}`) : "—"}</td>
                  <td className="py-2 print:hidden">{d.storage_path && d.status === "pending" ? <DocDecision contractorId={id} docId={d.id} /> : d.storage_path ? <a className="text-xs underline" href={`/api/hub/contractors/${id}/documents/${d.id}`} target="_blank" rel="noreferrer">Open</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-ink-soft">File items: {PRO_FILE_ITEMS.map((it) => it.label).join(" · ")}. Pros add and update everything from their phone (Pro portal → Setup); staff verify here.</p>
    </div>
  );
}
