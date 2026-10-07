/*
 * FILE    : packages/core/src/email-center.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Email Center (Hub → Email) rules, shared and pure:
 *             EMAIL_AUDIENCES  — who a campaign can go to (customers, repeat / lapsed customers, business
 *                                accounts, business leads, pros, a pasted list with consent)
 *             EMAIL_TEMPLATES  — starter campaigns (seasonal, win-back, new service, business, cleaning, referral)
 *             mergeTags        — {{first_name}}, {{company}}, {{city}}, {{book_url}} … with fallbacks
 *             renderEmailHtml  — the simple writing format → branded HTML (paragraphs, **bold**, links,
 *                                [Button](url)), with the plain-text version for every email
 *             lintCampaign     — blocks what breaks the law or the inbox (deceptive "Re:" subjects,
 *                                missing content) and warns on spammy writing
 *             EMAIL_LIMITS     — sending pace that protects the mailbox (Hostinger caps daily sends)
 *           Every marketing email carries the business postal address and a one-click unsubscribe
 *           (CAN-SPAM); unsubscribed addresses are never emailed again. No texts (TCPA).
 * UPDATED : 2026-10-06_0606 UTC — cleaning push: "House cleaning in Metro Detroit" (customers, English & Spanish) and
 *           "Office & turnover cleaning" (business leads) templates.
 */
import { BRAND } from "./brand.ts";

export type EmailAudience = "customers" | "repeat_customers" | "lapsed_customers" | "business_accounts" | "biz_leads" | "pros" | "custom";

export const EMAIL_AUDIENCES: Record<EmailAudience, { label: string; why: string; whyEs: string; note?: string }> = {
  customers: { label: "All customers", why: "you booked a service with us", whyEs: "reservó un servicio con nosotros" },
  repeat_customers: { label: "Repeat customers (2+ jobs)", why: "you've booked with us more than once", whyEs: "ha reservado con nosotros más de una vez" },
  lapsed_customers: { label: "Lapsed customers (no booking in 90+ days)", why: "you booked a service with us", whyEs: "reservó un servicio con nosotros" },
  business_accounts: { label: "Business account members", why: "your company has a business account with us", whyEs: "su empresa tiene una cuenta empresarial con nosotros" },
  biz_leads: { label: "Business leads (not yet customers)", why: "we reached out about services for your business", whyEs: "le escribimos sobre servicios para su empresa",
    note: "Skips leads already in an email sequence, converted, unsubscribed, bounced or marked do-not-contact." },
  pros: { label: "Approved pros (announcements)", why: "you're a pro on our network", whyEs: "es un profesional de nuestra red", note: "For network news only: never pressure to take jobs." },
  custom: { label: "Pasted list", why: "you asked to hear from us", whyEs: "pidió recibir noticias nuestras", note: "Only people who gave you permission to email them. Never bought lists." },
};

export const EMAIL_LIMITS = {
  /** Default sends per day (Hostinger mailboxes have a daily cap; stay well under it). */
  dailyCap: 250,
  maxDailyCap: 1000,
  /** Sent per 10-minute run, so a campaign trickles out instead of bursting. */
  perRun: 25,
  maxPerRun: 60,
  /** One marketing campaign per person per this many days, across all campaigns. */
  minDaysBetween: 7,
} as const;

