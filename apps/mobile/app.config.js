/*
 * FILE    : apps/mobile/app.config.js
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Fill store-facing links from the build environment instead of placeholders:
 *           privacy policy and terms come from EXPO_PUBLIC_API_URL (your website).
 */
module.exports = ({ config }) => {
  const site = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  return {
    ...config,
    extra: {
      ...config.extra,
      ...(site ? { privacyPolicyUrl: `${site}/privacy`, termsUrl: `${site}/terms/service-agreement` } : {}),
    },
  };
};
