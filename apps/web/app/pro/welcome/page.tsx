/*
 * FILE    : apps/web/app/pro/welcome/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2300 UTC
 * PURPOSE : "Welcome to Handled": the orientation every new pro finishes before Handled can approve them. Six short
 *           lessons with a question each (core orientation.ts), progress, and what's next once it's done.
 */
import Link from "next/link";
import { ORIENTATION, ORIENTATION_MINUTES, orientationStatus, type Contractor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function Welcome() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  const { data } = await v.db.from("contractors").select("*").eq("id", v.contractorId).single();
  const me = data as (Contractor & { orientation?: Record<string, string> | null }) | null;
  const progress = me?.orientation ?? {};
  const s = orientationStatus(progress);
  const pct = Math.round((s.done / s.total) * 100);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{es ? `Bienvenido a Handled, ${me?.contact_name?.split(" ")[0] ?? ""} 👋` : `Welcome to Handled, ${me?.contact_name?.split(" ")[0] ?? ""} 👋`}</h1>
        <p className="mt-1 text-sm text-ink-soft">{es
          ? `Seis lecciones cortas sobre cómo trabajamos (unos ${ORIENTATION_MINUTES} minutos). Cada una termina con una pregunta. Terminarlas es obligatorio antes de que Handled lo apruebe para trabajos pagados.`
          : `Six short lessons on how we work (about ${ORIENTATION_MINUTES} minutes). Each ends with one question. Finishing them is required before Handled can approve you for paid work.`}</p>
      </div>
      <div className="card">
        <div className="flex items-center justify-between text-sm"><b>{es ? `${s.done} de ${s.total} lecciones` : `${s.done} of ${s.total} lessons`}</b><span className="text-ink-soft">{pct}%</span></div>
        <div className="mt-2 h-2 rounded-full bg-paper"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
        {s.complete
          ? <p className="mt-3 text-sm">✅ {es ? "¡Terminó la orientación! Siga con su configuración." : "Orientation complete! Keep going with your setup."} <Link href="/pro/onboarding" className="font-semibold text-brand underline">{es ? "Configuración y documentos →" : "Setup & documents →"}</Link></p>
          : s.next && <Link href={`/pro/welcome/${s.next.id}`} className="btn-primary mt-3 inline-block">{s.done ? (es ? "Continuar →" : "Continue →") : (es ? "Empezar →" : "Start →")}</Link>}
      </div>
      <ol className="space-y-2">
        {ORIENTATION.map((l, i) => {
          const done = Boolean(progress[l.id]);
          return (
            <li key={l.id}><Link href={`/pro/welcome/${l.id}`} className={`card flex items-center justify-between gap-3 hover:border-brand ${done ? "border-brand/40" : ""}`}>
              <span><span className="mr-2">{done ? "✅" : l.icon}</span><b>{i + 1}. {(es ? l.es : l.en).title}</b></span>
              <span className="text-xs text-ink-soft">{done ? (es ? "terminada" : "done") : `${l.minutes} min`}</span>
            </Link></li>
          );
        })}
      </ol>
      <Link href="/pro/refer" className="card block border-gold/60 hover:border-brand">
        <b>💸 {es ? "Gane dinero mientras espera" : "Make money while you wait"}</b>
        <p className="mt-1 text-sm text-ink-soft">{es ? "Tome fotos de un trabajo que alguien necesita, llene un ticket y cobre cuando se haga. Vea cómo →" : "Snap photos of a job someone needs, fill out a ticket, and get paid when it's done. See how →"}</p>
      </Link>
    </div>
  );
}