export interface EmailTemplate { key: string; name: string; audience: EmailAudience; subject: string; preheader: string; body: string; subject_es?: string; body_es?: string }

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: "seasonal", name: "Seasonal tune-up", audience: "customers",
    subject: "Get your home ready for the season", preheader: "Gutters, windows, yard and more — booked in a minute.",
    body: `Hi {{first_name|there}},

The season's changing, and it's the best time to knock out the jobs that are easy to put off: gutter cleaning, windows, a yard clean-up, or a deep clean.

You get an upfront price in about a minute, a vetted, insured pro, and our {{guarantee_days}}-day make-it-right guarantee.

[Get my price]({{book_url}})

Thanks for being a {{brand}} customer,
The {{brand}} team`,
    subject_es: "Prepare su casa para la temporada",
    body_es: `Hola {{first_name|}}:

Cambia la temporada y es el mejor momento para hacer los trabajos que siempre se posponen: limpiar canaletas, ventanas, limpiar el jardín o una limpieza profunda.

Obtiene un precio por adelantado en un minuto, un profesional verificado y asegurado, y nuestra garantía de {{guarantee_days}} días.

[Ver mi precio]({{book_url}})

Gracias por ser cliente de {{brand}},
El equipo de {{brand}}`,
  },
  {
    key: "winback", name: "We miss you (lapsed customers)", audience: "lapsed_customers",
    subject: "It's been a while, {{first_name|friend}}", preheader: "Your next job is one minute away.",
    body: `Hi {{first_name|there}},

It's been a while since your last booking. Whatever's on the list — cleaning, repairs, yard work, hauling — you can get a firm price in about a minute and a vetted pro on the way.

[Book again]({{book_url}})

If something about your last job wasn't right, just reply to this email. We read every one.

The {{brand}} team`,
  },
  {
    key: "new_service", name: "New service announcement", audience: "customers",
    subject: "New on {{brand}}: [service name]", preheader: "Now bookable in a minute, with an upfront price.",
    body: `Hi {{first_name|there}},

You can now book **[service name]** on {{brand}}: an upfront price in about a minute, a vetted, insured pro, and live arrival tracking.

[See the price]({{book_url}})

The {{brand}} team`,
  },
  {
    key: "business", name: "Business account (property managers & offices)", audience: "business_accounts",
    subject: "One account for every property", preheader: "Upfront prices, photos of every job, one monthly view.",
    body: `Hi {{first_name|there}},

A quick reminder of what your {{company|business}} account does:

• Book any property in a minute, with an upfront price
• Your favorite pros get your jobs first
• Before-and-after photos of every job, and one place to see it all

[Open my business account]({{site_url}}/account/business)

Questions? Reply here and a person answers.
The {{brand}} team`,
  },
  {
    key: "cleaning", name: "House cleaning in Metro Detroit (homeowners)", audience: "customers",
    subject: "A clean home, without the hassle", preheader: "Standard, deep or move-out cleaning, priced in a minute.",
    body: `Hi {{first_name|there}},

We now have background-checked, insured cleaners across Detroit and the surrounding cities, including {{city|your neighborhood}}.

• **Standard, deep or move-in/move-out** cleaning, plus carpets and windows
• An upfront price in about a minute: no walk-through, no callbacks
• The same cleaner each visit on a weekly, every-other-week or monthly plan, and you save up to 20%
• A photo check-out after every clean, and a free redo within {{guarantee_days}} days if anything's missed

[Book a cleaning]({{site_url}}/book?service=house-cleaning)

The {{brand}} team`,
    subject_es: "Una casa limpia, sin complicaciones",
    body_es: `Hola {{first_name|}}:

Ya tenemos personal de limpieza verificado y asegurado en Detroit y las ciudades vecinas, incluida {{city|su zona}}.

• Limpieza **estándar, profunda o de mudanza**, además de alfombras y ventanas
• Un precio por adelantado en un minuto: sin visitas ni llamadas
• La misma persona en cada visita con un plan semanal, quincenal o mensual, y ahorra hasta un 20%
• Fotos al terminar cada limpieza y una nueva limpieza gratis dentro de {{guarantee_days}} días si algo faltó

[Reservar una limpieza]({{site_url}}/book?service=house-cleaning)

El equipo de {{brand}}`,
  },
  {
    key: "cleaning_business", name: "Office & turnover cleaning (business leads)", audience: "biz_leads",
    subject: "Cleaning for {{company|your properties}}, booked in a minute", preheader: "Office, common-area and move-out cleaning across Metro Detroit.",
    body: `Hi {{first_name|there}},

{{brand}} handles cleaning for offices and rental properties across Detroit and the surrounding cities:

• **Recurring office and common-area cleaning**: nightly, weekly or monthly, by the same vetted crew
• **Move-out and turnover deep cleans**, with carpets and windows when a unit needs them
• An upfront price in about a minute, before-and-after photos of every clean, and one account for all your locations
• Every cleaner is ID- and background-checked and insured. If a clean isn't right, we redo it free within {{guarantee_days}} days

[Set up a business account]({{site_url}}/business)

Would a quick call this week help? Just reply to this email.
The {{brand}} team`,
  },
  {
    key: "referral", name: "Refer a friend", audience: "repeat_customers",
    subject: "Give a friend money off their first job", preheader: "And get a credit when they book.",
    body: `Hi {{first_name|there}},

Thanks for booking with us again. If a friend or neighbor needs help around the house, send them your referral link from your account page: they get money off their first job, and you get a credit when it's done.

[Get my referral link]({{site_url}}/account)

The {{brand}} team`,
  },
];

export interface MergeVars { first_name?: string | null; company?: string | null; city?: string | null; email?: string | null; book_url?: string; site_url?: string; [k: string]: string | null | undefined }

/** {{name}} or {{name|fallback}} → value. Unknown tags with no fallback become "". */
export function mergeTags(text: string, vars: MergeVars): string {
  const base: Record<string, string> = { brand: BRAND.name, guarantee_days: String(BRAND.guaranteeDays) };
  return text.replace(/\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g, (_m, k: string, fb?: string) => {
    const v = vars[k] ?? base[k];
    return v != null && String(v).trim() !== "" ? String(v) : (fb ?? "");
  });
}

/** Tags a body uses that we don't fill (typos like {{firstname}}). */
export function unknownTags(text: string): string[] {
  const known = new Set(["first_name", "company", "city", "email", "book_url", "site_url", "brand", "guarantee_days"]);
  return [...new Set([...text.matchAll(/\{\{\s*([a-z_]+)/gi)].map((m) => m[1]).filter((k) => !known.has(k)))];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline formatting: [Button](url) on its own line is a button; [text](url) a link; **bold**; bare URLs linked. */
function inline(line: string, link: (u: string) => string): string {
  let out = esc(line);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_m, t, u) => `<a href="${esc(link(u))}" style="color:#0f766e">${t}</a>`);
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (_m, pre, u) => `${pre}<a href="${esc(link(u))}" style="color:#0f766e">${u}</a>`);
  return out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}

