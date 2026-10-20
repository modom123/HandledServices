<!--
FILE    : docs/OMNICHANNEL_SETUP_2026-10-20_0100.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-10-20_0100 UTC
PURPOSE : Turn on omnichannel outreach: the Lead inbox (every channel, instant reply), ad conversion tracking, and the
          AI social calendar. What goes in Vercel, what to click in each platform, and what stays manual (the rules).
-->
# Omnichannel outreach: setup

| Piece | Where in the Hub | What it does |
|---|---|---|
| **1. Lead inbox + speed to lead** | 📥 Lead inbox & channels | Every lead from every channel in one list. Instant AI reply in seconds, a call alert, businesses on the Call desk, and a channel report (leads, speed, bookings, revenue) |
| **2. Conversion tracking** | (automatic) + Lead inbox → CSV | Meta, Google Ads and TikTok see every lead and booking, so they show your ads to people who book |
| **3. AI social calendar** | 📱 Social media | The AI writes the week's Facebook, Instagram and TikTok posts. You approve; Facebook and Instagram post themselves |

**First:** Supabase → SQL Editor → run `supabase/setup/ADD_OMNICHANNEL_2026-10-20_0100.sql`. Run the earlier `ADD_*` files from the 19th and 20th first if you haven't.

All settings below go in **Vercel → Settings → Environment Variables (Production)**, then **Redeploy**. Type the 🔒 ones into Vercel yourself, never into chat.

---

## 1. Lead inbox: connect each channel

### Website (already on)
- The **Contact** page now has a "Get a quote — we'll call you" form.
- The **website AI chat** saves its leads to the inbox too.
- The channel comes from how the visitor first arrived: an ad, Google, Yelp, Facebook and so on.

### Facebook & Instagram Lead Ads (direct from Meta)
| Variable | Value |
|---|---|
| `META_APP_SECRET` 🔒 | developers.facebook.com → your app → Settings → Basic → App secret |
| `META_VERIFY_TOKEN` 🔒 | any long random string you make up (16+ characters) |
| `META_PAGE_ACCESS_TOKEN` 🔒 | A **long-lived Page token** with `leads_retrieval`, `pages_manage_metadata`, `pages_show_list` and `pages_read_engagement`. Generate it in Graph API Explorer or Business Settings → System users |

Then, in the Meta app:
1. **Add product → Webhooks → Page.**
2. Callback URL: `https://YOUR-SITE/api/webhooks/meta-leads`. Verify token: the same `META_VERIFY_TOKEN`.
3. Subscribe to **leadgen**.
4. Connect your Page to the app (Page settings → Business integrations, or `POST /{page-id}/subscribed_apps`).
5. Test with Meta's **Lead Ads Testing Tool**.

Instagram lead ads are tagged Instagram; the rest are tagged Meta ads.

### Google Ads lead forms
| Variable | Value |
|---|---|
| `GOOGLE_LEAD_FORM_KEY` 🔒 | any long random string (16+ characters) |

In Google Ads, open the lead form asset → **Lead delivery** → Webhook:
- URL: `https://YOUR-SITE/api/webhooks/google-leads`
- Key: the same string
- Click **Send test data**.

### Yelp, TikTok, LinkedIn, Google Local Services, Angi, Thumbtack (through Zapier or Make)
| Variable | Value |
|---|---|
| `LEAD_INTAKE_SECRET` 🔒 | any long random string (16+ characters) |

In Zapier, for each source:
1. **Trigger:** the platform's "New lead". Options:
   - **Yelp:** Yelp for Business "New Request a Quote lead", or Yelp's email parser if your plan has no API.
   - **TikTok:** TikTok Lead Generation "New lead".
   - **LinkedIn:** LinkedIn Lead Gen Forms "New form response".
   - **Google Local Services:** use the LSA lead email parser.
2. **Action:** Webhooks by Zapier → **POST**:
   - URL: `https://YOUR-SITE/api/leads/intake?key=YOUR_LEAD_INTAKE_SECRET&channel=yelp`
   - Use `channel=` `yelp`, `tiktok_ads`, `linkedin`, `google_lsa`, `referral`, or whatever fits.
   - Payload type: JSON or form.
   - Data: map `name`, `email`, `phone`, `company`, `zip`, `message`, `lead_id`, and `campaign`.
3. Test it. The lead should show up in the Lead inbox within seconds.

Field names are flexible: `full_name`, `first_name` + `last_name`, and `phone_number` all work.

