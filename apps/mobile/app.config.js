/*
 * FILE    : apps/mobile/app.config.js
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Fill store-facing links from the build environment instead of placeholders:
 *           privacy policy and terms come from EXPO_PUBLIC_API_URL (your website).
 * UPDATED : 2026-10-06_0708 UTC — Google Maps key for Android (GOOGLE_MAPS_ANDROID_API_KEY) for the live "pro on the way"
 *           map; extra.mapsAndroid tells the app whether it may show the map on Android (iOS uses Apple
 *           Maps, no key). Without the key Android shows the distance and ETA only, never a crash.
 * UPDATED : 2026-11-10_2130 UTC — store launch: the Expo project id can come from EAS_PROJECT_ID (push notifications need
 *           it); a production build stops with a clear message when EXPO_PUBLIC_API_URL / SUPABASE settings are missing,
 *           so a build that would open on "missing server settings" never reaches Apple review.
 */
module.exports = ({ config }) => {
  const site = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || "";
  const projectId = process.env.EAS_PROJECT_ID || (config.extra && config.extra.eas && config.extra.eas.projectId) || undefined;
  if (process.env.EAS_BUILD_PROFILE === "production") {
    const missing = ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"].filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`Production build is missing ${missing.join(", ")}. Add them with \`eas env:create --environment production\` (see docs/MOBILE_APP_STORE_LAUNCH_2026-11-10_2130.md).`);
    if (/localhost|your-app|example/.test(site)) throw new Error(`EXPO_PUBLIC_API_URL is "${site}". Set it to the live website (https://...).`);
  }
  return {
    ...config,
    android: {
      ...config.android,
      ...(mapsKey ? { config: { ...(config.android && config.android.config), googleMaps: { apiKey: mapsKey } } } : {}),
    },
    extra: {
      ...config.extra,
      mapsAndroid: Boolean(mapsKey),
      ...(projectId ? { eas: { ...(config.extra && config.extra.eas), projectId } } : {}),
      ...(site ? { privacyPolicyUrl: `${site}/privacy`, termsUrl: `${site}/terms/service-agreement` } : {}),
    },
  };
};
