/*
 * FILE    : packages/core/src/walkthrough.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Free walkthroughs for businesses: they pick a time themselves, no back-and-forth.
 *             WALKTHROUGH_DEFAULTS / WalkthroughSettings — hours, slot length, lead time, how far ahead (Hub sets them)
 *             WALKTHROUGH_KINDS  — on-site walkthrough at their property, or a short phone call
 *             walkthroughSlots   — the open times for the next N days in the business's time zone, minus booked ones
 *             wallTimeToUtc      — "2026-11-20" + 9:30 in America/Detroit → the UTC instant (DST-safe)
 *             slotIsOpen         — server-side re-check before saving a booking
 *             googleCalendarUrl  — "Add to Google Calendar" link for the confirmation email
 * UPDATED : 2026-11-17_2350 UTC — BIZ_LANDINGS: one landing page per kind of business (/business/<slug>), each with one
 *           first-job offer and one button (book a free walkthrough), plus "order online" for those ready now.
 */
import type { BizSegment } from "./biz-lead-engine.ts";

export type WalkthroughKind = "onsite" | "call";
export const WALKTHROUGH_KINDS: Record<WalkthroughKind, { label: string; blurb: string; minutes: number }> = {
  onsite: { label: "Free on-site walkthrough", blurb: "We walk the property with you, see the work and send an exact price the same day.", minutes: 45 },
  call: { label: "10-minute call", blurb: "Tell us what you need over the phone; we send an exact price or a link to order.", minutes: 15 },
};

export interface WalkthroughSettings {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** minutes after midnight, local time */
  start_min: number;
  end_min: number;
  slot_minutes: number;
  /** bookings allowed in the same slot (crew members who can walk sites at once) */
  per_slot: number;
  /** at least this many hours from now */
  lead_hours: number;
  horizon_days: number;
  time_zone: string;
}

export const WALKTHROUGH_DEFAULTS: WalkthroughSettings = {
  enabled: true, days: [1, 2, 3, 4, 5], start_min: 9 * 60, end_min: 17 * 60, slot_minutes: 30, per_slot: 1, lead_hours: 18, horizon_days: 14, time_zone: "America/Detroit",
};

/** Local wall time (date + minutes after midnight) in a time zone → the UTC instant. */
export function wallTimeToUtc(date: string, minutes: number, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  // offset of the zone at that moment (two passes settle DST edges)
  let t = asUtc;
  for (let i = 0; i < 2; i++) t = asUtc - zoneOffsetMs(new Date(t), timeZone);
  return new Date(t);
}

function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - Math.floor(at.getTime() / 1000) * 1000;
}

const localDay = (d: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDaysStr = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export interface WalkthroughDay { date: string; label: string; slots: { start: string; label: string }[] }

/** Open times for the next `horizon_days`, in the settings' time zone. `booked` = start instants (ISO) of active bookings. */
export function walkthroughSlots(s: WalkthroughSettings, booked: string[], now = new Date()): WalkthroughDay[] {
  if (!s.enabled || s.slot_minutes < 10 || s.end_min <= s.start_min) return [];
  const taken = new Map<number, number>();
  for (const b of booked) { const t = new Date(b).getTime(); taken.set(t, (taken.get(t) ?? 0) + 1); }
  const earliest = now.getTime() + s.lead_hours * 3600000;
  const today = localDay(now, s.time_zone);
  const out: WalkthroughDay[] = [];
  for (let i = 0; i <= s.horizon_days; i++) {
    const date = addDaysStr(today, i);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (!s.days.includes(weekday)) continue;
    const slots: WalkthroughDay["slots"] = [];
    for (let m = s.start_min; m + s.slot_minutes <= s.end_min; m += s.slot_minutes) {
      const at = wallTimeToUtc(date, m, s.time_zone);
      if (at.getTime() < earliest || (taken.get(at.getTime()) ?? 0) >= Math.max(1, s.per_slot)) continue;
      slots.push({ start: at.toISOString(), label: at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: s.time_zone }) });
    }
    if (slots.length) out.push({ date, label: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }), slots });
  }
  return out;
}

/** Is this exact start still bookable? (server-side check before saving) */
export function slotIsOpen(s: WalkthroughSettings, start: string, booked: string[], now = new Date()): boolean {
  const t = new Date(start).getTime();
  if (!Number.isFinite(t)) return false;
  return walkthroughSlots(s, booked, now).some((d) => d.slots.some((x) => new Date(x.start).getTime() === t));
}

