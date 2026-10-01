/*
 * FILE    : apps/web/app/(site)/privacy/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1945 UTC
 * PURPOSE : Privacy policy (required by Apple/Google app stores and SMS carriers).
 *           TEMPLATE — have counsel review before launch.
 */
import { BRAND } from "@handled/core";

export const metadata = { title: "Privacy Policy" };

const SECTIONS: [string, string][] = [
  ["What we collect", "Contact details (name, email, phone), service and billing addresses, booking details, photos you or your pro upload, messages, ratings, and device and usage data from our website and app. Pros additionally provide business, tax (W-9), insurance, license and payout information."],
  ["How we use it", "To price, schedule, dispatch, perform and guarantee services; to take payment and pay pros; to send job updates; to check work quality (including automated review of photos); to prevent fraud; to meet tax and legal obligations; and to improve our service."],
  ["Who we share it with", "With the pro assigned to your job (only what they need to do it), and with service providers that run our business: payments (Stripe), hosting and database (Vercel, Supabase), email (Resend), and AI processing (Anthropic) for quoting, dispatch, quality checks and support. We never sell your personal information or share your number with other contractors."],
  ["Payments", "Card details are entered on Stripe's secure checkout and stored by Stripe, not by us."],
  ["Texts and email", "We send messages about your bookings. You can reply STOP to texts or unsubscribe from marketing email at any time; job-critical messages may still be sent."],
  ["Photos", "Before and after photos are used for quality control and support, stored privately, and never published without your permission."],
  ["Retention", "We keep booking and payment records as long as the law requires (typically 7 years for tax records), and other data only as long as needed for the purposes above."],
  ["Your choices", "You can access, correct or delete your information by contacting us. Some records we must keep for legal or tax reasons."],
  ["Security", "Data is encrypted in transit, access is restricted by role, and sensitive documents (W-9s, licenses) are kept in private storage."],
  ["Children", "Our services are not directed to children under 13 and we don't knowingly collect their information."],
  ["Contact", `${BRAND.legalName} · ${BRAND.supportEmail} · ${BRAND.supportPhone}`],
];

export default function Privacy() {
  return (
    <div className="wrap max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-ink-soft">{BRAND.legalName} · effective {new Date().getFullYear()}</p>
      <div className="mt-8 space-y-5">{SECTIONS.map(([h, p]) => <div key={h}><h2 className="font-bold">{h}</h2><p className="mt-1 text-ink-soft">{p}</p></div>)}</div>
    </div>
  );
}
