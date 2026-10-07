/*
 * FILE    : apps/web/app/pro/crew/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Pro portal → My crew. A pro company lists the people it sends to jobs: sign the Crew
 *           Addendum, add crew (background check sent right away), see each check's status, remove
 *           people who leave. Whether the crew can be sent yet (workers' comp on file) is shown up top.
 */
import Link from "next/link";
import { crewReady, t as tr, TRADES, type Contractor, type CrewMember } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { listCrew } from "@/lib/crew";
import { CrewAdd, CrewRemove, CrewSign, roleLabel } from "@/components/Crew";

const BG: Record<CrewMember["background_status"], [string, string, string]> = {
  not_started: ["Not started", "No iniciada", "bg-paper text-ink-soft"],
  invited: ["Link sent: waiting on them", "Enlace enviado: esperando a la persona", "bg-amber-100 text-amber-800"],
  pending: ["In progress", "En proceso", "bg-amber-100 text-amber-800"],
  clear: ["Clear: can go to jobs", "Aprobada: puede ir a trabajos", "bg-emerald-100 text-emerald-800"],
  consider: ["Under review", "En revisión", "bg-rose-100 text-rose-800"],
  suspended: ["On hold", "En pausa", "bg-rose-100 text-rose-800"],
  canceled: ["Canceled", "Cancelada", "bg-paper text-ink-soft"],
};

export default async function CrewPage() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const l = await getLocale();
  const es = l === "es";
  const { data: me } = await v.db.from("contractors").select("*").eq("id", v.contractorId).single();
  const pro = me as Contractor;
  const crew = await listCrew(v.contractorId);
  const notReady = crewReady(pro);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{es ? "Mi equipo" : "My crew"}</h1>
        <p className="mt-1 text-sm text-ink-soft">{es
          ? "¿Tiene gente que trabaja con usted? Regístrela aquí para enviarla a trabajos de su empresa. Cada persona aprueba la misma verificación de antecedentes que usted antes de entrar a la casa de un cliente. Su equipo trabaja para su empresa: usted decide quién va, y su pago cubre todo el trabajo."
          : "Have people who work with you? List them here to send them on your company’s jobs. Each person passes the same background check you did before entering a customer’s home. Your crew works for your company: you decide who goes, and your payout covers the whole job."}</p>
      </div>

      {!pro.crew_attested_at ? (
        <div className="card space-y-3">
          <div className="font-semibold">{es ? "Paso 1: firme el Anexo de Equipo de Trabajo" : "Step 1: sign the Crew Addendum"}</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {(es
              ? ["Su equipo trabaja para su empresa: usted los dirige y les paga.", "Cada persona tiene permiso legal para trabajar en los EE. UU.; su empresa guarda su I-9.", "Seguro de accidentes laborales para su equipo antes de cualquier trabajo.", "Todos registrados y con verificación de antecedentes aprobada.", "Trabajo con licencia solo para quien tiene la licencia; los ayudantes nunca van solos."]
              : ["Your crew works for your company: you direct and pay them.", "Everyone is legally allowed to work in the U.S.; your company keeps their I-9.", "Workers’ comp for your crew before any job.", "Everyone listed and background-checked.", "Licensed work only to license holders; helpers never go alone."]).map((x) => <li key={x}>{x}</li>)}
          </ul>
          <CrewSign es={es} />
        </div>
      ) : (
        <>
          {notReady && <div className="card border-amber-300 bg-amber-50 text-sm">{es ? "Puede agregar a su equipo y empezar sus verificaciones ya. Para enviarlos a trabajos: " : "You can add your crew and start their checks now. To send them on jobs: "}<b>{notReady.includes("workers") ? (es ? "suba una póliza vigente de seguro de accidentes laborales (la declaración de que no tiene empleados no cubre a un equipo)" : notReady) : notReady}</b>. <Link href="/pro/onboarding" className="text-brand underline">{tr(l, "Setup & documents")}</Link></div>}
          <div className="card">
            <div className="font-semibold">{es ? `Su equipo (${crew.length})` : `Your crew (${crew.length})`}</div>
            {!crew.length && <p className="mt-2 text-sm text-ink-soft">{es ? "Todavía no hay nadie. Agregue a la primera persona abajo." : "No one yet. Add your first person below."}</p>}
            <ul className="mt-2 divide-y divide-line">
              {crew.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div><b>{m.full_name}</b> · {roleLabel(m.role, es)}{m.license_number ? ` · ${es ? "licencia" : "license"} ${m.license_number}` : ""}{m.years_experience ? ` · ${m.years_experience} ${es ? "años" : "yrs"}` : ""}
                    <div className="text-xs text-ink-soft">{m.trades.map((t) => tr(l, TRADES.find((x) => x.id === t)?.label ?? t)).join(", ")}{m.email ? ` · ${m.email}` : ""}</div></div>
                  <div className="flex items-center gap-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BG[m.background_status][2]}`}>{es ? BG[m.background_status][1] : BG[m.background_status][0]}</span><CrewRemove id={m.id} es={es} /></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card space-y-2">
            <div className="font-semibold">{es ? "Agregar a alguien" : "Add someone"}</div>
            <p className="text-xs text-ink-soft">{es ? "Le enviamos por correo un enlace seguro de nuestro proveedor de verificación (Checkr) para dar su consentimiento. Normalmente tarda de 1 a 3 días hábiles." : "We email them a secure link from our screening provider (Checkr) to consent. It usually takes 1–3 business days."}</p>
            <CrewAdd es={es} trades={pro.trades} />
          </div>
        </>
      )}
    </div>
  );
}