/** "Thursday, Nov 20 at 9:30 AM (Detroit time)" */
export function walkthroughWhen(start: string, timeZone: string): string {
  const d = new Date(start);
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })} (${city} time)`;
}

export function googleCalendarUrl(e: { title: string; start: string; minutes: number; details: string; location?: string | null }): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(e.start), end = new Date(start.getTime() + e.minutes * 60000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${f(start)}/${f(end)}`, details: e.details, ...(e.location ? { location: e.location } : {}) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// ─── Landing pages, one per kind of business ────────────────────────────────

export interface BizLanding {
  slug: string; segment: BizSegment | "hiring"; name: string; seoTitle: string; seoDescription: string;
  eyebrow: string; h1: string; sub: string; firstJob: string; firstJobWhy: string;
  bullets: [string, string][]; services: string[]; kind: WalkthroughKind; faq: [string, string][];
}

const COMMON_FAQ: [string, string][] = [
  ["Is the walkthrough really free?", "Yes. No charge and no obligation. You get an exact price, and you decide."],
  ["Are your pros vetted?", "Every pro is background-checked and vetted, and carries insurance and a license where the work requires them. Certificates of insurance on request."],
  ["How do we pay?", "Pay 25% to book and the rest when the work is done. Accounts with a track record can move to monthly invoicing with PO numbers."],
];

