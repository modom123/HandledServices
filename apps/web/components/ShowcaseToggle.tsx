"use client";
/*
 * FILE    : apps/web/components/ShowcaseToggle.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_2000 UTC
 * PURPOSE : Pro portal → My info: "Feature me on the website" (opt-in). On: the pro's photo, public name, area and up
 *           to 5 services appear in "New pros in the Handled Network" on the next 6-hour refresh. Off: removed right away.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShowcaseToggle({ on, approved, es = false }: { on: boolean; approved: boolean; es?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flip = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/pro/showcase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: !on }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setMsg(String((j as { error?: string }).error ?? (es ? "No se pudo guardar" : "Couldn't save")));
    setMsg(!on ? (es ? "Listo: aparecerá en el sitio en la próxima actualización (cada 6 horas)." : "Done: you'll appear on the website at the next update (every 6 hours).") : (es ? "Listo: ya no aparece en el sitio." : "Done: you're off the website."));
    router.refresh();
  };
  return (
    <section className="card text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">{es ? "Aparecer en el sitio web" : "Feature me on the website"}</h2>
          <p className="mt-1 text-ink-soft">{es
            ? "Muestre su foto, su nombre (o el de su negocio), su ciudad y hasta 5 de sus servicios en \"Nuevos profesionales\" del sitio de Handled. Nunca mostramos su dirección ni su teléfono. Puede apagarlo cuando quiera."
            : "Show your photo, your name (or business name), your city and up to 5 of your services in \"New pros in the Handled Network\" on the Handled website. We never show your address or phone. Turn it off any time."}</p>
          {!approved && <p className="mt-1 text-xs text-ink-soft">{es ? "Aparece una vez que su cuenta esté aprobada." : "You'll appear once your account is approved."}</p>}
        </div>
        <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={flip} className={on ? "btn-primary" : "btn-ghost"}>{on ? (es ? "Activado" : "On") : (es ? "Activar" : "Turn on")}</button>
      </div>
      {msg && <p className="mt-2 text-xs">{msg}</p>}
    </section>
  );
}
