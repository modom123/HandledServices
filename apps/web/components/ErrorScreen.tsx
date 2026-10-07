/*
 * FILE    : apps/web/components/ErrorScreen.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Friendly crash screen that reports the error to the Hub (/api/errors) once.
 */
"use client";

import { useEffect } from "react";

export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "web", message: error.message || "Page crashed", path: window.location.pathname, digest: error.digest, stack: error.stack?.slice(0, 3000) }) }).catch(() => {});
  }, [error]);
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-4xl">🛠️</div>
      <h1 className="mt-3 text-2xl font-bold">Something went wrong on our end</h1>
      <p className="mt-2 text-ink-soft">Our team has been notified automatically. Please try again — your booking details are safe.</p>
      <div className="mt-6 flex justify-center gap-2"><button className="btn-primary" onClick={reset}>Try again</button><a href="/home" className="btn-ghost">Go home</a></div>
    </div>
  );
}
