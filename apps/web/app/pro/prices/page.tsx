/*
 * FILE    : apps/web/app/pro/prices/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Pro portal → My prices: the pro sets their own price for each service they do (80–175% of Handled's
 *           suggested price, optional minimum job). Customers see it as an upfront, all-in price next to Handled's,
 *           with the pro's rating; booking at the pro's price gives them the first look at the job.
 */
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { myRates } from "@/lib/pro-prices";
import { ProPriceCard } from "@/components/ProPriceCard";

export const dynamic = "force-dynamic";

export default async function MyPrices() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const es = (await getLocale()) === "es";
  const rows = await myRates(v.contractorId);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{es ? "Mis precios" : "My prices"}</h1>
        <p className="mt-1 text-sm text-ink-soft">{es
          ? "Usted es un negocio independiente: fije su propio precio para cada servicio, del 80% al 175% del precio de Handled. Los clientes ven su precio final por adelantado junto al de Handled, con su calificación, y lo eligen. Si lo eligen, usted recibe el trabajo primero. Su pago es su tarifa completa; la comisión de Handled y el cargo por reserva se suman al precio del cliente."
          : "You're an independent business: set your own price for each service, from 80% to 175% of Handled's price. Customers see your all-in price upfront next to Handled's, with your rating, and choose. If they pick you, you get the first look at the job. Your pay is your full rate; Handled's commission and booking fee are added to the customer's price."}</p>
        <p className="mt-1 text-xs text-ink-soft">{es ? "El precio queda fijo al reservar. Si el trabajo resulta más grande, use “trabajo extra” con fotos; el cliente lo aprueba." : "The price is locked at booking. If the job turns out bigger, use “extra work” with photos — the customer approves it."}</p>
      </div>
      <ProPriceCard rows={rows} es={es} />
    </div>
  );
}
