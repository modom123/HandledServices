/*
 * FILE    : apps/web/components/SmsConsent.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_1640 UTC
 * PURPOSE : Text-message consent wording shown wherever we collect a mobile number (TCPA, carrier A2P 10DLC rules):
 *           who texts, what about, frequency, rates, STOP / HELP, and that consent isn't required to buy.
 */
import Link from "next/link";
import { BRAND } from "@handled/core";

export function SmsConsent({ es = false, purpose = "booking" }: { es?: boolean; purpose?: "booking" | "pro" | "waitlist" }) {
  const what = es
    ? { booking: "esta reserva (confirmaciones, llegada del profesional, enlaces de pago y recibos)", pro: "su solicitud, ofertas de trabajo y pagos", waitlist: "cuándo abra el servicio en su zona" }[purpose]
    : { booking: "this booking (confirmations, pro arrival, payment links and receipts)", pro: "your application, job offers and payouts", waitlist: "when the service opens in your area" }[purpose];
  return (
    <p className="text-xs text-ink-soft">
      {es
        ? <>Al dar su número de celular, acepta recibir mensajes de texto automatizados de {BRAND.name} sobre {what}. La frecuencia varía. Pueden aplicar tarifas de mensajes y datos. Responda STOP para cancelar o HELP para ayuda. No es condición de compra. Nunca vendemos su número. <Link href="/privacy" className="underline">Privacidad</Link></>
        : <>By giving your mobile number, you agree to receive automated texts from {BRAND.name} about {what}. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. Consent isn&apos;t a condition of purchase. We never sell your number. <Link href="/privacy" className="underline">Privacy</Link></>}
    </p>
  );
}
