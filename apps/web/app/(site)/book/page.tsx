/*
 * FILE    : apps/web/app/(site)/book/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 */
import { BookingWizard } from "@/components/BookingWizard";

export const metadata = { title: "Book a service" };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  return (
    <div className="wrap py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">Get your price & book</h1>
      <BookingWizard initialService={service} />
    </div>
  );
}
