import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../../global.css";
import { AppShell } from "../components/AppShell";
import { DataProvider } from "../services/data";
import { ThemeProvider } from "../theme";
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
export default function RootLayout() {
  const loading = (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1D1B1A",
      }}
    >
      <ActivityIndicator color="#DBAF6D" />
    </View>
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <DataProvider fallback={loading}>
            <AppShell>
              <Slot />
            </AppShell>
          </DataProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
