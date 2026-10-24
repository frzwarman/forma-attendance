import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
  Camera,
  CheckCheck,
  CircleAlert,
  Fingerprint,
  LocateFixed,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import {
  Badge,
  Button,
  Card,
  IconBox,
  Row,
  Sheet,
  T,
} from "../../components/ui";
import { geofence, time } from "../../domain/attendance";
import { useData } from "../../services/data";
import { acquireLocation, type LocationMode } from "../../services/location";
import { repository, uid } from "../../services/repository";
import { useTheme } from "../../theme";
import type { Coordinates } from "../../types";
export function AttendanceFlow({
  visible,
  onClose,
  type,
}: {
  visible: boolean;
  onClose: () => void;
  type: "in" | "out";
}) {
  const c = useTheme();
  const { db, employee, refresh } = useData();
  const office = db.locations.find((l) => l.id === employee.locationId)!;
  const [mode, setMode] = useState<LocationMode>("inside");
  const [coords, setCoords] = useState<Coordinates>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [selfie, setSelfie] = useState("");
  const [preview, setPreview] = useState("");
  const [camera, setCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const key = useRef(uid());
  const reduced = useReducedMotion();
  const result = coords
    ? geofence(coords, office, db.policy.maxAccuracy)
    : undefined;
  const close = () => {
    onClose();
    setCoords(undefined);
    setError("");
    setSuccess("");
    setSelfie("");
    setPreview("");
    setCamera(false);
    setCameraReady(false);
    key.current = uid();
  };
  async function locate() {
    setBusy(true);
    setError("");
    setCoords(undefined);
    try {
      setCoords(await acquireLocation(mode, office));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function startCamera() {
    setError("");
    setCameraReady(false);
    try {
      const p = permission?.granted ? permission : await requestPermission();
      if (!p.granted)
        throw new Error(
          "Camera permission was denied. Allow camera access in your browser or device settings.",
        );
      setCamera(true);
      setPreview("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function capture() {
    if (!cameraReady || busy) return;
    setBusy(true);
    setError("");
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      if (!shot) throw new Error("The camera is not ready. Try again.");
      setPreview(shot.uri);
      setCamera(false);
      setCameraReady(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!coords || camera || preview) return;
    setBusy(true);
    setError("");
    try {
      const session = await repository.submitAttendance({
        employeeId: employee.id,
        type,
        coordinates: coords,
        locationId: office.id,
        idempotencyKey: key.current,
        selfieReference: selfie || undefined,
      });
      await refresh();
      setSuccess(type === "in" ? session.clockIn! : session.clockOut!);
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={
        success
          ? "A moment, well marked."
          : type === "in"
            ? "Start your workday"
            : "Wrap up your workday"
      }
    >
      {success ? (
        <Animated.View
          entering={reduced ? undefined : ZoomIn.duration(300)}
          style={{ alignItems: "center", gap: 16, paddingVertical: 20 }}
        >
          <View
            style={{
              height: 87,
              width: 87,
              borderRadius: 44,
              backgroundColor: c.greenBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCheck size={40} color={c.green} />
          </View>
          <T size={25} weight="bold">
            {type === "in" ? "You’re checked in!" : "You’re checked out!"}
          </T>
          <T size={37} weight="bold" color={c.primaryText}>
            {time(success)}
          </T>
          <T color={c.muted}>{office.name}</T>
          <Badge
            label={
              coords?.simulated
                ? "Simulated attendance · demo only"
                : "GPS attendance recorded"
            }
            tone={coords?.simulated ? "amber" : "green"}
          />
          <T color={c.muted} style={{ textAlign: "center" }}>
            {type === "in"
              ? "A little focus. A lot of possibility. Have a good day."
              : "Thank you for showing up. Time to recharge."}
          </T>
          <Button
            label="Back to my day"
            onPress={close}
            style={{ alignSelf: "stretch" }}
          />
        </Animated.View>
      ) : (
        <>
          <T color={c.muted} size={12}>
            Verify your location before you clock {type}. Your location is only
            accessed for this action.
          </T>
          <Card style={{ padding: 16, backgroundColor: c.bg }}>
            <Row>
              <IconBox icon={MapPin} size={38} />
              <View style={{ flex: 1 }}>
                <T weight="bold" size={12}>
                  {office.name}
                </T>
                <T size={10} color={c.muted}>
                  {office.radius} m attendance zone
                </T>
              </View>
            </Row>
          </Card>
          <View style={{ gap: 10 }}>
            <T size={12} weight="semibold">
              Location source
            </T>
            <Row style={{ flexWrap: "wrap", gap: 7 }}>
              {(
                [
                  { key: "inside", label: "Demo: inside" },
                  { key: "outside", label: "Demo: outside" },
                  { key: "unavailable", label: "Unavailable" },
                  { key: "real", label: "Use real GPS" },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mode === item.key }}
                  onPress={() => {
                    setMode(item.key);
                    setCoords(undefined);
                    setError("");
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: mode === item.key ? c.primary : c.border,
                    borderRadius: 8,
                    backgroundColor: mode === item.key ? c.lavender : c.surface,
                  }}
                >
                  <T
                    size={10}
                    color={mode === item.key ? c.primaryText : c.muted}
                    weight="medium"
                  >
                    {item.label}
                  </T>
                </Pressable>
              ))}
            </Row>
            <T size={10} color={c.muted}>
              {mode === "real"
                ? "Use HTTPS or localhost for browser location access."
                : "Demo locations are simulated and do not verify real-world attendance."}
            </T>
          </View>
          <Button
            label={coords ? "Refresh location" : "Verify my location"}
            variant="secondary"
            icon={LocateFixed}
            onPress={locate}
            loading={busy && !camera}
          />
          {coords && result && (
            <Animated.View
              entering={reduced ? undefined : FadeIn.duration(180)}
            >
              <Card
                style={{
                  padding: 16,
                  backgroundColor:
                    result.status === "inside" ? c.greenBg : c.amberBg,
                  borderWidth: 0,
                  gap: 8,
                }}
              >
                <Row>
                  <ShieldCheck
                    size={20}
                    color={result.status === "inside" ? c.green : c.amber}
                  />
                  <T
                    size={13}
                    weight="bold"
                    color={result.status === "inside" ? c.green : c.amber}
                  >
                    {result.status === "inside"
                      ? "Location verified"
                      : result.status === "outside"
                        ? "Outside the attendance zone"
                        : "Location accuracy is uncertain"}
                  </T>
                </Row>
                <T size={11}>
                  You are {Math.round(result.distance)} meters from your office.
                </T>
                <T size={10} color={c.muted}>
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} ·
                  Accuracy ±{coords.accuracy.toFixed(0)} m
                </T>
                {coords.simulated && (
                  <Badge label="Simulated location" tone="amber" />
                )}
                {result.status !== "inside" && (
                  <T size={11} color={c.amber}>
                    Move inside the office zone and verify again. Attendance
                    cannot be submitted yet.
                  </T>
                )}
              </Card>
            </Animated.View>
          )}
          <View style={{ gap: 10 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T size={12} weight="semibold">
                Attendance selfie
              </T>
              <Badge
                label={db.policy.requireSelfie ? "Required" : "Optional"}
                tone="neutral"
              />
            </Row>
            <T size={10} color={c.muted}>
              Capture only. No facial recognition, identity matching, or
              liveness checks. Demo photos stay in memory.
            </T>
            {camera ? (
              <View style={{ gap: 10 }}>
                <View
                  style={{
                    height: 300,
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: c.bg,
                  }}
                >
                  <CameraView
                    ref={cameraRef}
                    facing="front"
                    mirror
                    onCameraReady={() => setCameraReady(true)}
                    onMountError={({ message }) => {
                      setCamera(false);
                      setCameraReady(false);
                      setError(
                        `Couldn’t start the camera. ${message} Check camera access and try again.`,
                      );
                    }}
                    style={{ flex: 1 }}
                  />
                  {!cameraReady && (
                    <View
                      style={{
                        position: "absolute",
                        inset: 0,
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: c.bg,
                      }}
                    >
                      <ActivityIndicator color={c.primary} />
                      <T size={12} color={c.muted}>
                        Starting camera…
                      </T>
                    </View>
                  )}
                </View>
                <Button
                  label="Capture selfie"
                  icon={Camera}
                  onPress={capture}
                  loading={busy}
                  disabled={!cameraReady}
                />
                <Button
                  label="Cancel camera"
                  variant="ghost"
                  onPress={() => {
                    setCamera(false);
                    setCameraReady(false);
                  }}
                />
              </View>
            ) : preview ? (
              <View style={{ gap: 13 }}>
                <Image
                  accessibilityLabel="Selfie preview"
                  source={{ uri: preview }}
                  contentFit="contain"
                  style={{
                    height: 300,
                    width: "100%",
                    borderRadius: 16,
                    backgroundColor: c.bg,
                  }}
                />
                <T size={12} weight="semibold">
                  Looking good? Use this photo for your attendance.
                </T>
                <Row>
                  <Button
                    label="Retake"
                    variant="secondary"
                    icon={RefreshCw}
                    onPress={startCamera}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Use photo"
                    icon={CheckCheck}
                    onPress={() => {
                      setSelfie(preview);
                      setPreview("");
                      setError("");
                    }}
                    style={{ flex: 1 }}
                  />
                </Row>
              </View>
            ) : selfie ? (
              <View style={{ gap: 13 }}>
                <Image
                  accessibilityLabel="Selected selfie"
                  source={{ uri: selfie }}
                  contentFit="contain"
                  style={{
                    height: 220,
                    width: "100%",
                    borderRadius: 16,
                    backgroundColor: c.bg,
                  }}
                />
                <Row style={{ justifyContent: "space-between" }}>
                  <Badge label="Selfie ready" tone="green" />
                  <Button
                    small
                    label="Retake"
                    variant="secondary"
                    icon={RefreshCw}
                    onPress={startCamera}
                  />
                </Row>
              </View>
            ) : (
              <Button
                label="Take a selfie"
                variant="secondary"
                icon={Camera}
                onPress={startCamera}
              />
            )}
          </View>
          {!!error && (
            <Row
              style={{
                backgroundColor: c.redBg,
                padding: 12,
                borderRadius: 10,
                alignItems: "flex-start",
              }}
            >
              <CircleAlert color={c.red} size={17} />
              <T color={c.red} size={11} style={{ flex: 1 }}>
                {error}
              </T>
            </Row>
          )}
          <Button
            label={`Confirm clock ${type}`}
            icon={Fingerprint}
            onPress={confirm}
            loading={busy}
            disabled={
              !coords ||
              camera ||
              !!preview ||
              result?.status !== "inside" ||
              (db.policy.requireSelfie && !selfie)
            }
          />
        </>
      )}
    </Sheet>
  );
}
