import { Asset } from "expo-asset";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { brandImageUrl, useSettings } from "../services/settings";
import { useTheme } from "../theme";
import { T } from "./ui";

const bundled = {
  background: require("../../assets/brand/bawaslu-background.jpg"),
  logo: require("../../assets/brand/bawaslu-logo.png"),
};
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

export function EventHeader() {
  const c = useTheme();
  const { settings } = useSettings();
  return (
    <View style={{ gap: 18, alignItems: "flex-start" }}>
      <Logo width={170} />
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
