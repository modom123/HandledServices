<!--
  FILE    : docs/MOBILE_APP_STORE_LAUNCH_2026-11-10_2130.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-10_2130 UTC
  PURPOSE : Going live with the Handled mobile app (v1.0.0): what was checked, the Apple (iPhone) build step by step,
            Google Play, and the App Store listing answers. Replaces the build steps in MOBILE_BUILD_2026-10-02_0310.md.
-->

# Handled app v1.0.0: going live on the App Store and Google Play

## What was checked on 2026-11-10

| Check | Result |
|---|---|
| TypeScript, the whole app | Passes |
| Production JavaScript bundle, iPhone and Android | Builds (5.3 MB iOS, 5.5 MB Android) |
| Native iPhone project (`expo prebuild`) | Builds: version 1.0.0, camera / photos / location messages, Apple privacy manifest |
| Expo Doctor | 19 of 21 pass; the 2 that "failed" only couldn't reach Expo's servers from the test machine |
| Every server call the app makes (45 endpoints) | All exist on the website |
| Delete my account inside the app (Apple and Google require it) | Yes: Account tab |
| Sign in | Email code only, so "Sign in with Apple" is **not** required |
| Payments | Stripe (cards, Apple Pay, Google Pay). Allowed: these are real-world services, not digital goods |

Fixed in this pass:
- Business & Technology in the app now matches the website: **free consultation, no price and no payment**. Before,
  it showed a price and a "Pay 25%" button.
- The fake `projectId` placeholder was removed (it would have broken `eas build`), and the version is now 1.0.0.
- Apple privacy manifest added (Apple rejects uploads without one).
- A production build now **refuses to build** if the server settings are missing, instead of shipping an app
  that opens on a "missing server settings" screen (an automatic App Store rejection).

What I could not do from here: run the builds on Expo's servers, sign them with your Apple account, or test on a
real phone. Those need your Expo and Apple logins, so they're the steps below.

## Before you start (one time)

- **Apple Developer Program**: $99 a year at developer.apple.com, enrolled as **Handled Services LLC** (an
  organization needs a D-U-N-S number, which is free and takes a few days). Enrolling as the company puts
  "Handled Services LLC" under the app name instead of your personal name.
- **Google Play Console**: $25 one time at play.google.com/console.
- **Expo account**: free at expo.dev.
- On your computer: Node.js, then `npm install -g eas-cli`.

## Step 1: Link the project (5 minutes)

From the `apps/mobile` folder:

```bash
npm install
```

```bash
eas login
```

```bash
eas init
```

`eas init` creates the Expo project and prints its project ID. If it says it can't write the ID because the
config is dynamic, add it to `app.json` under `expo.extra.eas.projectId` (or set `EAS_PROJECT_ID`), then commit.
Push notifications need this ID.

## Step 2: Server settings for the production build

The app needs three settings. Use the same values as the website's Vercel settings:

```bash
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://handledsvc.com --visibility plaintext
```

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
```

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-ANON-KEY --visibility plaintext
```

Use your real website address in the first one: it's also the privacy policy and terms links Apple checks.
Optional: `GOOGLE_MAPS_ANDROID_API_KEY` (live "pro on the way" map on Android; without it Android shows distance
and arrival time only).

## Step 3: The Apple (iPhone) build

```bash
eas build --platform ios --profile production
```

The first time, it asks you to sign in to your Apple account and answers "Yes" to creating everything itself:
the bundle ID `com.handled.app`, the distribution certificate, the provisioning profile, and the push
notification key. Let it. The build takes about 15–30 minutes on Expo's servers and gives you an `.ipa`.

**Apple Pay:** in the Apple Developer site → Identifiers → Merchant IDs, create `merchant.com.handled.app`. Then,
in the Stripe Dashboard → Settings → Payment methods → Apple Pay, upload the certificate request and finish
the setup. Card payments work without this step; only the Apple Pay button needs it.

Then send it to Apple:

```bash
eas submit --platform ios --latest
```

It shows up in **App Store Connect → TestFlight** in about 10–30 minutes. Install TestFlight on your iPhone and
test the app there before you send it for review.

## Step 4: The Android build

```bash
eas build --platform android --profile production
```

```bash
eas submit --platform android --latest
```

The first Google Play upload has to be done by hand: Play Console → create app → Testing → Internal testing →
upload the `.aab` file from the build page. After that, `eas submit` works (it asks for a Google service-account
key once).

**New personal Google Play accounts** have to run a closed test with 12 testers for 14 days before going public.
Organization accounts (Handled Services LLC with a D-U-N-S number) skip this.

## Step 5: Test on a real phone before review (from TestFlight / internal testing)

1. Sign in with an email code, as a customer.
2. Book a cleaning: see the price, name a lower price, and pay with a test card or Apple Pay.
3. Open a Business & Technology service: it should say "Free consultation", with no price.
4. Account → Delete my account: it works (use a test account).
5. Sign in as an approved pro → Pro tab → turn on "On call" → allow location → accept an offer.
6. Push notification: a new offer arrives while the app is closed.

## App Store listing answers (App Store Connect)

| Field | What to enter |
|---|---|
| Name | Handled |
| Subtitle (30) | Home & business services |
| Category | Lifestyle (secondary: Business) |
| Privacy policy URL | https://handledsvc.com/privacy |
| Support URL | https://handledsvc.com/contact |
| Age rating | 4+ (no objectionable content) |
| Price | Free |
| Sign-in for the reviewer | Give Apple a **test customer and a test pro account** in "App Review Information". Because sign-in is an email code, add a note telling them which inbox to use, or set up a reviewer account whose code you can read them |

**App Privacy ("nutrition label")**: data collected and linked to the user: contact info (name, email, phone,
address), precise location (pros only, while on call), photos, purchase history, user ID. Not used for
tracking. Encryption: the app already declares "standard encryption only", so no export paperwork is needed.

**Description (copy/paste):**

> Book cleaning, repairs, painting, lawn and snow, moving, hauling and 100+ more home and business services with
> upfront prices. Every pro is background-checked and vetted, work is checked with photos, and you pay 25% to
> book and the rest when it's done. Not right? Free redo or your money back within 30 days.
>
> Name your price, pick your day, and track your pro on the way. Business & Technology work (websites, AI,
> consulting) starts with a free video consultation.
>
> Handled pros: get job offers near you, run your schedule, and get paid every week, all from the same app.

## Common review rejections and how this app avoids them

- **Login wall without a test account** → give Apple test accounts (above).
- **No account deletion** → it's in the Account tab.
- **Placeholder or broken screens** → the production build can't be made without server settings.
- **Payments outside Apple for digital goods** → not this case: Handled sells real-world services, which may use Stripe.
- **Location without a reason** → the message explains it's only for pros while on call or on a job.

## After launch

App code changes need a new build (`eas build`, then `eas submit`); each build's number goes up automatically.
Raise `version` in `apps/mobile/app.json` (1.0.1, 1.1.0, ...) for each App Store release.