/** Branded HTML + plain text for one recipient. `link` rewrites URLs (click tracking). */
export function renderEmailHtml(body: string, opts: { preheader?: string | null; footer: string; link?: (url: string) => string }): { html: string; text: string } {
  const link = opts.link ?? ((u: string) => u);
  const blocks = body.replace(/\r/g, "").trim().split(/\n{2,}/);
  const html = blocks.map((b) => {
    const btn = b.trim().match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (btn) return `<p style="margin:24px 0"><a href="${esc(link(btn[2]))}" style="background:#0f766e;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${esc(btn[1])}</a></p>`;
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*[•\-*]\s+/.test(l))) return `<ul style="padding-left:20px;margin:0 0 16px">${lines.map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*[•\-*]\s+/, ""), link)}</li>`).join("")}</ul>`;
    return `<p style="margin:0 0 16px">${lines.map((l) => inline(l, link)).join("<br>")}</p>`;
  }).join("");
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>` : "";
  const foot = esc(opts.footer).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#64748b">$1</a>').replace(/\n/g, "<br>");
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f7f9">${pre}
<div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#0f172a">
<div style="font-weight:800;font-size:20px;color:#0f766e;margin-bottom:16px">${esc(BRAND.name)}</div>
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px">${html}</div>
<div style="font-size:12px;color:#64748b;margin-top:16px">${foot}</div></div></body></html>`;
  const text = body.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1: $2").replace(/\*\*([^*]+)\*\*/g, "$1") + `\n\n—\n${opts.footer}`;
  return { html: doc, text };
}

/** The legal footer: why they get it, who we are (postal address), one-click unsubscribe. */
export function marketingFooter(audience: EmailAudience, postalAddress: string, unsubscribeUrl: string, locale: "en" | "es" = "en"): string {
  const a = EMAIL_AUDIENCES[audience];
  return locale === "es"
    ? `Recibe este correo porque ${a.whyEs}. ${BRAND.legalName} · ${postalAddress}\nCancelar la suscripción: ${unsubscribeUrl}`
    : `You're getting this because ${a.why}. ${BRAND.legalName} · ${postalAddress}\nUnsubscribe: ${unsubscribeUrl}`;
}

export interface LintResult { blockers: string[]; warnings: string[] }

/** What blocks sending (law, broken content) and what to fix for the inbox. */
export function lintCampaign(c: { subject: string; body: string; subject_es?: string | null; body_es?: string | null }): LintResult {
  const blockers: string[] = [], warnings: string[] = [];
  const check = (subject: string, body: string, tag: string) => {
    if (!subject.trim()) blockers.push(`${tag}Subject is empty.`);
    if (body.trim().length < 20) blockers.push(`${tag}Body is too short.`);
    if (/^\s*(re|fw|fwd)\s*:/i.test(subject)) blockers.push(`${tag}Subjects can't start with "Re:" or "Fwd:" on a new campaign — that's deceptive under CAN-SPAM.`);
    if (/\[service name\]|\[[^\]]*name\]/i.test(subject + body)) blockers.push(`${tag}Replace the [placeholder] text from the template.`);
    const bad = unknownTags(subject + body);
    if (bad.length) blockers.push(`${tag}Unknown merge tag(s): ${bad.map((b) => `{{${b}}}`).join(", ")}.`);
    if (subject.length > 70) warnings.push(`${tag}Subject is long (${subject.length} chars) — under 50 shows fully on phones.`);
    const letters = subject.replace(/[^a-z]/gi, "");
    if (letters.length > 8 && letters === letters.toUpperCase()) warnings.push(`${tag}ALL-CAPS subject looks like spam.`);
    if (/!!|\$\$|100% free|act now|risk[- ]free|winner|guaranteed income|click here/i.test(subject + " " + body)) warnings.push(`${tag}Spam-trigger wording ("!!", "act now", "click here"…) hurts delivery.`);
    const links = (body.match(/https?:\/\//g) ?? []).length;
    if (links > 6) warnings.push(`${tag}${links} links — keep it to a few.`);
    if (!/https?:\/\/|\{\{\s*(book_url|site_url)/.test(body)) warnings.push(`${tag}No link — add a button so people can act on it.`);
  };
  check(c.subject, c.body, "");
  if (c.subject_es || c.body_es) check(c.subject_es ?? "", c.body_es ?? "", "Spanish: ");
  return { blockers, warnings };
}

/** Clean up a pasted list: "Name <a@b.co>", "a@b.co, Name", one per line or comma-separated. */
export function parseEmailList(raw: string): { email: string; name: string | null }[] {
  const out = new Map<string, string | null>();
  for (const part of raw.split(/[\n;]+/)) {
    const m = part.match(/[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (!m) continue;
    const email = m[0].toLowerCase();
    const name = part.replace(m[0], "").replace(/[<>",]/g, " ").trim().replace(/\s+/g, " ") || null;
    if (!out.has(email)) out.set(email, name);
  }
  return [...out].map(([email, name]) => ({ email, name }));
}
