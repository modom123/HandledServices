/*
 * FILE    : apps/mobile/lib/secure-storage.web.ts
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-06_0726 UTC
 * PURPOSE : Web build: no keychain in the browser, so the session uses the browser's storage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const secureStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
