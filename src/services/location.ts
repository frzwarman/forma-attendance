import * as Location from "expo-location";
import { acquireForegroundLocation } from "../domain/location";
import type { Coordinates,WorkLocation } from "../types";
export type LocationMode = "inside" | "outside" | "unavailable" | "real";
export async function acquireLocation(
  mode: LocationMode,
  office: WorkLocation,
): Promise<Coordinates> {
  if (mode === "unavailable")
    throw new Error(
      "Location is unavailable. Enable location services and try again.",
    );
  if (mode !== "real")
    return {
      latitude: office.latitude + (mode === "outside" ? 0.012 : 0.00022),
      longitude: office.longitude + 0.00012,
      accuracy: 8,
      simulated: true,
    };
  return acquireForegroundLocation({
    requestPermission: async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      return permission.status === "granted";
    },
    getPosition: async () => {
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return coords;
    },
  });
}