export const BIZ_LANDINGS: BizLanding[] = [
  {
    slug: "property-managers", segment: "property_manager", name: "Property managers",
    seoTitle: "Unit turnovers & move-out cleaning for property managers", seoDescription: "Rent-ready turnovers in one booking: move-out deep clean, carpets, touch-ups and haul-away, with photos of every room. Book a free walkthrough.",
    eyebrow: "For property managers", h1: "Rent-ready turnovers. One booking.", sub: "Move-out deep clean, carpets, windows, touch-ups and haul-away, done by one vetted crew, with before-and-after photos of every room.",
    firstJob: "Your next unit turnover", firstJobWhy: "Send us one unit. See the photos, the timing and the price, then decide on the rest of your portfolio.",
    bullets: [["Every room photographed", "Before-and-after photos land in your account, so you can approve a unit without driving to it."], ["One vendor for the whole turnover", "Clean, carpets, paint touch-ups, punch list and haul-away on one booking and one invoice."], ["Exact price up front", "No surprise invoices. You see the price before you book."], ["Backup crews built in", "If a pro can’t make it, dispatch moves the job to the next qualified crew."]],
    services: ["unit-turnover", "house-cleaning", "carpet-cleaning", "junk-removal", "handyman"], kind: "onsite",
    faq: [["How fast can you turn a unit?", "Tell us the move-out date on the walkthrough and we schedule around it, including weekends."], ...COMMON_FAQ],
  },
  {
    slug: "offices", segment: "facilities", name: "Offices & facilities",
    seoTitle: "Office cleaning & facility services", seoDescription: "Nightly, weekly or monthly office cleaning by the same vetted crew, with photos of every visit. Book a free walkthrough for an exact price.",
    eyebrow: "For offices, clinics and facilities", h1: "Office cleaning by the same crew, every visit.", sub: "Nightly, weekly or monthly cleaning around your hours, plus carpets, windows and repairs, with a photo record of every visit.",
    firstJob: "Your first office cleaning", firstJobWhy: "Try one cleaning. If it’s right, make it recurring in one click.",
    bullets: [["Same crew each visit", "They learn your space and your preferences."], ["After hours and weekends", "Scheduled around when you’re open."], ["Every visit on record", "Time-stamped photos and a monthly report by location."], ["PO numbers & cost centers", "Invoices split by location or department."]],
    services: ["house-cleaning", "window-cleaning", "carpet-cleaning", "power-washing", "handyman"], kind: "onsite",
    faq: [["Do you sign a contract?", "No long contract required. Book one cleaning, then set it to repeat; pause or cancel any time."], ...COMMON_FAQ],
  },
  {
    slug: "real-estate", segment: "real_estate", name: "Real estate brokerages",
    seoTitle: "Listing prep & move-out cleaning for real estate agents", seoDescription: "Listing prep, move-out deep cleans, haul-away and touch-ups booked in a minute, with photos your clients can see.",
    eyebrow: "For agents and brokerages", h1: "Listing-ready, without the chasing.", sub: "Deep cleans, haul-away, power washing and touch-ups booked in a minute, with photos you can forward to your sellers.",
    firstJob: "Your next listing prep or move-out clean", firstJobWhy: "One listing is enough to see the difference.",
    bullets: [["Photos for your clients", "Before-and-after photos you can forward to sellers and buyers."], ["Fast turnaround", "Tell us the listing date; we schedule around it."], ["One booking, many trades", "Clean, haul-away, power wash and handyman on one order."], ["Exact price up front", "Know the cost before you tell your seller."]],
    services: ["house-cleaning", "junk-removal", "power-washing", "handyman"], kind: "call",
    faq: COMMON_FAQ,
  },
  {
    slug: "self-storage", segment: "storage", name: "Self-storage facilities",
    seoTitle: "Abandoned-unit cleanouts for self-storage", seoDescription: "Abandoned-unit cleanouts and haul-away on call, plus moving help you can offer tenants.",
    eyebrow: "For self-storage facilities", h1: "Abandoned units, cleared on call.", sub: "Cleanouts and haul-away when an auction ends or a tenant leaves a mess, plus moving help you can offer your tenants.",
    firstJob: "Your next unit cleanout", firstJobWhy: "Send one unit; see how fast it’s rentable again.",
    bullets: [["On call", "Book a cleanout the day you need it."], ["Photo proof", "Empty-unit photos when we’re done."], ["Haul-away included", "Donation and dump runs handled."], ["Moving help for tenants", "A service you can offer at the counter."]],
    services: ["junk-removal", "junk-container", "small-moves", "power-washing"], kind: "call",
    faq: COMMON_FAQ,
  },
  {
    slug: "stagers", segment: "stager", name: "Home stagers",
    seoTitle: "Staging furniture delivery & pickup", seoDescription: "Staging furniture picked up, delivered, placed and picked up again when the listing closes — one booking for both trips.",
    eyebrow: "For home stagers", h1: "Both trips, one booking.", sub: "Staging furniture picked up, delivered and placed, then picked up again when the listing closes, by a careful 2-person crew.",
    firstJob: "Your next staging install", firstJobWhy: "Try one install and pickup.",
    bullets: [["Careful 2-person crews", "Padded, wrapped and placed where you want it."], ["Pickup scheduled up front", "Book the return trip with the install."], ["Cleaning on the same order", "A pre-listing clean before you stage."], ["Photo proof", "Placement photos for your records."]],
    services: ["staging-transport", "house-cleaning", "junk-removal"], kind: "call",
    faq: COMMON_FAQ,
  },
  {
    slug: "furniture-stores", segment: "retail", name: "Furniture & appliance stores",
    seoTitle: "Same-day large-item delivery for furniture & appliance stores", seoDescription: "Same-day large-item delivery for your customers by a 2-person crew, with haul-away of the old piece and photo proof.",
    eyebrow: "For furniture and appliance stores", h1: "Same-day delivery your customers will mention.", sub: "A 2-person crew delivers, places and hauls away the old piece, with photo proof on every drop-off.",
    firstJob: "Your next customer deliveries", firstJobWhy: "Hand us one day’s deliveries.",
    bullets: [["2-person crews", "Heavy items carried in and placed."], ["Haul-away of the old piece", "Your customer doesn’t have to deal with it."], ["Photo proof", "Delivery photos on every stop."], ["Book by the delivery", "No retainer, no minimum month."]],
    services: ["retail-delivery", "large-item-removal", "junk-removal"], kind: "call",
    faq: COMMON_FAQ,
  },
  {
    slug: "hiring", segment: "hiring", name: "Hiring for cleaning or maintenance",
    seoTitle: "Hiring a cleaner or maintenance tech? Book the work instead", seoDescription: "Before you hire: get the cleaning, maintenance or grounds work covered this week by vetted pros, with an exact price up front.",
    eyebrow: "Hiring for cleaning, maintenance or grounds?", h1: "Before you hire, get it covered this week.", sub: "Vetted pros do the cleaning, maintenance or grounds work while you look, or instead of hiring: no payroll, no benefits, no call-outs.",
    firstJob: "Cover the work while the role is open", firstJobWhy: "Book the work for this week; keep hiring if you still want to.",
    bullets: [["No payroll or benefits", "You pay for the work done, with an exact price up front."], ["No call-outs", "Backup crews are built in."], ["Start this week", "No interviews, no onboarding."], ["Scale up or down", "Weekly, monthly or one-off."]],
    services: ["house-cleaning", "handyman", "lawn-care", "junk-removal"], kind: "call",
    faq: [["How does this compare with hiring?", "On the call we compare the work you need with the cost of the role, so you can decide with real numbers."], ...COMMON_FAQ],
  },
];

export const bizLanding = (slug: string) => BIZ_LANDINGS.find((l) => l.slug === slug) ?? null;

/** Where a sales-email lead lands: the page for their kind of business (job-posting leads → "hiring"). */
export function landingSlugFor(segment: string | null | undefined, jobTitle?: string | null): string | null {
  if (jobTitle?.trim()) return "hiring";
  return BIZ_LANDINGS.find((l) => l.segment === segment)?.slug ?? null;
}
