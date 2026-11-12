/*
 * FILE    : apps/web/app/pro/pin/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0030 UTC
 * PURPOSE : /pro/pin — create, change or reset the Pro PIN (the extra lock on accepted jobs' addresses and customer
 *           details, lib/pro-pin.ts). ?reset= is the 30-minute link from "Forgot PIN". English / Spanish.
 */
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { pinStatus } from "@/lib/pro-pin";
import { ProPinForm } from "@/components/ProPin";

export const dynamic = "force-dynamic";

export default async function ProPinPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const v = await getViewer();
  if (!v?.contractorId) redirect("/login?next=/pro/pin");
  const es = (await getLocale()) === "es";
  const { reset } = await searchParams;
  const st = await pinStatus(v.contractorId);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">{es ? "Su PIN de profesional" : "Your Pro PIN"}</h1>
      <p className="text-sm text-ink-soft">{es
        ? "Después de aceptar un trabajo, su PIN desbloquea la dirección, el contacto del cliente y los datos de entrada en cada dispositivo por 12 horas. Así, si pierde o presta su teléfono, las casas de sus clientes siguen protegidas."
        : "After you accept a job, your PIN unlocks the street address, the customer's contact and entry details on each device for 12 hours — so if your phone is lost or shared, your customers' homes stay protected."}</p>
      {!st.enabled
        ? <p className="card text-sm">{es ? "El PIN aún no está activado." : "The PIN lock isn't switched on yet."}</p>
        : <ProPinForm hasPin={st.set} resetToken={reset ?? null} es={es} />}
    </div>
  );
}
