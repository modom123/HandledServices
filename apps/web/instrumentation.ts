/*
 * FILE    : apps/web/instrumentation.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Every server error (pages, API routes, cron, webhooks) is reported to the Hub as an
 *           alert — money and dispatch paths also email ops (lib/errors.ts).
 */
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
  const { reportError } = await import("./lib/errors");
  await reportError({ source: "server", message: e.message, path: `${request.method} ${request.path}`, digest, stack: e.stack ?? null });
};
