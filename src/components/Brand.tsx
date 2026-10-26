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

export function Logo({ width = 220 }: { width?: number }) {
  const { settings } = useSettings();
  const src = brandImageUrl(settings.logo_path) ?? bundledUri(bundled.logo);
  return <img alt={settings.event_name} src={src} style={{ width, height: "auto", display: "block" }} />;
}

export function EventHeader() {
  const c = useTheme();
  const { settings } = useSettings();
  return (
    <View style={{ gap: 14, alignItems: "flex-start" }}>
      <Logo />
      <T size={26} weight="bold" color={c.onBackground} accessibilityRole="header">
        {settings.event_name}
      </T>
      <T color={c.onBackground}>{settings.welcome_text}</T>
    </View>
  );
}
