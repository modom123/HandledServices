/*
 * FILE    : apps/web/lib/ticket-schema.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-22_0700 UTC
 * PURPOSE : The Standard Referral Ticket as the API accepts it — one schema for the partner page (/api/partner) and the
 *           phone-call invite page (/api/ticket-invite), so every ticket is validated the same way.
 */
import { z } from "zod";
import { BEST_TIMES, CONTACT_PREFS, OCCUPANCY, PROPERTY_TYPES, TICKET_RELATIONSHIPS, isPhotoPath } from "@handled/core";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const TicketFields = z.object({
  customer_name: z.string().trim().min(2).max(120), customer_email: z.string().trim().email().max(254), customer_phone: z.string().trim().max(30).optional().nullable(),
  company_name: z.string().trim().max(160).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(), city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(), zip: z.string().trim().regex(/^\d{5}$/, "5-digit ZIP"),
  description: z.string().trim().min(10).max(3000), service_slug: z.string().max(80).optional().nullable(),
  frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).optional().nullable(),
  urgency: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).optional().nullable(),
  budget: z.coerce.number().min(0).max(10_000_000).optional().nullable(), access_notes: z.string().trim().max(1000).optional().nullable(),
  customer_consent: z.literal(true), customer_expects_contact: z.literal(true), i_will_do_it: z.boolean().optional(),
  photos: z.array(z.string().refine(isPhotoPath, "Bad photo")).max(8).default([]),
  answers: z.record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean()])).default({}),
  details: z.object({
    relationship: z.enum(keys(TICKET_RELATIONSHIPS)), preferred_contact: z.enum(keys(CONTACT_PREFS)), best_time: z.enum(keys(BEST_TIMES)).nullable().optional(),
    property_type: z.enum(keys(PROPERTY_TYPES)), occupancy: z.enum(keys(OCCUPANCY)).nullable().optional(),
    pets: z.string().trim().max(200).nullable().optional(), parking: z.string().trim().max(200).nullable().optional(),
    preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), decision_maker: z.boolean().nullable().optional(),
  }),
});

/** A plain-English reason for a ticket the schema refused. */
export function ticketError(e: z.ZodError): string {
  const at = String(e.issues[0]?.path[0] ?? "");
  return ["customer_consent", "customer_expects_contact"].includes(at) ? "Only send a ticket the customer asked for, and who knows we'll contact them."
    : at === "details" ? "Fill in how you know them, how to reach them and the type of property." : "Check the form";
}
