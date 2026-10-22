/*
 * FILE    : packages/core/src/referral-ticket.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0600 UTC
 * PURPOSE : The STANDARD REFERRAL TICKET (RT-1). Every referral — from a pro, a client or a partner, on the web, the app,
 *           the Hub or an IEBC worker — uses these same sections and fields, so each one arrives with what a pro needs
 *           to price and do a good job. One definition drives the form, the server check, the AI filing, the Hub review,
 *           the printable blank ticket and the booking prefill.
 *             TICKET_SECTIONS   — the sections and fields, in order, with what's required
 *             ticketCheck()     — what's missing (required blocks submission; recommended lowers the score) + a 0–100 score
 *             ticketNotes()     — the job notes the pro and customer see, built from the standard fields
 */
import { getService, missingMeasurements, questionVisible, type Answers } from "./services.ts";
import { photoRule } from "./intake.ts";

export const TICKET_STANDARD_VERSION = "RT-1";

export const TICKET_RELATIONSHIPS = {
  my_customer: "My own customer or client",
  on_site: "A job I saw while working",
  friend: "Friend, family or neighbor",
  real_estate: "Real estate or property-management client",
  business: "Business contact",
  other: "Someone else",
} as const;
export const CONTACT_PREFS = { call: "Call", text: "Text", email: "Email" } as const;
export const BEST_TIMES = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", anytime: "Any time" } as const;
export const PROPERTY_TYPES = { house: "House", townhouse: "Townhouse", apartment: "Apartment or condo", commercial: "Business / commercial", land: "Land or lot", other: "Other" } as const;
export const OCCUPANCY = { occupied: "Someone lives or works there", vacant: "Empty (move-out, sale, rental turnover)" } as const;

/** The standard fields beyond customer, address and job (stored as referral_tickets.details). */
export type TicketDetails = {
  relationship: keyof typeof TICKET_RELATIONSHIPS | null;
  preferred_contact: keyof typeof CONTACT_PREFS | null;
  best_time: keyof typeof BEST_TIMES | null;
  property_type: keyof typeof PROPERTY_TYPES | null;
  occupancy: keyof typeof OCCUPANCY | null;
  pets: string | null;
  parking: string | null;
  preferred_date: string | null;   // YYYY-MM-DD, a wish (the customer picks the real slot at booking)
  decision_maker: boolean | null;  // the customer can approve and pay for the work
};

/** Everything a ticket holds, as checked against the standard. */
export type TicketDraft = {
  customer_name?: string | null; customer_email?: string | null; customer_phone?: string | null; company_name?: string | null;
  address?: string | null; city?: string | null; state?: string | null; zip?: string | null;
  service_slug?: string | null; description?: string | null; frequency?: string | null; urgency?: string | null; budget?: number | null;
  access_notes?: string | null; answers?: Answers; photos?: string[]; details?: Partial<TicketDetails>;
  customer_consent?: boolean; customer_expects_contact?: boolean;
};

type Field = { key: string; label: string; required: boolean; hint?: string };
export type TicketSection = { id: string; title: string; why: string; fields: Field[] };

const F = (key: string, label: string, required = true, hint?: string): Field => ({ key, label, required, hint });

/** The standard ticket, section by section. The service-specific questions and photos come from the service catalog. */
export const TICKET_SECTIONS: TicketSection[] = [
  { id: "referrer", title: "1. You and the customer", why: "So we know how you know them and can thank you properly.", fields: [
    F("details.relationship", "How you know the customer"),
  ] },
  { id: "customer", title: "2. Customer", why: "So we can reach them quickly the way they like.", fields: [
    F("customer_name", "Full name"), F("customer_email", "Email"), F("customer_phone", "Mobile phone"),
    F("details.preferred_contact", "Best way to reach them"), F("details.best_time", "Best time to reach them", false),
    F("company_name", "Company (if it's a business)", false), F("details.decision_maker", "They can approve and pay for the work", false),
  ] },
  { id: "location", title: "3. Location", why: "The address sets the price, the pro and the drive.", fields: [
    F("address", "Street address"), F("city", "City"), F("state", "State"), F("zip", "ZIP"),
    F("details.property_type", "Type of property"), F("details.occupancy", "Occupied or empty", false),
    F("access_notes", "Getting in (gate, lockbox, who's home)", false, "Only the assigned pro sees this"),
    F("details.parking", "Parking", false), F("details.pets", "Pets", false),
  ] },
  { id: "job", title: "4. The job", why: "What a pro needs to quote it right and show up ready.", fields: [
    F("service_slug", "Service", true, "Not sure? Describe it and our AI picks"), F("description", "What needs doing (30+ characters)"),
    F("answers", "Size and details for this service", true, "The same questions the customer would answer — sizes, rooms, square feet"),
    F("frequency", "How often"), F("urgency", "When they need it"), F("details.preferred_date", "A date they'd like", false), F("budget", "Their budget", false),
  ] },
  { id: "photos", title: "5. Photos", why: "Photos stop surprises on site and keep the price firm.", fields: [
    F("photos", "Photos of the job", false, "Required for some services — the form says which"),
  ] },
  { id: "confirm", title: "6. Confirm", why: "We only contact people who asked for it.", fields: [
    F("customer_consent", "The customer asked me to send this job"), F("customer_expects_contact", "They know Handled will email, text or call them"),
  ] },
];

