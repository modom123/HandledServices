/*
 * FILE    : apps/web/components/PrintButton.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_2030 UTC
 */
"use client";
export function PrintButton() {
  return <button className="btn-ghost print:hidden" onClick={() => window.print()}>Print / save PDF</button>;
}
