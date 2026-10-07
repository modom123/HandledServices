/*
 * FILE    : apps/web/lib/deductions.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0119 UTC
 * PURPOSE : Charging a pro for a workmanship refund or a lost chargeback — only the way the pro
 *           agreement (§17) promises:
 *             proposeDeduction — written notice with the reason, 3 business days to respond;
 *                                nothing is taken yet (the customer was already refunded from our share)
 *             respondToDeduction — the pro's side, in the portal
 *             decideDeduction  — a person upholds or waives it after the pro responded or the
 *                                deadline passed; upheld = the unpaid payout is reduced, or a
 *                                clawback row is created (paid out at most half a run at a time, never tips)
 */
import "server-only";
import { BRAND, money, respondBy } from "@handled/core";
import { adminClient } from "./supabase/server";
import { raiseAlert, addEvent } from "./jobs";
import { notify } from "./push";
import { siteUrl } from "./notify";

const db = () => adminClient();

export interface Deduction {
  id: string; contractor_id: string; job_id: string | null; amount: number; reason: string; source: "refund" | "chargeback";
  status: "proposed" | "upheld" | "waived"; respond_by: string; pro_response: string | null; responded_at: string | null;
  decided_by: string | null; decided_at: string | null; decision_note: string | null; created_at: string;
}

export async function proposeDeduction(d: { contractorId: string; jobId: string | null; amount: number; reason: string; source: "refund" | "chargeback"; evidence?: string }) {
  const amount = Math.round(d.amount * 100) / 100;
  if (!(amount > 0)) return null;
  const by = respondBy();
  const { data, error } = await db().from("pro_deductions").insert({
    contractor_id: d.contractorId, job_id: d.jobId, amount, reason: d.reason, source: d.source, respond_by: by.toISOString(),
  }).select("*").single();
  if (error || !data) { console.error("[deduction]", error?.message); return null; }
  const { data: pro } = await db().from("contractors").select("profile_id, email").eq("id", d.contractorId).single();
  const { data: job } = d.jobId ? await db().from("jobs").select("ref").eq("id", d.jobId).single() : { data: null };
  const link = `${siteUrl()}/pro/deductions/${data.id}`;
  const day = by.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const dayEs = by.toLocaleDateString("es-US", { weekday: "long", month: "long", day: "numeric" });
  await notify(pro?.profile_id, {
    title: `Proposed deduction ${money(amount)}${job ? ` · ${job.ref}` : ""} — tell us your side`,
    body: `Nothing has been taken. Respond by ${day}.`,
    data: { type: "earnings" },
    email: pro?.email ? { to: pro.email, subject: `${BRAND.name}: proposed deduction of ${money(amount)}${job ? ` (${job.ref})` : ""} — please respond by ${day}`,
      text: `We're considering deducting ${money(amount)} from your pay${job ? ` for ${job.ref}` : ""}.\n\nWhy: ${d.reason}${d.evidence ? `\n\nWhat we have:\n${d.evidence}` : ""}\n\nNothing has been taken yet. You have until ${day} to tell us your side (photos, messages, anything that helps). A person reviews it and decides; you'll get the decision in writing. If it's upheld, it never takes more than half of a weekly payout and never comes from tips.\n\nRespond here: ${link}\n\n— ${BRAND.name}` } : null,
    es: {
      title: `Deducción propuesta de ${money(amount)}${job ? ` · ${job.ref}` : ""} — cuéntenos su versión`,
      body: `No se ha descontado nada. Responda antes del ${dayEs}.`,
      subject: `${BRAND.name}: deducción propuesta de ${money(amount)}${job ? ` (${job.ref})` : ""} — responda antes del ${dayEs}`,
      text: `Estamos considerando descontar ${money(amount)} de su pago${job ? ` por ${job.ref}` : ""}.\n\nMotivo: ${d.reason}${d.evidence ? `\n\nLo que tenemos:\n${d.evidence}` : ""}\n\nTodavía no se ha descontado nada. Tiene hasta el ${dayEs} para contarnos su versión (fotos, mensajes, lo que ayude). Una persona lo revisa y decide; recibirá la decisión por escrito. Si se confirma, nunca se descuenta más de la mitad de un pago semanal y nunca de las propinas.\n\nResponda aquí: ${link}\n\n— ${BRAND.name}`,
    },
  });
  await raiseAlert("deduction", "info", `Proposed deduction ${money(amount)}${job ? ` on ${job.ref}` : ""}`, `${d.reason}\nThe pro has until ${by.toISOString().slice(0, 16)} UTC to respond; decide in Hub → Finance after that (or once they reply).`, d.jobId);
  if (d.jobId) await addEvent(d.jobId, "deduction", `Proposed pro deduction ${money(amount)} (${d.source}) — notice sent, awaiting response.`, "system", false);
  return data as Deduction;
}

