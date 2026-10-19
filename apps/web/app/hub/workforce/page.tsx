/*
 * FILE    : apps/web/app/hub/workforce/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0200 UTC
 * PURPOSE : Old address kept so bookmarks and emailed links still work: IEBC Workforce now lives at /hub/agents?view=workforce.
 */
import { redirect } from "next/navigation";

export default async function Moved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string" && k !== "view") sp.set(k, v);
  const rest = sp.toString();
  redirect(`/hub/agents?view=workforce${rest ? `&${rest}` : ""}`);
}
