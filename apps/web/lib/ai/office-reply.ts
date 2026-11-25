/*
 * FILE    : apps/web/lib/ai/office-reply.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-24_2345 UTC
 * PURPOSE : "✨ Draft with AI" in the Front Office inboxes (owner, 2026-11-24: write follow-ups with AI and send them from the
 *           same panel). Drafts a reply to one email as the office's person: plain text, short, no prices quoted (send
 *           the booking link or offer a free walkthrough instead), no promises we can't keep, no signature (the office
 *           signature is added on send). Staff always read and edit before sending; nothing is sent from here.
 * UPDATED : 2026-11-25_0200 UTC — asks for photos (price today) instead of offering a walkthrough first.
 */
import "server-only";
import { z } from "zod";
import { BRAND } from "@handled/core";
import { structured } from "./client";
import { siteUrl } from "../site-url";

const Draft = z.object({
  reply: z.string().describe("The reply body only: no subject line, no signature, plain text, short paragraphs"),
  note_for_staff: z.string().describe("One line for the person sending it: anything to check or fill in before sending, or empty"),
});

export async function draftOfficeReply(o: {
  sender: { name: string; title: string };
  inbox: string;
  email: { from: string; fromName: string | null; subject: string; text: string };
  lead?: { business_name: string | null; status: string | null } | null;
  instructions?: string | null;
}): Promise<{ reply: string; note: string } | null> {
  const site = siteUrl();
  const out = await structured({
    kind: "office_reply",
    schema: Draft,
    effort: "low",
    maxTokens: 2000,
    system: `You write email replies for ${o.sender.name}, ${o.sender.title} at ${BRAND.name}, a company that sends vetted, background-checked local pros for home and business services (cleaning, handyman and repairs, painting, lawn and snow, hauling and more) with upfront prices online and photos of every visit.
Write the reply body only, in plain text, warm and direct, usually 3–8 short sentences. Answer what they asked. Never quote a price or a discount: for a business, ask for a few photos so we can send their exact price today (or point them to ${site}/business/photo-quote); for a home, point them to ${site}/book. Offer a free walkthrough (${site}/walkthrough) only if they ask to meet. Never promise dates, pros or outcomes you can't confirm. Don't invent facts about them. If they asked to stop or aren't interested, thank them briefly and confirm we won't email again. No signature or sign-off name (it's added automatically). If something needs a human decision, say so in note_for_staff.`,
    content: `Inbox: ${o.inbox}
${o.lead ? `They're a business lead: ${o.lead.business_name ?? "unknown business"} (status: ${o.lead.status ?? "unknown"}).\n` : ""}From: ${o.email.fromName ? `${o.email.fromName} <${o.email.from}>` : o.email.from}
Subject: ${o.email.subject}

Their email:
${o.email.text.slice(0, 8000)}
${o.instructions?.trim() ? `\nWhat ${o.sender.name.split(" ")[0]} wants the reply to say: ${o.instructions.trim().slice(0, 1000)}` : ""}`,
  });
  return out ? { reply: out.reply.trim(), note: out.note_for_staff.trim() } : null;
}
