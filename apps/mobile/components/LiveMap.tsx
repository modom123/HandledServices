/*
 * FILE    : apps/mobile/components/LiveMap.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-06_0708 UTC
 * PURPOSE : "Your pro is on the way" map, like a ride app: the pro (🚗) and your home (🏠), framed
 *           together and re-framed as the pro moves. Apple Maps on iPhone; Google Maps on Android
 *           only when the build has a Maps key (extra.mapsAndroid), otherwise nothing is drawn and the
 *           ETA text above still shows. Web builds use LiveMap.web.tsx (no map).
 */
import { useEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import MapView, { Marker, type LatLng } from "react-native-maps";
import { C } from "./ui";

export const mapsAvailable = Platform.OS === "ios" || Boolean((Constants.expoConfig?.extra as { mapsAndroid?: boolean } | undefined)?.mapsAndroid);

export function LiveMap({ pro, home, proLabel, homeLabel }: { pro: LatLng; home: LatLng; proLabel: string; homeLabel: string }) {
  const map = useRef<MapView>(null);
  useEffect(() => {
    const id = setTimeout(() => map.current?.fitToCoordinates([pro, home], { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }), 250);
    return () => clearTimeout(id);
  }, [pro.latitude, pro.longitude, home.latitude, home.longitude]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mapsAvailable) return null;
  return (
    <View style={{ height: 230, borderRadius: 16, overflow: "hidden", marginTop: 10, borderWidth: 1, borderColor: C.line }} accessibilityLabel={proLabel}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={{ latitude: (pro.latitude + home.latitude) / 2, longitude: (pro.longitude + home.longitude) / 2, latitudeDelta: Math.max(0.02, Math.abs(pro.latitude - home.latitude) * 2.2), longitudeDelta: Math.max(0.02, Math.abs(pro.longitude - home.longitude) * 2.2) }}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
      >
        <Marker coordinate={home} title={homeLabel} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 4, borderWidth: 2, borderColor: C.ink }}><Text style={{ fontSize: 20 }}>🏠</Text></View>
        </Marker>
        <Marker coordinate={pro} title={proLabel} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={{ backgroundColor: C.brand, borderRadius: 20, padding: 5, borderWidth: 2, borderColor: C.white }}><Text style={{ fontSize: 20 }}>🚗</Text></View>
        </Marker>
      </MapView>
    </View>
  );
}
