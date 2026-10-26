import { GOOGLE_MAPS_KEY } from "./config";

// Loads the Google Maps JavaScript API once, only when a map is first shown.
let loading: Promise<typeof google.maps> | undefined;
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY belum diatur"));
  if (typeof google !== "undefined" && google.maps?.Map) return Promise.resolve(google.maps);
  loading ??= new Promise((resolve, reject) => {
    const callback = "__guestbookMapsReady";
    (window as unknown as Record<string, unknown>)[callback] = () => resolve(google.maps);
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: GOOGLE_MAPS_KEY, callback, loading: "async", language: "id", region: "ID", v: "weekly" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Google Maps gagal dimuat"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
