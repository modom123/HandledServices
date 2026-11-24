/*
 * FILE    : apps/web/app/(site)/walkthrough/[token]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : A business's own walkthrough link (from the confirmation email): see it, pick another time, or cancel. Not indexed.
 */
import { notFound } from "next/navigation";
import { WALKTHROUGH_KINDS, walkthroughWhen, type WalkthroughKind } from "@handled/core";
import { WalkthroughManage } from "@/components/Walkthrough";
import { getWalkthroughSettings, walkthroughByToken } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your walkthrough", robots: { index: false, follow: false } };

export default async function ManageWalkthrough({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const w = await walkthroughByToken(token).catch(() => null);
  if (!w) notFound();
  const s = await getWalkthroughSettings();
  const past = new Date(w.starts_at).getTime() < Date.now();
  return (
    <div className="wrap max-w-2xl py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Your walkthrough</h1>
      <p className="mt-1 text-ink-soft">{w.company}{w.kind === "onsite" && w.address ? ` · ${[w.address, w.city].filter(Boolean).join(", ")}` : ""}</p>
      <div className="mt-6">
        <WalkthroughManage token={w.token} kindLabel={WALKTHROUGH_KINDS[w.kind as WalkthroughKind].label} when={walkthroughWhen(w.starts_at, s.time_zone)} active={w.status === "booked" && !past} />
      </div>
    </div>
  );
}
