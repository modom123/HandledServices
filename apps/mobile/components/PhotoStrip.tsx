/*
 * FILE    : apps/mobile/components/PhotoStrip.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-02_0201 UTC
 * PURPOSE : Photo capture for customers: Take photo (with "take another" for several shots in a
 *           row) or choose from the library, thumbnails with remove, and a count.
 */
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { pickAndUpload, type Shot } from "../lib/photos";
import { Button, C, s } from "./ui";

export function PhotoStrip({ shots, onChange, max = 8 }: { shots: Shot[]; onChange: (s: Shot[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false);
  async function grab(camera: boolean, current: Shot[]) {
    setBusy(true);
    const got = await pickAndUpload(camera, max - current.length);
    setBusy(false);
    const next = [...current, ...got];
    onChange(next);
    // several shots in a row without going back to the form
    if (camera && got.length && next.length < max)
      Alert.alert("Photo added", `${next.length} of ${max}. Take another?`, [{ text: "Done", style: "cancel" }, { text: "Take another", onPress: () => grab(true, next) }]);
  }
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="📷 Take photo" onPress={() => grab(true, shots)} busy={busy} disabled={shots.length >= max} style={{ flex: 1 }} />
        <Button title="🖼️ Library" kind="ghost" onPress={() => grab(false, shots)} disabled={busy || shots.length >= max} style={{ flex: 1 }} />
      </View>
      {shots.length > 0 && (
        <ScrollView horizontal style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
          {shots.map((p) => (
            <View key={p.path}>
              {p.uri ? <Image source={{ uri: p.uri }} style={{ width: 76, height: 76, borderRadius: 10 }} /> : <View style={{ width: 76, height: 76, borderRadius: 10, backgroundColor: C.line }} />}
              <Pressable accessibilityLabel="Remove photo" onPress={() => onChange(shots.filter((x) => x.path !== p.path))}
                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(11,27,43,0.7)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.white, fontSize: 14 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      <Text style={[s.p, { marginTop: 6 }]}>{shots.length}/{max} photos</Text>
    </View>
  );
}