const has = (v: unknown) => v !== undefined && v !== null && (typeof v !== "string" || v.trim().length > 0);
const label = (key: string) => TICKET_SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key)?.label ?? key;

/**
 * Check a ticket against the standard. `required` must be empty to submit; `recommended` is what would make it better.
 * The score counts both (required 70%, recommended 30%), so the Hub can sort weak tickets first.
 */
export function ticketCheck(t: TicketDraft): { required: string[]; recommended: string[]; score: number } {
  const d = t.details ?? {};
  const req: [boolean, string][] = [
    [has(d.relationship), label("details.relationship")],
    [has(t.customer_name) && String(t.customer_name).trim().length >= 2, label("customer_name")],
    [has(t.customer_email) && /\S+@\S+\.\S+/.test(String(t.customer_email)), label("customer_email")],
    [has(t.customer_phone) && String(t.customer_phone).replace(/\D/g, "").length >= 10, label("customer_phone")],
    [has(d.preferred_contact), label("details.preferred_contact")],
    [has(t.address) && String(t.address).trim().length >= 4, label("address")],
    [has(t.city), label("city")],
    [has(t.state) && String(t.state).trim().length === 2, label("state")],
    [/^\d{5}$/.test(String(t.zip ?? "")), label("zip")],
    [has(d.property_type), label("details.property_type")],
    [has(t.description) && String(t.description).trim().length >= 30, label("description")],
    [has(t.frequency), label("frequency")],
    [has(t.urgency), label("urgency")],
    [t.customer_consent === true, label("customer_consent")],
    [t.customer_expects_contact === true, label("customer_expects_contact")],
  ];
  const rec: [boolean, string][] = [
    [has(d.best_time), label("details.best_time")],
    [has(d.occupancy), label("details.occupancy")],
    [has(t.access_notes), label("access_notes")],
    [has(d.parking), label("details.parking")],
    [has(d.pets), label("details.pets")],
    [has(t.budget) && Number(t.budget) > 0, label("budget")],
    [has(d.preferred_date), label("details.preferred_date")],
    [d.decision_maker === true, label("details.decision_maker")],
  ];
  // the service: its required measurements and photos are required; its other questions and recommended photos help
  const svc = t.service_slug ? getService(t.service_slug) : null;
  if (svc) {
    const answers = t.answers ?? {};
    const need = missingMeasurements(svc.questions, answers);
    if (need.length) req.push([false, `Size: ${need.map((q) => q.label).join(", ")}`]);
    const open = svc.questions.filter((q) => q.type !== "toggle" && questionVisible(q, answers, svc.questions) && !(q.id in answers));
    if (open.length) rec.push([false, `Details: ${open.map((q) => q.label).join(", ")}`]);
    const rule = photoRule(svc.slug);
    const n = t.photos?.length ?? 0;
    if (rule.need === "required" && n < rule.min) req.push([false, `${rule.min} photo${rule.min === 1 ? "" : "s"} (${rule.tips.join(", ")})`]);
    if (rule.need === "recommended" && n === 0) rec.push([false, `Photos (${rule.tips.join(", ")})`]);
  } else {
    // no service picked: the AI picks one from the description, so it has to say enough
    rec.push([false, "Service (or a clear description so our AI can pick it)"]);
  }
  const required = req.filter(([ok]) => !ok).map(([, l]) => l);
  const recommended = rec.filter(([ok]) => !ok).map(([, l]) => l);
  const score = Math.round((70 * (req.length - required.length)) / req.length + (30 * (rec.length - recommended.length)) / rec.length);
  return { required, recommended, score };
}

/** The job notes built from the standard fields (shown to the customer at booking and on the pro's work order). */
export function ticketNotes(t: TicketDraft & { ai_summary?: string | null }): string {
  const d = t.details ?? {};
  return [
    t.ai_summary || t.description,
    d.property_type ? `Property: ${PROPERTY_TYPES[d.property_type]}${d.occupancy ? `, ${d.occupancy === "vacant" ? "empty" : "occupied"}` : ""}.` : null,
    d.pets ? `Pets: ${d.pets}.` : null,
    d.parking ? `Parking: ${d.parking}.` : null,
    d.preferred_date ? `Would like it around ${d.preferred_date}.` : null,
  ].filter(Boolean).join("\n");
}
