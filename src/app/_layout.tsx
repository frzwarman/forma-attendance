import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../../global.css";
import { AppShell } from "../components/AppShell";
import { DataProvider } from "../services/data";
import { ThemeProvider } from "../theme";
import { SectionLoading, WorkspaceLoading } from "../components/Loading";
export function SuspenseFallback() {
  return <SectionLoading />;
}
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <DataProvider fallback={<WorkspaceLoading />}>
            <AppShell>
              <Slot />
            </AppShell>
          </DataProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
