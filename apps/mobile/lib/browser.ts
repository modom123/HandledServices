/*
 * FILE    : apps/mobile/lib/browser.ts
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-06_0645 UTC
 * PURPOSE : Open payment pages (Stripe Checkout) in an in-app browser sheet, so paying never throws the
 *           customer out of the app; when the sheet closes they're back where they were. Falls back to
 *           the phone's browser if the sheet can't open.
 */
import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

export async function openInApp(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, controlsColor: "#0e7c66", dismissButtonStyle: "done" });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}
