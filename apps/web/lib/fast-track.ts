/*
 * FILE    : apps/web/lib/fast-track.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Proven-skill fast track (rules in core crew.ts → FAST_TRACK):
 *             applyFastTrack   — the pro sends years in the trade, a short summary, references and
 *                                3–10 photos of past work
 *             decideFastTrack  — staff: start the trial (their next finished job is reviewed by hand,
 *                                see runQa in jobs.ts), approve (tier_floor = Pro+) or decline (with a reason;
 *                                they keep working and earn tiers the normal way)
 */
import "server-only";
import { FAST_TRACK, PRO_TIERS, fastTrackProblem } from "@handled/core";
import { adminClient } from "./supabase/server";
import { raiseAlert } from "./jobs";
import { notify } from "./push";
import { siteUrl } from "./notify";

const db = () => adminClient();
type R = { ok: true } | { ok: false; error: string };
const PLUS = PRO_TIERS.find((t) => t.id === FAST_TRACK.tier)!;
const BOOST = `+${Math.round(PLUS.payoutBoost * 100)}%`;

export interface FastTrackApplication { years: number; summary: string; references: string; trades: string[]; photos: string[] }

export async function applyFastTrack(contractorId: string, a: FastTrackApplication): Promise<R> {
  const { data: c } = await db().from("contractors").select("business_name, trades, fast_track_status, tier_floor").eq("id", contractorId).single();
  if (!c) return { ok: false, error: "Pro not found" };
  if (c.tier_floor || ["applied", "trial", "approved"].includes(c.fast_track_status)) return { ok: false, error: "You’ve already applied" };
  const photos = a.photos.filter((p) => p.startsWith(`pro/${contractorId}/`));
  const problem = fastTrackProblem({ years: a.years, photos: photos.length, summary: a.summary });
  if (problem) return { ok: false, error: problem };
  const trades = a.trades.filter((t) => (c.trades as string[]).includes(t));
  await db().from("contractors").update({
    fast_track_status: "applied", fast_track_applied_at: new Date().toISOString(), fast_track_trial_job_id: null, fast_track_note: null,
    fast_track: { years: a.years, summary: a.summary.trim(), references: a.references.trim(), trades, photos },
  }).eq("id", contractorId);
  await raiseAlert("recruiting", "info", `Fast-track application: ${c.business_name}`, `${a.years} years · ${photos.length} portfolio photos. Review in Hub → Pros → ${c.business_name} → Fast track, then start their trial job or decline with a reason.`);
  return { ok: true };
}

export async function decideFastTrack(contractorId: string, action: "trial" | "approve" | "decline", note: string | null, actor: string): Promise<R> {
  const { data: c } = await db().from("contractors").select("profile_id, email, fast_track_status, fast_track_trial_job_id").eq("id", contractorId).single();
  if (!c) return { ok: false, error: "Pro not found" };
  const now = new Date().toISOString();
  if (action === "trial") {
    if (c.fast_track_status !== "applied") return { ok: false, error: "Only a new application can start a trial" };
    await db().from("contractors").update({ fast_track_status: "trial", fast_track_trial_job_id: null, fast_track_note: note }).eq("id", contractorId);
    await notify(c.profile_id, {
      title: "Fast track: your trial job is next", body: "Your portfolio looks great. The next job you finish is your trial: we review it by hand, then decide on Pro+.", data: { type: "onboarding" },
      email: { to: c.email, subject: "Fast track: your trial job is next", text: `Your portfolio looks great. The next job you finish on ${siteUrl()} is your trial job: it's paid like any other job, and we review the photos and call the customer. If it's to the standard you showed us (${FAST_TRACK.trialMinRating}★ or better), you start at Pro+.` },
      es: { title: "Vía rápida: su trabajo de prueba es el siguiente", body: "Su portafolio se ve muy bien. El próximo trabajo que termine es su prueba: lo revisamos personalmente y luego decidimos sobre Pro+.",
        subject: "Vía rápida: su trabajo de prueba es el siguiente", text: `Su portafolio se ve muy bien. El próximo trabajo que termine es su trabajo de prueba: se paga como cualquier otro, y nosotros revisamos las fotos y llamamos al cliente. Si cumple con el nivel que nos mostró (${FAST_TRACK.trialMinRating}★ o más), empieza en Pro+.` },
    });
    return { ok: true };
  }
  if (action === "approve") {
    if (c.fast_track_status !== "trial" || !c.fast_track_trial_job_id) return { ok: false, error: "Approve after their trial job is done" };
    await db().from("contractors").update({ fast_track_status: "approved", tier_floor: FAST_TRACK.tier, fast_track_decided_at: now, fast_track_decided_by: actor, fast_track_note: note }).eq("id", contractorId);
    await notify(c.profile_id, {
      title: "Welcome to Pro+ ★", body: `Your trial job passed. You now earn ${BOOST} on every payout and see offers earlier.`, data: { type: "onboarding" },
      email: { to: c.email, subject: "Welcome to Pro+ ★", text: `Your trial job passed our review. You're now a Pro+ pro: ${BOOST} of the job price on every payout, and you're ranked ahead for offers. Pro+ stays yours while your rating and on-time numbers stay at Pro+ level.` },
      es: { title: "Bienvenido a Pro+ ★", body: `Su trabajo de prueba fue aprobado. Ahora gana ${BOOST} en cada pago y ve las ofertas antes.`,
        subject: "Bienvenido a Pro+ ★", text: `Su trabajo de prueba pasó nuestra revisión. Ahora es un profesional Pro+: ${BOOST} del precio del trabajo en cada pago, y tiene prioridad para recibir ofertas. Pro+ se mantiene mientras su calificación y su puntualidad se mantengan al nivel de Pro+.` },
    });
    return { ok: true };
  }
  if (!note || note.trim().length < 5) return { ok: false, error: "Give the pro a reason" };
  await db().from("contractors").update({ fast_track_status: "declined", fast_track_decided_at: now, fast_track_decided_by: actor, fast_track_note: note }).eq("id", contractorId);
  await notify(c.profile_id, {
    title: "Fast track: not this time", body: "You keep working and earn Pro+ the normal way. Tap to see why.", data: { type: "onboarding" },
    email: { to: c.email, subject: "Your fast-track application", text: `Thanks for applying for the fast track. We're not approving it this time: ${note}\n\nNothing else changes: you keep getting offers and move up to Pro+ the normal way (${PLUS.min.jobs} jobs, ${PLUS.min.rating}★, ${Math.round(PLUS.min.onTime * 100)}% on time).` },
    es: { title: "Vía rápida: esta vez no", body: "Sigue trabajando y llega a Pro+ de la forma normal. Toque para ver por qué.",
      subject: "Su solicitud de vía rápida", text: `Gracias por solicitar la vía rápida. Esta vez no la aprobamos: ${note}\n\nNo cambia nada más: sigue recibiendo ofertas y sube a Pro+ de la forma normal (${PLUS.min.jobs} trabajos, ${PLUS.min.rating}★, ${Math.round(PLUS.min.onTime * 100)}% de puntualidad).` },
  });
  return { ok: true };
}
