import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Camera, FileText, SwitchCamera, Upload, X } from "../../components/icons";
import { Button, Row, T } from "../../components/ui";
import { ALLOWED_TYPES, UNSUPPORTED_FILE } from "../../services/uploads";
import { FONT_STACK, useTheme } from "../../theme";

function useObjectUrl(blob: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

function cameraMessage(cause: unknown) {
  const name = (cause as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, atau pilih berkas dari galeri.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Kamera tidak ditemukan di perangkat ini. Pilih berkas sebagai gantinya.";
  if (name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.";
  return "Kamera tidak dapat dibuka. Pilih berkas sebagai gantinya.";
}

// Live camera with capture, preview, retake and an explicit "use photo" step.
function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const c = useTheme();
  const video = useRef<HTMLVideoElement>(null);
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(supported ? "" : "Kamera hanya bisa dipakai lewat HTTPS. Pilih berkas sebagai gantinya.");
  const [shot, setShot] = useState<Blob | null>(null);
  const shotUrl = useObjectUrl(shot);

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        const element = video.current;
        if (!element) return;
        element.srcObject = media;
        element.onloadeddata = () => setReady(true);
        void element.play().catch(() => {});
      })
      .catch((cause) => {
        if (!cancelled) setError(cameraMessage(cause));
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing, supported]);

  function capture() {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    canvas.toBlob((blob) => blob && setShot(blob), "image/jpeg", 0.9);
  }

  const frame = { width: "100%", aspectRatio: "4 / 3", objectFit: "cover" as const, borderRadius: 12, backgroundColor: "#0b1220", display: "block" };
  return (
    <View style={{ gap: 12, padding: 12, borderRadius: 16, backgroundColor: c.ground, borderWidth: 1, borderColor: c.border }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T size={14} weight="semibold">
          {shot ? "Periksa foto" : "Arahkan kamera ke dokumen"}
        </T>
        <Button small variant="ghost" icon={X} label="Tutup kamera" onPress={onClose} />
      </Row>
      {!!error && (
        <T size={13} color={c.danger} accessibilityRole="alert">
          {error}
        </T>
      )}
      {!error && (
        <>
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            aria-label="Kamera"
            style={{ ...frame, display: shot ? "none" : "block", transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
          {shotUrl && <img src={shotUrl} alt="Pratinjau foto" style={frame} />}
          {shot ? (
            <Row style={{ gap: 10, flexWrap: "wrap" }}>
              <Button
                label="Gunakan foto"
                onPress={() => onCapture(new File([shot], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }))}
              />
              <Button variant="secondary" label="Ulangi" onPress={() => setShot(null)} />
            </Row>
          ) : (
            <Row style={{ gap: 10, flexWrap: "wrap" }}>
              <Button icon={Camera} label="Potret" disabled={!ready} onPress={capture} />
              <Button
                variant="secondary"
                icon={SwitchCamera}
                label="Ganti kamera"
                onPress={() => {
                  setReady(false);
                  setFacing(facing === "environment" ? "user" : "environment");
                }}
              />
            </Row>
          )}
        </>
      )}
    </View>
  );
}

// Supporting file: take a photo or choose an image/PDF; shows what is attached.
export function Attachment({
  file,
  error,
  onChange,
  onError,
}: {
  file: File | null;
  error: string;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
}) {
  const c = useTheme();
  const [camera, setCamera] = useState(false);
  const image = file && file.type.startsWith("image/") ? file : null;
  const thumbnail = useObjectUrl(image);
  const input = useRef<HTMLInputElement>(null);

  if (camera)
    return (
      <CameraCapture
        onClose={() => setCamera(false)}
        onCapture={(photo) => {
          setCamera(false);
          onChange(photo);
        }}
      />
    );

  return (
    <View style={{ gap: 10 }}>
      {file && (
        <Row style={{ gap: 12, padding: 10, borderRadius: 12, backgroundColor: c.ground }}>
          {thumbnail ? (
            <img src={thumbnail} alt="Foto terlampir" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", display: "block" }} />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
              <FileText size={22} color={c.muted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <T size={14} weight="semibold" numberOfLines={1}>
              {file.name}
            </T>
            <T size={12} color={c.muted}>
              {file.size < 1024 * 1024
                ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                : `${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`}
            </T>
          </View>
          <Button small variant="ghost" label="Hapus" onPress={() => onChange(null)} />
        </Row>
      )}
      <Row style={{ gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" icon={Camera} label="Ambil foto" onPress={() => setCamera(true)} />
        <label
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            minHeight: 46,
            padding: "0 20px",
            borderRadius: 999,
            border: `1px solid ${c.border}`,
            backgroundColor: c.surface,
            cursor: "pointer",
            fontFamily: FONT_STACK,
            fontWeight: 600,
            fontSize: 15,
            color: c.text,
            boxSizing: "border-box",
          }}
        >
          <Upload size={18} color={c.text} strokeWidth={2.2} />
          Pilih berkas
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            aria-label="Pilih berkas"
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;
              if (input.current) input.current.value = "";
              if (!chosen) return;
              if (!ALLOWED_TYPES.includes(chosen.type)) onError(UNSUPPORTED_FILE);
              else onChange(chosen);
            }}
            style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: "hidden" }}
          />
        </label>
      </Row>
      <T size={12} color={c.muted}>
        Gambar atau PDF, maksimal 5 MB.
      </T>
      {!!error && (
        <T size={12} color={c.danger} accessibilityRole="alert">
          {error}
        </T>
      )}
    </View>
  );
}
