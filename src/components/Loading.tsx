import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useFocusEffect, usePathname } from "expo-router";
import { NusantaraBackdrop, NusantaraLogo } from "./NusantaraBrand";
import { Card, Row, T } from "./ui";

const SectionReadyContext = createContext<(path: string) => void>(() => {});

// Expo's lazy route fallback is empty in production. Keep a skeleton visible
// until the focused route module has actually mounted, on every platform.
export function SectionContent({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const path = usePathname();
  const [readyPath, setReadyPath] = useState<string>();
  const ready = readyPath === path;
  return (
    <SectionReadyContext.Provider value={setReadyPath}>
      {!ready && <SectionLoading />}
      <View style={{ flex: fill ? 1 : undefined, display: ready ? "flex" : "none" }}>
        {children}
      </View>
    </SectionReadyContext.Provider>
  );
}

export function useSectionReady(path: string) {
  const onReady = useContext(SectionReadyContext);
  useFocusEffect(useCallback(() => { onReady(path); }, [onReady, path]));
}

export function LoadingStatus({ label }: { label: string }) {
  const c = useTheme();
  return (
    <Row accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} aria-busy style={{ gap: 9 }}>
      <ActivityIndicator size="small" color={c.primary} />
      <T size={12} color={c.muted}>{label}</T>
    </Row>
  );
}

export function SectionLoading({ label = "Loading section…" }: { label?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 18 }}>
      <LoadingStatus label={label} />
      {[160, 92, 92].map((height, index) => (
        <Card key={index} style={{ minHeight: height, gap: 16 }}>
          <View style={{ height: 12, width: "45%", backgroundColor: c.lavender, borderRadius: 4 }} />
          <View style={{ height: 20, width: index ? "65%" : "80%", backgroundColor: c.lavender, borderRadius: 4 }} />
        </Card>
      ))}
    </View>
  );
}

export function WorkspaceLoading({ label = "Loading workspace…" }: { label?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <NusantaraBackdrop>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", gap: 30 }}>
          <NusantaraLogo width={108} />
          <SectionLoading label={label} />
        </View>
      </ScrollView>
    </NusantaraBackdrop>
  );
}
