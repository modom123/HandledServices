/*
 * FILE    : apps/mobile/app.config.js
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Fill store-facing links from the build environment instead of placeholders:
 *           privacy policy and terms come from EXPO_PUBLIC_API_URL (your website).
 * UPDATED : 2026-10-06_0708 UTC — Google Maps key for Android (GOOGLE_MAPS_ANDROID_API_KEY) for the live "pro on the way"
 *           map; extra.mapsAndroid tells the app whether it may show the map on Android (iOS uses Apple
 *           Maps, no key). Without the key Android shows the distance and ETA only, never a crash.
 */
module.exports = ({ config }) => {
  const site = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || "";
  return {
    ...config,
    android: {
      ...config.android,
      ...(mapsKey ? { config: { ...(config.android && config.android.config), googleMaps: { apiKey: mapsKey } } } : {}),
    },
    extra: {
      ...config.extra,
      mapsAndroid: Boolean(mapsKey),
      ...(site ? { privacyPolicyUrl: `${site}/privacy`, termsUrl: `${site}/terms/service-agreement` } : {}),
    },
  };
};
