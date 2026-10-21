/*
 * FILE    : apps/web/lib/ai/social.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : The AI social writer: one post per slot for the week (Facebook, Instagram, TikTok), each with a caption in the
 *           network's voice, hashtags and a shot idea (what photo or short video to make). Seasonal Detroit-area angles,
 *           the services we push (cleaning first, then landscaping, painting, carpets, windows, construction, AI
 *           automation for businesses) and the owner's themes. Honest by rule: no made-up reviews, customers, results,
 *           prices or discounts unless the owner's themes state them.
 */
import "server-only";
import { z } from "zod";
import { BRAND, SERVICE_BY_SLUG, SOCIAL_CHANNELS, type SocialChannel } from "@handled/core";
import { structured } from "./client";

const Posts = z.object({
  posts: z.array(z.object({
    service_slug: z.string().nullable().describe("The catalog service this post promotes, or null"),
    caption: z.string().describe("The post text, in the network's voice, with one clear call to action (book at the website or call)"),
    hashtags: z.array(z.string()).max(30),
    media_idea: z.string().describe("The photo or short video to make for it: what to shoot, in one or two lines (for TikTok: a 15–30 second shot list)"),
  })),
});

export async function writeSocialWeek(slots: { channel: SocialChannel; when: string }[], o: { siteUrl: string; themes: string | null; recent: string[] }) {
  if (!slots.length) return [];
  const services = Object.values(SERVICE_BY_SLUG).map((s) => `${s.slug} — ${s.name}`).join("\n");
  const r = await structured({
    kind: "social_writer",
    schema: Posts,
    system:
      `You write ${BRAND.name}'s organic social posts. ${BRAND.pitch} We start in Detroit and its suburbs. ` +
      "Write exactly one post per slot, in the same order. Facebook: friendly, local, 40–90 words. Instagram: a hook line, 30–70 words, then hashtags. TikTok: a hook in the first line, under 40 words, the video does the work. " +
      `Rotate services across the week: cleaning (house, move-out, carpet, windows, office) most often, then landscaping and seasonal yard work, painting, construction and repairs, and AI automation for small businesses. Use the season and the date. Call to action: book at ${o.siteUrl} or call ${BRAND.supportPhone}. ` +
      "Never invent reviews, customer names, before/after results, statistics, prices, discounts or deadlines; only use offers that appear in the owner's themes. No fear-mongering. Mix tips (how to keep carpets clean, prep a rental for move-out), behind the scenes, and service spotlights. " +
      "Use local hashtags (#Detroit #MetroDetroit and the city) sparingly. Don't repeat recent captions.",
    content: JSON.stringify({
      slots: slots.map((s) => ({ network: SOCIAL_CHANNELS[s.channel].label, date: new Date(s.when).toDateString() })),
      owner_themes: o.themes ?? "none set",
      recent_captions: o.recent.slice(0, 20),
      services,
    }),
    effort: "medium",
    maxTokens: 8000,
  });
  return (r?.posts ?? []).slice(0, slots.length).map((p, i) => ({ ...p, channel: slots[i].channel, when: slots[i].when, service_slug: p.service_slug && SERVICE_BY_SLUG[p.service_slug] ? p.service_slug : null }));
}
