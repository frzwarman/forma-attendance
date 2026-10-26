import "../../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card, T } from "../components/ui";
import { BAWASLU } from "../domain/theme";
import { settingsColors, useSettings } from "../services/settings";
import { CONFIG_ERROR, supabaseConfigured } from "../services/config";
import { ThemeProvider } from "../theme";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } });

function AppTheme({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  return <ThemeProvider colors={settingsColors(settings)}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  if (!supabaseConfigured())
    return (
      <ThemeProvider colors={BAWASLU}>
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <Card style={{ maxWidth: 480, width: "100%", alignSelf: "center" }}>
            <T accessibilityRole="alert">{CONFIG_ERROR}</T>
          </Card>
        </View>
      </ThemeProvider>
    );
  return (
    <QueryClientProvider client={client}>
      <AppTheme>
        <Slot />
      </AppTheme>
    </QueryClientProvider>
  );
}
