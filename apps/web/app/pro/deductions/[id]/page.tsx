/*
 * FILE    : apps/web/app/pro/deductions/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0120 UTC
 * PURPOSE : Pro portal → one proposed deduction: what, why, the deadline, the pro's response and
 *           the decision. Nothing is taken until a person decides (pro agreement §17).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { adminClient } from "@/lib/supabase/server";
import { DeductionResponse } from "@/components/Deductions";
import type { Deduction } from "@/lib/deductions";

export const dynamic = "force-dynamic";

export default async function DeductionPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const { data } = await adminClient().from("pro_deductions").select("*, jobs(ref)").eq("id", (await params).id).eq("contractor_id", v.contractorId).maybeSingle();
  const d = data as (Deduction & { jobs: { ref: string } | null }) | null;
  if (!d) notFound();
  const es = (await getLocale()) === "es";
  const dl = es ? "es-US" : "en-US";
  const when = (iso: string) => new Date(iso).toLocaleString(dl, { dateStyle: "long", timeStyle: "short" });
  const status = { proposed: es ? "Propuesta — no se ha descontado nada" : "Proposed — nothing has been taken", upheld: es ? "Confirmada" : "Upheld", waived: es ? "Anulada — no se descuenta nada" : "Waived — nothing taken" }[d.status];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/pro/earnings" className="text-sm text-brand">← {es ? "Ganancias" : "Earnings"}</Link>
      <div className="card">
        <div className="text-sm text-ink-soft">{d.jobs?.ref ?? ""} · {status}</div>
        <h1 className="mt-1 text-2xl font-bold">{es ? "Deducción propuesta" : "Proposed deduction"}: {money(Number(d.amount))}</h1>
        <p className="mt-2 text-sm">{d.reason}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>{es ? `Puede responder hasta el ${when(d.respond_by)}. Una persona lo revisa y decide.` : `You can respond until ${when(d.respond_by)}. A person reviews it and decides.`}</li>
          <li>{es ? "Si se confirma, nunca se descuenta más de la mitad de un pago semanal y nunca de las propinas." : "If upheld, it never takes more than half of a weekly payout and never comes from tips."}</li>
          <li>{es ? "Puede apelar la decisión dentro de 14 días." : "You can appeal the decision within 14 days."}</li>
        </ul>
      </div>
      {d.pro_response && <div className="card text-sm"><div className="font-semibold">{es ? "Su respuesta" : "Your response"} · {when(d.responded_at!)}</div><p className="mt-1 whitespace-pre-line text-ink-soft">{d.pro_response}</p></div>}
      {d.status === "proposed" && !d.pro_response && <DeductionResponse id={d.id} es={es} />}
      {d.decided_at && <div className="card text-sm"><div className="font-semibold">{es ? "Decisión" : "Decision"} · {when(d.decided_at)}</div><p className="mt-1 text-ink-soft">{status}{d.decision_note ? ` — ${d.decision_note}` : ""}</p></div>}
    </div>
  );
}