export async function respondToDeduction(id: string, contractorId: string, response: string) {
  const { data } = await db().from("pro_deductions").update({ pro_response: response.slice(0, 4000), responded_at: new Date().toISOString() })
    .eq("id", id).eq("contractor_id", contractorId).eq("status", "proposed").select("id, amount, job_id").maybeSingle();
  if (!data) return { ok: false, error: "This deduction can't be answered any more" };
  await raiseAlert("deduction", "warn", `Pro responded to a proposed deduction (${money(Number(data.amount))})`, `Decide in Hub → Finance.\n\n"${response.slice(0, 500)}"`, data.job_id);
  return { ok: true };
}

/** A person decides. Upheld before the deadline only if the pro already responded. */
export async function decideDeduction(id: string, decision: "upheld" | "waived", actor: string, note: string) {
  const { data: d } = await db().from("pro_deductions").select("*").eq("id", id).maybeSingle();
  const ded = d as Deduction | null;
  if (!ded || ded.status !== "proposed") return { ok: false, error: "Already decided" };
  if (decision === "upheld" && !ded.responded_at && new Date(ded.respond_by) > new Date()) return { ok: false, error: `The pro has until ${ded.respond_by.slice(0, 16).replace("T", " ")} UTC to respond` };
  await db().from("pro_deductions").update({ status: decision, decided_by: actor, decided_at: new Date().toISOString(), decision_note: note || null }).eq("id", id);

  // a chargeback hold on this job ends with the decision either way
  if (ded.job_id && ded.source === "chargeback") await db().from("payouts").update({ status: "approved" }).eq("job_id", ded.job_id).eq("status", "held").like("reason", "Chargeback%");

  let applied = 0;
  if (decision === "upheld") {
    // reduce the job's unpaid payout first; whatever was already paid becomes a clawback row
    const { data: rows } = ded.job_id ? await db().from("payouts").select("id, amount, status").eq("job_id", ded.job_id).eq("contractor_id", ded.contractor_id).eq("kind", "job").in("status", ["pending", "approved", "held"]) : { data: [] };
    let left = Number(ded.amount);
    for (const r of (rows ?? []) as { id: string; amount: number }[]) {
      if (left <= 0) break;
      const take = Math.min(left, Number(r.amount));
      await db().from("payouts").update({ amount: Math.round((Number(r.amount) - take) * 100) / 100, deduction_id: id }).eq("id", r.id);
      left = Math.round((left - take) * 100) / 100; applied += take;
    }
    if (left > 0) {
      await db().from("payouts").insert({ contractor_id: ded.contractor_id, job_id: ded.job_id, amount: -left, status: "clawback", kind: "clawback", reason: `Deduction: ${ded.reason}`.slice(0, 300), deduction_id: id });
      applied += left;
    }
  }
  const { data: pro } = await db().from("contractors").select("profile_id, email").eq("id", ded.contractor_id).single();
  const up = decision === "upheld";
  await notify(pro?.profile_id, {
    title: up ? `Deduction upheld: ${money(Number(ded.amount))}` : `Deduction waived — nothing taken`,
    body: up ? "It comes out of upcoming payouts, at most half of any week, never tips." : "We reviewed it and decided not to deduct anything.",
    data: { type: "earnings" },
    email: pro?.email ? { to: pro.email, subject: `${BRAND.name}: deduction ${up ? "upheld" : "waived"}`, text: `${up ? `After review we've upheld the deduction of ${money(Number(ded.amount))}. It comes out of upcoming payouts — never more than half of a weekly payout, never from tips.` : "After review we've decided not to deduct anything."}${note ? `\n\nWhy: ${note}` : ""}\n\nYou can appeal within 14 days by replying to this email or from ${siteUrl()}/pro/deductions/${id}.\n\n— ${BRAND.name}` } : null,
    es: { title: up ? `Deducción confirmada: ${money(Number(ded.amount))}` : "Deducción anulada — no se descuenta nada", body: up ? "Se descuenta de los próximos pagos, como máximo la mitad de cada semana, nunca de las propinas." : "La revisamos y decidimos no descontar nada.",
      subject: `${BRAND.name}: deducción ${up ? "confirmada" : "anulada"}`, text: `${up ? `Después de revisarla, confirmamos la deducción de ${money(Number(ded.amount))}. Se descuenta de los próximos pagos: nunca más de la mitad de un pago semanal y nunca de las propinas.` : "Después de revisarla, decidimos no descontar nada."}${note ? `\n\nMotivo: ${note}` : ""}\n\nPuede apelar dentro de 14 días respondiendo a este correo o desde ${siteUrl()}/pro/deductions/${id}.\n\n— ${BRAND.name}` },
  });
  if (ded.job_id) await addEvent(ded.job_id, "deduction", `Pro deduction ${decision} by ${actor}${up ? ` (${money(applied)})` : ""}.`, actor, false);
  return { ok: true, applied };
}
