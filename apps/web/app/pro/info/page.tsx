/*
 * FILE    : apps/web/app/pro/info/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2300 UTC
 * PURPOSE : Pro portal → My info: everything Handled has on file for this pro in one place — profile, trades and
 *           area, where they are on the way to approval, documents and expiry dates, payout, contracts, orientation
 *           and referral code. Read-only; each section links to where it's changed.
 */
import Link from "next/link";
import { TRADES, onboardingChecklist, orientationStatus, specialtiesFor, type Contractor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { adminClient } from "@/lib/supabase/server";
import { partnerFor } from "@/lib/partners";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const DOC: Record<string, [string, string]> = {
  w9: ["W-9", "W-9"], coi: ["Insurance certificate", "Certificado de seguro"], license: ["Trade license", "Licencia del oficio"],
  background: ["Background check", "Verificación de antecedentes"], agreement: ["Agreement", "Acuerdo"], resume: ["Resume", "Currículum"],
  photo: ["Profile photo", "Foto de perfil"], other: ["Other", "Otro"],
};

export default async function MyInfo() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  const db = adminClient();
  const [{ data }, { data: docs }, partner] = await Promise.all([
    db.from("contractors").select("*").eq("id", v.contractorId).single(),
    db.from("contractor_documents").select("id, kind, status, expires_on, created_at").eq("contractor_id", v.contractorId).order("created_at", { ascending: false }).limit(50),
    partnerFor(v).catch(() => null),
  ]);
  const c = data as (Contractor & Record<string, unknown>) | null;
  if (!c) return null;
  const { steps, complete } = onboardingChecklist(c as never);
  const left = steps.filter((s) => !s.done);
  const o = orientationStatus(c.orientation as Record<string, string> | null);
  const tradeName = (id: string) => TRADES.find((t) => t.id === id)?.label ?? id;
  const specs = specialtiesFor(c.trades ?? []).filter((s) => (c.specialties ?? []).includes(s.id)).map((s) => s.label);
  const approved = c.status === "approved";
  const statusText = approved ? (es ? "Aprobado: recibe ofertas" : "Approved: getting offers")
    : complete ? (es ? "Todo listo: esperando la aprobación de Handled" : "All set: waiting for Handled's approval")
    : (es ? `En configuración: faltan ${left.length} paso(s)` : `In setup: ${left.length} step(s) left`);
  const Row = ({ k, v: val }: { k: string; v: React.ReactNode }) => <div className="flex flex-wrap justify-between gap-2 border-t border-line py-2 first:border-0"><span className="text-ink-soft">{k}</span><span className="text-right font-medium">{val || "—"}</span></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">🪪 {es ? "Mi información" : "My info"}</h1>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{es ? "Estado" : "Status"}</h2><Badge tone={approved ? "green" : complete ? "brand" : "amber"}>{statusText}</Badge></div>
        {!approved && <p className="mt-2 text-sm text-ink-soft">{es
          ? "Antes de trabajos pagados: su currículum, su identificación verificada, la orientación y los demás pasos, y luego la aprobación de una persona de Handled."
          : "Before paid work: your resume, a verified ID, the orientation and the other steps, then approval by a person at Handled."}</p>}
        {left.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{left.map((s) => <li key={s.key}><Link className="text-brand underline" href={s.key === "orientation" ? "/pro/welcome" : `/pro/onboarding#step-${s.key}`}>{s.label}</Link></li>)}</ul>}
      </section>

      <section className="card text-sm">
        <div className="mb-1 flex justify-between"><h2 className="font-bold">{es ? "Perfil" : "Profile"}</h2><Link href="/pro/onboarding" className="text-brand underline">{es ? "Cambiar" : "Edit"}</Link></div>
        <Row k={es ? "Negocio" : "Business"} v={c.business_name} />
        <Row k={es ? "Nombre" : "Name"} v={c.contact_name} />
        <Row k={es ? "Correo" : "Email"} v={c.email} />
        <Row k={es ? "Celular" : "Mobile"} v={c.phone} />
        {c.pro_no ? <Row k={es ? "ID de profesional" : "Pro ID"} v={String(c.pro_no)} /> : null}
        <Row k={es ? "Oficios" : "Trades"} v={(c.trades ?? []).map(tradeName).join(", ")} />
        <Row k={es ? "Especialidades" : "Specialties"} v={specs.join(", ")} />
        <Row k={es ? "Zona" : "Area"} v={c.base_zip ? `${c.base_city ?? ""} ${c.base_zip} · ${c.zips_only && c.service_zips?.length ? c.service_zips.join(", ") : `${c.service_radius_mi ?? 25} mi`}` : ""} />
      </section>

      <section className="card text-sm">
        <div className="mb-1 flex justify-between"><h2 className="font-bold">{es ? "Documentos y vencimientos" : "Documents and expiry dates"}</h2><Link href="/pro/onboarding" className="text-brand underline">{es ? "Subir" : "Upload"}</Link></div>
        <Row k={es ? "Seguro (responsabilidad civil)" : "Insurance (general liability)"} v={c.insured_until ? `${es ? "hasta" : "until"} ${c.insured_until}` : ""} />
        {c.license_number ? <Row k={es ? "Licencia" : "License"} v={`#${c.license_number}${c.license_expires ? ` · ${es ? "hasta" : "until"} ${c.license_expires}` : ""}`} /> : null}
        <Row k={es ? "Identificación con foto" : "Photo ID"} v={c.id_verified_at ? `${es ? "verificada" : "verified"} ${String(c.id_verified_at).slice(0, 10)}` : ""} />
        <Row k={es ? "Antecedentes" : "Background check"} v={c.background_checked ? (es ? "aprobado" : "cleared") : ""} />
        <Row k={es ? "Pago" : "Payout"} v={c.payout_method ? String(c.payout_method).toUpperCase() : ""} />
        {(docs ?? []).length > 0 && <div className="mt-3 space-y-1">{(docs as { id: string; kind: string; status: string; expires_on: string | null; created_at: string }[]).map((d) => (
          <div key={d.id} className="flex flex-wrap justify-between gap-2 text-xs"><span>{(DOC[d.kind] ?? [d.kind, d.kind])[es ? 1 : 0]} · {d.created_at.slice(0, 10)}{d.expires_on ? ` · ${es ? "vence" : "expires"} ${d.expires_on}` : ""}</span>
            <Badge tone={d.status === "verified" ? "green" : d.status === "rejected" || d.status === "expired" ? "red" : "amber"}>{d.status}</Badge></div>
        ))}</div>}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/pro/welcome" className="card block hover:border-brand"><b>👋 {es ? "Orientación" : "Orientation"}</b><div className="text-sm text-ink-soft">{o.done}/{o.total} {es ? "lecciones" : "lessons"}</div></Link>
        <Link href="/pro/contracts" className="card block hover:border-brand"><b>📜 {es ? "Mis contratos" : "My contracts"}</b><div className="text-sm text-ink-soft">{c.agreement_signed_at ? `${es ? "firmado" : "signed"} ${String(c.agreement_signed_at).slice(0, 10)}` : (es ? "sin firmar" : "not signed")}</div></Link>
        <Link href="/pro/refer" className="card block hover:border-brand"><b>💸 {es ? "Referir y ganar" : "Refer & earn"}</b><div className="text-sm text-ink-soft">{partner ? `${es ? "código" : "code"} ${partner.code}` : (es ? "empiece hoy" : "start today")}</div></Link>
      </section>
    </div>
  );
}
