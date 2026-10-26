import { Asset } from "expo-asset";
import type { ReactNode } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { brandImageUrl, useSettings } from "../services/settings";
import { useTheme } from "../theme";
import { T } from "./ui";

const bundled = {
  background: require("../../assets/brand/bawaslu-background.jpg"),
  logo: require("../../assets/brand/bawaslu-logo.png"),
  sphere: require("../../assets/brand/bawaslu-sphere.webp"),
};
export const sphereUri = () => bundledUri(bundled.sphere);
const bundledUri = (module: number) => Asset.fromModule(module).uri;

export function useBrandBackground() {
  const { settings } = useSettings();
  return brandImageUrl(settings.background_path) ?? bundledUri(bundled.background);
}

// The site is web only, so the backdrop and logo are plain DOM elements.
export function Backdrop({ children }: { children: ReactNode }) {
  const c = useTheme();
  const { settings } = useSettings();
  const image = brandImageUrl(settings.background_path) ?? bundledUri(bundled.background);
  // Expo's web shell keeps the document itself unscrollable (body overflow hidden),
  // so pages scroll inside this ScrollView; the image layer fills the container behind it.
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <div
        data-testid="backdrop-image"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: c.background,
          backgroundImage: `url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "left top",
          backgroundRepeat: "no-repeat",
        }}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

// "pill" places the logo on a white capsule for dark grounds; "bare" is for white surfaces.
export function Logo({ width = 200, variant = "pill" }: { width?: number; variant?: "pill" | "bare" }) {
  const { settings } = useSettings();
  const src = brandImageUrl(settings.logo_path) ?? bundledUri(bundled.logo);
  const image = <img alt={settings.event_name} src={src} style={{ width, height: "auto", display: "block" }} />;
  if (variant === "bare") return image;
  return (
    <div
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        alignItems: "center",
        padding: `${Math.round(width * 0.06)}px ${Math.round(width * 0.1)}px`,
        borderRadius: 999,
        backgroundColor: "#ffffff",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
      }}
    >
      {image}
    </div>
  );
}

// The network sphere from the key visual. Its transparent glow sits on a soft navy
// halo so it reads as clearly as on the original artwork over any part of the backdrop.
export function Sphere({ width, testID }: { width: number; testID?: string }) {
  return (
    <div
      data-testid={testID}
      aria-hidden
      style={{
        width,
        flexShrink: 0,
        background: "radial-gradient(closest-side, rgba(0, 28, 72, 0.9), rgba(0, 28, 72, 0.55) 72%, rgba(0, 28, 72, 0))",
      }}
    >
      <img src={sphereUri()} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  );
}

export function EventHeader() {
  const c = useTheme();
  const { settings } = useSettings();
  const { width } = useWindowDimensions();
  // Logo on the left and the network sphere on the right, as in the key visual.
  const content = Math.min(width - 40, 560);
  const logoWidth = Math.min(170, Math.round(content * 0.46));
  const art = Math.min(210, content - Math.round(logoWidth * 1.2) - 12);
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ paddingTop: 8 }}>
          <Logo width={logoWidth} />
        </View>
        <Sphere width={art} testID="event-illustration" />
      </View>
      <View style={{ gap: 8 }}>
        <T size={34} weight="extra" color={c.onBackground} accessibilityRole="header" style={{ maxWidth: 520 }}>
          {settings.event_name}
        </T>
        <T size={16} color={c.onBackgroundMuted} style={{ maxWidth: 480 }}>
          {settings.welcome_text}
        </T>
      </View>
    </View>
  );
}
