import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, Row, T } from "../../components/ui";
import { useTheme } from "../../theme";

export type Pin = { latitude: number; longitude: number };
const JAKARTA: L.LatLngTuple = [-6.2, 106.816667];
const UNAVAILABLE = "Lokasi tidak tersedia. Anda tetap bisa mengisi alamat.";

export function MapPicker({ value, onChange }: { value: Pin | null; onChange: (pin: Pin | null) => void }) {
  const c = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  function place(latitude: number, longitude: number, zoom?: number) {
    const current = map.current;
    if (!current) return;
    if (!marker.current) {
      marker.current = L.marker([latitude, longitude], {
        draggable: true,
        icon: L.divIcon({
          className: "guestbook-pin",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${c.accent};border:3px solid #fff;box-shadow:0 0 0 2px ${c.accent}"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(current);
      marker.current.on("dragend", () => {
        const position = marker.current!.getLatLng();
        latest.current({ latitude: position.lat, longitude: position.lng });
      });
    } else {
      marker.current.setLatLng([latitude, longitude]);
    }
    if (zoom) current.setView([latitude, longitude], zoom);
    latest.current({ latitude, longitude });
  }

  useEffect(() => {
    if (!container.current || map.current) return;
    const created = L.map(container.current, { center: JAKARTA, zoom: 11 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(created);
    created.on("click", (event: L.LeafletMouseEvent) => place(event.latlng.lat, event.latlng.lng));
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    setError("");
    if (!navigator.geolocation) return setError(UNAVAILABLE);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        place(position.coords.latitude, position.coords.longitude, 16);
      },
      () => {
        setLocating(false);
        setError(UNAVAILABLE);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <div
        ref={container}
        role="img"
        aria-label="Peta lokasi"
        style={{ height: 240, borderRadius: 12, overflow: "hidden", border: `1px solid ${c.border}` }}
      />
      <Row style={{ gap: 12, flexWrap: "wrap" }}>
        <Button small variant="secondary" label="Gunakan lokasi saya" loading={locating} loadingLabel="Mencari lokasi…" onPress={locate} />
        <T size={12} color={c.muted} style={{ flex: 1 }}>
          {value ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}` : "Ketuk peta untuk menandai lokasi (opsional)."}
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
