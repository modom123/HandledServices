/*
 * FILE    : apps/web/app/(site)/partners/referral-ticket/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0600 UTC
 * PURPOSE : The Standard Referral Ticket (RT-1), blank and printable: every section and field, what's required, and why.
 *           Built from the same definition as the online form and the server check (packages/core/src/referral-ticket.ts),
 *           so paper, phone and online referrals all collect the same information. For training pros, clients and
 *           partners, taking a referral on a job site or by phone, and the IEBC workers' reference.
 */
import Link from "next/link";
import { BEST_TIMES, BRAND, CONTACT_PREFS, OCCUPANCY, PARTNER_PROGRAM, PROPERTY_TYPES, TICKET_RELATIONSHIPS, TICKET_SECTIONS, TICKET_STANDARD_VERSION, pctLabel } from "@handled/core";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Standard Referral Ticket", description: `${BRAND.name}'s standard referral ticket: the information every referral needs for a good job.` };

const CHOICES: Record<string, Record<string, string>> = {
  "details.relationship": TICKET_RELATIONSHIPS, "details.preferred_contact": CONTACT_PREFS, "details.best_time": BEST_TIMES,
  "details.property_type": PROPERTY_TYPES, "details.occupancy": OCCUPANCY,
  frequency: { once: "One time", weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Every month", quarterly: "Every 3 months" },
  urgency: { asap: "As soon as possible", this_week: "Within a week", two_weeks: "Within 2 weeks", month: "Within a month", flexible: "Flexible" },
};

export default function StandardTicket() {
  const P = PARTNER_PROGRAM;
  return (
    <div className="wrap max-w-3xl py-10 print:py-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link href="/partner" className="text-sm text-brand">← Fill it out online (faster: AI files it and the customer gets their link)</Link>
        <PrintButton />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold">{BRAND.name} Standard Referral Ticket <span className="font-mono text-base font-normal text-ink-soft">{TICKET_STANDARD_VERSION}</span></h1>
      <p className="mt-1 text-sm text-ink-soft">Every referral — from a pro, a client or a partner — uses this ticket, so the pro arrives knowing the job. <b>*</b> = required. You earn {pctLabel(P.jobOncePct)}% of our fee on a one-time job, {pctLabel(P.jobRecurringPct)}% on every visit of a recurring job for {P.months} months.</p>
      <div className="mt-6 space-y-5">
        {TICKET_SECTIONS.map((s) => (
          <section key={s.id} className="break-inside-avoid rounded-xl border border-line p-4">
            <h2 className="font-bold">{s.title}</h2>
            <p className="text-xs text-ink-soft">{s.why}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {s.fields.map((f) => (
                <div key={f.key} className={f.key === "description" || f.key === "answers" || f.key === "photos" ? "sm:col-span-2" : ""}>
                  <div className="text-sm font-semibold">{f.label}{f.required ? " *" : ""}</div>
                  {f.hint && <div className="text-xs text-ink-soft">{f.hint}</div>}
                  {CHOICES[f.key]
                    ? <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">{Object.values(CHOICES[f.key]).map((c) => <span key={c}>☐ {c}</span>)}</div>
                    : f.key === "customer_consent" || f.key === "customer_expects_contact" || f.key === "details.decision_maker"
                      ? <div className="mt-1 text-sm">☐ Yes</div>
                      : <div className={`mt-1 border-b border-ink/30 ${f.key === "description" || f.key === "answers" ? "h-16" : "h-7"}`} />}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink-soft">Size and details: write what the service asks for — rooms and bathrooms (cleaning), square feet (lawns, driveways, painting), number of items (junk), height (trees). Online, the form asks the exact questions for the service you pick, and says which photos it needs. Referral terms: {BRAND.name} partner terms {P.termsVersion}, at /partners.</p>
    </div>
  );
}
