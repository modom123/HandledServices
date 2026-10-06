<!--
  FILE    : docs/MOBILE_APP_DEVICE_TEST_2026-10-06_0645.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-06_0645 UTC
  PURPOSE : What to check on a real iPhone and a real Android phone before each app release (v0.4.0+).
            The app builds and is type-checked and screen-tested automatically; these are the things only a
            real phone can prove: the keyboard, code autofill, push taps, the payment sheet, a lost signal.
  UPDATED : 2026-10-06_0708 UTC — v0.5.0: Apple Pay / Google Pay, live map, haptics, icon and splash.
-->

# Handled App: Real-Phone Test (10 minutes per phone)

Test on one iPhone and one Android phone, on a production build (TestFlight / internal testing track).

## Customer
1. **First open, signed out.** Home shows "What do you need done?", search, Snap / Ask, Popular in Metro Detroit, category chips. Tab bar: Home, Bookings, Account (no Pro tab).
2. **Search.** Type "lawn", then "limpieza" (Spanish word). Both find services. The ✕ clears the search.
3. **Sign in.** Account → Sign in. Enter an email → Send code. The code should autofill from the email or text notification (iOS) and sign you in the moment the 6th digit lands. Try "Use a different email" and "Resend code" (counts down from 30).
4. **Book.** Open House & Office Cleaning. Scroll: the price and the button stay pinned at the bottom. Tap into Street address, City, Email and Mobile. **The keyboard must never cover the field you're typing in.** Press the bottom button with fields empty: it lists what's missing and the fields turn red.
5. **Pay.** Complete a test booking. Stripe opens **inside the app** as a sheet; tap Done and you land on Bookings.
6. **Book again.** Start a second booking: name, email, phone and address are already filled in.
7. **Bookings tab.** Upcoming and Past sections; pull down to refresh; open a booking; the status updates live when it changes in the Hub.
8. **Spanish.** Switch to ES on Home. Tab labels, home, booking and sign-in are all in Spanish.

## Pro
9. Sign in as an approved pro with "I'm a pro": the **Pro** tab appears and opens on the Pro tab.
10. Go **on call 2h**. Send yourself an offer from the Hub: the phone rings (Android "offers" channel), **tapping the notification with the app closed opens the offer** (cold start), the countdown ticks, Accept works.
11. Tools grid opens Earnings, Calendar, Crew, Rewards, Setup & documents, Contracts. Payout setup opens in the in-app sheet.

## v0.5.0 additions
17. **Icon and splash.** The home-screen icon is the green check; opening the app shows the deep-green splash with the Handled check and wordmark.
18. **Apple Pay / Google Pay.** Book with Stripe test keys: after Pay & book a payment sheet slides up with Apple Pay (iPhone with a card in Wallet) or Google Pay, and card entry. Pay → "Paid ✓", the booking shows paid within seconds. Close the sheet instead → "Your booking is saved" with Pay now / Later.
19. **Pay now** on an unpaid booking opens the same sheet.
20. **Live map.** As a pro, tap "On my way" on today's job and drive (or walk) a block. As the customer, the booking shows a map with 🚗 and 🏠 that moves every ~15 s, plus the ETA. It disappears when the pro taps "I've arrived".
21. **Haptics.** Picking an option ticks; Pay & book taps; payment success, accepting an offer and signing in buzz; errors buzz differently.

## Bad conditions (the part that makes it world-class)
12. **Airplane mode**, then pull to refresh on Bookings and Pro: a plain "No connection… Try again" appears, never a blank or frozen screen. Turn the signal back on and tap Try again.
13. **Slow network** (iOS Settings → Developer → Network Link Conditioner "Very Bad Network"): booking shows a spinner and gives up with a clear message after 20 seconds instead of hanging.
14. **Old link**: open `handled://book/not-a-service`. A friendly "This service isn't available anymore" with a way back, no crash.
15. **Background and return** after 10 minutes: still signed in, data refreshes.
16. **Text size**: set the phone's text size to the largest. Buttons and the bottom bar still fit and work.

Anything that fails: note the phone model, OS version and the step number. Crashes also arrive in the Hub automatically.
