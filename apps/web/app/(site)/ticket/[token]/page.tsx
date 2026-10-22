/*
 * FILE    : apps/web/app/(site)/ticket/[token]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0700 UTC
 * PURPOSE : The personal link we send someone after a phone call. It opens the Standard Referral Ticket with their own
 *           details filled in from the call (no sign-in needed: the link is the key). Sending the job — or just joining —
 *           signs them up for the Handled network as a referral partner; their account comes with the welcome email.
 *           Do the work themselves? "Apply as a Handled pro" opens the pro application filled in from the same link.
 */
import Link from "next/link";
import { BRAND, PARTNER_KINDS, PARTNER_PROGRAM, SERVICES, partnerTerms, pctLabel } from "@handled/core";
import { inviteByToken } from "@/lib/ticket-invites";
import { ReferralTicket } from "@/components/PartnerUI";

export const metadata = { title: "Your referral ticket", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TicketInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await inviteByToken(token).catch(() => null);
  const P = PARTNER_PROGRAM;
  if (!inv) return (
    <div className="wrap py-20"><div className="card mx-auto max-w-lg text-center">
      <h1 className="text-xl font-bold">This link has expired or was already used</h1>
      <p className="mt-2 text-sm text-ink-soft">Already signed up? Send jobs from your partner page. New here? Join in two minutes.</p>
      <div className="mt-4 flex justify-center gap-2"><Link href="/partner" className="btn-ghost">Partner sign in</Link><Link href="/partners#join" className="btn-primary">Join the network</Link></div>
    </div></div>
  );
  const services = SERVICES.map((s) => [s.slug, s.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <div className="wrap max-w-4xl space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Hi {inv.name.split(" ")[0]} — thanks for the call 👋</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Send us the job on this ticket and you join the {BRAND.name} network (free). You earn {pctLabel(P.jobOncePct)}% of our fee on a one-time job,
          {" "}{pctLabel(P.jobRecurringPct)}% on every visit of a recurring job for {P.months} months, and {pctLabel(P.pctOfTake)}% of everything from people you refer — paid to your bank every week.
          The bonus is shared by {BRAND.name} and the pro who does the job. No job right now? Just sign up below.
        </p>
      </div>
      <section className="card">
        <ReferralTicket
          services={services} isPro={false}
          rates={{ once: pctLabel(P.jobOncePct), recurring: pctLabel(P.jobRecurringPct), months: P.months }}
          invite={{
            token: inv.token, jobHint: inv.job_hint,
            me: { name: inv.name, email: inv.email ?? "", phone: inv.phone ?? "", company: inv.company ?? "", kind: inv.kind },
            kinds: Object.entries(PARTNER_KINDS).filter(([k]) => k !== "pro") as [string, string][], terms: partnerTerms(),
          }}
          afterDone={
            <div className="mt-4 rounded-lg bg-white p-3">
              <p className="font-semibold">Do this kind of work yourself?</p>
              <p className="mt-1 text-ink-soft">Join as a {BRAND.name} pro: prepaid jobs near you, paid weekly, and you keep earning on referrals.</p>
              <Link href={`/pros?invite=${inv.token}#apply`} className="btn-primary mt-2 inline-block">Apply as a pro (2 minutes)</Link>
            </div>
          }
        />
      </section>
      <p className="text-center text-xs text-ink-soft">Prefer paper or the phone? <Link href="/partners/referral-ticket" className="underline">See the blank Standard Referral Ticket</Link>.</p>
    </div>
  );
}
