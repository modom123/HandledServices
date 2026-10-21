/*
 * FILE    : apps/web/app/hub/social/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Hub → Social media: the AI's weekly Facebook / Instagram / TikTok calendar. Settings, then this week and next
 *           week, post by post: edit, add the photo, approve (it posts itself at its time on Facebook and Instagram),
 *           or post the TikTok video from the app and mark it posted. Recent results below.
 */
import { SOCIAL_CHANNELS, type SocialChannel } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { facebookReady, getSocialSettings, instagramReady, weekStart } from "@/lib/social";
import { Stat } from "@/components/ui";
import { SocialPostCard, SocialSettingsForm, type SocialPostRow } from "@/components/SocialAdmin";

export const dynamic = "force-dynamic";

export default async function Social() {
  const start = weekStart();
  const from = new Date(start.getTime() - 14 * 86400000), to = new Date(start.getTime() + 14 * 86400000);
  const [s, { data }] = await Promise.all([
    getSocialSettings(),
    adminClient().from("social_posts").select("*").gte("scheduled_for", from.toISOString()).lt("scheduled_for", to.toISOString()).order("scheduled_for").limit(500),
  ]);
  const posts = (data ?? []) as SocialPostRow[];
  const thisWeek = posts.filter((p) => new Date(p.scheduled_for) >= start && new Date(p.scheduled_for) < new Date(start.getTime() + 7 * 86400000));
  const nextWeek = posts.filter((p) => new Date(p.scheduled_for) >= new Date(start.getTime() + 7 * 86400000));
  const past = posts.filter((p) => new Date(p.scheduled_for) < start).reverse();
  const ready: Record<SocialChannel, boolean> = { facebook: facebookReady(), instagram: instagramReady(), tiktok: false };
  const week = (title: string, list: SocialPostRow[]) => (
    <section>
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {list.length ? <div className="grid gap-3 lg:grid-cols-2">{list.map((p) => <SocialPostCard key={p.id} p={p} />)}</div> : <p className="text-sm text-ink-soft">No posts yet — use “Write this week” / “Write next week” above.</p>}
    </section>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social media</h1>
        <p className="max-w-3xl text-sm text-ink-soft">The AI writes the week’s posts for Facebook, Instagram and TikTok: seasonal, local, rotating our services, each with a photo or video idea. You edit and approve; Facebook and Instagram post themselves at their time. TikTok is video, so post it from the TikTok app with the caption here and tap “Mark posted”. The AI never makes up reviews, results or offers, and only uses offers you write in Themes.</p>
        {!ready.facebook && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">Facebook / Instagram aren’t connected: set META_PAGE_ID, META_PAGE_ACCESS_TOKEN and META_IG_USER_ID in Vercel (see the omnichannel setup doc). Until then you can still write, approve and copy posts.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="This week" value={thisWeek.length} />
        <Stat label="Waiting for approval" value={posts.filter((p) => p.status === "draft").length} />
        <Stat label="Posted (2 weeks)" value={past.filter((p) => p.status === "posted").length} />
        <Stat label="Failed" value={posts.filter((p) => p.status === "failed").length} />
      </div>
      <section className="card"><h2 className="mb-3 text-lg font-bold">Settings</h2><SocialSettingsForm s={s} ready={ready} /></section>
      {week("This week", thisWeek)}
      {week("Next week", nextWeek)}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Last two weeks</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <tbody>{past.map((p) => <tr key={p.id} className="border-t border-line"><td className="p-3 text-xs">{new Date(p.scheduled_for).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td className="p-3 text-xs">{SOCIAL_CHANNELS[p.channel].label}</td><td className="p-3 text-xs">{p.caption.slice(0, 120)}</td><td className="p-3 text-xs">{p.status}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
