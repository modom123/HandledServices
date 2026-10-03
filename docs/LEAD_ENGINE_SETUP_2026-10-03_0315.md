<!--
  FILE    : docs/LEAD_ENGINE_SETUP_2026-10-03_0315.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-03_0315 UTC
  PURPOSE : Step-by-step: turn on automatic pro recruiting (auto-invite + the pro lead engine) and
            create the keys it needs — Google Places, a separate outreach email domain, and the
            business postal address. About 30–45 minutes, plus 1–2 days for DNS / domain warm-up.
-->

# Turn on automatic pro recruiting

You'll do 5 things. Steps 2–4 need your own accounts (Google, a domain registrar, Resend, Vercel), so only you can do them. **Never paste API keys into chat or email.** Put them straight into Vercel.

## 1. Turn on auto-invite and the lead engine (2 minutes)

1. Supabase → your project → **SQL Editor** → New query.
2. If you haven't yet, run the new migrations (or the full `HANDLED_SETUP_*.sql` for a brand-new project).
3. Paste and run **`supabase/setup/TURN_ON_RECRUITING_2026-10-03_0315.sql`**. The last lines should show:
   - `autoInvite: true`
   - `enabled=t searches/day=10 emails/day=25`

What this turns on:
- **Auto-invite:** applicants the AI screen scores 70+ (and doesn't flag) get their setup link within minutes.
- **Auto-activate:** a pro goes live as soon as every step is verified.
- **Lead engine:** on for cleaning, handyman/carpentry, remodeling, plumbing and electrical, at 10 searches and 25 invitations a day.

Until the keys below are set, the lead engine does nothing harmful. It shows a "not fully set up" notice in the Hub.

## 2. Google Places API key — finds pros automatically (10 minutes)

1. Go to **console.cloud.google.com** and create a project (for example "Handled").
2. **Billing:** link a billing account. Google gives a monthly free credit, and at 10 searches a day you'll typically pay **$0–20 a month**.
3. **APIs & Services → Library** → search **"Places API (New)"** → **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key.**
5. Open the new key and lock it down:
   - **API restrictions → Restrict key → Places API (New) only.**
   - Application restrictions: **None.** The key is used from Vercel's servers, never in the browser.
6. Optional, recommended: **APIs & Services → Places API (New) → Quotas.** Cap requests per day at ~200, so a mistake can never run up a bill.
7. Copy the key for step 5 below.

## 3. A separate email domain for invitations (15 minutes, then 1–2 days of warm-up)

Cold invitations must **not** come from the domain that sends your booking confirmations and payment links. If a few recipients mark them as spam, that domain's reputation drops and customers stop getting receipts.

1. **Buy a second domain** that's clearly yours, for example `joinhandled.com` or `handledpros.com` (~$12/year at Cloudflare, Namecheap or Google Domains).
2. **Create a separate Resend account** for outreach at resend.com. It's free up to 3,000 emails a month.
   - Note: Resend's rules expect permission-based email. If they ever object to cold outreach, switch the sender to a cold-email tool (Instantly, Smartlead or Lemlist) and I'll change the code. The rest of the engine stays the same.
3. In that Resend account: **Domains → Add domain** → enter the new domain → add the DNS records it shows (SPF, DKIM, MX) at your registrar.
4. **Also add a DMARC record** (a TXT record named `_dmarc`): `v=DMARC1; p=none; rua=mailto:you@yourmaindomain.com`
5. Wait until Resend shows the domain as **Verified** (usually minutes, sometimes hours).
6. **API Keys → Create API key** (Sending access only, this domain only). Copy it for step 5.
7. **Set up replies:** create a mailbox that people's replies go to. A forwarding address like `pros@joinhandled.com` → your inbox works.
8. **Warm up:** send a few normal emails from the new address to people you know over 2–3 days before turning invitations on. The engine starts at 25 a day; raise it slowly (40 → 75 → 100) only if bounces stay under ~3% (watch Resend → Logs).

## 4. Your business postal address (2 minutes)

Federal law (CAN-SPAM) requires a real postal address in every commercial email. A PO box or a registered agent / virtual mailbox address is fine. It must actually receive mail.

## 5. Put the keys in Vercel (5 minutes)

Vercel → your project → **Settings → Environment Variables**. Add these for **Production** (and Preview, if you test there):

| Name | Value |
|---|---|
| `GOOGLE_PLACES_API_KEY` | the key from step 2 |
| `OUTREACH_RESEND_API_KEY` | the outreach Resend key from step 3 |
| `OUTREACH_FROM` | `Handled Pros <pros@joinhandled.com>` (your new domain) |
| `OUTREACH_REPLY_TO` | where replies should go, e.g. `pros@joinhandled.com` |
| `BUSINESS_POSTAL_ADDRESS` | e.g. `Handled Services LLC, PO Box 1234, Detroit, MI 48201` |

Then **Deployments → … → Redeploy** the latest production deployment. New variables only apply after a redeploy.

## 6. Check it

1. Hub → **Go-live setup**: "Lead engine: finding pros" and "Lead engine: invitations" should be green.
2. Hub → **Pro leads**: all three keys should show ✓.
3. Click **Run now**. Within a minute you should see leads found, with emails for some and phone-only leads on the call list. If outreach is set, the first invitations go out.
4. Send yourself a test: Hub → Pro leads → Import, with a 2-line CSV:
   ```
   business_name,contact_name,email,trade,city
   Test Cleaning Co,Your Name,your-own-email@example.com,cleaning,Detroit
   ```
   Then **Run now**. You'll get the first invitation. Check that the links, the Spanish link and the unsubscribe all work.

From then on it runs by itself on **weekdays at 10:30am Detroit time**. Applicants appear in Hub → **Recruiting**, credited to the lead or the Indeed post they came from.

## What it costs

| Item | Typical monthly cost |
|---|---|
| Google Places (10 searches/day) | $0–20 |
| Outreach domain | ~$1 |
| Resend outreach account | $0 up to 3,000 emails/month, then $20 |
| **Total** | **about $0–40 a month** |
