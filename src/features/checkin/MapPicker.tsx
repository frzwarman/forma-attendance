import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, Row, T } from "../../components/ui";
import { loadGoogleMaps } from "../../services/googleMaps";
import { useTheme } from "../../theme";

export type Pin = { latitude: number; longitude: number };
const JAKARTA = { lat: -6.2, lng: 106.816667 };
const LOCATION_UNAVAILABLE = "Lokasi tidak tersedia. Anda tetap bisa mengisi alamat.";
const MAP_UNAVAILABLE = "Peta tidak dapat dimuat. Anda tetap bisa mengisi alamat.";

// Google Maps with a draggable pin; the address and the pin both stay optional
// so the form keeps working when the map cannot load.
export function MapPicker({ value, onChange }: { value: Pin | null; onChange: (pin: Pin | null) => void }) {
  const c = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const latest = useRef(onChange);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    latest.current = onChange;
  });

  function place(latitude: number, longitude: number, zoom?: number) {
    latest.current({ latitude, longitude });
    const current = map.current;
    if (!current) return;
    const position = { lat: latitude, lng: longitude };
    if (!marker.current) {
      marker.current = new google.maps.Marker({ map: current, position, draggable: true, title: "Lokasi Anda" });
      marker.current.addListener("dragend", () => {
        const moved = marker.current?.getPosition();
        if (moved) latest.current({ latitude: moved.lat(), longitude: moved.lng() });
      });
    } else {
      marker.current.setPosition(position);
    }
    if (zoom) {
      current.setCenter(position);
      current.setZoom(zoom);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !container.current) return;
        const created = new maps.Map(container.current, {
          center: JAKARTA,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        created.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) place(event.latLng.lat(), event.latLng.lng());
        });
        map.current = created;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    setError("");
    if (!navigator.geolocation) return setError(LOCATION_UNAVAILABLE);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        place(position.coords.latitude, position.coords.longitude, 16);
      },
      () => {
        setLocating(false);
        setError(LOCATION_UNAVAILABLE);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {status !== "unavailable" && (
        <div
          ref={container}
          role="img"
          aria-label="Peta lokasi"
          style={{ height: 240, borderRadius: 12, overflow: "hidden", border: `1px solid ${c.border}`, backgroundColor: c.inputSurface }}
        />
      )}
      {status === "unavailable" && (
        <T size={13} color={c.muted}>
          {MAP_UNAVAILABLE}
        </T>
      )}
      <Row style={{ gap: 12, flexWrap: "wrap" }}>
        <Button small variant="secondary" label="Gunakan lokasi saya" loading={locating} loadingLabel="Mencari lokasi…" onPress={locate} />
        <T size={12} color={c.muted} style={{ flex: 1 }}>
          {value
            ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
            : status === "ready"
              ? "Ketuk peta untuk menandai lokasi (opsional)."
              : "Titik lokasi bersifat opsional."}
        </T>
      </Row>
      {!!error && (
        <T size={12} color={c.danger} accessibilityRole="alert">
          {error}
        </T>
      )}
    </View>
  );
}
