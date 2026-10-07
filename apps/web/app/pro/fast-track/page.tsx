/*
 * FILE    : apps/web/app/pro/fast-track/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Pro portal → Fast track. For pros who are already masters of their trade: send a portfolio,
 *           do one paid trial job we review by hand, and start at Pro+ instead of working up from Pro.
 *           Shows where their application stands. English and Spanish.
 */
import Link from "next/link";
import { FAST_TRACK, PRO_TIERS, proTier, type Contractor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { FastTrackApply } from "@/components/FastTrack";

export default async function FastTrackPage() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  const { data } = await v.db.from("contractors").select("*").eq("id", v.contractorId).single();
  const me = data as Contractor & { fast_track_note?: string | null };
  const plus = PRO_TIERS.find((t) => t.id === FAST_TRACK.tier)!;
  const boost = `+${Math.round(plus.payoutBoost * 100)}%`;
  const st = me.fast_track_status ?? "none";
  const steps = es
    ? [`Envíe de ${FAST_TRACK.minPhotos} a ${FAST_TRACK.maxPhotos} fotos de su trabajo y cuéntenos su experiencia (${FAST_TRACK.minYears}+ años en el oficio).`, "Revisamos su portafolio, normalmente en 2 días hábiles.", `Su siguiente trabajo es su prueba: se paga normal, y nosotros revisamos las fotos y llamamos al cliente (${FAST_TRACK.trialMinRating}★ o más).`, `Si pasa, empieza en Pro+: ${boost} del precio del trabajo en cada pago, ofertas antes que el nivel Pro, y sin el límite de tamaño del período de prueba.`]
    : [`Send ${FAST_TRACK.minPhotos}–${FAST_TRACK.maxPhotos} photos of your work and tell us about your experience (${FAST_TRACK.minYears}+ years in the trade).`, "We review your portfolio, usually within 2 business days.", `Your next job is your trial: paid as usual, and we review the photos and call the customer (${FAST_TRACK.trialMinRating}★ or better).`, `Pass, and you start at Pro+: ${boost} of the job price on every payout, offers before Pro-tier pros, and no probation job-size limit.`];
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{es ? "Vía rápida a Pro+" : "Fast track to Pro+"}</h1>
        <p className="mt-1 text-sm text-ink-soft">{es
          ? `¿Lleva años dominando su oficio? No tiene que empezar desde cero. Normalmente Pro+ se gana con ${plus.min.jobs} trabajos; con la vía rápida, su experiencia lo demuestra desde el principio.`
          : `Been mastering your trade for years? You don’t have to start from zero. Pro+ normally takes ${plus.min.jobs} jobs; the fast track lets your experience prove it up front.`}</p>
      </div>
      <ol className="card list-decimal space-y-1 pl-8 text-sm">{steps.map((x) => <li key={x}>{x}</li>)}</ol>
      {proTier(me).id !== "pro" || st === "approved" ? (
        <div className="card bg-brand-tint text-sm text-brand-dark">{es ? `Ya es ${proTier(me).name}. ` : `You’re already ${proTier(me).name}. `}<Link href="/pro" className="underline">{es ? "Volver a trabajos" : "Back to jobs"}</Link></div>
      ) : st === "applied" ? (
        <div className="card text-sm">{es ? "Recibimos su solicitud. Estamos revisando su portafolio y le avisaremos por correo y en la aplicación." : "We have your application. We’re reviewing your portfolio and will let you know by email and in the app."}</div>
      ) : st === "trial" ? (
        <div className="card text-sm">{es ? "¡Su portafolio pasó! El próximo trabajo que termine es su trabajo de prueba. Hágalo como siempre y tome buenas fotos al terminar." : "Your portfolio passed! The next job you finish is your trial job. Do it like you always do and take good photos at the end."}{me.fast_track_note ? <p className="mt-2 text-ink-soft">{me.fast_track_note}</p> : null}</div>
      ) : st === "declined" ? (
        <div className="card text-sm">{es ? "Esta vez no aprobamos la vía rápida: " : "We didn’t approve the fast track this time: "}<b>{me.fast_track_note}</b>{es ? ` Sigue recibiendo ofertas y llega a Pro+ de la forma normal.` : " You keep getting offers and reach Pro+ the normal way."}</div>
      ) : (
        <div className="card"><FastTrackApply es={es} trades={me.trades} /></div>
      )}
    </div>
  );
}
