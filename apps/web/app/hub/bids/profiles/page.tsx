/*
 * FILE    : apps/web/app/hub/bids/profiles/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0400 UTC
 * PURPOSE : Hub → Bids → Bidding profiles: who we bid as (IEBC for AI automation, Handled for services). The proposal
 *           writer uses only these facts — anything missing becomes a [[NEEDS]] marker in the draft.
 */
import Link from "next/link";
import { listProfiles } from "@/lib/proposals";
import { ProfileEditor } from "@/components/ProposalWriter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bidding profiles" };

export default async function ProfilesPage() {
  const profiles = await listProfiles();
  return (
    <div className="space-y-4">
      <Link href="/hub/bids" className="text-sm text-brand">← Bids</Link>
      <h1 className="text-2xl font-bold">Bidding profiles</h1>
      <p className="max-w-3xl text-sm text-ink-soft">The company facts the AI proposal writer is allowed to use. Fill in the UEI, CAGE code, contacts, real past performance and real key people. The AI never makes these up. When something is missing it leaves a yellow [[NEEDS]] note in the draft for you to fill in. Keep one profile per company you bid as, for example IEBC for AI automation and Handled for services.</p>
      {profiles.map((p) => (
        <section key={p.id}>
          <h2 className="mb-2 text-lg font-bold">{p.name}{p.is_default ? " (default)" : ""}</h2>
          <ProfileEditor profile={p as unknown as Record<string, unknown>} />
        </section>
      ))}
      <section>
        <h2 className="mb-2 text-lg font-bold">Add a profile</h2>
        <ProfileEditor profile={null} />
      </section>
    </div>
  );
}
