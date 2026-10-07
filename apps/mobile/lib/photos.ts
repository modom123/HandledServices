/*
 * FILE    : apps/mobile/lib/photos.ts
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-02_0201 UTC
 * PURPOSE : Take or pick photos and upload them. iPhone photos come back as JPEG (not HEIC) so
 *           the AI price check can read them; quality 0.6 keeps uploads quick on cellular.
 */
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "./supabase";

export type Shot = { path: string; uri: string };

export async function pickAndUpload(camera: boolean, room: number): Promise<Shot[]> {
  if (room <= 0) { Alert.alert("Photos", "That's the most photos for one booking."); return []; }
  const opts = { quality: 0.6, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible } as const;
  let r: ImagePicker.ImagePickerResult;
  if (camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera", "Allow camera access in Settings to take photos — or choose from your library."); return []; }
    r = await ImagePicker.launchCameraAsync(opts);
  } else {
    r = await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room });
  }
  if (r.canceled) return [];
  const assets = r.assets.slice(0, room);
  const fd = new FormData();
  assets.forEach((a, i) => fd.append("photos", { uri: a.uri, name: `photo-${Date.now()}-${i}.jpg`, type: a.mimeType && a.mimeType !== "image/heic" ? a.mimeType : "image/jpeg" } as never));
  const up = await api<{ paths: string[]; error?: string }>("/api/uploads", { method: "POST", body: fd });
  if (!up.ok) { Alert.alert("Upload failed", up.data.error ?? "Check your connection and try again."); return []; }
  return up.data.paths.map((path, i) => ({ path, uri: assets[i]?.uri ?? "" }));
}