### What happens to every lead
1. **Duplicates are dropped.** That covers the same platform lead twice, or the same person within 24 hours.
2. **Instant reply within seconds.** The AI writes an email; the fixed template is used if the AI is off. It never quotes a price or a date. It gives the booking link and says a real person will call.
3. **A text goes out only if they agreed to texts.** That means the website consent box was ticked, or the lead form sent `sms_consent: yes`. That's the TCPA rule.
4. **An alert to call within 5 minutes,** with the AI's note on what they want.
5. **A business lead** (company given) also goes to **Business leads**, marked warm, at the top of today's **Call desk**.
6. The **channel report** shows, per channel: leads, % called within 5 minutes, leads booked, bookings by first touch, and revenue.

---

## 2. Conversion tracking

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | Events Manager → your pixel → ID (numbers) |
| `META_CAPI_TOKEN` 🔒 | Events Manager → pixel → Settings → **Conversions API → Generate access token** |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-XXXXXXXXX` (Google Ads → Goals → Conversions → your action → Tag setup) |
| `NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL` | the conversion label for "Booking" (the part after the slash in `send_to`) |
| `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL` | the label for a "Lead" conversion (optional) |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID` | TikTok Ads Manager → Assets → Events → Web events → pixel ID |
| `TIKTOK_EVENTS_TOKEN` 🔒 | the same pixel → Settings → **Events API → Generate access token** |
| `GOOGLE_ADS_CONVERSION_NAME` | optional. The exact name of your Google offline conversion action (default `Booking`) |

What gets sent:
- **Lead:** when someone sends the website form.
- **Purchase / CompletePayment:** when someone books. The browser event fires on the confirmation page and the server event fires from the booking itself. Both share the booking ref, so each platform counts it once.
- Emails and phone numbers are hashed before they're sent.
- Pixels only load on public pages, never in the Hub or the portals.

**Google Ads offline conversions:** Lead inbox → "Google Ads offline conversions (CSV)" downloads bookings from Google ad clicks (gclid) in Google's upload format. Upload it in Google Ads → Goals → Conversions → Uploads, weekly, or schedule it.

**Privacy policy:** add a line that the site uses Meta, Google and TikTok advertising pixels and conversion tools to measure ads, with a link to opt out (e.g. aboutads.info). Have counsel review it.

---

## 3. AI social calendar
| Variable | Value |
|---|---|
| `META_PAGE_ID` | your Facebook Page ID (Page → About → Page transparency, or Graph API Explorer) |
| `META_PAGE_ACCESS_TOKEN` 🔒 | the same long-lived Page token, plus `pages_manage_posts`, `instagram_basic` and `instagram_content_publish` |
| `META_IG_USER_ID` | the Instagram **business** account ID connected to the Page (Graph API Explorer: `/{page-id}?fields=instagram_business_account`) |

In **Hub → Social media**:
1. **Pick posts per week for each network.** Defaults: Facebook 3, Instagram 3, TikTok 2.
2. **Write your Themes:** areas you serve, seasonal pushes, and real offers and codes. The AI **only** uses offers written here.
3. Tick **"Write next week's posts every Monday"**, or click **Write this week** now.
4. **Each post** has a caption, hashtags, a photo or video idea, and a time. Edit it, then:
   - **Facebook:** approve. A photo link is optional; it posts itself at its time.
   - **Instagram:** paste a public photo link (https), then approve. It posts itself.
   - **TikTok:** film the video, copy the caption, post it from the TikTok app, then tap **Mark posted**. TikTok's API only allows direct posting for audited apps.
5. **Auto-publish** skips your approval. Leave it off until you trust the drafts.

Posts go out every 10 minutes through the dispatch cron (GitHub Action). Failures show the reason and can be retried.

---

## The rules this follows (and why some things stay manual)
- **Texts:** only to people who agreed to texts. No cold texts (TCPA). Every text says "Reply STOP to opt out."
- **Calls:** made by a person from the Call desk. No robocalls or AI voice calls to cell phones without consent.
- **LinkedIn:** no automated connection requests or messages (LinkedIn bans accounts for it). Lead Gen Forms through Zapier are fine.
- **Yelp:** never ask customers for Yelp reviews or offer anything for them (Yelp's rules). Ask for **Google** reviews, which the app already does after every job.
- **Social DMs:** no automated cold DMs on Facebook, Instagram or TikTok (their policies).
- **No made-up reviews, results or offers** in any AI-written text.
